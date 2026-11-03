export function clamp(value:number,min=0,max=1):number{return Math.max(min,Math.min(max,value));}
export function wordProgress(time:number,start:number,end:number):number{
 if(!Number.isFinite(time)||!Number.isFinite(start)||!Number.isFinite(end)||end<=start)return 0;
 return clamp((time-start)/(end-start));
}
export function wordGradient(progress:number,textColor:string,highlightColor:string):string{
 const p=clamp(progress)*100;
 return `linear-gradient(90deg, ${highlightColor} 0%, ${highlightColor} ${p}%, ${textColor} ${p}%, ${textColor} 100%)`;
}
