import React,{useMemo} from 'react';
import {paginate,pageAtTime,measureWithCanvas,wordGradient,wordProgress,isPagePlan} from '../core';
import type {Word,ReadingStyle,PagePlan} from '../core';
/** Same component is used by WebView2 and Remotion. Text is positioned explicitly from the shared page plan. */
export function ReaderCanvas({words,style,time,videoHeight,video,canvasWidth,canvasHeight,pagePlan}:{words:Word[];style:ReadingStyle;time:number;videoHeight:number;video:React.ReactNode;canvasWidth:number;canvasHeight:number;pagePlan?:PagePlan}){
 const availableHeight=canvasHeight-videoHeight;
 const visible=useMemo(()=>words.filter(w=>!w.hidden),[words]);
 const plan=useMemo(()=>{
  if(pagePlan&&isPagePlan(pagePlan))return pagePlan;
  if(availableHeight<=0)return null;
  return paginate(words,style,canvasWidth,availableHeight,measureWithCanvas(style.fontFamily,style.fontSize,style.fontWeight));
 },[pagePlan,words,style,availableHeight]);
 const index=plan?pageAtTime(plan,time):-1;
 const page=index>=0?plan?.pages[index]:null;
 return <div data-reader-time={time} data-page-index={index} data-page-count={plan?.pages.length??0} style={{width:canvasWidth,height:canvasHeight,overflow:'hidden',background:style.backgroundColor,position:'relative'}}>
  <div style={{width:canvasWidth,height:videoHeight,overflow:'hidden',position:'relative',background:'#172536'}}>{video}</div>
  <div style={{height:Math.max(0,availableHeight),position:'relative',overflow:'hidden',background:style.backgroundColor}}>
   {!plan?<div style={{padding:20,color:'#b81a35'}}>视频高度已占满画布，无法显示字幕区域</div>:page?.rows.map((row,i)=><div key={`${index}:${i}`} data-reader-row={i} style={{position:'absolute',top:row.top,left:style.paddingX,width:plan.availableWidth,height:row.height,fontFamily:style.fontFamily,fontSize:style.fontSize,lineHeight:style.lineHeight,fontWeight:style.fontWeight,color:style.textColor,whiteSpace:'nowrap'}}>
    {row.words.map(item=>{
     const w=visible[item.index];if(!w||w.id!==item.id)return null;
     const progress=wordProgress(time,w.start,w.end);
     return <span key={item.id} data-word={item.id} data-progress={progress} style={{position:'absolute',left:item.x,top:0,whiteSpace:'pre',backgroundImage:wordGradient(progress,style.textColor,style.highlightColor),backgroundClip:'text',WebkitBackgroundClip:'text',color:'transparent',WebkitTextFillColor:'transparent'}}>{w.display}</span>;
    })}
   </div>)}
  </div>
 </div>;
}
