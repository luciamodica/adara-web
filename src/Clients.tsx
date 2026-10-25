import {useEffect,useRef,useState} from 'react';
import {Plus,Pencil,Trash2,Undo2} from 'lucide-react';
import ClientImport from './ClientImport';
import ClientPaymentRule from './ClientPaymentRule';
import {api,fmtDate,money} from './api';
import './customer-management.css';

function ClientEditor({client,onSave,onCancel}:any){
 const[f,setF]=useState({name:client.name||'',email:client.email||'',phone:client.phone||'',notes:client.notes||''}),[busy,setBusy]=useState(false),[error,setError]=useState('');
 return <form className="panel form clientEditor" onSubmit={async e=>{e.preventDefault();setError('');setBusy(true);try{await onSave(f)}catch(e:any){setError(e.message)}finally{setBusy(false)}}}>
  <h2>{client.id?'Editar clienta':'Nueva clienta'}</h2><fieldset disabled={busy}>
   <label>Nombre y apellido<input autoFocus required maxLength={120} value={f.name} onChange={e=>setF({...f,name:e.target.value})}/></label>
   <div className="two"><label>WhatsApp o teléfono (opcional)<input type="tel" maxLength={40} value={f.phone} onChange={e=>setF({...f,phone:e.target.value})}/></label><label>Email (opcional)<input type="email" maxLength={254} value={f.email} onChange={e=>setF({...f,email:e.target.value})}/></label></div>
   <label>Notas privadas<textarea rows={3} maxLength={4000} value={f.notes} onChange={e=>setF({...f,notes:e.target.value})}/></label>
   {error&&<p className="errorText" role="alert">{error}</p>}<div className="clientActions"><button className="dark">{busy?'Guardando…':'Guardar clienta'}</button><button className="outline" type="button" onClick={onCancel}>Cancelar</button></div>
  </fieldset>
 </form>;
}
export default function Clients({b}:any){
 const[list,setList]=useState<any[]>([]),[search,setSearch]=useState(''),[archived,setArchived]=useState(false),[editing,setEditing]=useState<any>(),[removing,setRemoving]=useState<number|null>(null),[error,setError]=useState(''),[message,setMessage]=useState(''),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),requestId=useRef(0);
 const root=`/businesses/${b.id}/clients`;
 const load=async()=>{const id=++requestId.current;setLoading(true);try{const data=await api(root+(archived?'?archived=1':''));if(requestId.current===id)setList(data)}catch(e:any){if(requestId.current===id)setError(e.message)}finally{if(requestId.current===id)setLoading(false)}};
 useEffect(()=>{setError('');load();return()=>{requestId.current++}},[b.id,archived]);
 const shown=list.filter(x=>`${x.name} ${x.email||''} ${x.phone}`.toLowerCase().includes(search.toLowerCase()));
 const mutate=async(action:()=>Promise<any>,success:string)=>{setBusy(true);setError('');try{await action();setRemoving(null);setMessage(success);await load()}catch(e:any){setError(e.message)}finally{setBusy(false)}};
 const save=async(f:any)=>{await api(root+(editing.id?'/'+editing.id:''),{method:editing.id?'PATCH':'POST',body:JSON.stringify(f)});setEditing(undefined);setMessage(editing.id?'Clienta actualizada.':'Clienta agregada.');await load()};
 return <><span className="kicker">CLIENTAS DE TU NEGOCIO</span><div className="clientHeading"><h1>Clientas</h1><button className="dark" onClick={()=>{setEditing({});setMessage('');setError('');setRemoving(null);setArchived(false)}}><Plus size={17}/>Agregar clienta</button></div>
  {message&&<p className="successBox" role="status">{message}</p>}{error&&<p className="error" role="alert">{error}</p>}
  {editing&&<ClientEditor key={editing.id||'new'} client={editing} onSave={save} onCancel={()=>setEditing(undefined)}/>}
  <div className="clientToolbar"><ClientImport b={b} onImported={load}/>{!b.basic_only&&<a className="outline" href="/admin?tab=Herramientas">Ver historial, ausencias y puntos</a>}</div>
  <div className="panel clientFilters"><div role="group" aria-label="Estado de las clientas"><button type="button" className={archived?'outline':'dark'} aria-pressed={!archived} onClick={()=>{setArchived(false);setEditing(undefined);setRemoving(null)}}>Activas</button><button type="button" className={archived?'dark':'outline'} aria-pressed={archived} onClick={()=>{setArchived(true);setEditing(undefined);setRemoving(null)}}>Eliminadas</button></div><label>Buscar clienta<input placeholder="Nombre, email o teléfono…" value={search} onChange={e=>setSearch(e.target.value)}/></label></div>
  {loading?<p role="status">Cargando clientas…</p>:<div className="clientGrid managedClientGrid">{shown.map(x=><article className="managedClient" key={x.id}><div className="clientIdentity"><div className="avatar" aria-hidden="true">{x.name?.[0]?.toUpperCase()}</div><div><h3>{x.name}</h3><p>{x.phone||'Sin teléfono'} · {x.email||'Sin email'}</p><span>{x.booking_count} turnos · Último: {x.last_booking?fmtDate(x.last_booking):'—'}</span><small>Total cobrado: {money(x.paid_cents)}</small>{x.notes&&<p className="clientNotes">{x.notes}</p>}</div></div>
   {archived?<button className="outline" disabled={busy} onClick={()=>mutate(()=>api(root+'/'+x.id+'/restore',{method:'POST'}),'Clienta restaurada.')}><Undo2 size={15}/>Restaurar clienta</button>:<><div className="clientActions"><button className="outline" disabled={busy} onClick={()=>{setEditing(x);setRemoving(null);setMessage('')}}><Pencil size={15}/>Editar</button><button className="outline clientDelete" disabled={busy} aria-label={'Eliminar a '+x.name} onClick={()=>setRemoving(x.id)}><Trash2 size={15}/>Eliminar</button></div>{!b.basic_only&&<ClientPaymentRule client={x} b={b} refresh={load}/>}</>}
   {removing===x.id&&<div className="clientDeleteConfirm" role="alertdialog" aria-labelledby={'remove-client-'+x.id}><b id={'remove-client-'+x.id}>¿Eliminar a {x.name} de la lista?</b><p>Sus turnos y cobros se conservarán. Podés restaurar su ficha desde Eliminadas.</p><div className="clientActions"><button className="dark" disabled={busy} onClick={()=>mutate(()=>api(root+'/'+x.id,{method:'DELETE'}),'Clienta eliminada de la lista. Podés restaurarla desde Eliminadas.')}>{busy?'Eliminando…':'Confirmar eliminación'}</button><button className="outline" disabled={busy} onClick={()=>setRemoving(null)}>Cancelar</button></div></div>}
  </article>)}</div>}
  {!loading&&!shown.length&&<div className="panel emptyState">{search?'No hay clientas que coincidan con la búsqueda.':archived?'No hay clientas eliminadas.':'Todavía no hay clientas. Podés agregar la primera desde acá.'}</div>}
 </>;
}
