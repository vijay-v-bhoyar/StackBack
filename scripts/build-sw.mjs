import {readdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
async function walk(dir){const all=[];for(const e of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())all.push(...await walk(p));else if(e.name!=='sw.js')all.push(p)}return all}
const template=await readFile('src/sw-template.js','utf8');
const files=(await walk('dist')).sort();const hash=createHash('sha256').update(template);for(const f of files)hash.update(await readFile(f));
const name='stackback-'+hash.digest('hex').slice(0,16);
const assets=files.map(f=>'./'+path.relative('dist',f).split(path.sep).join('/'));
await writeFile('dist/sw.js','const CACHE_NAME='+JSON.stringify(name)+';\nconst ASSETS='+JSON.stringify(assets)+';\n'+template);
console.log('Offline shell:',name,assets.length,'assets');

