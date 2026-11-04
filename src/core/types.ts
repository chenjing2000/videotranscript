export interface Word { id: string; segmentId: string; original: string; display: string; start: number; end: number; score?: number; hidden: boolean; breakParagraph: boolean; sourceBreakParagraph?: boolean; sourceDisplay?: string }
export interface Transcript { language?: string; words: Word[]; warnings: string[] }
export interface TranscriptStudioInput {language:'en';segments:Array<{start?:number;end?:number;text?:string;words:Array<{word:string;start:number;end:number;score?:number;breakParagraph?:true}>}>;word_segments?:unknown[];transcript_studio:{format:'transcript-studio';schemaVersion:2;displayOverrides?:Record<string,string>}}

export interface ReadingStyle {textAlign:'justify'|'left';fontFamily:string;fontSize:number;fontWeight:number;firstLineIndentCh?:number;firstLineIndentEm?:number;lineHeight:number;paragraphGap:number;paddingX:number;paddingY:number;textColor:string;highlightColor:string;backgroundColor:string;minScrollDuration:number}
export interface Row { index:number; startWord:number; endWord:number; top:number; bottom:number; firstStart:number; lastEnd:number }
export interface Layout {rows:Row[]; wordRows:number[]; totalHeight:number; viewportHeight:number; viewportWidth:number}
export interface ScrollEvent {start:number; end:number; from:number; to:number; rowIndex:number}
export interface ScrollPlan {events:ScrollEvent[]; maxOffset:number}
export interface Project {canvas:{width:number;height:number};mediaKind?:'video'|'audio';format:'transcript-studio-project';schemaVersion:2;source:{videoName:string;subtitleName:string;subtitleSha256?:string}; overrides:Record<string,{display?:string;hidden?:boolean;breakParagraph?:boolean}>;style:ReadingStyle;export:{fps:30|60;quality:'standard'|'high'};savedAt?:string}
export const DEFAULT_STYLE:ReadingStyle={textAlign:'justify',fontFamily:'Arial',fontSize:40,fontWeight:400,firstLineIndentEm:2,lineHeight:1.4,paragraphGap:20,paddingX:36,paddingY:30,textColor:'#293847',highlightColor:'#b81a35',backgroundColor:'#f7f4ec',minScrollDuration:.15};
export const WIDTH=1200; export const HEIGHT=1600;
