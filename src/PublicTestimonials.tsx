import {useEffect,useState} from 'react';
import {ArrowUpRight,MessageSquareQuote} from 'lucide-react';
import {api} from './api';

export default function PublicTestimonials(){
 const[rows,setRows]=useState<any[]>([]),[all,setAll]=useState(false);
 useEffect(()=>{let active=true;api('/public/testimonials').then(x=>{if(active)setRows(x)}).catch(()=>{});return()=>{active=false}},[]);
 if(!rows.length)return null;
 return <section className="platformTestimonials" id="experiencias"><div className="platformSectionTitle"><span className="platformEyebrow">PROFESIONALES QUE USAN ADARA</span><h2>Su negocio. Su experiencia.</h2><p>Opiniones compartidas por quienes organizan sus turnos con Adara Web.</p></div><div className="testimonialGrid">{rows.slice(0,all?12:3).map(row=><figure key={row.id}><MessageSquareQuote size={26} aria-hidden="true"/><blockquote>{row.quote}</blockquote><figcaption><div className="testimonialAvatar">{row.logo_image?<img src={row.logo_image} alt="" loading="lazy"/>:row.name[0]}</div><div><b>{row.name}</b><span>{row.role||row.business_name}</span>{row.role&&<small>{row.business_name}</small>}</div></figcaption><a href={row.path} target="_blank" rel="noopener noreferrer">Conocer su página<ArrowUpRight size={15}/></a></figure>)}</div>{rows.length>3&&<button className="platformTextLink" onClick={()=>setAll(!all)}>{all?'Ver menos opiniones':'Ver más opiniones'}</button>}</section>;
}
