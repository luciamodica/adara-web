import {useEffect,useRef,useState} from 'react';
import {api} from './api';
import {HOME_CONSENT_KEY,HOME_META_CONSENT_KEY,allowedHomePath,createHomeTracker,createHomeMetaTracker,setActiveHomeTracker,setActiveHomeMetaTracker,validHomeId,validHomePixel,readHomeChoices,needsHomeConsent} from './home-analytics';
import './home-analytics.css';

const storedChoices=()=>{try{return readHomeChoices(localStorage)}catch{return {ga:null,meta:null}}};
export default function HomeAnalytics(){
 const[config,setConfig]=useState<any>({}),[path,setPath]=useState(location.pathname),[choices,setChoices]=useState(storedChoices),[editing,setEditing]=useState(false),[draft,setDraft]=useState({ga:false,meta:false});
 const tracker=useRef<ReturnType<typeof createHomeTracker>|undefined>(undefined),metaTracker=useRef<ReturnType<typeof createHomeMetaTracker>|undefined>(undefined);
 useEffect(()=>{
  const ga=createHomeTracker(window,document),meta=createHomeMetaTracker(window,document);tracker.current=ga;metaTracker.current=meta;setActiveHomeTracker(ga);setActiveHomeMetaTracker(meta);
  const route=()=>setPath(location.pathname),storage=(e:StorageEvent)=>{if(!e.key||[HOME_CONSENT_KEY,HOME_META_CONSENT_KEY].includes(e.key))setChoices(storedChoices())};
  addEventListener('popstate',route);addEventListener('storage',storage);
  return()=>{ga.destroy();meta.destroy();setActiveHomeTracker(undefined);setActiveHomeMetaTracker(undefined);removeEventListener('popstate',route);removeEventListener('storage',storage)};
 },[]);
 useEffect(()=>{let active=true;if(allowedHomePath(path))api('/public/config').then(x=>{if(active)setConfig(x)}).catch(()=>{});return()=>{active=false}},[path]);
 useEffect(()=>{tracker.current?.sync(config,path,choices.ga==='yes');metaTracker.current?.sync(config,path,choices.meta==='yes')},[config,path,choices]);
 useEffect(()=>{setDraft({ga:choices.ga==='yes',meta:choices.meta==='yes'})},[choices]);
 const gaEnabled=!!config.home_analytics_enabled&&validHomeId(config.home_ga_id),metaEnabled=!!config.home_meta_enabled&&validHomePixel(config.home_meta_pixel_id);
 const select=(ga:boolean,meta:boolean)=>{
  const next={ga:gaEnabled?(ga?'yes':'no'):choices.ga,meta:metaEnabled?(meta?'yes':'no'):choices.meta};
  tracker.current?.sync(config,location.pathname,ga);metaTracker.current?.sync(config,location.pathname,meta);
  try{if(gaEnabled)localStorage.setItem(HOME_CONSENT_KEY,next.ga);if(metaEnabled)localStorage.setItem(HOME_META_CONSENT_KEY,next.meta)}catch{}
  setChoices(next);setEditing(false);
 };
 if(!allowedHomePath(path)||!(gaEnabled||metaEnabled))return null;
 return <>{!editing&&!needsHomeConsent(config,choices)?<button className="homePrivacyPreferences" onClick={()=>{setDraft({ga:choices.ga==='yes',meta:choices.meta==='yes'});setEditing(true)}}>Preferencias de medición</button>:<section className="homeAnalyticsConsent" aria-label="Medición del sitio Adara Web"><div><b>Vos elegís cómo medimos</b><p>Podés aceptar estadísticas y publicidad por separado. Rechazarlas permite seguir usando Adara. <a href="/privacidad" target="_blank" rel="noopener noreferrer">Política de privacidad</a>.</p></div><div className="homeConsentOptions">{gaEnabled&&<label><input type="checkbox" checked={draft.ga} onChange={e=>setDraft({...draft,ga:e.target.checked})}/><span><strong>Estadísticas (Google Analytics)</strong><small>Medir visitas, clics y registros del sitio.</small></span></label>}{metaEnabled&&<label><input type="checkbox" checked={draft.meta} onChange={e=>setDraft({...draft,meta:e.target.checked})}/><span><strong>Publicidad (Meta Pixel)</strong><small>Medir resultados y crear públicos de anuncios en Instagram y Facebook.</small></span></label>}</div><div className="homeConsentActions"><button type="button" className="outline" onClick={()=>select(false,false)}>Rechazar</button><button type="button" className="outline" onClick={()=>select(gaEnabled&&draft.ga,metaEnabled&&draft.meta)}>Guardar selección</button><button type="button" className="dark" onClick={()=>select(gaEnabled,metaEnabled)}>Aceptar todo</button></div></section>}</>;
}
