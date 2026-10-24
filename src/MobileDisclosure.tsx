import {useEffect,useId,useState,type ReactNode} from 'react';
import {ChevronDown} from 'lucide-react';

export function useCompactLayout(){
 const [compact,setCompact]=useState(()=>window.matchMedia('(max-width: 700px)').matches);
 useEffect(()=>{const query=window.matchMedia('(max-width: 700px)'),update=()=>setCompact(query.matches);update();query.addEventListener('change',update);return()=>query.removeEventListener('change',update)},[]);
 return compact;
}

export default function MobileDisclosure({title,description,children,defaultOpen=false,revealKey=0,progress,className=''}:{title:string;description?:string;children:ReactNode;defaultOpen?:boolean;revealKey?:number;progress?:{value:number;total:number};className?:string}){
 const compact=useCompactLayout(),id=useId(),[open,setOpen]=useState(defaultOpen);
 useEffect(()=>{if(revealKey>0)setOpen(true)},[revealKey]);
 if(!compact)return <>{children}</>;
 return <section className={'mobileDisclosure '+className}>
  <button className="mobileDisclosureToggle" type="button" aria-expanded={open} aria-controls={id} onClick={()=>setOpen(!open)}>
   <span><strong>{title}</strong>{description&&<small>{description}</small>}</span><ChevronDown size={18} aria-hidden="true"/>
  </button>
  {progress&&<progress className="mobileDisclosureProgress" max={progress.total} value={progress.value} aria-label="Progreso de configuración"/>}
  <div className="mobileDisclosureBody" id={id} hidden={!open}>{children}</div>
 </section>;
}
