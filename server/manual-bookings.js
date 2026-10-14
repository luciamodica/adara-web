import crypto from 'node:crypto';
import {db} from './db.js';
import {normalizePhone} from './features-db.js';
import {validDate,validTime} from './calendar-periods.js';
import {billingAccess,refreshBillingState} from './platform-billing.js';
import {sendBookingEmail} from './email.js';

const positive=v=>(typeof v==='number'||(typeof v==='string'&&/^[1-9]\d*$/.test(v)))&&Number.isSafeInteger(Number(v))&&Number(v)>0;
export function registerManualBookings(app,{auth,own,availabilityFor,bookingDetails,getBusinessPlan,staffCanDoServices}){
 const guarded=fn=>(req,res)=>{const b=own(req.user.sub,req.params.id);if(!b)return res.status(403).json({error:'Acceso no autorizado'});res.set('Cache-Control','no-store');Promise.resolve().then(()=>fn(req,res,b)).catch(e=>res.status(e.status||400).json({error:e.message}))};
 const selection=(b,x)=>{
  if(!Array.isArray(x.serviceIds)||!x.serviceIds.length||x.serviceIds.length>100||x.serviceIds.some(id=>!positive(id)))throw Error('Elegí al menos un servicio válido.');
  const ids=[...new Set(x.serviceIds.map(Number))],services=db.prepare(`SELECT * FROM services WHERE business_id=? AND active=1 AND id IN (${ids.map(()=>'?')})`).all(b.id,...ids);
  if(services.length!==ids.length)throw Error('Uno de los servicios ya no está disponible.');
  const staff=db.prepare('SELECT * FROM staff WHERE business_id=? AND active=1 ORDER BY display_order,id').all(b.id),team=Number(getBusinessPlan(b).max_staff)>1;
  let staffId=null;
  if(team&&staff.length){if(!positive(x.staffId))throw Error('Elegí la agenda del profesional.');staffId=Number(x.staffId);if(!staff.some(s=>s.id===staffId)||!staffCanDoServices(staffId,ids))throw Error('Ese profesional no realiza los servicios seleccionados.');}
  else if(x.staffId!==undefined&&x.staffId!==null&&x.staffId!=='')throw Error('Esta reserva utiliza la agenda individual.');
  if(!validDate(x.date))throw Error('Elegí una fecha válida.');
  return {services,staffId};
 };
 const ensureAccess=b=>{refreshBillingState(b.id);const current=db.prepare('SELECT * FROM businesses WHERE id=?').get(b.id);if(current.status!=='active'||!billingAccess(current)){const e=Error('Tu cuenta necesita acceso activo para crear turnos. Revisá tu plan.');e.status=402;throw e;}};
 app.post('/api/businesses/:id/manual-bookings/availability',auth,guarded((req,res,b)=>{
  ensureAccess(b);const {services,staffId}=selection(b,req.body||{});res.json({slots:availabilityFor({business:b,date:req.body.date,services,staffId,manual:true}),duration:services.reduce((n,s)=>n+s.duration_min,0),total_cents:services.reduce((n,s)=>n+s.price_cents,0)});
 }));
 app.post('/api/businesses/:id/manual-bookings',auth,guarded(async(req,res,b)=>{
  ensureAccess(b);const x=req.body||{}, {services,staffId}=selection(b,x);
  if(!validTime(x.time))throw Error('Elegí un horario válido.');
  if(x.sendEmail!==undefined&&typeof x.sendEmail!=='boolean')throw Error('Revisá el envío de confirmación.');
  const notes=x.notes??'';if(typeof notes!=='string'||notes.length>2000)throw Error('Las notas deben tener hasta 2000 caracteres.');
  let client=null;
  if(x.clientId!==undefined&&x.clientId!==null&&x.clientId!==''){
   if(!positive(x.clientId))throw Error('Cliente inválido.');client=db.prepare('SELECT * FROM clients WHERE id=? AND business_id=?').get(Number(x.clientId),b.id);if(!client)throw Error('Cliente no encontrado.');
  }
  const name=client?.name??x.clientName,phone=client?.phone??x.phone??'',email=client?.email??x.email??'';
  if(typeof name!=='string'||!name.trim()||name.trim().length>120)throw Error('Completá el nombre del cliente (hasta 120 caracteres).');
  if(typeof phone!=='string'||phone.length>35||! /^[+\d\s().-]*$/.test(phone)||(phone.trim()&&!/^\d{7,15}$/.test(phone.replace(/\D/g,''))))throw Error('Revisá el teléfono del cliente.');
  if(typeof email!=='string'||email.length>254||(email.trim()&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())))throw Error('Revisá el email del cliente.');
  const em=email.trim().toLowerCase(),normalized=normalizePhone(phone);
  if(!client){const matches=db.prepare("SELECT * FROM clients WHERE business_id=? AND ((?!='' AND email=?) OR (?!='' AND phone_normalized=?))").all(b.id,em,em,normalized,normalized);if(matches.length)throw Error('Ese contacto ya está registrado. Elegilo en Clientes existentes para conservar su ficha.');}
  if(x.sendEmail&&!em)throw Error('Agregá un email para enviar la confirmación.');
  const duration=services.reduce((n,s)=>n+s.duration_min,0),total=services.reduce((n,s)=>n+s.price_cents,0),[h,m]=x.time.split(':').map(Number),end=h*60+m+duration;
  const endTime=`${String(Math.floor(end/60)).padStart(2,'0')}:${String(end%60).padStart(2,'0')}`;
  const id=db.transaction(()=>{
   if(!availabilityFor({business:b,date:x.date,services,staffId,manual:true}).includes(x.time)){const e=Error('Ese horario ya no está disponible para el turno completo. Elegí otro.');e.status=409;throw e;}
   const cid=client?.id??Number(db.prepare('INSERT INTO clients(business_id,name,email,phone,phone_normalized) VALUES(?,?,?,?,?)').run(b.id,name.trim(),em||null,phone.trim(),normalized).lastInsertRowid);
   const result=db.prepare(`INSERT INTO bookings(business_id,client_id,date,start_time,end_time,status,payment_status,payment_mode,payment_method,subtotal_cents,total_cents,selection_summary,manage_token,staff_id,notes,booking_source) VALUES(?,?,?,?,?,'confirmed','not_required','none','manual',?,?,?,?,?,?,'manual')`).run(b.id,cid,x.date,x.time,endTime,total,total,services.map(s=>s.name).join(' + '),crypto.randomBytes(24).toString('hex'),staffId,notes.trim());
   const bid=Number(result.lastInsertRowid);for(const s of services)db.prepare('INSERT INTO booking_items(booking_id,service_id,service_name,price_cents,duration_min,quantity,line_subtotal_cents) VALUES(?,?,?,?,?,1,?)').run(bid,s.id,s.name,s.price_cents,s.duration_min,s.price_cents);return bid;
  }).immediate();
  const booking=bookingDetails(id);let emailStatus='not_requested';
  if(x.sendEmail)try{const result=await sendBookingEmail({email:booking.client_email,clientName:booking.client_name,businessName:booking.business_name,summary:booking.selection_summary,date:booking.date,time:booking.start_time,totalCents:booking.total_cents,status:booking.status,manageUrl:booking.manage_url});emailStatus=result.sent?'sent':'unconfigured'}catch{emailStatus='failed'}
  res.status(201).json({ok:true,booking,email_status:emailStatus});
 }));
}
