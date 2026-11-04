import React from 'react';
import type {ReadingStyle} from '../core';
import {STYLE_PRESETS} from '../core';
import {PresetDropdown} from './PresetDropdown';
const groups=[
 {title:'字体设置',items:[['fontFamily','英文字体',''],['fontSize','字体大小',' px'],['fontWeight','字体粗细','']]},
 {title:'行与段落设置',items:[['lineHeight','行距',''],['paragraphGap','段间距',' px'],['firstLineIndentCh','首行缩进',' ch']]},
 {title:'页面排版',items:[['textAlign','段落对齐',''],['paddingY','上下边距',' px'],['paddingX','左右边距',' px']]},
] as const;
export function StyleSettings({style,onChange}:{style:ReadingStyle;onChange:(value:ReadingStyle)=>void}){
 const update=(key:keyof ReadingStyle,value:string)=>{
  const numeric=key!=='fontFamily'&&key!=='textAlign';const v=numeric?Number(value):value;
  if(numeric&&!Number.isFinite(v as number))return;
  onChange({...style,[key]:v});
 };
 return <div className="style-settings"><h3>阅读样式</h3>{groups.map(group=><section key={group.title} className="style-group"><h4>{group.title}</h4>{group.items.map(([key,label,suffix])=>{
  const options=key==='textAlign'?['justify','left'] as const:STYLE_PRESETS[key];const current=String(style[key]);
  return <div className="style-field" key={key}>
   <label htmlFor={`style-${key}`}>{label}</label>
   <PresetDropdown id={`style-${key}`} value={current} onChange={v=>update(key,v)} options={[...options.map(o=>({value:String(o),label:key==='textAlign'?(o==='justify'?'两端对齐':'左对齐'):key==='fontWeight'?`${o} · ${o===400?'Regular':o===500?'Medium':o===600?'SemiBold':'Bold'}`:`${o}${suffix}`})),...(!options.some(o=>String(o)===current)?[{value:current,label:`${current}${suffix}（旧工程参数）`}]:[])]}/>

  </div>;
 })}</section>)}<section className="style-group"><h4>颜色设置</h4>{([['textColor','正文颜色'],['highlightColor','强调颜色'],['backgroundColor','页面背景']]as const).map(([key,label])=><div key={key} className="style-field"><label htmlFor={`style-${key}`}>{label}</label><input id={`style-${key}`} className="style-color" type="color" value={style[key]} onChange={e=>onChange({...style,[key]:e.target.value})}/></div>)}</section>
 <p className="style-note">参数改变后自动重新分页。下拉框采用固定列宽，展开列表最多同时显示四项，更多选项可在列表内滚动。</p>
 </div>;
}
