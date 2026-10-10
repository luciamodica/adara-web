import {useEffect,useRef,useState} from 'react';
import {ChevronLeft,ChevronRight} from 'lucide-react';

export function galleryImages(value:any,fallback=''):string[] {
 return Array.isArray(value)&&value.length?value.filter(x=>typeof x==='string'):fallback?[fallback]:[];
}

export default function ImageCarousel({images,alt,className='',hero=false}:{images:string[];alt:string;className?:string;hero?:boolean}) {
 const [index,setIndex]=useState(0),start=useRef<number|null>(null);
 useEffect(()=>{setIndex(0)},[images.join('\n')]);
 const move=(n:number)=>setIndex(i=>(i+n+images.length)%images.length);
 return <div className={`imageCarousel ${className}${hero?' heroCarousel':''}`} role={images.length>1?'region':undefined} aria-label={images.length>1?`Imágenes de ${alt}`:undefined} onPointerDown={e=>{start.current=e.clientX}} onPointerUp={e=>{if(start.current!==null&&images.length>1&&Math.abs(e.clientX-start.current)>40)move(e.clientX<start.current?1:-1);start.current=null}} onPointerCancel={()=>{start.current=null}}>
  {images.length>0&&<img className="carouselImage" src={images[Math.min(index,images.length-1)]} alt={`${alt}${images.length>1?` · imagen ${index+1}`:''}`} loading={hero?'eager':'lazy'} draggable={false}/>}
  {images.length>1&&<div className="carouselControls"><button type="button" onClick={()=>move(-1)} aria-label={`Imagen anterior de ${alt}`}><ChevronLeft size={18}/></button><span aria-live="polite">{index+1} / {images.length}</span><button type="button" onClick={()=>move(1)} aria-label={`Imagen siguiente de ${alt}`}><ChevronRight size={18}/></button></div>}
 </div>;
}
