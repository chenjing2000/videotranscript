import {execFileSync}from'node:child_process';import path from'node:path';import{fileURLToPath}from'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');const ffmpeg=process.env.FFMPEG_PATH||'ffmpeg';
execFileSync(ffmpeg,['-y','-f','lavfi','-i','color=c=0x254759:s=960x540:r=30:d=10','-f','lavfi','-i','sine=frequency=440:duration=10','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-shortest',path.join(root,'fixtures','demo.mp4')],{stdio:'inherit'});
console.log('Generated fixtures/demo.mp4 (synthetic, no copyrighted content)');
