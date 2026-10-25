import crypto from 'node:crypto';
import {db} from './db.js';
import {normalizePhone} from './features-db.js';
import {validDate,validTime} from './calendar-periods.js';
import {billingAccess,refreshBillingState} from './platform-billing.js';
import {sendBookingEmail} from './email.js';

const positive=v=>(typeof v==='number'||(typeof v==='string'&&/^[1-9]\d*$/.test(v)))&&Number.isSafeInteger(Number(v))&&Number(v)>0;
export function registerManualBookings(app,{auth,own,availabilityFor,bookingDetails,getBusinessPlan,staffCanDoServices,computeQuote}){
 const guarded=fn=>(req,res)=>{const b=own(req.user.sub,req.params.id);if(!b)return res.status(403).json({error:'Acceso no autorizado'});res.set('Cache-Control','no-store');Promise.resolve().then(()=>fn(req,res,b)).catch(e=>res.status(e.status||400).json({error:e.message}))};
 const existing=(b,id)=>{
  if(!positive(id))throw Error('Turno inválido.');
  const booking=db.prepare("SELECT * FROM bookings WHERE id=? AND business_id=? AND booking_source='manual'").get(Number(id),b.id);
  if(!booking)throw Object.assign(Error('Turno manual no encontrado.'),{status:404});
  if(booking.status!=='confirmed')throw Object.assign(Error('Sólo se pueden cambiar los servicios y horarios de un turno manual confirmado.'),{status:409});
  return booking;
 };
 const selection=(b,x,current=null)=>{
  if(!Array.isArray(x.serviceIds)||!x.serviceIds.length||x.serviceIds.length>100||x.serviceIds.some(id=>!positive(id)))throw Error('Elegí al menos un servicio válido.');
  const ids=[...new Set(x.serviceIds.map(Number))],previous=current?db.prepare('SELECT service_id FROM booking_items WHERE booking_id=?').all(current.id).map(i=>i.service_id):[];
  const services=db.prepare(`SELECT * FROM services WHERE business_id=? AND id IN (${ids.map(()=>'?')})`).all(b.id,...ids);
  if(services.length!==ids.length||services.some(s=>!s.active&&!previous.includes(s.id)))throw Error('Uno de los servicios ya no está disponible.');
  const staff=db.prepare('SELECT * FROM staff WHERE business_id=? AND active=1 ORDER BY display_order,id').all(b.id),team=Number(getBusinessPlan(b).max_staff)>1;
  let staffId=null;
  if(team&&staff.length){if(!positive(x.staffId))throw Error('Elegí la agenda del profesional.');staffId=Number(x.staffId);if(!staff.some(s=>s.id===staffId)||!staffCanDoServices(staffId,ids))throw Error('Ese profesional no realiza los servicios seleccionados.');}
  else if(x.staffId!==undefined&&x.staffId!==null&&x.staffId!=='')throw Error('Esta reserva utiliza la agenda individual.');
  if(!validDate(x.date))throw Error('Elegí una fecha válida.');
  if(x.overrideSchedule!==undefined&&typeof x.overrideSchedule!=='boolean')throw Error('Revisá la autorización del horario excepcional.');
  const overrideSchedule=x.overrideSchedule??Boolean(current?.manual_override);
  const quote=computeQuote({business:b,services,promotionId:x.promotionId,date:x.date});
  return {services,staffId,quote,overrideSchedule};
 };
 const ensureAccess=b=>{refreshBillingState(b.id);const current=db.prepare('SELECT * FROM businesses WHERE id=?').get(b.id);if(current.status!=='active'||!billingAccess(current))throw Object.assign(Error('Tu cuenta necesita acceso activo para crear turnos. Revisá tu plan.'),{status:402})};
 const slotArgs=(b,x,chosen,current)=>({business:b,date:x.date,services:chosen.services,staffId:chosen.staffId,manual:true,overrideSchedule:chosen.overrideSchedule,excludeBookingId:current?.id||0});
 app.post('/api/businesses/:id/manual-bookings/availability',auth,guarded((req,res,b)=>{
  const x=req.body||{},current=x.bookingId?existing(b,x.bookingId):null;if(!current)ensureAccess(b);
  const chosen=selection(b,x,current),args=slotArgs(b,x,chosen,current);
  res.json({slots:availabilityFor(args),duration:chosen.quote.duration_min,total_cents:chosen.quote.total_cents,subtotal_cents:chosen.quote.subtotal_cents,promotion:chosen.quote.promotion||null,custom_available:validTime(x.time)?availabilityFor({...args,time:x.time}).includes(x.time):null});
 }));
 const save=editing=>guarded(async(req,res,b)=>{
  const x=req.body||{},current=editing?existing(b,req.params.bid):null;if(!current)ensureAccess(b);
  const chosen=selection(b,x,current),{services,staffId,quote,overrideSchedule}=chosen;
  if(!validTime(x.time))throw Error('Elegí un horario válido.');
  if(x.sendEmail!==undefined&&typeof x.sendEmail!=='boolean')throw Error('Revisá el envío de confirmación.');
  const notes=x.notes??current?.notes??'';if(typeof notes!=='string'||notes.length>2000)throw Error('Las notas deben tener hasta 2000 caracteres.');
  let client=null;
  if(x.clientId!==undefined&&x.clientId!==null&&x.clientId!==''){
   if(!positive(x.clientId))throw Error('Cliente inválido.');client=db.prepare('SELECT * FROM clients WHERE id=? AND business_id=?').get(Number(x.clientId),b.id);if(!client)throw Error('Cliente no encontrado.');
  }else if(current&&x.clientId===undefined)client=db.prepare('SELECT * FROM clients WHERE id=? AND business_id=?').get(current.client_id,b.id);
  const name=client?.name??x.clientName,phone=client?.phone??x.phone??'',email=client?.email??x.email??'';
  if(typeof name!=='string'||!name.trim()||name.trim().length>120)throw Error('Completá el nombre del cliente (hasta 120 caracteres).');
  if(typeof phone!=='string'||phone.length>35||! /^[+\d\s().-]*$/.test(phone)||(phone.trim()&&!/^\d{7,15}$/.test(phone.replace(/\D/g,''))))throw Error('Revisá el teléfono del cliente.');
  if(typeof email!=='string'||email.length>254||(email.trim()&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())))throw Error('Revisá el email del cliente.');
  const em=email.trim().toLowerCase(),normalized=normalizePhone(phone);
  if(!client){const matches=db.prepare("SELECT * FROM clients WHERE business_id=? AND ((?!='' AND email=?) OR (?!='' AND phone_normalized=?))").all(b.id,em,em,normalized,normalized);if(matches.length)throw Error('Ese contacto ya está registrado. Elegilo en Clientes existentes para conservar su ficha.');}
  if(x.sendEmail&&!em)throw Error('Agregá un email para enviar la confirmación.');
  const [h,m]=x.time.split(':').map(Number),end=h*60+m+quote.duration_min,endTime=`${String(Math.floor(end/60)).padStart(2,'0')}:${String(end%60).padStart(2,'0')}`;
  const id=db.transaction(()=>{
   // Recheck inside the write transaction; two manual requests cannot claim the same slot.
   if(!availabilityFor({...slotArgs(b,x,chosen,current),time:overrideSchedule?x.time:null}).includes(x.time))throw Object.assign(Error('Ese horario no está disponible para el turno completo. Revisá otros turnos, bloqueos y el horario de cierre.'),{status:409});
   const cid=client?.id??Number(db.prepare('INSERT INTO clients(business_id,name,email,phone,phone_normalized) VALUES(?,?,?,?,?)').run(b.id,name.trim(),em||null,phone.trim(),normalized).lastInsertRowid);
   let bid=current?.id;
   if(current){
    if(current.amount_paid_cents||current.payment_status!=='not_required')throw Object.assign(Error('El turno tiene un pago registrado. Revisá el cobro antes de cambiar sus servicios.'),{status:409});
    db.prepare('UPDATE bookings SET client_id=?,date=?,start_time=?,end_time=?,staff_id=?,notes=?,manual_override=?,subtotal_cents=?,total_cents=?,selection_summary=?,promotion_id=?,promotion_title=?,promotion_discount_cents=?,promotion_before_cents=?,google_revision=google_revision+1 WHERE id=? AND business_id=?').run(cid,x.date,x.time,endTime,staffId,notes.trim(),overrideSchedule?1:0,quote.subtotal_cents,quote.total_cents,services.map(s=>s.name).join(' + '),quote.promotion?.id||null,quote.promotion?.title||'',quote.promotion_discount_cents||0,quote.promotion?.price_before_cents||null,bid,b.id);
    db.prepare('DELETE FROM booking_items WHERE booking_id=?').run(bid);
   }else{
    const result=db.prepare(`INSERT INTO bookings(business_id,client_id,date,start_time,end_time,status,payment_status,payment_mode,payment_method,subtotal_cents,total_cents,selection_summary,manage_token,staff_id,notes,booking_source,manual_override,promotion_id,promotion_title,promotion_discount_cents,promotion_before_cents) VALUES(?,?,?,?,?,'confirmed','not_required','none','manual',?,?,?,?,?,?,'manual',?,?,?,?,?)`).run(b.id,cid,x.date,x.time,endTime,quote.subtotal_cents,quote.total_cents,services.map(s=>s.name).join(' + '),crypto.randomBytes(24).toString('hex'),staffId,notes.trim(),overrideSchedule?1:0,quote.promotion?.id||null,quote.promotion?.title||'',quote.promotion_discount_cents||0,quote.promotion?.price_before_cents||null);
    bid=Number(result.lastInsertRowid);
   }
   for(const s of quote.items)db.prepare('INSERT INTO booking_items(booking_id,service_id,service_name,price_cents,duration_min,quantity,line_subtotal_cents,line_promotion_discount_cents) VALUES(?,?,?,?,?,1,?,?)').run(bid,s.id,s.name,s.price_cents,s.duration_min,s.price_cents,s.line_promotion_discount_cents||0);
   return bid;
  }).immediate();
  const booking=bookingDetails(id);let emailStatus='not_requested';
  if(x.sendEmail)try{const result=await sendBookingEmail({email:booking.client_email,clientName:booking.client_name,businessName:booking.business_name,summary:booking.selection_summary,date:booking.date,time:booking.start_time,totalCents:booking.total_cents,status:booking.status,manageUrl:booking.manage_url});emailStatus=result.sent?'sent':'unconfigured'}catch{emailStatus='failed'}
  res.status(editing?200:201).json({ok:true,booking,email_status:emailStatus});
 });
 app.post('/api/businesses/:id/manual-bookings',auth,save(false));
 app.put('/api/businesses/:id/manual-bookings/:bid',auth,save(true));
}
