import {useEffect,useRef,useState} from 'react';
import {ChevronLeft,ChevronRight,Pause,Play} from 'lucide-react';

export function galleryImages(value:any,fallback=''):string[] {
 return Array.isArray(value)&&value.length?value.filter(x=>typeof x==='string'):fallback?[fallback]:[];
}

export default function ImageCarousel({images,alt,className='',hero=false}:{images:string[];alt:string;className?:string;hero?:boolean}) {
 const [index,setIndex]=useState(0),start=useRef<number|null>(null),container=useRef<HTMLDivElement|null>(null),pointerKind=useRef('');
 const [paused,setPaused]=useState(false),[dragging,setDragging]=useState(false);
 const [hidden,setHidden]=useState(document.hidden),[reducedMotion,setReducedMotion]=useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches);
 useEffect(()=>{
  const motion=matchMedia('(prefers-reduced-motion: reduce)'),visibility=()=>setHidden(document.hidden),preference=()=>setReducedMotion(motion.matches);
  document.addEventListener('visibilitychange',visibility);motion.addEventListener('change',preference);
  return ()=>{document.removeEventListener('visibilitychange',visibility);motion.removeEventListener('change',preference)};
 },[]);
 useEffect(()=>{setIndex(0)},[images.join('\n')]);
 useEffect(()=>{if(hero&&images.length>1){const next=new Image();next.src=images[(index+1)%images.length]}},[hero,index,images.join('\n')]);
 const automatic=hero&&images.length>1&&!reducedMotion;
 useEffect(()=>{
  if(!automatic||paused||hidden||dragging)return;
  const timer=window.setInterval(()=>{
   const element=container.current;
   // Read current interaction state: image changes or scrolling can prevent a
   // pointer-leave event, and must not leave the carousel permanently paused.
   if(!element||document.hidden||element.contains(document.activeElement)||(pointerKind.current==='mouse'&&element.matches(':hover')))return;
   setIndex(i=>(i+1)%images.length);
  },5000);
  return ()=>window.clearInterval(timer);
 },[automatic,paused,hidden,dragging,images.length,index]);
 const move=(n:number)=>setIndex(i=>(i+n+images.length)%images.length);
 return <div ref={container} className={`imageCarousel ${className}${hero?' heroCarousel':''}`} role={images.length>1?'region':undefined} aria-roledescription={images.length>1?'carrusel':undefined} aria-label={images.length>1?`Imágenes de ${alt}`:undefined} onPointerEnter={e=>{pointerKind.current=e.pointerType}} onPointerLeave={()=>{setDragging(false);start.current=null}} onPointerDown={e=>{pointerKind.current=e.pointerType;start.current=e.clientX;setDragging(true)}} onPointerUp={e=>{if(start.current!==null&&images.length>1&&Math.abs(e.clientX-start.current)>40)move(e.clientX<start.current?1:-1);start.current=null;setDragging(false)}} onPointerCancel={()=>{start.current=null;setDragging(false)}}>
  {images.length>0&&<img key={images[Math.min(index,images.length-1)]} className="carouselImage" src={images[Math.min(index,images.length-1)]} alt={`${alt}${images.length>1?` · imagen ${index+1}`:''}`} loading={hero?'eager':'lazy'} draggable={false}/>}
  {images.length>1&&<div className="carouselControls"><button type="button" onClick={()=>move(-1)} aria-label={`Imagen anterior de ${alt}`}><ChevronLeft size={18}/></button><span aria-live={automatic&&!paused?'off':'polite'}>{index+1} / {images.length}</span><button type="button" onClick={()=>move(1)} aria-label={`Imagen siguiente de ${alt}`}><ChevronRight size={18}/></button>{automatic&&<button type="button" onClick={()=>setPaused(v=>!v)} aria-label={`${paused?'Reanudar':'Pausar'} imágenes de ${alt}`}>{paused?<Play size={16}/>:<Pause size={16}/>}</button>}</div>}
 </div>;
}
