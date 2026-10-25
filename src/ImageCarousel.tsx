import {useEffect,useRef,useState} from 'react';
import {ChevronLeft,ChevronRight,X,Maximize2} from 'lucide-react';
import {createPortal} from 'react-dom';

function ImageLightbox({src,alt,onClose,onMove}:{src:string;alt:string;onClose:()=>void;onMove?:(n:number)=>void}){
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const previous=document.body.style.overflow,focus=document.activeElement as HTMLElement|null;document.body.style.overflow='hidden';dialog.current?.showModal();return()=>{document.body.style.overflow=previous;if(focus?.isConnected)focus.focus({preventScroll:true})}},[]);
 return createPortal(<dialog ref={dialog} className="imageLightbox" aria-label={`Imagen completa: ${alt}`} onCancel={event=>{event.preventDefault();onClose()}} onClick={event=>{if(event.target===event.currentTarget)onClose()}} onKeyDown={event=>{if(onMove&&['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();onMove(event.key==='ArrowRight'?1:-1)}}}><button className="lightboxClose" type="button" autoFocus aria-label="Cerrar imagen ampliada" onClick={onClose}><X size={24}/></button><img src={src} alt={alt}/>{onMove&&<div className="lightboxArrows"><button type="button" aria-label="Imagen anterior ampliada" onClick={()=>onMove(-1)}><ChevronLeft/></button><button type="button" aria-label="Imagen siguiente ampliada" onClick={()=>onMove(1)}><ChevronRight/></button></div>}</dialog>,document.body);
}
export function ZoomImage({src,alt}:{src:string;alt:string}){
 const [open,setOpen]=useState(false);
 return <><button className="imageZoomTrigger" type="button" aria-label={`Ampliar imagen: ${alt}`} onClick={()=>setOpen(true)}><img src={src} alt={alt} loading="lazy"/><Maximize2 size={16} aria-hidden="true"/></button>{open&&<ImageLightbox src={src} alt={alt} onClose={()=>setOpen(false)}/>}</>;
}

export function galleryImages(value:any,fallback=''):string[] {
 return Array.isArray(value)&&value.length?value.filter(x=>typeof x==='string'):fallback?[fallback]:[];
}

export default function ImageCarousel({images,alt,className='',hero=false}:{images:string[];alt:string;className?:string;hero?:boolean}) {
 const[index,setIndex]=useState(0),[zoom,setZoom]=useState(false),start=useRef<number|null>(null),moved=useRef(false);
 useEffect(()=>setIndex(0),[images.join('\n')]);
 useEffect(()=>{if(hero&&images.length>1){const next=new Image();next.src=images[(index+1)%images.length]}},[hero,index,images.join('\n')]);
 const move=(n:number)=>setIndex(i=>(i+n+images.length)%images.length);
 return <div className={`imageCarousel ${className}${hero?' heroCarousel':''}`} role={images.length>1?'region':undefined} aria-roledescription={images.length>1?'carrusel':undefined} aria-label={images.length>1?`Imágenes de ${alt}`:undefined}
  onPointerDown={e=>{start.current=e.clientX;moved.current=false}}
  onPointerUp={e=>{if(start.current!==null&&Math.abs(e.clientX-start.current)>40){moved.current=true;if(images.length>1)move(e.clientX<start.current?1:-1)}start.current=null}}
  onPointerCancel={()=>{start.current=null}}
  onPointerLeave={()=>{start.current=null}}>
  {images.length>0&&<button type="button" className="carouselZoom" aria-label={`Ampliar imagen: ${alt}`} onClick={()=>{if(!moved.current)setZoom(true)}}><img key={images[Math.min(index,images.length-1)]} className="carouselImage" src={images[Math.min(index,images.length-1)]} alt={`${alt}${images.length>1?` · imagen ${index+1}`:''}`} loading={hero?'eager':'lazy'} draggable={false}/></button>}
  {zoom&&images.length>0&&<ImageLightbox src={images[Math.min(index,images.length-1)]} alt={alt} onClose={()=>setZoom(false)} onMove={images.length>1?move:undefined}/>}
  {images.length>1&&<div className="carouselControls"><button type="button" onClick={()=>move(-1)} aria-label={`Imagen anterior de ${alt}`}><ChevronLeft size={18}/></button><span className="srOnly" aria-live="polite">Imagen {index+1} de {images.length}</span><button type="button" onClick={()=>move(1)} aria-label={`Imagen siguiente de ${alt}`}><ChevronRight size={18}/></button></div>}
 </div>;
}
