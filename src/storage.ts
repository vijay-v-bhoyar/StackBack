import {type Guide,type Run,clone,MAX_FILE_BYTES} from './domain';
export class StorageError extends Error {}
export class Store {
 private db?:Promise<IDBDatabase>;
 private open():Promise<IDBDatabase>{
  return this.db??=new Promise((resolve,reject)=>{
   let request:IDBOpenDBRequest;
   try{request=indexedDB.open('stackback-v1',1)}catch{reject(new StorageError('Browser storage is unavailable. Work is temporary; export a backup.'));return}
   request.onupgradeneeded=()=>{const db=request.result;for(const name of ['guides','runs'])if(!db.objectStoreNames.contains(name))db.createObjectStore(name,{keyPath:'id'})};
   request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>db.close();resolve(db)};
   request.onerror=()=>reject(new StorageError('Browser storage could not be opened. Work is temporary; export a backup.'));
   request.onblocked=()=>reject(new StorageError('Close older StackBack tabs to open browser storage.'));
  });
 }
 async list<T extends Guide|Run>(name:'guides'|'runs'):Promise<T[]>{
  const db=await this.open();return new Promise((resolve,reject)=>{const tx=db.transaction(name,'readonly');const q=tx.objectStore(name).getAll();let rows:T[]=[];q.onsuccess=()=>rows=q.result;tx.oncomplete=()=>resolve(clone(rows));tx.onabort=tx.onerror=()=>reject(new StorageError('Could not read browser storage.'))});
 }
 async saveGuide(g:Guide,expected?:string):Promise<void>{
  const db=await this.open();return new Promise((resolve,reject)=>{
   const tx=db.transaction('guides','readwrite'),s=tx.objectStore('guides'),q=s.get(g.id);let conflict=false;
   q.onsuccess=()=>{const current=q.result as Guide|undefined;if(expected===undefined?current!==undefined:!current||current.revisionId!==expected){conflict=true;tx.abort()}else s.put(clone(g))};
   tx.oncomplete=()=>resolve();tx.onabort=tx.onerror=()=>reject(new StorageError(conflict?'This guide changed in another tab. Reload the library or save as a new copy.':'Guide was not saved. Browser storage may be full or unavailable. Keep editing or export a backup.'));
  });
 }
 async removeGuide(g:Guide):Promise<void>{return this.remove('guides',g)}
 async removeRun(r:Run):Promise<void>{return this.remove('runs',r)}
 private async remove(name:'guides'|'runs',expected:Guide|Run):Promise<void>{
  const db=await this.open();return new Promise((resolve,reject)=>{
   const tx=db.transaction(name,'readwrite'),s=tx.objectStore(name),q=s.get(expected.id);let conflict=false;
   q.onsuccess=()=>{const current=q.result as Guide|Run|undefined;
    const matches=current&&(name==='guides'?(current as Guide).revisionId===(expected as Guide).revisionId:JSON.stringify(current)===JSON.stringify(expected));
    if(!matches){conflict=true;tx.abort();return}s.delete(expected.id);
   };
   tx.oncomplete=()=>resolve();tx.onabort=tx.onerror=()=>reject(new StorageError(conflict?'This record changed or was removed in another tab. Reload the library before deleting.':'The record was not deleted. Browser storage may be unavailable. Reload and retry.'));
  });
 }
 async saveRun(r:Run,expected?:Run):Promise<void>{
  // Pre-transaction canonical portability check.
  // Must NOT call encodePackage (that calls parsePackage which would add the
  // canonical check again — no infinite recursion in practice, but avoid the
  // extra parse/validate round-trip). Use JSON.stringify + TextEncoder directly.
  const canonical=JSON.stringify({kind:'stackback.handoff',schemaVersion:1,run:r},null,2);
  if(new TextEncoder().encode(canonical).byteLength>MAX_FILE_BYTES){
   throw new StorageError('Not saved — shorten the note to fit the portable handoff limit. The last saved checkpoint is unchanged.');
  }
  const db=await this.open();return new Promise((resolve,reject)=>{
   const tx=db.transaction('runs','readwrite'),store=tx.objectStore('runs'),q=store.get(r.id);
   let conflict=false;
   q.onsuccess=()=>{
    const current=q.result as Run|undefined;
    if(expected===undefined){
     // create / import path — expect no existing record (fresh UUID).
     if(current!==undefined){conflict=true;tx.abort();return}
    }else{
     // update path — expect a specific existing record.
     // Use compact JSON.stringify for full structural comparison.
     // Do NOT require canonical portability of the stored old record;
     // over-capacity legacy records are valid checkpoints for conflict detection.
     if(current===undefined||JSON.stringify(current)!==JSON.stringify(expected)){conflict=true;tx.abort();return}
    }
    store.put(clone(r));
   };
   tx.oncomplete=()=>resolve();
   tx.onabort=tx.onerror=()=>reject(new StorageError(conflict?'Session conflict: this session was changed in another tab.':'Session was not saved. Browser storage may be full or unavailable. Export a handoff backup.'));
  });
 }
}
