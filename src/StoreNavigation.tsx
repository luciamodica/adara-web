import {useEffect,useId,useState} from 'react';
import {Menu,X} from 'lucide-react';
export default function StoreNavigation({b,data}:any){
 const [open,setOpen]=useState(false),id=useId();
 useEffect(()=>{const close=(event:KeyboardEvent)=>{if(event.key==='Escape')setOpen(false)};addEventListener('keydown',close);return()=>removeEventListener('keydown',close)},[]);
 return <header className="storeNav"><a className="storeIdentity" href="#portada" onClick={()=>setOpen(false)}>{b.logo_image&&<img src={b.logo_image} alt=""/>}<b>{b.name}</b></a><button className="storeMenuToggle" type="button" aria-label={open?'Cerrar menú del sitio':'Abrir menú del sitio'} aria-expanded={open} aria-controls={id} onClick={()=>setOpen(!open)}>{open?<X size={23}/>:<Menu size={23}/>}</button><nav id={id} className={open?'storeLinks open':'storeLinks'} aria-label="Menú del sitio de reservas">{[[b.show_services,'servicios','Servicios'],[b.show_promotions&&data.promotions.length,'promociones','Promociones'],[b.show_posts&&data.posts.length,'novedades','Novedades'],[b.show_faqs&&data.faqs?.length,'preguntas','Preguntas'],[true,'resenas','Reseñas'],[b.show_booking,'reservar','Reservar']].filter(([visible])=>visible).map(([,anchor,label])=><a key={String(anchor)} className={anchor==='reservar'?'storeCta':''} href={'#'+anchor} onClick={()=>setOpen(false)}>{label}</a>)}</nav></header>;
}
