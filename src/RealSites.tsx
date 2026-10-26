import {useEffect,useRef,useState} from 'react';
import {ArrowUpRight,ChevronDown,ChevronLeft,ChevronRight} from 'lucide-react';
import {api} from './api';
import './real-sites.css';

export default function RealSites({hero=false}:{hero?:boolean}){
 const[sites,setSites]=useState<any[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(false),[expanded,setExpanded]=useState(false),[active,setActive]=useState(0),rail=useRef<HTMLDivElement>(null);
 const load=()=>{setLoading(true);setError(false);api('/public/home/sites').then(rows=>{
  const temporary=(site:any)=>/\/reservar\/(?:prueba|demo|test|revision)(?:[-\d]|$)/i.test(site.path);
  setSites(rows.filter((site:any)=>site.image).sort((a:any,b:any)=>Number(temporary(a))-Number(temporary(b))));setActive(0);
 }).catch(()=>setError(true)).finally(()=>setLoading(false))};
 useEffect(()=>{load()},[]);
 const visible=sites.slice(0,expanded?8:3),color=(value:string,fallback:string)=>/^#[\da-f]{6}$/i.test(value)?value:fallback;
 const move=(step:number)=>{const element=rail.current,index=Math.max(0,Math.min(visible.length-1,active+step));if(!element)return;const card=element.children[index] as HTMLElement;const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;element.scrollTo({left:card.offsetLeft,behavior:reduced?'auto':'smooth'});setActive(index)};
 const sync=()=>{const element=rail.current;if(!element)return;let closest=0;Array.from(element.children).forEach((node,i)=>{if(Math.abs((node as HTMLElement).offsetLeft-element.scrollLeft)<Math.abs((element.children[closest] as HTMLElement).offsetLeft-element.scrollLeft))closest=i});setActive(closest)};
 return <section className={"realSites visualSites"+(hero?" heroClientSites":"")} data-site-count={visible.length} id="sitios-reales" aria-labelledby="real-sites-title">
  <div className="realSitesHeading"><div><span className="platformEyebrow">CREADOS CON ADARA</span><h2 id="real-sites-title">{hero?"Sus negocios, sus webs.":"Un espacio para cada negocio."}</h2></div><p>Son páginas reales. Entrá y conocelas.<ArrowUpRight size={16} aria-hidden="true"/></p></div>
  {loading?<div className="visualSiteSkeletons" role="status" aria-label="Cargando sitios"><i/><i/><i/></div>:error?<div className="realSitesEmpty"><p>No pudimos cargar los sitios.</p><button className="platformSecondary" onClick={load}>Reintentar</button></div>:sites.length?<>
   <div className="realSitesRail" ref={rail} onScroll={sync} role="list" aria-label="Sitios creados con Adara">
    {visible.map((site,i)=><article className="visualSite" key={site.path} role="listitem" style={{'--site-primary':color(site.primary_color,'#0758df'),'--site-bg':color(site.background_color,'#f6faff')} as any}>
     <a className="realSiteCard" href={site.path} target="_blank" rel="noopener noreferrer" aria-label={'Visitar el sitio de '+site.name}>
      <div className="realSiteBrowser" aria-hidden="true"><span><i/><i/><i/></span><small>{site.name}</small><ArrowUpRight size={13}/></div>
      <div className="realSiteImage"><img src={site.image} alt={'Portada de '+site.name} loading={i===0?'eager':'lazy'} fetchPriority={i===0?'high':'auto'}/><div className="realSiteBrand"><span>{site.category||'Tu próximo momento'}</span><h3>{site.hero_title||site.name}</h3><span className="realSiteVisit">Conocer el sitio<ArrowUpRight size={14}/></span></div></div>
     </a>
     <div className="visualSiteCaption"><div>{site.logo_image&&<img src={site.logo_image} alt="" loading="lazy"/>}<div><h3>{site.name}</h3><p>{site.category||'Creado con Adara Web'}</p></div></div><ArrowUpRight size={18} aria-hidden="true"/></div>
    </article>)}
   </div>
   <div className="visualSiteNavigation"><div className="realSiteControls"><button type="button" aria-label="Ver sitio anterior" disabled={active===0} onClick={()=>move(-1)}><ChevronLeft size={18}/></button><span aria-live="polite">{active+1} / {visible.length}</span><button type="button" aria-label="Ver siguiente sitio" disabled={active===visible.length-1} onClick={()=>move(1)}><ChevronRight size={18}/></button></div>{sites.length>3&&<button type="button" className="visualMoreSites" aria-expanded={expanded} onClick={()=>{setExpanded(!expanded);setActive(0);rail.current?.scrollTo({left:0})}}>{expanded?'Ver menos sitios':'Ver más sitios'}<ChevronDown size={15} aria-hidden="true"/></button>}</div>
  </>:<div className="realSitesEmpty"><p>Tu negocio también puede tener su propia web.</p><a href="/registro" className="platformSecondary">Crear mi página</a></div>}
 </section>;
}
