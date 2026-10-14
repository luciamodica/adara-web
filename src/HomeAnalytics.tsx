import {useEffect,useRef,useState} from 'react';
import {api} from './api';
import {HOME_CONSENT_KEY,allowedHomePath,createHomeTracker,setActiveHomeTracker,validHomeId} from './home-analytics';
import './home-analytics.css';

const storedChoice=()=>{try{const choice=localStorage.getItem(HOME_CONSENT_KEY);return choice==='yes'||choice==='no'?choice:null}catch{return null}};
export default function HomeAnalytics(){
 const[config,setConfig]=useState<any>({}),[path,setPath]=useState(location.pathname),[choice,setChoice]=useState<string|null>(storedChoice),[editing,setEditing]=useState(false),tracker=useRef<ReturnType<typeof createHomeTracker>|undefined>(undefined);
 useEffect(()=>{const t=createHomeTracker(window,document);tracker.current=t;setActiveHomeTracker(t);const route=()=>setPath(location.pathname),storage=(e:StorageEvent)=>{if(e.key===HOME_CONSENT_KEY)setChoice(storedChoice())};addEventListener('popstate',route);addEventListener('storage',storage);return()=>{t.destroy();setActiveHomeTracker(undefined);removeEventListener('popstate',route);removeEventListener('storage',storage)}},[]);
 useEffect(()=>{let active=true;if(allowedHomePath(path))api('/public/config').then(x=>{if(active)setConfig(x)}).catch(()=>{});return()=>{active=false}},[path]);
 useEffect(()=>{tracker.current?.sync(config,path,choice==='yes')},[config,path,choice]);
 const select=(value:string)=>{tracker.current?.sync(config,location.pathname,value==='yes');try{localStorage.setItem(HOME_CONSENT_KEY,value)}catch{}setChoice(value);setEditing(false)};
 if(!allowedHomePath(path)||!config.home_analytics_enabled||!validHomeId(config.home_ga_id))return null;
 return <>{choice&&!editing?<button className="homePrivacyPreferences" onClick={()=>setEditing(true)}>Preferencias de medición</button>:<section className="homeAnalyticsConsent" aria-label="Medición del sitio Adara Web"><div><b>¿Nos ayudás a mejorar Adara?</b><p>Con tu permiso usamos Google Analytics para medir visitas y registros en nuestro sitio. <a href="/privacidad" target="_blank" rel="noopener noreferrer">Política de privacidad</a>.</p></div><div className="homeConsentActions"><button type="button" className="outline" onClick={()=>select('no')}>Rechazar</button><button type="button" className="dark" onClick={()=>select('yes')}>Aceptar medición</button></div></section>}</>;
}
