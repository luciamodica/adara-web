import {useState} from 'react';
import {recentBookings,forgetBooking,recoveryPath} from '../shared/booking-recovery.js';
export default function BookingRecovery({slug}:any){
 const[rows,setRows]=useState(()=>{try{return recentBookings(localStorage,slug)}catch{return []}});
 if(!rows.length)return null;
 return <div className="bookingRecovery" role="region" aria-label="Retomar reserva"><b>¿Volvés para enviar un comprobante?</b><p>Podés retomar tu reserva reciente sin sacar otro turno.</p>{rows.slice(0,3).map((row:any,i:number)=><div key={row.token}><a className="outline" href={recoveryPath(row.token)}>Retomar {rows.length>1?'reserva '+(i+1):'mi reserva'}</a><button type="button" className="link" aria-label={'Ocultar reserva '+(i+1)+' en este dispositivo'} onClick={()=>{try{forgetBooking(localStorage,row.token)}catch{}setRows(rows.filter((x:any)=>x.token!==row.token))}}>Ocultar</button></div>)}</div>;
}
