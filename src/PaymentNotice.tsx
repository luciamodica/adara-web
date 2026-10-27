import {useEffect,useState} from 'react';
import {Clock3} from 'lucide-react';
export function holdTime(booking:any,now=Date.now()){
 const left=Math.max(0,Math.ceil((Date.parse(booking.hold_expires_at)-now)/1000));
 if(!Number.isFinite(left))return 'Esperando pago';
 return left?`${Math.floor(left/60)}:${String(left%60).padStart(2,'0')} para pagar`:'Plazo vencido · liberando horario';
}
export default function PaymentNotice({booking}:any){
 const[now,setNow]=useState(Date.now());useEffect(()=>{if(booking.status!=='pending_payment')return;const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer)},[booking.status,booking.hold_expires_at]);
 if(booking.payment_review_required)return <div className="paymentNotice review"><b>Pago recibido · turno cancelado</b><p>El pago requiere revisión. Contactá al profesional para coordinar una devolución o una nueva reserva.</p></div>;
 if(booking.payment_status==='expired')return <div className="paymentNotice expired"><b>El plazo para pagar venció.</b><p>El horario se liberó automáticamente. {booking.payment_method==='bank_transfer'?'Si ya transferiste, contactá al profesional desde su página antes de reservar o pagar de nuevo.':'Volvé a consultar la disponibilidad para crear una nueva reserva.'}</p></div>;
 if(booking.status!=='pending_payment')return null;
 return <div className="paymentNotice"><b><Clock3 size={17}/>{holdTime(booking,now)}</b><p>Pagá antes del {new Date(booking.hold_expires_at).toLocaleString('es-AR',{timeZone:'America/Argentina/Buenos_Aires',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})} (hora de Argentina). {booking.payment_method==='bank_transfer'?'La profesional confirma al verificar el ingreso. El comprobante no extiende el plazo.':'Tu turno se confirma al acreditarse el pago.'} Al vencer, se libera el horario.</p></div>;
}

export const paymentStatusLabel=(status:string)=>({approved:'Aprobado',not_required:'Sin pago anticipado',pending:'Pendiente',receipt_submitted:'Comprobante enviado · pendiente de revisión',expired:'Plazo vencido',cancelled:'Cancelado',error:'No se pudo iniciar el pago',rejected:'Rechazado',refunded:'Devuelto',charged_back:'Contracargo'} as any)[status]||status;
