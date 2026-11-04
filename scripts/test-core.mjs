/** Portable test entrypoint: compile core TS into CommonJS before Node tests.
 * Works from npm on Windows PowerShell/CMD without shell glob expansion. */
import {readdirSync, mkdirSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const tsc=require.resolve('typescript/bin/tsc');
const core=resolve('src/core');
const sources=readdirSync(core).filter(name=>name.endsWith('.ts')).map(name=>resolve(core,name));
if(!sources.length)throw new Error('No core TypeScript files found');
mkdirSync('.tmp-core',{recursive:true});
function run(args){
 const result=spawnSync(process.execPath,args,{stdio:'inherit',shell:false});
 if(result.error)throw result.error;
 if(result.status!==0)process.exit(result.status??1);
}
run([tsc,'--target','ES2022','--module','commonjs','--strict','--skipLibCheck','--outDir','.tmp-core',...sources]);
writeFileSync('.tmp-core/package.json',JSON.stringify({type:'commonjs'}));
const tests=readdirSync('tests').filter(name=>name.endsWith('.test.mjs')).map(name=>resolve('tests',name));
run(['--test',...tests]);
