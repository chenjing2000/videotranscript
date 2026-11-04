import type {Layout,ScrollEvent,ScrollPlan} from './types';import {clamp} from './highlight';
export const smooth=(u:number):number=>(1-Math.cos(Math.PI*clamp(u)))/2;
// Anchor: once the spoken row would fall below center, schedule advances after prior row finishes.
// End requirement: the final visible row reaches bottom alignment (when totalHeight > viewport).
export function buildScrollPlan(layout:Layout,minDuration=.15):ScrollPlan{
 const {rows,totalHeight,viewportHeight}=layout;
 const maxOffset=Math.max(0,totalHeight-viewportHeight);
 if(!rows.length||maxOffset<=0)return {events:[],maxOffset};
 const events:ScrollEvent[]=[];let offset=0;let previousEnd=-Infinity;
 for(let next=1;next<rows.length;next++){
  const nextRow=rows[next];const prior=rows[next-1];
  const goal=clamp(nextRow.bottom-viewportHeight/2,0,maxOffset);
  // Target bottom alignment at the final row, subject to the minimum duration.
  const desired=next===rows.length-1?maxOffset:goal;
  if(desired<=offset+1e-7)continue;
  const nominalStart=prior.lastEnd;
  const nominalEnd=nextRow.firstStart;
  // No teleports: if a previous animation overlaps, start the next at previous end.
  const start=Math.max(nominalStart,previousEnd);
  // A queued transition uses the remaining silence instead of replaying elapsed time.
  const end=Math.max(start+minDuration,nominalEnd);
  events.push({start,end,from:offset,to:desired,rowIndex:next});
  offset=desired;previousEnd=end;
  if(offset>=maxOffset-1e-7)break;
 }
 // If a one-line document extends beyond viewport: pathological styling. No event possible.
 return {events,maxOffset};
}
export function scrollOffset(plan:ScrollPlan,time:number):number{
 if(plan.maxOffset<=0||!Number.isFinite(time))return 0;
 let y=0;for(const e of plan.events){if(time<e.start)break;if(time>=e.end){y=e.to;continue;}return clamp(e.from+(e.to-e.from)*smooth((time-e.start)/(e.end-e.start)),0,plan.maxOffset);}return clamp(y,0,plan.maxOffset);
}
