import {useEffect,useRef,useState} from 'react';
import {ChevronLeft,ChevronRight,Pause,Play} from 'lucide-react';
import {designs,WebsiteExample} from './TemplateShowcase';

export default function TemplateCarousel(){
 const region=useRef<HTMLDivElement>(null),track=useRef<HTMLDivElement>(null),pointerKind=useRef(''),pointerActive=useRef(false);
 const [index,setIndex]=useState(0),[visible,setVisible]=useState(1),[paused,setPaused]=useState(false),[inView,setInView]=useState(false);
 const [reduced,setReduced]=useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches);
 const last=Math.max(0,designs.length-visible);
 const go=(next:number)=>{
  const el=track.current,slide=el?.firstElementChild as HTMLElement|null;
  if(el&&slide)el.scrollTo({left:Math.max(0,Math.min(last,next))*slide.offsetWidth,behavior:reduced?'instant':'smooth'});
 };
 useEffect(()=>{
  const el=track.current;if(!el)return;
  const measure=()=>{
   const slide=el.firstElementChild as HTMLElement|null;if(!slide)return;
   const count=Math.max(1,Math.round(el.clientWidth/slide.offsetWidth));
   setVisible(count);setIndex(Math.min(designs.length-count,Math.round(el.scrollLeft/slide.offsetWidth)));
  };
  const resize=new ResizeObserver(measure);resize.observe(el);measure();
  const observer=new IntersectionObserver(([entry])=>setInView(entry.isIntersecting),{threshold:.25});observer.observe(el);
  const motion=matchMedia('(prefers-reduced-motion: reduce)'),preference=()=>setReduced(motion.matches);
  motion.addEventListener('change',preference);
  return()=>{resize.disconnect();observer.disconnect();motion.removeEventListener('change',preference)};
 },[]);
 useEffect(()=>{
  if(paused||reduced||!inView)return;
  const timer=window.setInterval(()=>{
   const el=track.current,root=region.current,slide=el?.firstElementChild as HTMLElement|null;
   if(!el||!root||!slide||document.hidden||pointerActive.current||root.contains(document.activeElement)||(pointerKind.current==='mouse'&&root.matches(':hover')))return;
   const current=Math.round(el.scrollLeft/slide.offsetWidth);
   el.scrollTo({left:(current>=last?0:current+1)*slide.offsetWidth,behavior:'smooth'});
  },5000);
  return()=>window.clearInterval(timer);
 },[paused,reduced,inView,last]);
 return <div ref={region} className="templateCarousel" role="region" aria-roledescription="carrusel" aria-label="Plantillas de Adara" onPointerEnter={e=>{pointerKind.current=e.pointerType}} onPointerDown={e=>{pointerKind.current=e.pointerType;pointerActive.current=true}} onPointerUp={()=>{pointerActive.current=false}} onPointerCancel={()=>{pointerActive.current=false}} onPointerLeave={()=>{pointerActive.current=false}}>
  <div ref={track} className="templateTrack" tabIndex={0} aria-label="Deslizá para explorar las plantillas" onKeyDown={e=>{if(e.target!==e.currentTarget)return;if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();go(e.key==='Home'?0:e.key==='End'?last:index+(e.key==='ArrowRight'?1:-1))}} onScroll={()=>{
   const el=track.current,slide=el?.firstElementChild as HTMLElement|null;
   if(el&&slide)setIndex(Math.max(0,Math.min(last,Math.round(el.scrollLeft/slide.offsetWidth))));
  }}>{designs.map((design,i)=><div key={design.id} className="templateSlide" role="group" aria-roledescription="diapositiva" aria-label={`${i+1} de ${designs.length}: ${design.name}`}><WebsiteExample design={design}/></div>)}</div>
  <div className="templateNavigation">
   <div className="templateDots" aria-label="Elegir plantilla">{designs.slice(0,last+1).map((d,i)=><button type="button" key={d.id} aria-label={`Ver ${d.name}`} aria-current={index===i?'true':undefined} onClick={()=>go(i)}/>)}</div>
   <div className="templateActions"><span aria-live={paused||reduced?'polite':'off'}>{index+1}{visible>1?`–${Math.min(designs.length,index+visible)}`:''} / {designs.length}</span><button type="button" aria-label="Plantilla anterior" onClick={()=>go(index===0?last:index-1)}><ChevronLeft size={18}/></button><button type="button" aria-label="Plantilla siguiente" onClick={()=>go(index>=last?0:index+1)}><ChevronRight size={18}/></button>{!reduced&&<button type="button" aria-label={paused?'Reanudar plantillas':'Pausar plantillas'} onClick={()=>setPaused(v=>!v)}>{paused?<Play size={16}/>:<Pause size={16}/>}</button>}</div>
  </div>
 </div>;
}
