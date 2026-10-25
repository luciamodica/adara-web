import {BarChart3,CalendarDays,ChevronDown,CreditCard,Mail,Target} from 'lucide-react';
import {WhatsappIcon} from './WhatsappIcon';
import integrations from '../shared/integrations.json';
const icons={payments:CreditCard,calendar:CalendarDays,whatsapp:WhatsappIcon,email:Mail,analytics:BarChart3,meta:Target};
export default function HomeIntegrations(){
 return <section className="platformIntegrations compactIntegrations" id="integraciones" aria-labelledby="integrations-title">
  <div className="platformSectionTitle"><h2 id="integrations-title">Conectá tus herramientas.</h2></div>
  <div className="homeIntegrationGrid">{integrations.map(item=>{const Icon=icons[item.id as keyof typeof icons];return <article key={item.id} className={'homeIntegration-'+item.id}><span className="homeIntegrationIcon"><Icon size={20} aria-hidden="true"/></span><h3>{item.name}</h3></article>})}</div>
  <details className="homeIntegrationDetails"><summary>Qué incluye cada conexión<ChevronDown size={16} aria-hidden="true"/></summary><ul>{integrations.map(item=><li key={item.id}><b>{item.name}:</b> {item.description}</li>)}</ul><p>Todos los planes permiten transferencias. Mercado Pago integrado está incluido en Inicial y Equipo; requiere conectar tu cuenta. Google Calendar, recordatorios y medición están disponibles desde Individual.</p><p>Google Calendar lleva los turnos confirmados desde Adara a tu calendario. Los avisos manuales se envían desde WhatsApp; los automáticos requieren WhatsApp Business configurado y plantillas aprobadas. El email necesita el servicio de correo habilitado.</p><p>Google Analytics y Meta Pixel usan los identificadores de tu negocio y se cargan con consentimiento del visitante.</p><a href="#planes">Comparar planes</a></details>
 </section>;
}
