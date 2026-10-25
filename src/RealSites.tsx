import {useEffect,useState} from 'react';
import {ArrowUpRight,ChevronLeft,ChevronRight,Globe} from 'lucide-react';
import {api} from './api';
import './real-sites.css';

export default function RealSites(){
 const[sites,setSites]=useState<any[]>([]),[index,setIndex]=useState(0),[loading,setLoading]=useState(true),[error,setError]=useState(false);
 const load=()=>{setLoading(true);setError(false);api('/public/home/sites').then(rows=>{setSites(rows);setIndex(0)}).catch(()=>setError(true)).finally(()=>setLoading(false))};
 useEffect(()=>{load()},[]);
 const site=sites[index%Math.max(1,sites.length)],color=(value:string,fallback:string)=>/^#[\da-f]{6}$/i.test(value)?value:fallback;
 return <section className="realSites" id="sitios-reales" aria-labelledby="real-sites-title"><div className="realSitesHeading"><span className="platformEyebrow">CREADOS CON ADARA</span><h2 id="real-sites-title">Sitios reales.<br/>Negocios con identidad.</h2><p>Conocé las páginas de profesionales que usan Adara Web.</p></div>
  {loading?<div className="realSitesEmpty" role="status">Cargando sitios…</div>:error?<div className="realSitesEmpty"><p>No pudimos cargar los sitios.</p><button className="platformSecondary" onClick={load}>Reintentar</button></div>:site?<>
   <a className="realSiteCard" href={site.path} target="_blank" rel="noopener noreferrer" aria-label={'Visitar el sitio de '+site.name} style={{'--site-primary':color(site.primary_color,'#0758df'),'--site-bg':color(site.background_color,'#f6faff')} as any}>
    <div className="realSiteBar"><span><Globe size={13} aria-hidden="true"/>Página publicada en Adara</span><ArrowUpRight size={17} aria-hidden="true"/></div>
    <div className={'realSiteImage '+(site.image?'':'withoutImage')}>{site.image&&<img src={site.image} alt={'Portada de '+site.name}/>}<div className="realSiteBrand">{site.logo_image&&<img src={site.logo_image} alt=""/>}<span>{site.category||'Profesional independiente'}</span><h3>{site.name}</h3></div></div>
    <div className="realSiteFooter"><p>{site.hero_title||'Conocé sus servicios y su página.'}</p><span>Visitar sitio<ArrowUpRight size={16} aria-hidden="true"/></span></div>
   </a>
   {sites.length>1&&<div className="realSiteControls"><button type="button" aria-label="Ver sitio anterior" onClick={()=>setIndex((index+sites.length-1)%sites.length)}><ChevronLeft size={18}/></button><p aria-live="polite">{index+1} de {sites.length} · {site.name}</p><button type="button" aria-label="Ver siguiente sitio" onClick={()=>setIndex((index+1)%sites.length)}><ChevronRight size={18}/></button></div>}
  </>:<div className="realSitesEmpty"><Globe size={30}/><p>Las próximas páginas de profesionales aparecerán acá.</p><a href="/registro" className="platformSecondary">Crear mi página</a></div>}
 </section>;
}
