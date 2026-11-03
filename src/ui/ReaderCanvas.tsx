import React,{useMemo} from 'react';
import {buildLayout,buildScrollPlan,measureWithCanvas,scrollOffset,wordGradient,wordProgress,WIDTH,HEIGHT} from '../core';
import type {Word,ReadingStyle} from '../core';
export function ReaderCanvas({words,style,time,videoHeight,video}:{words:Word[];style:ReadingStyle;time:number;videoHeight:number;video:React.ReactNode}){
 const availableHeight=HEIGHT-videoHeight;
 const visible=useMemo(()=>words.filter(w=>!w.hidden),[words]);
 const layout=useMemo(()=>{
  if(availableHeight<=0)return null;
  return buildLayout(words,style,WIDTH,availableHeight,measureWithCanvas(style.fontFamily,style.fontSize));
 },[words,style,availableHeight]);
 const plan=useMemo(()=>layout?buildScrollPlan(layout,style.minScrollDuration):null,[layout,style.minScrollDuration]);
 const offset=plan?scrollOffset(plan,time):0;
 return <div style={{width:WIDTH,height:HEIGHT,overflow:'hidden',background:style.backgroundColor,position:'relative'}}>
  <div style={{width:WIDTH,height:videoHeight,overflow:'hidden',position:'relative',background:'#172536'}}>{video}</div>
  <div style={{height:Math.max(0,availableHeight),position:'relative',overflow:'hidden',background:style.backgroundColor}}>
   {!layout? <div style={{padding:20,color:'#b81a35'}}>视频高度已占满画布，无法显示字幕区域</div>:
    <div style={{position:'absolute',inset:0,transform:`translateY(${-offset}px)`,willChange:'transform'}}>
     {layout.rows.map(row=><div key={row.index} style={{position:'absolute',top:row.top,left:style.paddingX,width:WIDTH-2*style.paddingX,height:style.fontSize*style.lineHeight,fontFamily:style.fontFamily,fontSize:style.fontSize,lineHeight:style.lineHeight,fontWeight:400,whiteSpace:'nowrap',color:style.textColor}}>
      {visible.slice(row.startWord,row.endWord+1).map((w,i)=>{
       const grad=wordGradient(wordProgress(time,w.start,w.end),style.textColor,style.highlightColor);
       return <React.Fragment key={w.id}>{i>0?' ':null}<span data-word={w.id} style={{backgroundImage:grad,backgroundClip:'text',WebkitBackgroundClip:'text',color:'transparent',WebkitTextFillColor:'transparent'}}>{w.display}</span></React.Fragment>;
      })}
     </div>)}
    </div>}
  </div>
 </div>;
}
