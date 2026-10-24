import {lazy,Suspense,useEffect,useState} from 'react';
import Landing from './Landing';

// Visitors can explore the home without downloading the management panels.
const App=lazy(()=>import('./App'));
const IndustryPage=lazy(()=>import('./IndustryPage'));

export default function Router(){
  const [path,setPath]=useState(location.pathname);
  useEffect(()=>{
    const onNavigation=()=>setPath(location.pathname);
    addEventListener('popstate',onNavigation);
    return()=>removeEventListener('popstate',onNavigation);
  },[]);
  useEffect(()=>{if(!location.hash)window.scrollTo(0,0)},[path]);
  if(path==='/')return <Landing/>;
  if(path.startsWith('/para/'))return <Suspense fallback={<main className="authBg" role="status"><p>Cargando…</p></main>}><IndustryPage slug={decodeURIComponent(path.split('/')[2]||'')}/></Suspense>;
  return <Suspense fallback={<main className="authBg" role="status"><p>Cargando tu espacio…</p></main>}><App/></Suspense>;
}
