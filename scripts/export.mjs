import {readFile,copyFile,mkdir,stat} from 'node:fs/promises';
import path from 'node:path';import {execFileSync} from 'node:child_process';import{fileURLToPath}from'node:url';
import {assertTranscriptStudio,assertProjectForExport} from './transcript-studio-contract.mjs';
import {createCliTaskCacheDir} from './cli-cache.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
function getArg(name){const i=process.argv.indexOf(`--${name}`);return i<0?undefined:process.argv[i+1]}
const media=getArg('media'),json=getArg('json'),output=getArg('out'),projectPath=getArg('project'),cacheArg=getArg('cache-dir');
if(!media||!json||!output){console.error('Usage: npm run export -- --media INPUT.mp4|mkv|mp3|wav --json FILE.transcript-studio.json --out OUTPUT.mp4 [--project FILE.project.json] [--cache-dir DIRECTORY]');process.exit(2)}
const cacheRoot=cacheArg?path.resolve(cacheArg):path.join(path.dirname(path.resolve(output)),'.transcript-studio-cache');
let publicDir,bundleLocation;
try{
 const subtitleBytes=await readFile(json),input=JSON.parse(subtitleBytes.toString('utf8').replace(/^\uFEFF/,''));assertTranscriptStudio(input);
 const stem=path.basename(json).slice(0,-'.transcript-studio.json'.length);
 if(!path.basename(json).toLowerCase().endsWith('.transcript-studio.json')||path.basename(media,path.extname(media)).toLowerCase()!==stem.toLowerCase())throw Error('Media and .transcript-studio.json must have the same stem');
 const ext=path.extname(media).toLowerCase();if(!['.mp4','.mkv','.mp3','.wav'].includes(ext))throw Error('Unsupported media extension');
 const mediaKind=['.mp3','.wav'].includes(ext)?'audio':'video';
 const project=projectPath?JSON.parse(await readFile(projectPath,'utf8')):undefined;
 if(projectPath)assertProjectForExport(project,{mediaName:path.basename(media),subtitleName:path.basename(json),subtitleBytes,mediaKind,transcript:input});
 const width=project?.canvas?.width??1200,height=project?.canvas?.height??1600;
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<320||height<320||width>3840||height>3840||width%2||height%2)throw Error('Invalid even canvas dimensions');
 let durationSec=Number(getArg('duration')),videoHeight=mediaKind==='audio'?0:Number(getArg('video-height'));
 if(!getArg('duration')||(mediaKind==='video'&&!getArg('video-height'))){
  const meta=JSON.parse(execFileSync(getArg('ffprobe')||'ffprobe',['-v','quiet','-show_entries','format=duration:stream=width,height,codec_type','-of','json',media],{encoding:'utf8'}));
  durationSec=Number(meta.format.duration);
  if(mediaKind==='video'){const stream=meta.streams.find(s=>s.codec_type==='video');if(!stream)throw Error('Missing video stream');videoHeight=Math.round(width*stream.height/stream.width)}
 }
 if(!Number.isFinite(durationSec)||durationSec<=0||!Number.isInteger(videoHeight)||videoHeight<0||videoHeight>=height)throw Error('Media leaves no room for transcript, or invalid duration');
 const last=input.segments.at(-1)?.words.at(-1)?.end??0;
 if(last>durationSec+0.5)throw Error(`Subtitle ends at ${last}s, beyond media duration ${durationSec}s`);
 if([media,json,projectPath].filter(Boolean).some(f=>path.resolve(f)===path.resolve(output)))throw Error('Cannot overwrite input');
 await mkdir(path.dirname(output),{recursive:true});
 const cacheDir=await createCliTaskCacheDir(cacheRoot);
 // Keep Node/Chromium temporary work associated with this export task.
 process.env.TEMP=cacheDir;process.env.TMP=cacheDir;process.env.TMPDIR=cacheDir;
 publicDir=path.join(cacheDir,'media');await mkdir(publicDir,{recursive:true});
 const bundleRoot=path.join(cacheDir,'bundle');
 const filename='__export_input'+ext;await copyFile(media,path.join(publicDir,filename));
 const pagePlan=getArg('page-plan')?JSON.parse(await readFile(getArg('page-plan'),'utf8')):undefined;
 if(pagePlan&&(pagePlan.viewportWidth!==width||pagePlan.viewportHeight!==height-videoHeight))throw Error('Page plan does not match canvas size');
 const inputProps={transcript:input,project,mediaKind,videoHeight,mediaFile:filename,pagePlan,durationSec};
 const {bundle}=await import('@remotion/bundler');const {getCompositions,renderMedia}=await import('@remotion/renderer');
 const browserExecutable=getArg('browser');console.log('Bundling Remotion...');
 bundleLocation=await bundle({publicDir,entryPoint:path.join(root,'src/remotion/index.ts'),outDir:bundleRoot});
 const compositions=await getCompositions(bundleLocation,{inputProps,browserExecutable});
 const composition=compositions.find(c=>c.id==='TranscriptStudio');if(!composition)throw Error('Missing TranscriptStudio composition');
 const intermediate=path.join(cacheDir,'render-output.mp4');
 await renderMedia({composition,serveUrl:bundleLocation,codec:'h264',audioCodec:'aac',browserExecutable,concurrency:2,outputLocation:intermediate,inputProps,crf:18,onProgress:({progress})=>console.log('render '+Math.round(progress*100)+'%')});
 await stat(intermediate);
 await (await import('node:fs/promises')).rename(intermediate,output);
 console.log('Export succeeded:',output);
}catch(e){console.error('Export failed:',e);process.exitCode=1}
