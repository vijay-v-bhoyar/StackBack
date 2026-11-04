import './styles.css';
import {type Guide,type Run,type Card,type Package,clone,validateGuide,canReadDraft,requireGuide,readStoredRun,startRun,choose,stepBack,replay,parsePackage,encodePackage,MAX_FILE_BYTES} from './domain';
import {Store} from './storage';
import {sample,SAMPLE_ID} from './sample';
import {stackOutline,compareStacks} from './stack';

const store=new Store();
let guides:Guide[]=[],runs:Run[]=[],view:'library'|'editor'|'runner'|'stack'='library';
let draft:Guide|undefined,expectedRevision:string|undefined,currentRun:Run|undefined;
let savedRun:Run|undefined,stackGuide:Guide|undefined,stackCardId='';
let dirty=false,saveStatus='',error='',issues= [] as ReturnType<typeof validateGuide>,showHistory=false;
let offline='Preparing offline access',waiting:ServiceWorker|undefined;
let busy=false;
let lockedControls=new Map<HTMLInputElement|HTMLButtonElement|HTMLTextAreaElement|HTMLSelectElement,boolean>();
// Keep the hidden file input enabled so the locked Import button can open its native chooser.
function lockControls(){for(const n of document.querySelectorAll<HTMLInputElement|HTMLButtonElement|HTMLTextAreaElement|HTMLSelectElement>('button,input:not([type="file"]),textarea,select')){if(!lockedControls.has(n))lockedControls.set(n,n.disabled);n.disabled=true}}
const app=document.querySelector<HTMLDivElement>('#app')!;
function el<K extends keyof HTMLElementTagNameMap>(tag:K,attrs:Record<string,string>={},...children:(Node|string|undefined)[]):HTMLElementTagNameMap[K]{
 const n=document.createElement(tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,v);
 for(const c of children)if(c!==undefined)n.append(typeof c==='string'?document.createTextNode(c):c);
 return n;
}
function button(label:string,action:()=>void|Promise<unknown>,kind='secondary'):HTMLButtonElement{
 const n=el('button',{type:'button',class:kind},label);n.onclick=async()=>{
  if(busy)return;
  busy=true;lockedControls.clear();lockControls();
  try{await action()}catch(e){error=message(e);render()}finally{busy=false;for(const [n,disabled]of lockedControls)if(n.isConnected)n.disabled=disabled;lockedControls.clear();syncOffline()}
 };return n;
}
function message(e:unknown){return e instanceof Error?e.message:'The action could not be completed. Your saved records were not intentionally removed.'}
function stamp(s:string){return new Date(s).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'})}
function focusHeading(){requestAnimationFrame(()=>document.querySelector<HTMLElement>('main h1')?.focus())}
function updateStatus(){const n=document.querySelector('#save-status');if(n){n.textContent=saveStatus;n.className='save-status'+(dirty?' unsaved':'')}}
function changed(){dirty=true;const invalid=view==='editor'&&validateGuide(draft).length>0;saveStatus=invalid?'Not saved — save the draft locally. Correct its routes before exporting.':'Not saved — save your changes or export a backup.';updateStatus();if(view==='editor'){const start=document.querySelector<HTMLButtonElement>('#start-draft');if(start)start.disabled=invalid}}
function field(label:string,id:string,value:string,onChange:(s:string)=>void,max:number,multiline=false){
 const input=multiline?el('textarea',{id,maxlength:String(max)}):el('input',{id,type:'text',maxlength:String(max)});
 input.value=value;input.oninput=()=>{onChange(input.value);changed()};
 return el('div',{class:'field'},el('label',{for:id},label),input);
}
function picker(label:string,id:string,values:[string,string][],value:string,onChange:(v:string)=>void){
 const select=el('select',{id});for(const [v,t]of values)select.append(el('option',{value:v},t));select.value=value;select.onchange=()=>{onChange(select.value);changed()};
 return el('div',{class:'field'},el('label',{for:id},label),select);
}
async function refresh(){
 try{
  const rawGuides=await store.list<Guide>('guides'),rawRuns=await store.list<Run>('runs');
  guides=[];runs=[];let corrupt=0;
  for(const g of rawGuides){if(canReadDraft(g))guides.push(g);else corrupt++}
  for(const r of rawRuns){try{runs.push(readStoredRun(r))}catch{corrupt++}}
  if(!guides.some(g=>g.id===SAMPLE_ID)){const g=sample();await store.saveGuide(g);guides.unshift(g)}
  if(corrupt)error=corrupt+' local record(s) could not be read safely. Original data is retained in browser storage.';
 }catch(e){error=message(e);if(!guides.length)guides=[sample()]}
}
async function library(){
 if(dirty&&!confirm('Leave this view with unsaved changes? Save locally or export valid work before leaving if you need to keep it. Saved records remain.'))return;
 view='library';draft=undefined;currentRun=undefined;savedRun=undefined;dirty=false;saveStatus='';issues=[];error='';await refresh();render();focusHeading();
}
function edit(g?:Guide,copy=false){
 const base=g?clone(g):{id:crypto.randomUUID(),revisionId:crypto.randomUUID(),title:'Untitled guide',description:'',startCardId:'first',updatedAt:new Date().toISOString(),cards:[{id:'first',title:'First card',body:'Describe the next step.',kind:'terminal' as const,choices:[],outcome:'Complete'}]};
 expectedRevision=g&&!copy?g.revisionId:undefined;
 if(copy){base.id=crypto.randomUUID();base.revisionId=crypto.randomUUID();base.title=(base.title+' — copy').slice(0,100)}
 draft=base;view='editor';dirty=!g||copy;saveStatus=dirty?'Not saved — save your new guide.':'Loaded saved guide.';error='';issues=[];render();focusHeading();
}
async function saveDraft(asCopy=false):Promise<boolean>{
 if(!draft)return false;
 const candidate=clone(draft);if(asCopy){candidate.id=crypto.randomUUID();expectedRevision=undefined}
 candidate.revisionId=crypto.randomUUID();candidate.updatedAt=new Date().toISOString();
 saveStatus='Saving…';updateStatus();
 try{await store.saveGuide(candidate,expectedRevision);draft=candidate;expectedRevision=candidate.revisionId;dirty=false;saveStatus='Saved on this device · '+stamp(candidate.updatedAt);error='';guides=guides.filter(g=>g.id!==candidate.id);guides.push(clone(candidate));render();return true}
 catch(e){dirty=true;error=message(e);saveStatus=validateGuide(draft).length?'Not saved — keep this draft open and retry storage. Correct its routes before exporting.':'Not saved — keep editing, retry or export a backup.';render();return false}
}
async function persistRun(){
 if(!currentRun)return;
 saveStatus='Saving…';updateStatus();
 try{await store.saveRun(currentRun,savedRun);savedRun=clone(currentRun);dirty=false;saveStatus='Saved on this device · '+stamp(currentRun.updatedAt);error='';runs=runs.filter(r=>r.id!==currentRun!.id);runs.unshift(clone(currentRun))}
 catch(e){dirty=true;error=message(e);saveStatus=portableIssue(currentRun)?'Not saved — shorten the note to fit the portable handoff limit. The last saved checkpoint is unchanged.':error.includes('another tab')?'Not saved — session conflict with another tab. Export this work or save it as a new copy.':'Not saved — this session is temporary. Export a handoff backup.'}
}
function portableIssue(r:Run){try{encodePackage({kind:'stackback.handoff',schemaVersion:1,run:r});return ''}catch(e){return message(e)}}
async function begin(g:Guide){currentRun=startRun(g);savedRun=undefined;view='runner';draft=undefined;showHistory=false;error='';dirty=true;await persistRun();render();focusHeading()}
function resume(r:Run){currentRun=clone(r);savedRun=clone(r);replay(currentRun);view='runner';draft=undefined;showHistory=false;dirty=false;error='';saveStatus='Loaded saved session · '+stamp(r.updatedAt);render();focusHeading()}
async function saveSessionCopy(){if(!currentRun)return;const previous=currentRun,checkpoint=savedRun;currentRun=clone(previous);currentRun.sourceRunId=previous.sourceRunId||previous.id;currentRun.id=crypto.randomUUID();savedRun=undefined;await persistRun();if(dirty){currentRun=previous;savedRun=checkpoint}render()}
async function transition(kind:'choose'|'back',id=''){if(!currentRun)return;currentRun=kind==='choose'?choose(currentRun,id):stepBack(currentRun);dirty=true;await persistRun();render();focusHeading()}
function download(p:Package,name:string){const data=encodePackage(p),blob=new Blob([data],{type:'application/json'}),url=URL.createObjectURL(blob),a=el('a',{href:url,download:name});a.click();setTimeout(()=>URL.revokeObjectURL(url),2000)}
function exportGuide(g:Guide){download({kind:'stackback.guide',schemaVersion:1,guide:requireGuide(g)},'stackback-guide.json')}
function exportRun(){if(currentRun)download({kind:'stackback.handoff',schemaVersion:1,run:currentRun},'stackback-handoff.json')}
function render(){
 const file=el('input',{type:'file',accept:'.json,application/json',class:'file-control','aria-label':'Select a StackBack file'});
 file.onchange=async()=>{const f=file.files?.[0];if(!f)return;try{if(f.size>MAX_FILE_BYTES)throw new Error('File is larger than 1 MiB.');const parsed=parsePackage(await f.text());openImport(parsed)}catch(e){error=message(e);render()}finally{file.value=''}};
 const nav=el('nav',{'aria-label':'Main navigation',class:'topnav'},el('span',{class:'offline','data-testid':'offline-status'},offline),button('Library',library,'tertiary'),button('Import a file',()=>file.click(),'tertiary'));
 if(waiting)nav.append(button('Apply available update',applyUpdate,'tertiary'));
 const header=el('header',{},el('div',{class:'topbar'},el('div',{class:'brand'},el('span',{class:'monogram','aria-hidden':'true'},'SB'),el('span',{},'STACKBACK')),nav));
 const main=el('main',{class:'main',id:'main'});
 if(error)main.append(el('div',{class:'banner',role:'alert'},error));
 main.append(el('div',{id:'save-status',class:'save-status'+(dirty?' unsaved':''),role:'status','aria-live':'polite'},saveStatus));
  if(view==='library')renderLibrary(main);else if(view==='editor')renderEditor(main);else if(view==='stack')renderStack(main);else renderRunner(main);
 main.append(el('footer',{class:'footnote'},el('span',{},'Linked-card guides, brought back for handoffs.'),el('span',{},'Device only · No account · v0.1')));
 app.replaceChildren(header,file,main);
 if(busy)lockControls();
}
function heading(title:string){return el('h1',{tabindex:'-1'},title)}
function renderLibrary(main:HTMLElement){
 main.append(el('div',{class:'eyebrow'},'Your local workbench'),heading('Pick up the thread.'),el('p',{class:'intro'},'Build a guide. Follow the route. Hand over the context, not the guesswork.'),el('p',{class:'hint'},'Guides and sessions stay in this browser. Export files as backups; browser clearing or eviction can remove local data. Sample content is fictional.'));
 main.append(el('div',{class:'section-head'},el('h2',{},'Guide library'),button('Create guide',()=>edit(),'primary')));
 const grid=el('div',{class:'grid'});
 for(const g of guides){const invalid=validateGuide(g).length>0;const article=el('article',{class:'panel guide'},el('div',{},el('span',{class:'tag'},invalid?'Draft needs correction':g.id===SAMPLE_ID?'Fictional sample':'Your guide')),el('h2',{},g.title||'Untitled guide'),el('p',{},g.description||'A local branching guide.'),el('div',{class:'metadata'},g.cards.length+' cards · revision '+g.revisionId.slice(0,8)));
 const start=button('Start guide',()=>begin(g),'primary');start.disabled=invalid;
  const explore=button('Explore stack',()=>{stackGuide=clone(g);stackCardId=g.startCardId;view='stack';saveStatus='';error='';render();focusHeading()},'tertiary');explore.disabled=invalid;
  article.append(el('div',{class:'actions'},start,button(g.id===SAMPLE_ID?'Edit a copy':'Edit guide',()=>edit(g,g.id===SAMPLE_ID)),explore));
 if(g.id!==SAMPLE_ID)article.append(el('div',{class:'actions metadata'},button('Duplicate guide',()=>edit(g,true),'tertiary'),button('Export guide',()=>exportGuide(g),'tertiary')));
 grid.append(article)}
 main.append(grid,el('div',{class:'section-head'},el('h2',{},'Saved sessions'),el('span',{class:'muted'},'Return to the exact guide snapshot')));
 if(!runs.length)main.append(el('div',{class:'empty'},'No saved sessions yet. Start a guide to keep your place on this device.'));
  else{const sessionGrid=el('div',{class:'grid'});for(const r of [...runs].sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))){const state=replay(r),article=el('article',{class:'panel'},el('span',{class:'tag'},r.sourceRunId?'Imported copy':'Local session'),el('h3',{},r.guideSnapshot.title),el('p',{},state.current.title),el('p',{class:'metadata'},stamp(r.updatedAt)+' · '+r.id.slice(0,8)),button('Resume session',()=>resume(r),'primary'));if(portableIssue(r))article.append(el('span',{class:'tag amber'},'Over-capacity — shorten note to export'),el('p',{class:'hint'},'Your stored record is retained and can be resumed to shorten its note.'));sessionGrid.append(article)}main.append(sessionGrid)}
 main.append(el('details',{class:'panel',style:'margin-top:28px'},el('summary',{},'How local handoffs work'),el('ol',{class:'help-list'},el('li',{},'The guide author defines the route. StackBack follows those choices deterministically.'),el('li',{},'Each session keeps an immutable guide snapshot. Later guide edits do not rewrite an existing session.'),el('li',{},'Export a handoff file, transfer it yourself, then preview and import it as a new local copy.'),el('li',{},'Files are editable, unsigned and unencrypted. Avoid personal or sensitive notes.'),el('li',{},'Offline access needs one completed online preparation. Export backups before clearing browser data.'))));
}
function renderStack(main:HTMLElement){
 if(!stackGuide)return;const g=stackGuide,current=g.cards.find(c=>c.id===stackCardId)??g.cards[0];
 const show=(id:string)=>{stackCardId=id;render();requestAnimationFrame(()=>document.querySelector<HTMLElement>('#stack-card-title')?.focus())};
 main.append(el('div',{class:'eyebrow'},'Linked-card workbench'),heading(g.title+' · card stack'),el('p',{class:'hint'},'Stack preview — no session is being recorded.'),el('div',{class:'actions'},button('Start this stack',()=>begin(g),'primary'),button('Edit this stack',()=>{edit(g,g.id===SAMPLE_ID);requestAnimationFrame(()=>document.getElementById('title-'+current.id)?.focus())},'secondary')));
 const paper=el('section',{class:'paper stack-preview','aria-labelledby':'stack-card-title'},el('span',{class:'tag'},current.kind==='terminal'?'Outcome card':'Linked card'),el('h2',{id:'stack-card-title',tabindex:'-1'},current.title),el('p',{},current.body));
 for(const choice of current.choices)paper.append(button('Follow: '+choice.label,()=>show(choice.to),'choice'));
 if(current.kind==='terminal')paper.append(el('p',{class:'complete'},current.outcome));
 main.append(paper,el('h2',{},'Stack connections'),el('p',{class:'hint'},'Select any card to inspect it. Links show where each choice leads; starting a session keeps a separate frozen copy.'));
 const grid=el('section',{class:'stack-index','aria-label':'Card connection map'});
 for(const {card,depth}of stackOutline(g)){
  const node=el('article',{class:'stack-node'+(card.id===current.id?' selected':'')},el('span',{class:'eyebrow'},'Level '+(depth+1)+' · '+(card.kind==='terminal'?'Outcome':'Decision')),button('Open card: '+card.title,()=>show(card.id),'tertiary'));
  for(const choice of card.choices)node.append(el('p',{class:'hint'},choice.label+' → '+g.cards.find(c=>c.id===choice.to)!.title));
  grid.append(node);
 }main.append(grid);
}
function renderEditor(main:HTMLElement){
 if(!draft)return;const d=draft;
 main.append(el('div',{class:'eyebrow'},'Guide studio'),el('div',{class:'editor-head'},heading('Shape a guide.'),el('div',{class:'actions'},button('Save guide',()=>saveDraft(),'primary'),button('Save as new copy',()=>saveDraft(true),'tertiary'))));
 const body=el('div',{class:'editor-grid'}),form=el('div',{}),side=el('aside',{class:'panel validation','aria-label':'Guide validation'});
  form.append(el('div',{class:'panel'},field('Guide title','guide-title',d.title,v=>d.title=v,100),field('Guide description','guide-description',d.description,v=>d.description=v,500,true),picker('Start card','start-card',d.cards.map(c=>[c.id,c.title]),d.startCardId,v=>d.startCardId=v)));
  const map=el('details',{class:'panel'},el('summary',{},'Card stack map'));
  for(const {card,depth}of stackOutline(d))map.append(button((depth<0?'Unreachable':('Level '+(depth+1)))+' · '+(card.title||'Untitled card'),()=>{const field=document.getElementById('title-'+card.id);field?.scrollIntoView({block:'center'});field?.focus()},'tertiary'));
  form.append(map);
 d.cards.forEach((c,index)=>{
  const card=el('section',{class:'card-editor',id:'card-'+c.id},el('div',{class:'card-head'},el('h2',{},'Card '+(index+1)),button('Remove card '+(index+1),()=>{if(confirm('Remove this draft card? Links to it will need correction.')){d.cards=d.cards.filter(x=>x.id!==c.id);changed();render()}},'tertiary')));
  card.append(field('Card '+(index+1)+' title','title-'+c.id,c.title,v=>c.title=v,100),field('Card '+(index+1)+' body','body-'+c.id,c.body,v=>c.body=v,2000,true),picker('Card '+(index+1)+' type','kind-'+c.id,[['step','Step with choices'],['terminal','Terminal outcome']],c.kind,v=>{c.kind=v as Card['kind'];if(v==='terminal'){c.choices=[];c.outcome='Routing complete.'}else{delete c.outcome;c.choices=[]}render()}));
  if(c.kind==='terminal')card.append(field('Card '+(index+1)+' outcome','outcome-'+c.id,c.outcome||'',v=>c.outcome=v,200));
  else{
   c.choices.forEach((ch,i)=>{const row=el('div',{class:'choice-editor'},field('Choice '+(i+1)+' label','label-'+c.id+'-'+i,ch.label,v=>ch.label=v,120),picker('Choice '+(i+1)+' destination','dest-'+c.id+'-'+i,[['','Choose a destination'],...d.cards.map(x=>[x.id,x.title] as [string,string])],ch.to,v=>ch.to=v),button('Remove choice '+(i+1),()=>{c.choices.splice(i,1);changed();render()},'tertiary'));card.append(row)});
   const add=button('Add choice to card '+(index+1),()=>{c.choices.push({id:crypto.randomUUID(),label:'New choice',to:''});changed();render()},'tertiary');add.disabled=c.choices.length>=6;card.append(add);
  }form.append(card);
 });
 const addCard=button('Add card',()=>{d.cards.push({id:crypto.randomUUID(),title:'New card',body:'',kind:'terminal',choices:[],outcome:'Complete'});changed();render()},'secondary');addCard.disabled=d.cards.length>=100;form.append(addCard);
 side.append(el('span',{class:'eyebrow'},'Before you start'),el('h2',{},'Make every route clear.'),el('p',{class:'muted'},'Every card must be reachable. Every route ends at an explicit outcome.'),button('Validate guide',()=>{issues=validateGuide(d);error='';render();document.querySelector<HTMLElement>('#validation')?.focus()},'secondary'));
 const results=el('div',{id:'validation',tabindex:'-1',...(issues.length?{role:'alert'}:{})});
 if(issues.length){const ul=el('ul',{});for(const issue of issues){const item=el('li',{},issue.message);if(issue.cardId)item.append(button('Go to affected card',()=>document.getElementById('card-'+issue.cardId)?.scrollIntoView({block:'center'}),'tertiary'));ul.append(item)}results.append(ul)}
 else results.append(el('p',{class:'muted'},validateGuide(d).length?'Validate to see what needs correction.':'All routes are valid. Ready to preview.'));
 const start=button('Start this guide',async()=>{issues=validateGuide(d);if(issues.length){render();return}if(dirty&&!await saveDraft())return;await begin(draft!)},'primary');start.id='start-draft';start.disabled=validateGuide(d).length>0;
 side.append(results,el('div',{class:'actions'},start,button('Export guide',()=>exportGuide(d),'tertiary')),el('p',{class:'hint'},'Starting creates a separate session with this exact guide snapshot. Invalid drafts may be saved, but cannot start or export.'));
 body.append(form,side);main.append(body);
}
function renderRunner(main:HTMLElement){
 if(!currentRun)return;const r=currentRun,{path,current}=replay(r),g=r.guideSnapshot;
  main.append(el('div',{class:'revision'},el('span',{class:'tag'},r.sourceRunId?'Imported session copy':'Guided session'),el('span',{},g.title+' · snapshot '+g.revisionId.slice(0,8))),el('div',{class:'back-row actions'},button('Previous card',()=>transition('back'),'secondary'),button('Export handoff',exportRun,'tertiary')));
  if(dirty)main.append(button('Save session as new copy',saveSessionCopy,'tertiary'));
  if(portableIssue(r)&&!error)main.append(el('div',{class:'banner',role:'alert'},'This session is retained locally but exceeds the portable handoff limit. Shorten its note and save before exporting.'));
  const latest=guides.find(guide=>guide.id===g.id);
  if(latest&&latest.revisionId!==g.revisionId){
   const diff=compareStacks(g,latest),comparison=el('details',{class:'panel version-comparison','aria-label':'Guide version comparison'},el('summary',{},'Compare guide versions'),el('p',{},'This session remains on snapshot '+g.revisionId.slice(0,8)+'. Library revision '+latest.revisionId.slice(0,8)+' is separate.'));
   if(diff.guideDetailsChanged)comparison.append(el('p',{},'Guide title, description or start card changed.'));
   for(const change of diff.changes){const item=el('section',{},el('h3',{},change.kind+': '+(change.after?.title??change.before?.title)));for(const [label,card,guide]of [['Session snapshot',change.before,g],['Current library',change.after,latest]]as const)if(card)item.append(el('p',{},label+': '+card.title+' · '+card.body+' · '+(card.outcome??card.choices.map(ch=>ch.label+' → '+(guide.cards.find(c=>c.id===ch.to)?.title??'Removed card')).join('; '))));comparison.append(item)}
   if(!diff.guideDetailsChanged&&!diff.changes.length)comparison.append(el('p',{},'The revision changed; card contents are unchanged.'));
   main.append(el('p',{class:'version-notice'},'Library guide has a newer revision.'),comparison);
  }
 main.querySelectorAll<HTMLButtonElement>('button').forEach(b=>{if(b.textContent==='Previous card')b.disabled=path.length<2});
 const rail=el('aside',{class:'rail','aria-label':'Active route'},el('div',{class:'eyebrow'},'Active path'));
 const list=el('ol',{});for(const id of path)list.append(el('li',{class:id===current.id?'current':''},g.cards.find(c=>c.id===id)!.title));rail.append(list,el('p',{class:'hint'},'Earlier corrected choices remain in session history.'),button(showHistory?'Hide session history':'Show session history',()=>{showHistory=!showHistory;render()},'tertiary'));
 const paper=el('section',{class:'paper'},el('span',{class:'eyebrow'},current.kind==='terminal'?'Terminal outcome':'Next decision'),heading(current.title),el('p',{},current.body));
 for(const c of current.choices)paper.append(button(c.label,()=>transition('choose',c.id),'choice'));
 if(current.kind==='terminal')paper.append(el('p',{class:'complete'},current.outcome));
 const area=el('div',{class:'run-area'},paper,el('section',{class:'note-section'},field('Current handoff note','run-note',r.note,v=>{r.note=v;r.updatedAt=new Date().toISOString()},1000,true),button('Save note',async()=>{r.updatedAt=new Date().toISOString();await persistRun();render()},'secondary'),el('p',{class:'hint'},'Use benign notes only. The note, exact guide snapshot and history are included in an exported handoff. Files are unsigned and unencrypted.')));
 if(showHistory){const history=el('section',{class:'history','data-testid':'history'},el('h2',{},'Session history'),el('p',{class:'hint'},'This includes choices later corrected with Previous card. The active path is shown separately. Current note edits are not a complete note audit.')),ul=el('ol',{});
 for(const e of r.events){const from=g.cards.find(c=>c.id===e.from)!,to=g.cards.find(c=>c.id===e.to)!;ul.append(el('li',{},(e.kind==='back'?'Previous card':from.choices.find(c=>c.id===e.choiceId)!.label)+' → '+to.title+' · '+stamp(e.at)))}
 history.append(ul);area.append(history)}
 main.append(el('div',{class:'workbench'},rail,area));
}
function openImport(p:Package){
 const prior=document.activeElement as HTMLElement|null,dialog=el('dialog',{'aria-labelledby':'import-title'}),data=p.kind==='stackback.guide'?p.guide:p.run.guideSnapshot;
 dialog.append(el('h2',{id:'import-title'},'Preview your import'),el('span',{class:'tag'},p.kind==='stackback.guide'?'Guide file':'Handoff file'),el('h3',{},data.title),el('p',{},'Guide revision '+data.revisionId.slice(0,8)+' · '+data.cards.length+' cards'));
 if(p.kind==='stackback.handoff')dialog.append(el('p',{},'Current card: '+replay(p.run).current.title),el('p',{},'Current note:'),el('div',{class:'preview-note'},p.run.note||'(No note)'));
 dialog.append(el('p',{class:'hint'},'Import creates a distinct local copy. Existing guides and sessions stay unchanged. File contents are user-editable, not authenticated. Notes may contain information you choose to transfer.'));
 const localError=el('div',{});dialog.append(localError);
 const commit=button('Import as new copy',async()=>{
  if(dirty&&!confirm('Leave current unsaved work to import this copy? Export a backup before leaving if needed.'))return;
  commit.disabled=true;
  try{
   if(p.kind==='stackback.guide'){const g=clone(p.guide);g.id=crypto.randomUUID();g.revisionId=crypto.randomUUID();g.updatedAt=new Date().toISOString();await store.saveGuide(g);guides.push(g);dirty=false;dialog.close();edit(g)}
   else{const r=clone(p.run);r.sourceRunId=r.sourceRunId||r.id;r.id=crypto.randomUUID();await store.saveRun(r);runs.unshift(r);dirty=false;dialog.close();resume(r)}
  }catch(e){localError.replaceChildren(el('div',{class:'banner',role:'alert'},message(e)));commit.disabled=false}
 },'primary');
 dialog.append(el('div',{class:'actions'},commit,button('Cancel import',()=>dialog.close(),'secondary')));
 dialog.addEventListener('close',()=>{dialog.remove();if(prior?.isConnected)prior.focus()});document.body.append(dialog);dialog.showModal();
}
let applyingUpdate=false;
let reloading=false;
function reloadUpdated(){if(reloading)return;reloading=true;location.reload()}
async function applyUpdate(){
 if(dirty){error='Save your pending work before applying the update. Export a backup if storage is unavailable.';render();return}
 const worker=waiting;if(!worker)return;applyingUpdate=true;
 try{await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('The update did not activate. Your saved session remains available. Reload online to retry.')),10000);const check=()=>{if(worker.state==='activated'){clearTimeout(timer);resolve()}else if(worker.state==='redundant'){clearTimeout(timer);reject(new Error('The update could not activate. Your saved session remains available.'))}};worker.addEventListener('statechange',check);worker.postMessage('APPLY_UPDATE');check()});reloadUpdated()}
 catch(e){applyingUpdate=false;throw e}
}
function syncOffline(){const n=document.querySelector('[data-testid=offline-status]');if(n)n.textContent=offline;if(waiting&&!busy&&view==='library')render()}
function confirmOffline(worker:ServiceWorker){return new Promise<void>((resolve,reject)=>{
 const channel=new MessageChannel(),timer=setTimeout(()=>{channel.port1.close();reject(new Error('Offline cache verification timed out.'))},7000);
 channel.port1.onmessage=event=>{clearTimeout(timer);channel.port1.close();event.data?.ready===true?resolve():reject(new Error('The offline shell could not be prepared.'))};
 worker.postMessage('PREPARE_CACHE',[channel.port2]);
})}
async function prepareOffline(){
 if(!('serviceWorker'in navigator)){offline='Offline access unavailable';syncOffline();return}
 try{
   const reg=await navigator.serviceWorker.register(new URL('sw.js',document.baseURI));
  function update(){if(reg.waiting){waiting=reg.waiting;syncOffline()}}
  const ready=new Promise<void>((resolve,reject)=>{
   if(reg.active){resolve();return}
   const watch=()=>{const worker=reg.installing||reg.waiting;if(!worker){if(reg.active)resolve();return}const check=()=>{if(worker.state==='activated')resolve();if(worker.state==='redundant')reject(new Error('Offline installation failed.'))};worker.addEventListener('statechange',check);check()};
   watch();reg.addEventListener('updatefound',watch);
   setTimeout(()=>reject(new Error('Offline preparation timed out.')),15000);
  });
  update();reg.addEventListener('updatefound',()=>reg.installing?.addEventListener('statechange',update));
   await ready;if(!reg.active)throw new Error('No active offline worker.');await confirmOffline(reg.active);offline='Offline ready';syncOffline();
   navigator.serviceWorker.addEventListener('controllerchange',()=>{if(applyingUpdate)reloadUpdated();else if(navigator.serviceWorker.controller){offline='Preparing offline access';syncOffline();void confirmOffline(navigator.serviceWorker.controller).then(()=>{offline='Offline ready';syncOffline()},()=>{offline='Offline not prepared — reload online to retry';syncOffline()})}});
 }catch{offline='Offline not prepared — reload online to retry';syncOffline()}
}
window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue=''}});
await refresh();render();void prepareOffline();

