import {useEffect,useId,useRef,useState} from 'react';
export default function ExpandableText({text}:{text:string}){
 const id=useId(),element=useRef<HTMLParagraphElement>(null),[expanded,setExpanded]=useState(false),[overflow,setOverflow]=useState(false);
 useEffect(()=>{setExpanded(false)},[text]);
 useEffect(()=>{
  const el=element.current;if(!el||expanded)return;
  const measure=()=>setOverflow(el.scrollHeight>el.clientHeight+1),observer=new ResizeObserver(measure);observer.observe(el);measure();return()=>observer.disconnect();
 },[text,expanded]);
 if(!text)return null;
 return <><p ref={element} id={id} className={'expandableText'+(expanded?' expanded':'')}>{text}</p>{(overflow||expanded)&&<button type="button" className="readMore" aria-expanded={expanded} aria-controls={id} onClick={()=>setExpanded(v=>!v)}>{expanded?'Leer menos':'Leer más'}</button>}</>;
}
