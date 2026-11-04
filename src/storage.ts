import {type Guide,type Run,clone} from './domain';
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
   q.onsuccess=()=>{const current=q.result as Guide|undefined;if(current&&current.revisionId!==expected){conflict=true;tx.abort()}else s.put(clone(g))};
   tx.oncomplete=()=>resolve();tx.onabort=tx.onerror=()=>reject(new StorageError(conflict?'This guide changed in another tab. Reload the library or save as a new copy.':'Guide was not saved. Browser storage may be full or unavailable. Keep editing or export a backup.'));
  });
 }
 async saveRun(r:Run):Promise<void>{
  const db=await this.open();return new Promise((resolve,reject)=>{const tx=db.transaction('runs','readwrite');tx.objectStore('runs').put(clone(r));tx.oncomplete=()=>resolve();tx.onabort=tx.onerror=()=>reject(new StorageError('Session was not saved. Browser storage may be full or unavailable. Export a handoff backup.'))});
 }
}

