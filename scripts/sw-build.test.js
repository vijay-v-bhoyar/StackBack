import {it,expect} from 'vitest';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

it('changes the shell cache identity when only the worker implementation changes',()=>{
 const folder=mkdtempSync(path.join(tmpdir(),'StackBack-worker-build-'));
 try{
  mkdirSync(path.join(folder,'dist'));mkdirSync(path.join(folder,'src'));
  writeFileSync(path.join(folder,'dist/index.html'),'<title>Immutable build fixture</title>');
  const template=readFileSync('src/sw-template.js','utf8');writeFileSync(path.join(folder,'src/sw-template.js'),template);
  const build=()=>{execFileSync(process.execPath,[path.resolve('scripts/build-sw.mjs')],{cwd:folder});return readFileSync(path.join(folder,'dist/sw.js'),'utf8').match(/const CACHE_NAME="([^"]+)"/)[1]};
  const before=build();writeFileSync(path.join(folder,'src/sw-template.js'),template+'\n// Distinct worker-only fixture version.\n');expect(build()).not.toBe(before);
 }finally{
  if(path.dirname(path.resolve(folder))!==path.resolve(tmpdir())||!path.basename(folder).startsWith('StackBack-worker-build-'))throw new Error('Unexpected fixture cleanup path');
  rmSync(folder,{recursive:true});
 }
});
