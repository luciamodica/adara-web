import {useState} from 'react';
const presets=[5,10,15,20,30,45,60,90,120];
export default function SlotIntervalField({value,onChange,label='Intervalo entre horarios'}:{value:number|string;onChange:(value:number|string)=>void;label?:string}){
 const [custom,setCustom]=useState(()=>!presets.includes(Number(value)));
 return <div className="slotIntervalField"><label>{label}<select aria-label={label} value={custom||!presets.includes(Number(value))?'custom':String(value)} onChange={e=>{if(e.target.value==='custom'){setCustom(true);return}setCustom(false);onChange(Number(e.target.value))}}>{presets.map(n=><option key={n} value={n}>{n===60?'1 hora':n===90?'1 hora y media':n===120?'2 horas':`${n} minutos`}</option>)}<option value="custom">Personalizado</option></select></label>{(custom||!presets.includes(Number(value)))&&<label>Intervalo personalizado (minutos)<input required type="number" min="5" max="720" step="1" value={value} onChange={e=>onChange(e.target.value)}/></label>}<small>Define cada cuánto ofrecemos un horario de inicio. La duración del servicio se configura por separado.</small></div>;
}
