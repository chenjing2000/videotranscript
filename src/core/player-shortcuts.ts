/** Keyboard commands for the media transport; independent of React and WPF. */
export type PlayerShortcut = 'toggle' | 'stop' | 'next-frame' | 'previous-frame' |
 'forward-10' | 'backward-10' | 'forward-30' | 'backward-30' |
 'normal-speed' | 'volume-up' | 'volume-down' | 'mute' |
 'open-file' | 'save';
export function resolvePlayerShortcut(key:string, ctrl=false, shift=false):PlayerShortcut|null {
 if(shift)return null;
 const k=key.toLowerCase();
 if(ctrl){
  if(k==='arrowright')return 'forward-30';
  if(k==='arrowleft')return 'backward-30';
  if(k==='o')return 'open-file';
  if(k==='s')return 'save';
  return null;
 }
 switch(k){
  case ' ':case 'spacebar':return 'toggle';
  case 'x':return 'stop';
  case 'f':return 'next-frame';
  case 'd':return 'previous-frame';
  case 'arrowright':return 'forward-10';
  case 'arrowleft':return 'backward-10';
  case 'z':return 'normal-speed';
  case 'arrowup':return 'volume-up';
  case 'arrowdown':return 'volume-down';
  case 'm':return 'mute';
  default:return null;
 }
}
