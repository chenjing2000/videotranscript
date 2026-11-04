/** Media discovery contract used by desktop and tested independently. */
export const TRANSCRIPT_SUFFIX = '.transcript-studio.json';
export const MEDIA_PRIORITY = ['.mp4', '.mkv', '.mp3', '.wav'] as const;
export type MediaKind = 'video'|'audio';
export function transcriptStem(filename:string):string {
 if (!filename.toLowerCase().endsWith(TRANSCRIPT_SUFFIX)) throw new Error(`请选择 *${TRANSCRIPT_SUFFIX} 文件`);
 return filename.slice(0,-TRANSCRIPT_SUFFIX.length);
}
export function selectCompanion(filename:string,names:readonly string[]):{name:string;kind:MediaKind}|null {
 const stem=transcriptStem(filename).toLowerCase();
 for(const extension of MEDIA_PRIORITY){
  const name=names.find(n=>n.toLowerCase()===stem+extension);
  if(name) return {name,kind:extension==='.mp3'||extension==='.wav'?'audio':'video'};
 }
 return null;
}
export function validCanvas(width:number,height:number):boolean {
 return Number.isInteger(width)&&Number.isInteger(height)&&width>=320&&height>=320&&width<=3840&&height<=3840&&width%2===0&&height%2===0;
}
