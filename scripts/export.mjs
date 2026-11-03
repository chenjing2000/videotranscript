import {readFile,copyFile,mkdir,rm,stat} from 'node:fs/promises';
import path from 'node:path';import os from 'node:os';import {execFileSync} from 'node:child_process';import{fileURLToPath}from'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
function getArg(name){const i=process.argv.indexOf(`--${name}`);return i<0?undefined:process.argv[i+1]}
const video=getArg('video'),json=getArg('json'),output=getArg('out'),projectPath=getArg('project');
if(!video||!json||!output){console.error('Usage: npm run export -- --video INPUT.mp4 --json INPUT.json --out OUTPUT.mp4 [--project EDITS.evr.json]');process.exit(2)}
let staged=false;const filename='__export_input.mp4';const stagedFile=path.join(root,'public',filename);
try{
 const input=JSON.parse(await readFile(json,'utf8'));
 if(!Array.isArray(input.segments))throw new Error('Invalid WhisperX JSON');
 const project=projectPath?JSON.parse(await readFile(projectPath,'utf8')):undefined;
 const probe=getArg('ffprobe')||'ffprobe';
 const metadata=JSON.parse(execFileSync(probe,['-v','quiet','-show_entries','format=duration:stream=width,height,codec_type','-of','json',video],{encoding:'utf8'}));
 const v=metadata.streams.find(s=>s.codec_type==='video');if(!v)throw new Error('Input has no video stream');
 const durationSec=Number(metadata.format.duration);if(!(durationSec>0))throw new Error('Invalid video duration');
 const videoHeight=Math.round(1200*v.height/v.width);
 if(videoHeight>=1600)throw new Error('Video height leaves no reading panel; choose a wider source video');
 if(path.resolve(video)===path.resolve(output)||path.resolve(json)===path.resolve(output)|| (projectPath&&path.resolve(projectPath)===path.resolve(output)))throw new Error('Output cannot overwrite source assets or project');
 await stat(output).then(()=>{throw new Error('Output already exists; choose a new filename')},e=>{if(e?.code!=='ENOENT')throw e});
 await mkdir(path.dirname(output),{recursive:true});await mkdir(path.join(root,'public'),{recursive:true});
 await stat(stagedFile).then(()=>{throw new Error('Another export may be running: staging file already exists')},e=>{if(e?.code!=='ENOENT')throw e});
 await copyFile(video,stagedFile);staged=true;
 const{bundle}=await import('@remotion/bundler');const{getCompositions,renderMedia}=await import('@remotion/renderer');
 const inputProps={transcript:input,project,videoHeight,videoFile:filename,durationSec};
 console.log('Bundling Remotion...');const bundleLocation=await bundle({entryPoint:path.join(root,'src/remotion/index.ts'),onProgress:p=>console.log(`bundle ${Math.round(p*100)}%`)});
 const comps=await getCompositions(bundleLocation,{inputProps});const composition=comps.find(c=>c.id==='EnglishReader');if(!composition)throw new Error('Missing composition');
 console.log('Rendering...');await renderMedia({composition,serveUrl:bundleLocation,codec:'h264',outputLocation:output,inputProps,crf:18,onProgress:({progress})=>{process.stdout.write(`\rrender ${Math.round(progress*100)}%`)}});
 console.log(`\nExport succeeded: ${output}`);
}catch(e){console.error('\nExport failed:',e);process.exitCode=1;}finally{if(staged)await rm(stagedFile,{force:true})}
