import {useEffect,useRef,useState} from 'react';
import {ArrowRight,CalendarDays,Check,ChevronDown,CreditCard,Globe,Menu,X} from 'lucide-react';
import HomeIntegrations from './HomeIntegrations';
import PlanComparison from './PlanComparison';
import PublicTestimonials from './PublicTestimonials';
import RealSites from './RealSites';
import {PlatformSupport} from './PlatformSupport';
import PlatformSocials from './PlatformSocials';
import {WhatsappIcon} from './WhatsappIcon';
import PlatformLogo from './PlatformLogo';
import {usePublicLegal,contactEmail} from './Legal';
import {trackHomeEvent} from './home-analytics';
import {api,money} from './api';
import {BRAND} from './brand';
import industries from '../shared/industries.json';
import './management-update.css';
import './landing.css';
import './visual-home.css';
import './clear-home.css';

function go(path:string){if(path.startsWith('/registro'))trackHomeEvent('registration_start');history.pushState({},'',path);window.dispatchEvent(new PopStateEvent('popstate'))}
function Wordmark(){return <a className="platformWordmark" href="/" aria-label="Adara Web, inicio"><PlatformLogo/></a>}
export default function Landing(){
 const{legal}=usePublicLegal(),menuButton=useRef<HTMLButtonElement>(null);
 const[contact,setContact]=useState<any>({}),[faqs,setFaqs]=useState<any[]>([]),[plans,setPlans]=useState<any[]>([]),[annual,setAnnual]=useState(false),[trialDays,setTrialDays]=useState<number>(BRAND.trialDays),[error,setError]=useState(''),[menu,setMenu]=useState(false),[moreFaqs,setMoreFaqs]=useState(false);
 const loadPlans=()=>{setError('');api('/public/plans').then(setPlans).catch(()=>setError('No pudimos cargar los planes. Intentá nuevamente.'))};
 useEffect(()=>{if(!location.hash)return;try{document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView({block:'start'})}catch{}},[]);
 useEffect(()=>{api('/public/faqs').then(setFaqs).catch(()=>{});loadPlans();api('/public/config').then((x:any)=>{setTrialDays(Number(x.trial_days||BRAND.trialDays));setContact(x)}).catch(()=>{})},[]);
 useEffect(()=>{if(!menu)return;const close=(event:KeyboardEvent)=>{if(event.key==='Escape'){setMenu(false);menuButton.current?.focus()}};window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close)},[menu]);
 return <div className="platformHome visualHome clearHome">
  <header className="platformHeader"><Wordmark/><a className="clearHeaderLogin" href="/login">Ingresar<ArrowRight size={15}/></a><button ref={menuButton} className="platformMenu" aria-label={menu?'Cerrar menú':'Abrir menú'} aria-expanded={menu} aria-controls="platform-navigation" onClick={()=>setMenu(!menu)}>{menu?<X size={22}/>:<Menu size={22}/>}</button><nav id="platform-navigation" className={menu?'open':''} aria-label="Navegación principal">{[['#sitios-reales','Sitios reales'],['#funciones','Qué incluye'],['#planes','Planes']].map(([href,label])=><a key={href} href={href} onClick={()=>setMenu(false)}>{label}</a>)}<button className="platformButton" onClick={()=>go('/registro')}>Probar gratis<ArrowRight size={15}/></button></nav></header>
  <main>
   <section className="visualHero"><div className="clearHeroCopy"><span className="platformEyebrow">TU NEGOCIO, A TU MANERA.</span><h1>Creá tu web.<br/><span>Recibí turnos.</span></h1><p>Tu marca, tus servicios y tu agenda en un solo lugar.</p><div className="platformHeroActions"><button className="platformButton" onClick={()=>go('/registro')}>Probar gratis<ArrowRight size={16}/></button><a className="visualHeroLink" href="#planes">Conocer los planes<ArrowRight size={14}/></a></div><small><Check size={13}/>{trialDays} días gratis · Sin tarjeta para comenzar</small></div><RealSites hero/></section>
   <section className="visualFeatures" id="funciones" aria-labelledby="visual-features-title"><div><span className="platformEyebrow">HECHA PARA TU DÍA A DÍA</span><h2 id="visual-features-title">Vos hacés lo tuyo.<br/>Adara te ayuda con el resto.</h2></div><div className="visualFeatureList">{[{Icon:Globe,title:'Tu página, a tu manera.',text:'Tus servicios, imágenes y estilo. Todo con tu marca.'},{Icon:CalendarDays,title:'Tus turnos, organizados.',text:'Reservas online y una agenda que manejás desde tu panel.'},{Icon:CreditCard,title:'Tus cobros, en tu cuenta.',text:'Elegí seña, pago completo o cobro al atender, según tu plan.'}].map(({Icon,title,text})=><article key={title}><Icon size={20} aria-hidden="true"/><div><h3>{title}</h3><p>{text}</p></div></article>)}</div></section>

   <section id="planes" className="platformPlans"><div className="platformSectionTitle"><span className="platformEyebrow">PLANES</span><h2>Elegí cómo querés empezar.</h2><p>Una agenda o un equipo. Vos elegís.</p></div><div className="platformBilling" aria-label="Período de facturación"><button aria-pressed={!annual} className={!annual?'active':''} onClick={()=>setAnnual(false)}>Mensual</button><button aria-pressed={annual} className={annual?'active':''} onClick={()=>setAnnual(true)}>Anual</button></div>{error&&<div role="alert" className="platformPlanError">{error}<button className="platformTextLink" onClick={loadPlans}>Reintentar</button></div>}<div className="platformPlanGrid">{plans.map((p:any)=><article className={p.highlighted?'highlighted':''} key={p.slug}>{!!p.highlighted&&<span className="platformPlanBadge">RECOMENDADO</span>}<div className="visualPlanHeading"><h3>{p.name}</h3><div className="platformPrice">{money(annual?p.annual_price_cents:p.monthly_price_cents)}<small> / {annual?'año':'mes'}</small></div></div><p className="visualPlanDescription">{p.description}</p>{annual&&<p className="platformAnnual">Equivale a {money(Math.round(p.annual_price_cents/12))} por mes, con pago anual.</p>}<button className={p.highlighted?'platformButton':'platformButton outline'} onClick={()=>go(`/registro?plan=${p.slug}&cycle=${annual?'annual':'monthly'}`)}>Elegir este plan<ArrowRight size={16}/></button><p className="visualPlanPayment">{Number(p.mercadopago_enabled)===1?'Mercado Pago + transferencias':'Cobros por transferencia'}</p><details className="visualPlanDetails"><summary>Qué incluye<ChevronDown size={14}/></summary><div className="platformPlanFeatures">{p.features.map((feature:string)=><span key={feature}><Check size={16}/>{feature}</span>)}</div></details></article>)}</div><PlanComparison plans={plans} annual={annual} onChoose={(p:any)=>go(`/registro?plan=${p.slug}&cycle=${annual?'annual':'monthly'}`)}/><p className="platformPlanFootnote">{contact.subscription_transfer_available?'Elegí Mercado Pago o transferencia para pagar tu suscripción.':'Elegí tu plan y activá la suscripción desde tu panel.'}</p></section>
   <HomeIntegrations/>
   <PublicTestimonials/>
   {faqs.length>0&&<section id="preguntas" className="platformFaq"><h2>¿Te quedó alguna duda?</h2><div>{faqs.slice(0,moreFaqs?undefined:4).map(f=><details key={f.id}><summary>{f.question}<ChevronDown size={17}/></summary><p>{f.answer}</p></details>)}</div>{faqs.length>4&&<button type="button" className="visualMoreFaqs" aria-expanded={moreFaqs} onClick={()=>setMoreFaqs(!moreFaqs)}>{moreFaqs?'Ver menos preguntas':'Ver todas las preguntas'}<ChevronDown size={15}/></button>}</section>}
   <PlatformSupport contact={contact}/>
  </main>
  <footer className="platformHomeFooter"><div className="platformFooterGrid"><div><Wordmark/><p className="visualFooterNote">Tu negocio, con identidad.</p><PlatformSocials socials={contact.home_socials}/></div><div><b>PRODUCTO</b><a href="#planes">Planes</a><a href="#integraciones">Integraciones</a>{industries.map(industry=><a key={industry.slug} href={'/para/'+industry.slug}>Para {industry.label.toLowerCase()}</a>)}</div><div><b>TU ESPACIO</b><a href="/login">Ingresar</a><a href="/registro" onClick={()=>trackHomeEvent('registration_start')}>Crear cuenta</a><a href="#soporte">Soporte</a></div><div><b>CONTACTO Y LEGAL</b><a href={'mailto:'+(legal?.profile?.email||contactEmail)}>Contacto</a><a href="/privacidad">Privacidad</a><a href="/terminos">Términos y condiciones</a><a href="/condiciones-de-suscripcion">Condiciones de suscripción</a></div></div><div className="platformFooterBottom"><span>© {new Date().getFullYear()} Adara Web</span><span>Pensada para tu negocio.</span></div></footer>
  {contact.home_whatsapp_enabled&&contact.home_whatsapp_phone&&<a className="platformWhatsappFloat" href={`https://wa.me/${contact.home_whatsapp_phone}?text=${encodeURIComponent(contact.home_whatsapp_message||'Hola, quiero conocer Adara Web.')}`} target="_blank" rel="noopener noreferrer" aria-label="Soporte de Adara por WhatsApp"><WhatsappIcon/></a>}
 </div>;
}
