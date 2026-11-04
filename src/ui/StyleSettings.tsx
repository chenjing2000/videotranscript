import React,{useEffect,useState} from 'react';
import type {AppSettings} from '../core/app-settings';
import {FONT_OPTIONS,validateSettings} from '../core/app-settings';
type Props={settings:AppSettings;onChange:(settings:AppSettings)=>void;onInvalid:(message:string)=>void};
type Field={label:string;value:string;unit?:string;options?:Array<{label:string;value:string}>;type?:'color'|'number';digits?:number;min?:number;max?:number;step?:number;set:(s:AppSettings,v:string)=>AppSettings};
const choices=(v:readonly string[])=>v.map(x=>({label:x,value:x}));
export function StyleSettings({settings:s,onChange,onInvalid}:Props){
 const [drafts,setDrafts]=useState<Record<string,string>>({});
 useEffect(()=>setDrafts({}),[s]);
 const change=(key:string,f:Field,v:string)=>{const next=f.set(s,v);if(validateSettings(next)){onChange(next);setDrafts(d=>{const x={...d};delete x[key];return x})}else onInvalid(`${f.label}：输入值不合法`)};
 const mk=(label:string,value:string,set:Field['set'],opt:Partial<Field>={}):Field=>({label,value,set,...opt});
 const numeric=(label:string,value:number,set:Field['set'],digits:number,min:number,max:number,unit:string,step=1)=>mk(label,String(value),set,{type:'number',digits,min,max,unit,step});
 const clr=(label:string,value:string,set:Field['set'])=>mk(label,value.slice(1).toUpperCase(),set,{type:'color',digits:6});
 const select=(label:string,value:string,values:Array<{value:string;label:string}>,set:Field['set'])=>mk(label,value,set,{options:values});
 const families=choices(FONT_OPTIONS);
 const groups:[string,Field[]][]=[
 ['左栏字体',[
  select('字体',s.leftFont.family,families,(x,v)=>({...x,leftFont:{...x.leftFont,family:v}})),
  numeric('大小',s.leftFont.size,(x,v)=>({...x,leftFont:{...x.leftFont,size:Number(v)}}),2,1,99,'px'),
  clr('字体色',s.leftFont.color,(x,v)=>({...x,leftFont:{...x.leftFont,color:'#'+v.toUpperCase()}})),
  clr('强调色',s.leftFont.highlightColor,(x,v)=>({...x,leftFont:{...x.leftFont,highlightColor:'#'+v.toUpperCase()}}))]],
 ['右栏字体',[
  select('字体',s.rightFont.family,families,(x,v)=>({...x,rightFont:{...x.rightFont,family:v}})),
  numeric('大小',s.rightFont.size,(x,v)=>({...x,rightFont:{...x.rightFont,size:Number(v)}}),2,1,99,'dip'),
  clr('字体色',s.rightFont.color,(x,v)=>({...x,rightFont:{...x.rightFont,color:'#'+v.toUpperCase()}})),
  clr('背景色',s.rightFont.backgroundColor,(x,v)=>({...x,rightFont:{...x.rightFont,backgroundColor:'#'+v.toUpperCase()}}))]],
 ['段落设置',[
  numeric('首行缩进',s.paragraph.firstLineIndentEm,(x,v)=>({...x,paragraph:{...x.paragraph,firstLineIndentEm:Number(v)}}),1,0,9,'em'),
  select('行距',String(s.paragraph.lineHeight),choices(['1.2','1.3','1.4','1.5']),(x,v)=>({...x,paragraph:{...x.paragraph,lineHeight:Number(v) as AppSettings['paragraph']['lineHeight']}})),
  numeric('段间距',s.paragraph.gap,(x,v)=>({...x,paragraph:{...x.paragraph,gap:Number(v)}}),2,0,99,'px'),
  select('段落对齐',s.paragraph.alignment,[{value:'justify',label:'两端对齐'},{value:'left',label:'左对齐'}],(x,v)=>({...x,paragraph:{...x.paragraph,alignment:v as 'left'|'justify'}}))]],
 ['页面设置',[
  numeric('上下边距',s.page.paddingY,(x,v)=>({...x,page:{...x.page,paddingY:Number(v)}}),2,0,99,'px'),
  numeric('左右边距',s.page.paddingX,(x,v)=>({...x,page:{...x.page,paddingX:Number(v)}}),2,0,99,'px'),
  clr('背景色',s.page.backgroundColor,(x,v)=>({...x,page:{...x.page,backgroundColor:'#'+v.toUpperCase()}}))]],
 ['输出视频',[
  numeric('宽度',s.output.width,(x,v)=>({...x,output:{...x.output,width:Number(v)}}),4,320,3840,'px',2),
  numeric('高度',s.output.height,(x,v)=>({...x,output:{...x.output,height:Number(v)}}),4,320,3840,'px',2)]]];
 const render=(f:Field,index:number,title:string)=>{const key=`${title}-${index}`;const value=drafts[key]??f.value;
  const commit=()=>{if(value===f.value){setDrafts(d=>{const next={...d};delete next[key];return next});return}if(f.type==='number'&&(!/^\d{1,4}$/.test(value)||value.length>(f.digits??4)||Number(value)<(f.min??0)||Number(value)>(f.max??9999)||Number(value)%(f.step??1)!==0)){onInvalid(`${f.label}：数字范围或格式不正确`);return}if(f.type==='color'&&!/^[0-9A-Fa-f]{6}$/.test(value)){onInvalid(`${f.label}：请输入 6 位十六进制颜色`);return}change(key,f,value)};
  return <React.Fragment key={key}><label htmlFor={`m65-${key}`}>{f.label}</label><div className={`m65-value${f.type==='color'?' m65-value-color':''}${title==='段落设置'&&f.label==='段落对齐'?' m65-value-align':''}`}>{f.options?<select id={`m65-${key}`} value={f.value} onChange={e=>change(key,f,e.target.value)}>{f.options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select>:<input id={`m65-${key}`} inputMode={f.type==='number'?'numeric':'text'} value={value} maxLength={f.digits} onChange={e=>{const raw=e.target.value;if(f.type==='number'&&!/^\d*$/.test(raw))return;if(f.type==='color'&&!/^[0-9a-fA-F]*$/.test(raw))return;setDrafts(d=>({...d,[key]:raw}));}} onBlur={commit} onKeyDown={e=>{if(e.key==='Enter'){e.currentTarget.blur()}}}/>} {f.unit&&<span className="m65-unit">{f.unit}</span>}{f.type==='color'&&<span className="m65-swatch" style={{backgroundColor:/^[0-9a-fA-F]{6}$/.test(value)?'#'+value:f.value.startsWith('#')?f.value:'#ffffff'}}/>}</div></React.Fragment>};
 return <div className="m65-settings">{groups.map(([title,fields])=><section key={title} className="m65-group"><h4>{title}</h4><div className="m65-grid">{fields.map((f,i)=>render(f,i,title))}</div></section>)}<p className="m65-note">参数修改并通过校验后自动保存；右栏字体仅影响编辑区，输出视频使用左栏与页面设置。</p></div>;
}
