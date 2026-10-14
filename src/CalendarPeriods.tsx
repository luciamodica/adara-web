import {useRef,useState} from 'react';
import {CalendarDays,Pencil,Trash2} from 'lucide-react';
import {api,fmtDate} from './api';

const blank=()=>({id:0,date_from:'',date_to:'',staff_id:'',closed:false,start_time:'10:00',end_time:'18:00',reason:''});
export default function CalendarPeriods({b,staff,periods=[],root,refresh}:any){
 const[form,setForm]=useState<any>(blank),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const editor=useRef<HTMLFormElement>(null),set=(key:string,value:any)=>setForm((f:any)=>({...f,[key]:value}));
 const reset=()=>{setForm(blank());setError('')};
 const save=async(e:any)=>{e.preventDefault();setBusy(true);setError('');setMessage('');try{
  const result=await api(root+'/calendar-periods'+(form.id?'/'+form.id:''),{method:form.id?'PUT':'POST',body:JSON.stringify(form)});
  await refresh();setMessage(`Período ${form.id?'actualizado':'guardado'}: ${fmtDate(form.date_from)}${form.date_to!==form.date_from?' al '+fmtDate(form.date_to):''}.${result.affected_bookings?` Hay ${result.affected_bookings} turno${result.affected_bookings===1?'':'s'} en esos horarios. Revisalos en Turnos; sus reservas se conservan.`:''}`);reset();
 }catch(e:any){setError(e.message)}finally{setBusy(false)}};
 const edit=(p:any)=>{setError('');setMessage('');setForm({...p,staff_id:p.staff_id?String(p.staff_id):'',closed:!!p.closed,start_time:p.start_time||'10:00',end_time:p.end_time||'18:00'});editor.current?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'})};
 const remove=async(p:any)=>{setBusy(true);setError('');setMessage('');try{await api(root+'/calendar-periods/'+p.id,{method:'DELETE'});await refresh();if(form.id===p.id)reset();setMessage('Período eliminado. Se vuelve a usar tu agenda habitual en esas fechas.')}catch(e:any){setError(e.message)}finally{setBusy(false)}};
 return <div className="calendarPeriods">
  {message&&<div role="status" className="successBox">{message}</div>}
  <form ref={editor} className="panel periodEditor" onSubmit={save}>
   <div className="periodHeading"><span className="periodIcon"><CalendarDays size={22}/></span><div><h2>{form.id?'Editar período':'Horarios temporales y vacaciones'}</h2><p>Definí un día o un rango de fechas. El cambio se aplica a todos los días incluidos.</p></div></div>
   {error&&<div role="alert" className="error">{error}</div>}
   <fieldset disabled={busy}><div className="periodDateFields"><label>Fecha desde<input required type="date" value={form.date_from} onChange={e=>setForm({...form,date_from:e.target.value,date_to:!form.date_to||form.date_to<e.target.value?e.target.value:form.date_to})}/></label><label>Fecha hasta<input required type="date" min={form.date_from||undefined} value={form.date_to} onChange={e=>set('date_to',e.target.value)}/></label></div>
    {Number(b.max_staff)>1&&<label>Aplicar a<select aria-label="Aplicar a" value={form.staff_id} onChange={e=>set('staff_id',e.target.value)}><option value="">Todo el negocio</option>{staff.map((s:any)=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}
    <div className="periodMode" role="group" aria-label="Tipo de período"><button type="button" aria-pressed={form.closed} className={form.closed?'selected':''} onClick={()=>set('closed',true)}><b>Vacaciones o día libre</b><span>No recibir reservas en estas fechas.</span></button><button type="button" aria-pressed={!form.closed} className={!form.closed?'selected':''} onClick={()=>set('closed',false)}><b>Horario especial</b><span>Atender en un horario diferente al habitual.</span></button></div>
    {!form.closed&&<div className="periodDateFields"><label>Horario desde<input required type="time" value={form.start_time} onChange={e=>set('start_time',e.target.value)}/></label><label>Horario hasta<input required type="time" value={form.end_time} onChange={e=>set('end_time',e.target.value)}/></label></div>}
    <label>Motivo (opcional)<input maxLength={250} value={form.reason} onChange={e=>set('reason',e.target.value)}/></label>
    <div className="periodFormActions"><button className="dark">{busy?'Guardando…':form.id?'Guardar cambios del período':'Guardar período'}</button>{!!form.id&&<button type="button" className="outline" onClick={reset}>Cancelar edición</button>}</div>
   </fieldset><small>El horario especial reemplaza el habitual. Los bloqueos y turnos ya reservados se conservan.</small>
  </form>
  <div className="panel periodList"><h2>Períodos guardados</h2>{periods.length?periods.map((p:any)=><article className="periodItem" key={p.id}><div><span className={'periodTag '+(p.closed?'closed':'')}>{p.closed?'Vacaciones / día libre':'Horario especial'}</span><h3>{fmtDate(p.date_from)}{p.date_to!==p.date_from&&<> <span>→</span> {fmtDate(p.date_to)}</>}</h3><p>{p.staff_id?p.staff_name||'Profesional':'Todo el negocio'} · {p.closed?'Cerrado todo el día':`${p.start_time} a ${p.end_time}`}</p>{p.reason&&<small>{p.reason}</small>}</div><div className="periodItemActions"><button className="outline" disabled={busy} onClick={()=>edit(p)}><Pencil size={14}/>Editar período</button><button className="outline" disabled={busy} aria-label={`Eliminar período del ${fmtDate(p.date_from)}`} onClick={()=>remove(p)}><Trash2 size={15}/></button></div></article>):<div className="periodEmpty"><CalendarDays size={28}/><p>Todavía no agregaste períodos especiales.</p><small>Guardá tus próximas vacaciones o un cambio de horario desde el formulario.</small></div>}</div>
 </div>;
}
