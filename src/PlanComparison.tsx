import {Check,ArrowRight} from 'lucide-react';
import {money} from './api';

export const planAudience=(plan:any)=>Number(plan.max_staff||1)>1?'Para trabajar en equipo':plan.basic_only?'Para dar el primer paso':'Para hacer crecer tu agenda';
const limit=(value:number)=>Number(value)>0?'Hasta '+Number(value):'Sin límite';
const rows:Array<[string,(plan:any)=>string|boolean]>=[
 ['Agendas',p=>Number(p.max_staff||1)>1?'Hasta '+p.max_staff+' integrantes':'Una agenda'],
 ['Servicios',p=>limit(p.max_services)],
 ['Página con tu marca',()=>true],
 ['Reservas y señas por transferencia',()=>true],
 ['Mercado Pago integrado',p=>Number(p.mercadopago_enabled??1)===1],
 ['Clientes y reseñas moderadas',()=>true],
 ['Plantillas',p=>Number(p.template_level)>=3?'Todos los estilos':Number(p.template_level)===2?'Esenciales e intermedias':'Esenciales'],
 ['Promociones',p=>p.basic_only?false:limit(p.max_promotions)],
 ['Cupones',p=>p.basic_only?false:limit(p.max_coupons)],
 ['Novedades',p=>p.basic_only?false:limit(p.max_posts)],
 ['Recordatorios y lista de espera',p=>!p.basic_only],
 ['Packs, fidelidad y turnos recurrentes',p=>!p.basic_only],
 ['Conexión con Google Calendar',p=>!p.basic_only],
 ['Estadísticas de actividad',p=>!p.basic_only&&!!p.analytics_enabled],
];
export default function PlanComparison({plans,annual,onChoose}:any){
 if(!plans.length)return null;
 return <details className="planComparison"><summary>Comparar todas las funciones <span aria-hidden="true">+</span></summary><div className="planComparisonBody"><p>Compará los límites y las herramientas incluidas antes de elegir tu plan.</p><p className="comparisonHint">Deslizá la tabla hacia los lados para ver todos los planes.</p><div className="comparisonScroll" tabIndex={0} role="region" aria-label="Tabla comparativa de planes; desplazá para ver todas las columnas"><table><caption className="growthSrOnly">Funciones incluidas en cada plan de Adara Web</caption><thead><tr><th scope="col">Tu forma de trabajar</th>{plans.map((p:any)=><th scope="col" key={p.slug}><b>{p.name}</b><small>{planAudience(p)}</small><strong>{money(annual?p.annual_price_cents:p.monthly_price_cents)}<span>/{annual?'año':'mes'}</span></strong></th>)}</tr></thead><tbody>{rows.map(([label,value])=><tr key={label}><th scope="row">{label}</th>{plans.map((p:any)=>{const result=value(p);return <td key={p.slug}>{typeof result==='boolean'?result?<span className="comparisonYes"><Check size={15} aria-hidden="true"/>Incluido</span>:<span className="comparisonNo">No incluido</span>:result}</td>})}</tr>)}</tbody><tfoot><tr><th scope="row">Empezá con una prueba</th>{plans.map((p:any)=><td key={p.slug}><button className="platformTextLink" onClick={()=>onChoose(p)}>Elegir {p.name}<ArrowRight size={14}/></button></td>)}</tr></tfoot></table></div><p className="comparisonFootnote">Los recordatorios automáticos necesitan el canal de envío configurado. Google Calendar requiere conectar tu cuenta. La importación de clientes está disponible en los tres planes.</p></div></details>;
}
