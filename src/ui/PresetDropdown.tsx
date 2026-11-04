import React,{useEffect,useRef,useState} from 'react';
/** Keyboard-accessible preset picker. The list is physically limited to four visible rows. */
export function PresetDropdown({id,value,options,onChange}:{id:string;value:string;options:{value:string;label:string}[];onChange:(v:string)=>void}){
 const [open,setOpen]=useState(false);const ref=useRef<HTMLDivElement>(null);
 const selected=options.findIndex(o=>o.value===value);
 const [active,setActive]=useState(Math.max(0,selected));
 useEffect(()=>{if(!open)return;const close=(e:PointerEvent)=>{if(ref.current&&!ref.current.contains(e.target as Node))setOpen(false)};document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close)},[open]);
 function choose(i:number){if(i<0||i>=options.length)return;onChange(options[i].value);setActive(i);setOpen(false)}
 function onKey(e:React.KeyboardEvent){
  if(e.key==='Escape'){setOpen(false);return;}
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();const direction=e.key==='ArrowDown'?1:-1;setOpen(true);setActive(a=>Math.max(0,Math.min(options.length-1,(open?a:Math.max(0,selected))+direction)));return;}
  if(e.key==='Enter'||e.key===' '){e.preventDefault();if(open)choose(active);else {setActive(Math.max(0,selected));setOpen(true)}}
  if(e.key==='Home'){e.preventDefault();setActive(0);setOpen(true)}
  if(e.key==='End'){e.preventDefault();setActive(options.length-1);setOpen(true)}
 }
 return <div ref={ref} className="preset-control" onKeyDown={onKey}>
  <button id={id} type="button" className="preset-trigger" aria-haspopup="listbox" aria-expanded={open} onClick={()=>{setActive(Math.max(0,selected));setOpen(!open)}}>{options[selected]?.label??value}<span aria-hidden>⌄</span></button>
  {open&&<div className="preset-menu" role="listbox" aria-labelledby={id}>
   {options.map((option,i)=><button type="button" key={option.value} role="option" aria-selected={option.value===value} className={`preset-option${i===active?' is-active':''}`} onMouseEnter={()=>setActive(i)} onClick={()=>choose(i)}>{option.label}</button>)}
  </div>}
 </div>;
}
