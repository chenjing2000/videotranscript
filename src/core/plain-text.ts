import type {Word} from './types';

/** Export exactly the displayed word text and user-defined paragraph breaks.
 * No punctuation correction, timestamps, formatting, or trailing blank line.
 * CRLF separators make the result suitable for a Windows .txt file.
 */
export function exportPlainText(words:readonly Word[]):string {
 const paragraphs:string[]=[];
 let current:string[]=[];
 for(const word of words){
  if(word.hidden){
   // The right pane still renders the paragraph boundary after a hidden word.
   // Preserve that boundary without exporting the hidden token itself.
   if(word.breakParagraph&&current.length){paragraphs.push(current.join(' '));current=[];}
   continue;
  }
  current.push(word.display);
  if(word.breakParagraph){
   if(current.length)paragraphs.push(current.join(' '));
   current=[];
  }
 }
 if(current.length)paragraphs.push(current.join(' '));
 return paragraphs.join('\r\n\r\n');
}
