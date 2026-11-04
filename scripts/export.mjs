import {readFile,copyFile,mkdir,mkdtemp,rm,stat} from 'node:fs/promises';
import path from 'node:path';import os from 'node:os';import{createHash}from'node:crypto';import {execFileSync} from 'node:child_process';import{fileURLToPath}from'node:url';import {assertEvrTranscript} from './evr-contract.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
function getArg(name){const i=process.argv.indexOf(`--${name}`);return i<0?undefined:process.argv[i+1]}
const video=getArg('video'),json=getArg('json'),output=getArg('out'),projectPath=getArg('project');
if(!video||!json||!output){console.error('Usage: npm run export -- --video INPUT.mp4 --json INPUT.json --out OUTPUT.mp4 [--project EDITS.evr.json]');process.exit(2)}
let publicDir;
let bundleLocation;
const filename = '__export_input.mp4';
try{
 const subtitleBytes=await readFile(json);
 const input=JSON.parse(subtitleBytes.toString('utf8').replace(/^\uFEFF/,''));
 assertEvrTranscript(input);
 if(path.basename(json).toLowerCase()!==path.basename(video,path.extname(video)).toLowerCase()+'.evr-transcript.json')throw new Error('Expected <video-stem>.evr-transcript.json matching the input video');
 const project=projectPath?JSON.parse(await readFile(projectPath,'utf8')):undefined;
 if(project&&(project.source?.subtitleName!==path.basename(json)||project.source?.videoName!==path.basename(video)))throw new Error('Project source names do not match the selected EVR subtitle and video');
 if(project?.source?.subtitleSha256 && project.source.subtitleSha256.toUpperCase()!==createHash('sha256').update(subtitleBytes).digest('hex').toUpperCase())throw new Error('Project subtitle SHA-256 does not match the selected EVR transcript');
 let durationSec = Number(getArg('duration'));
 let videoHeight = Number(getArg('video-height'));
 if (!getArg('duration') && !getArg('video-height')) {
   const probe = getArg('ffprobe') || 'ffprobe';
   const metadata = JSON.parse(execFileSync(probe, [
     '-v', 'quiet', '-show_entries', 'format=duration:stream=width,height,codec_type', '-of', 'json', video
   ], {encoding: 'utf8'}));
   const stream = metadata.streams.find(s => s.codec_type === 'video');
   if (!stream) throw new Error('Input has no video stream');
   durationSec = Number(metadata.format.duration);
   videoHeight = Math.round(1200 * stream.height / stream.width);
 }
 if (!Number.isFinite(durationSec) || durationSec <= 0) throw new Error('Invalid video duration');
 if (!Number.isInteger(videoHeight) || videoHeight <= 0) throw new Error('Invalid video height');
 if(videoHeight>=1600)throw new Error('Video height leaves no reading panel; choose a wider source video');
 if(path.resolve(video)===path.resolve(output)||path.resolve(json)===path.resolve(output)|| (projectPath&&path.resolve(projectPath)===path.resolve(output)))throw new Error('Output cannot overwrite source assets or project');
 await stat(output).then(()=>{throw new Error('Output already exists; choose a new filename')},e=>{if(e?.code!=='ENOENT')throw e});
 await mkdir(path.dirname(output), {recursive: true});
 publicDir = await mkdtemp(path.join(os.tmpdir(), 'evr-media-'));
 await copyFile(video, path.join(publicDir, filename));
 const browserExecutable = getArg('browser');
 const{bundle}=await import('@remotion/bundler');const{getCompositions,renderMedia}=await import('@remotion/renderer');
 const planPath = getArg('page-plan');
 const pagePlan = planPath ? JSON.parse(await readFile(planPath,'utf8')) : undefined;
 const inputProps={transcript:input,project,pagePlan,videoHeight,videoFile:filename,durationSec};
 console.log('Bundling Remotion...');bundleLocation=await bundle({publicDir,entryPoint:path.join(root,'src/remotion/index.ts'),onProgress:p=>console.log(`bundle ${Math.round(p)}%`)});
 const comps=await getCompositions(bundleLocation,{inputProps,browserExecutable});const composition=comps.find(c=>c.id==='EnglishReader');if(!composition)throw new Error('Missing composition');
 let lastPercent = -1;
 console.log('Rendering...');
 await renderMedia({
   composition, serveUrl: bundleLocation, codec: 'h264', audioCodec: 'aac',
   browserExecutable, concurrency: 2, outputLocation: output, inputProps, crf: 18,
   onProgress: ({progress}) => {
     const percent = Math.round(progress * 100);
     if (percent !== lastPercent) {
       lastPercent = percent;
       console.log(`render ${percent}%`);
     }
   }
 });
 console.log(`\nExport succeeded: ${output}`);
}catch(e){console.error('\nExport failed:',e);process.exitCode=1;}finally{if(bundleLocation)await rm(bundleLocation,{recursive:true,force:true});if(publicDir)await rm(publicDir,{recursive:true,force:true})}
