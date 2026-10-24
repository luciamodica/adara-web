import {BarChart3,CalendarDays,ChevronDown,CreditCard,Mail,Target} from 'lucide-react';
import {WhatsappIcon} from './WhatsappIcon';
import integrations from '../shared/integrations.json';

const icons={payments:CreditCard,calendar:CalendarDays,whatsapp:WhatsappIcon,email:Mail,analytics:BarChart3,meta:Target};
export default function HomeIntegrations(){
 return <section className="platformIntegrations" id="integraciones" aria-labelledby="integrations-title">
  <div className="platformSectionTitle"><span className="platformEyebrow">CONECTÁ LO QUE YA USÁS</span><h2 id="integrations-title">Tus herramientas,<br/>en un mismo lugar.</h2><p>Cobros, calendario y comunicación para acompañar cada reserva.</p></div>
  <div className="homeIntegrationGrid">{integrations.map(item=>{const Icon=icons[item.id as keyof typeof icons];return <article key={item.id} className={'homeIntegration-'+item.id}><span className="homeIntegrationIcon"><Icon size={21} aria-hidden="true"/></span><div><h3>{item.name}</h3><p>{item.description}</p></div></article>})}</div>
  <p className="homeIntegrationNote">Google Calendar, recordatorios y medición: desde el plan Individual.</p>
  <details className="homeIntegrationDetails"><summary>Disponibilidad y configuración<ChevronDown size={16} aria-hidden="true"/></summary><p>Mercado Pago requiere conectar tu cuenta. Google Calendar sincroniza los turnos confirmados desde Adara hacia tu calendario, una vez habilitada la conexión.</p><p>Los mensajes manuales se revisan y envían desde WhatsApp. El envío automático requiere WhatsApp Business configurado y plantillas aprobadas; los emails necesitan el servicio de correo habilitado en la plataforma.</p><p>Google Analytics y Meta Pixel usan los identificadores de tu negocio y se cargan con el consentimiento del visitante. Consultá las funciones de cada plan antes de elegir.</p><a href="#planes">Comparar planes</a></details>
 </section>;
}
