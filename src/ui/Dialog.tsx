import React,{useEffect,useId,useRef} from 'react';

export type DialogAction = {
 label:string;
 onClick:()=>void;
 variant:'primary'|'secondary'|'danger';
 autoFocus?:boolean;
 disabled?:boolean;
};

type DialogProps = {
 title:string;
 subtitle?:string;
 icon?:'warning'|'info'|'package'|'error';
 children:React.ReactNode;
 actions:DialogAction[];
 onClose?:()=>void;
 onEscape?:()=>void;
 showCloseButton?:boolean;
 dismissOnBackdrop?:boolean;
 className?:string;
};

function DialogIcon({kind}:{kind:NonNullable<DialogProps['icon']>}){
 const paths:Record<NonNullable<DialogProps['icon']>,React.ReactNode>={
  warning:<><path d="M12 7v6"/><path d="M12 17h.01"/></>,
  info:<><circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8h.01"/></>,
  package:<><path d="m4 8 8-4 8 4-8 4-8-4Z"/><path d="M4 8v9l8 4 8-4V8M12 12v9"/></>,
  error:<><circle cx="12" cy="12" r="8.5"/><path d="m9 9 6 6m0-6-6 6"/></>
 };
 return <span className={`fluent-dialog-icon fluent-dialog-icon--${kind}`} aria-hidden="true">
  <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[kind]}</svg>
 </span>;
}

export function Dialog({
 title,subtitle,icon='info',children,actions,onClose,onEscape,showCloseButton=!!onClose,dismissOnBackdrop=false,className=''
}:DialogProps){
 const dialogRef=useRef<HTMLElement|null>(null);
 const titleId=useId();
 const descriptionId=useId();

 useEffect(()=>{
  const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;
  const dialog=dialogRef.current;
  const preferred=dialog?.querySelector<HTMLButtonElement>('[data-autofocus="true"]');
  const first=dialog?.querySelector<HTMLButtonElement>('button:not(:disabled)');
  (preferred??first??dialog)?.focus();
  return()=>previous?.focus();
 },[]);

 useEffect(()=>{
  const dialog=dialogRef.current;
  const active=document.activeElement;
  const activeButton=active instanceof HTMLButtonElement?active:null;
  if(dialog&&(!dialog.contains(active)||activeButton?.disabled||active===dialog)){
   const preferred=dialog.querySelector<HTMLButtonElement>('[data-autofocus="true"]');
   const first=dialog.querySelector<HTMLButtonElement>('button:not(:disabled)');
   (preferred??first??dialog).focus();
  }
 },[actions]);

 const handleKeyDown=(event:React.KeyboardEvent<HTMLElement>)=>{
  if(event.key==='Escape'){
   event.preventDefault();event.stopPropagation();
   const action=onEscape??onClose;
   action?.();
   return;
  }
  if(event.key!=='Tab')return;
  const buttons=[...(dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')??[])];
  if(!buttons.length){event.preventDefault();return}
  const active=document.activeElement;
  const index=buttons.indexOf(active as HTMLButtonElement);
  if(event.shiftKey&&index<=0){event.preventDefault();buttons.at(-1)?.focus()}
  else if(!event.shiftKey&&(index===buttons.length-1||index<0)){event.preventDefault();buttons[0]?.focus()}
 };

 return <div className="modal-backdrop fluent-dialog-backdrop" role="presentation" onMouseDown={event=>{if(dismissOnBackdrop&&event.target===event.currentTarget)onClose?.()}}> 
  <section ref={dialogRef} className={`fluent-dialog ${className}`.trim()} role="dialog" aria-modal="true"
   aria-labelledby={titleId} aria-describedby={descriptionId} tabIndex={-1} onKeyDown={handleKeyDown}>
   <header className="fluent-dialog-head">
    <DialogIcon kind={icon}/>
    <div className="fluent-dialog-titles">
     <strong id={titleId}>{title}</strong>
     {subtitle&&<span>{subtitle}</span>}
    </div>
    {showCloseButton&&onClose&&<button type="button" className="fluent-dialog-close" aria-label="关闭" title="关闭" onClick={onClose}>
     <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="m6 6 12 12M18 6 6 18"/></svg>
    </button>}
   </header>
   <div className="fluent-dialog-body" id={descriptionId}>{children}</div>
   <footer className="fluent-dialog-actions">
    {actions.map((action,index)=><button key={`${action.label}-${index}`} type="button"
     className={`fluent-dialog-button fluent-dialog-button--${action.variant}`}
     disabled={action.disabled} data-autofocus={action.autoFocus?'true':undefined} onClick={action.onClick}>
     {action.label}
    </button>)}
   </footer>
  </section>
 </div>;
}
