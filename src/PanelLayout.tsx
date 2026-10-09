import {useEffect,useId,useRef,useState,type ReactNode} from 'react';
import {LogOut,Menu,X,type LucideIcon} from 'lucide-react';
import './PanelLayout.css';

type Props={
  variant?:'admin'|'superLayout';
  brand:ReactNode;
  identity:ReactNode;
  title:string;
  items:ReadonlyArray<readonly [string,LucideIcon]>;
  active:string;
  onSelect:(section:string)=>void;
  onLogout:()=>void;
  children:ReactNode;
};

export default function PanelLayout({variant='admin',brand,identity,title,items,active,onSelect,onLogout,children}:Props){
  const[mobile,setMobile]=useState(()=>window.matchMedia('(max-width: 900px)').matches);
  const[open,setOpen]=useState(false);
  const id=useId(),drawer=useRef<HTMLElement>(null),content=useRef<HTMLElement>(null),trigger=useRef<HTMLButtonElement>(null);
  const restoreFocus=useRef(true);

  useEffect(()=>{
    const query=window.matchMedia('(max-width: 900px)');
    const change=()=>{setMobile(query.matches);if(!query.matches)setOpen(false)};
    query.addEventListener('change',change);
    return()=>query.removeEventListener('change',change);
  },[]);

  useEffect(()=>{
    if(!mobile||!open)return;
    const previousOverflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    if(content.current)content.current.inert=true;
    drawer.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const keys=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){event.preventDefault();setOpen(false)}
      if(event.key!=='Tab')return;
      const buttons=Array.from(drawer.current?.querySelectorAll<HTMLElement>('button,a[href],[tabindex="0"]')||[]).filter(element=>!element.hasAttribute('disabled'));
      const first=buttons[0],last=buttons[buttons.length-1];
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}
    };
    document.addEventListener('keydown',keys);
    return()=>{
      document.body.style.overflow=previousOverflow;
      if(content.current)content.current.inert=false;
      document.removeEventListener('keydown',keys);
      if(restoreFocus.current&&window.matchMedia('(max-width: 900px)').matches)trigger.current?.focus();
    };
  },[mobile,open]);

  const select=(section:string)=>{
    onSelect(section);
    if(mobile){
      restoreFocus.current=false;
      setOpen(false);
      requestAnimationFrame(()=>{window.scrollTo({top:0,behavior:'instant'});content.current?.focus({preventScroll:true})});
    }
  };

  return <div className={`${variant} panelLayout`}>
    <header className="panelMobileHeader">
      <div className="panelMobileIdentity"><div className="brand">ADARA <i>WEB</i></div><span>{active}</span></div>
      <button ref={trigger} type="button" className="panelMenuTrigger" aria-controls={id} aria-expanded={open} onClick={()=>{restoreFocus.current=true;setOpen(true)}}><Menu size={20} aria-hidden="true"/>Menú</button>
    </header>
    {mobile&&open&&<div className="panelMenuBackdrop" aria-hidden="true" onClick={()=>setOpen(false)}/>}
    <aside ref={drawer} id={id} className="panelSidebar" hidden={mobile&&!open} role={mobile?'dialog':undefined} aria-modal={mobile&&open?true:undefined} aria-label={title}>
      <div className="panelSidebarHeading">{brand}<button type="button" className="panelMenuClose" aria-label="Cerrar menú" onClick={()=>setOpen(false)}><X size={22} aria-hidden="true"/></button></div>
      {identity}
      <nav className="panelNavigation" aria-label={title}>
        {items.map(([label,Icon])=><button key={label} type="button" className={active===label?'active':''} aria-current={active===label?'page':undefined} onClick={()=>select(label)}><Icon size={18} aria-hidden="true"/>{label}</button>)}
      </nav>
      <button type="button" className="panelLogout" onClick={onLogout}><LogOut size={18} aria-hidden="true"/>Salir</button>
    </aside>
    <main ref={content} tabIndex={-1} className={`dash panelContent${variant==='superLayout'?' superDash':''}`}>{children}</main>
  </div>;
}
