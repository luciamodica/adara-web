import {useEffect,useState} from 'react';
import {Moon,Sun} from 'lucide-react';
import './color-mode.css';

const KEY='adara-color-mode';
type Mode='light'|'dark';
export function initialMode():Mode{
 try{const saved=localStorage.getItem(KEY);if(saved==='light'||saved==='dark')return saved}catch{}
 return window.matchMedia?.('(prefers-color-scheme: dark)').matches?'dark':'light';
}
export default function ThemeToggle(){
 const[mode,setMode]=useState<Mode>(initialMode);
 useEffect(()=>{document.documentElement.dataset.colorMode=mode;document.documentElement.style.colorScheme=mode},[mode]);
 useEffect(()=>{
  const media=window.matchMedia('(prefers-color-scheme: dark)');
  const system=()=>{try{const saved=localStorage.getItem(KEY);if(saved==='light'||saved==='dark')return}catch{}setMode(media.matches?'dark':'light')};
  const sync=(event:StorageEvent)=>{if(event.key===KEY||event.key===null)setMode(initialMode())};
  media.addEventListener('change',system);window.addEventListener('storage',sync);
  return()=>{media.removeEventListener('change',system);window.removeEventListener('storage',sync)};
 },[]);
 function toggle(){const next=mode==='dark'?'light':'dark';setMode(next);try{localStorage.setItem(KEY,next)}catch{}}
 return <button type="button" className="colorModeToggle" onClick={toggle} aria-label={mode==='dark'?'Activar modo claro':'Activar modo oscuro'} title={mode==='dark'?'Activar modo claro':'Activar modo oscuro'} aria-pressed={mode==='dark'}>{mode==='dark'?<Sun size={17}/>:<Moon size={17}/>}<span>{mode==='dark'?'Modo claro':'Modo oscuro'}</span></button>;
}
