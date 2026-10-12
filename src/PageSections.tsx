import {ArrowUp,ArrowDown} from 'lucide-react';
export const PAGE_SECTIONS=[['hero','Portada'],['booking','Turnos'],['promotions','Promociones'],['services','Servicios'],['posts','Novedades'],['faqs','Preguntas frecuentes']] as const;
export function sectionOrder(value:any):string[]{return Array.isArray(value)&&value.length===6&&new Set(value).size===6&&value.every(id=>PAGE_SECTIONS.some(([key])=>id===key))?value:PAGE_SECTIONS.map(([key])=>key)}
export default function PageSections({form,onChange}:any){
 const order=sectionOrder(form.section_order),move=(i:number,n:number)=>{const next=[...order];[next[i],next[i+n]]=[next[i+n],next[i]];onChange({...form,section_order:next})};
 return <div className="panel sectionOrderEditor"><h2>Orden de las secciones</h2><p className="mutedText">Subí o bajá cada sección. La cabecera y el pie quedan fijos; las secciones ocultas conservan su posición.</p><ol>{order.map((id,i)=>{const label=PAGE_SECTIONS.find(([key])=>key===id)![1];return <li key={id}><span>{i+1}</span><b>{label}</b><div><button type="button" className="outline" disabled={i===0} aria-label={`Subir ${label}`} onClick={()=>move(i,-1)}><ArrowUp size={16}/></button><button type="button" className="outline" disabled={i===order.length-1} aria-label={`Bajar ${label}`} onClick={()=>move(i,1)}><ArrowDown size={16}/></button></div></li>})}</ol></div>;
}
