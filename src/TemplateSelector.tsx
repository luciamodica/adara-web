import {useId,useState} from 'react';
import {ChevronDown,LockKeyhole} from 'lucide-react';
export default function TemplateSelector({templates,level,selected,onChoose,Mini}:any){
 const[open,setOpen]=useState(false),id=useId(),active=templates.find((t:any)=>t.id===selected)||templates[0];
 return <div className="compactTemplateSelector"><label>Plantilla de tu página<select value={selected} onChange={e=>onChoose(templates.find((t:any)=>t.id===e.target.value))}>{templates.map((t:any)=><option key={t.id} value={t.id} disabled={t.level>level}>{t.name}{t.level>level?' · no incluida en tu plan':''}</option>)}</select></label>
 {active&&<div className="selectedTemplatePreview"><Mini t={active}/><div><b>{active.name}</b><p>{active.description}</p><small>Al elegir otra plantilla se aplican sus colores, tipografías y composición. Después podés ajustarlos.</small></div></div>}
 <button className="outline templateCatalogToggle" type="button" aria-expanded={open} aria-controls={id} onClick={()=>setOpen(!open)}>{open?'Cerrar catálogo':`Ver catálogo de plantillas (${templates.length})`}<ChevronDown size={16}/></button>
 {open&&<div className="compactTemplateCatalog" id={id}>{templates.map((t:any)=>{const locked=t.level>level;return <button type="button" key={t.id} disabled={locked} aria-pressed={t.id===selected} className={t.id===selected?'selected':''} onClick={()=>{onChoose(t);setOpen(false)}}><Mini t={t}/><b>{t.name}</b>{locked&&<small><LockKeyhole size={12}/>No incluida en tu plan</small>}</button>})}</div>}
 </div>;
}
