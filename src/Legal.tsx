import PlatformLogo from './PlatformLogo';
import {useEffect,useState} from 'react';
import {ArrowLeft,ExternalLink,Mail} from 'lucide-react';
import {api} from './api';
import './legal.css';

export type LegalKind='terms'|'privacy'|'subscription';
export type LegalDocumentData={title:string;body:string};
export type LegalProfile={name:string;email:string;street:string;city:string;province:string;country:string;tax_id:string};
export type LegalData={published:boolean;version?:number;published_at?:string;profile?:LegalProfile;documents?:Record<LegalKind,LegalDocumentData>};
export const contactEmail='Adaraweb23@gmail.com';
export const legalLinks=[['terms','Términos y condiciones','/terminos'],['privacy','Privacidad','/privacidad'],['subscription','Condiciones de suscripción','/condiciones-de-suscripcion']] as const;

export function usePublicLegal(enabled=true){
 const[legal,setLegal]=useState<LegalData>(),[error,setError]=useState(''),[reload,setReload]=useState(0);
 useEffect(()=>{if(!enabled)return;let alive=true;setError('');api('/public/legal').then(value=>{if(alive)setLegal(value)}).catch(()=>{if(alive)setError('No pudimos cargar la información legal. Intentá nuevamente.')});return()=>{alive=false}},[enabled,reload]);
 return {legal:enabled?legal:{published:false},error,loading:enabled&&!legal&&!error,refresh:()=>setReload(value=>value+1)};
}

export function LegalText({document}: {document:LegalDocumentData}){
 return <div className="legalText">{document.body.split(/\n\s*\n/).filter(Boolean).map((block,index)=>{
  const lines=block.split('\n');
  return <section key={index}>{lines[0].startsWith('## ')?<><h2>{lines[0].slice(3)}</h2>{lines.length>1&&<p>{lines.slice(1).join('\n')}</p>}</>:<p>{block}</p>}</section>;
 })}</div>;
}

export default function LegalPage({kind}:{kind:LegalKind}){
 const {legal,error,loading,refresh}=usePublicLegal(),document=legal?.documents?.[kind];
 const title=legalLinks.find(([key])=>key===kind)![1];
 return <div className="adaraLegalPage">
  <header className="adaraLegalHeader"><a href="/" aria-label="Adara Web, inicio"><PlatformLogo/></a><a className="outline" href="/"><ArrowLeft size={16}/>Volver al inicio</a></header>
  <main className="adaraLegalMain"><div className="adaraLegalIntro"><span className="kicker">INFORMACIÓN LEGAL</span><h1>{document?.title||title}</h1>{legal?.published_at&&<p>Publicado el {new Date(legal.published_at).toLocaleDateString('es-AR',{timeZone:'America/Argentina/Buenos_Aires'})}.</p>}</div>
   <nav className="adaraLegalNav" aria-label="Documentos legales">{legalLinks.map(([key,label,path])=><a key={key} href={path} aria-current={kind===key?'page':undefined}>{label}</a>)}</nav>
   {loading?<p role="status">Cargando documento…</p>:error?<div role="alert" className="error">{error}<button className="outline" onClick={refresh}>Reintentar</button></div>:document?<article className="adaraLegalArticle"><LegalText document={document}/></article>:<div className="panel"><h2>Publicación en preparación</h2><p>Los documentos legales todavía están en revisión. Para consultas, escribí a <a href={'mailto:'+contactEmail}>{contactEmail}</a>.</p></div>}
   <footer className="adaraLegalContact"><a href={'mailto:'+(legal?.profile?.email||contactEmail)}><Mail size={18}/>{legal?.profile?.email||contactEmail}</a>{kind==='privacy'&&<a href="https://www.argentina.gob.ar/aaip/datospersonales/derechos" target="_blank" rel="noopener noreferrer">Derechos sobre datos personales <ExternalLink size={15}/></a>}</footer>
  </main>
 </div>;
}

export function ReservationPrivacyNotice(){const{legal}=usePublicLegal();return legal?.published?<p className="reservationPrivacyNotice">Tus datos se utilizan para gestionar la reserva con esta profesional. Consultá la <a href="/privacidad" target="_blank" rel="noopener noreferrer">política de privacidad de Adara</a> y las condiciones del negocio.</p>:null;}
