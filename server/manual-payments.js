import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import multer from 'multer';
import {db} from './db.js';
import {receiptsDir} from './storage.js';
import {mercadoPagoAllowed} from './plan-payments.js';
export const paymentMethods=b=>{let methods;try{methods=JSON.parse(b.payment_methods_json).filter(x=>['mercadopago','bank_transfer'].includes(x))}catch{methods=['mercadopago']}return mercadoPagoAllowed(b)?methods:['bank_transfer']};
export const bankDetails=b=>({alias:b.bank_alias||'',account:b.bank_account||'',holder:b.bank_holder||'',bank:b.bank_name||'',instructions:b.bank_instructions||''});
export function decoratePayment(booking){if(!booking)return booking;let transfer=null;try{transfer=booking.payment_method==='bank_transfer'?JSON.parse(booking.payment_details_json||'null'):null}catch{}const receipt=db.prepare('SELECT original_name,uploaded_at FROM booking_transfer_receipts WHERE booking_id=?').get(booking.id);return {...booking,transfer_details:transfer,receipt_name:receipt?.original_name||null,receipt_uploaded_at:receipt?.uploaded_at||null}}
export function validatePaymentSettings(b,x){
 const methods=x.payment_methods===undefined?paymentMethods(b):x.payment_methods;
 if(!Array.isArray(methods)||methods.length>2||methods.some(m=>!['mercadopago','bank_transfer'].includes(m)))throw new Error('Elegí medios de pago válidos');
 if(!mercadoPagoAllowed(b)&&methods.includes('mercadopago'))throw new Error('Adara Inicial incluye cobros por transferencia. Mercado Pago integrado está disponible desde Adara Individual.');
 const normalized=[...new Set(methods)],alias=String(x.bank_alias??b.bank_alias??'').trim(),account=String(x.bank_account??b.bank_account??'').trim(),holder=String(x.bank_holder??b.bank_holder??'').trim(),bank=String(x.bank_name??b.bank_name??'').trim(),instructions=String(x.bank_instructions??b.bank_instructions??'').trim();
 if(alias&&!/^[a-zA-Z0-9.-]{6,20}$/.test(alias))throw new Error('El alias debe tener entre 6 y 20 letras, números, puntos o guiones');
 if(account&&!/^\d{22}$/.test(account))throw new Error('El CBU/CVU debe tener 22 dígitos');
 if(holder.length>150||bank.length>100||instructions.length>1000)throw new Error('Revisá la longitud de los datos de transferencia');
 if(x.payment_mode!=='none'&&normalized.includes('bank_transfer')&&(!(alias||account)||!holder))throw new Error('Para transferencia, completá alias o CBU/CVU y titular');
 if(x.payment_mode!=='none'&&!normalized.length)throw new Error('Activá al menos un medio de pago para cobrar seña o total');
 return {methods:normalized,alias,account,holder,bank,instructions};
}
export function registerManualPayments(app,{auth,own,bookingDetails,cleanupExpiredHolds,emailBooking,emailProfessional}){
 const receiptDir=receiptsDir;
 const receiptUpload=multer({storage:multer.memoryStorage(),limits:{fileSize:5*1024*1024,files:1,fields:2}}).single('receipt');
 const pending=(id,business)=>{cleanupExpiredHolds(business);return db.prepare("SELECT * FROM bookings WHERE id=? AND business_id=? AND status='pending_payment' AND hold_expires_at>?").get(id,business,new Date().toISOString())};
 app.post('/api/public/manage-booking/:token/transfer-receipt',(req,res)=>{
  const first=db.prepare('SELECT * FROM bookings WHERE manage_token=?').get(req.params.token);if(!first||first.payment_method!=='bank_transfer'||!pending(first.id,first.business_id))return res.status(409).json({error:'La reserva no está pendiente de transferencia o su plazo venció'});
  receiptUpload(req,res,async err=>{
   if(err)return res.status(400).json({error:err.code==='LIMIT_FILE_SIZE'?'El comprobante puede pesar hasta 5 MB':'Adjuntá un solo comprobante de hasta 5 MB'});
   if(!req.file)return res.status(400).json({error:'Adjuntá el comprobante en PDF, JPG o PNG'});
   const file=req.file,bytes=file.buffer;let mime='';if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))mime='image/png';else if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)mime='image/jpeg';else if(bytes.subarray(0,5).toString()==='%PDF-')mime='application/pdf';if(!mime)return res.status(400).json({error:'El archivo debe ser un comprobante PDF, JPG o PNG'});
   if(!pending(first.id,first.business_id))return res.status(409).json({error:'El plazo para pagar venció. Contactá al profesional si ya transferiste.'});
   const stored=crypto.randomBytes(24).toString('hex'),name=String(file.originalname||'Comprobante').replace(/[\r\n/\\]/g,' ').slice(0,160),old=db.prepare('SELECT stored_name FROM booking_transfer_receipts WHERE booking_id=?').get(first.id);
   try{fs.writeFileSync(path.join(receiptDir,stored),bytes,{flag:'wx',mode:0o600});db.transaction(()=>{db.prepare('INSERT INTO booking_transfer_receipts(booking_id,stored_name,original_name,mime,uploaded_at) VALUES(?,?,?,?,?) ON CONFLICT(booking_id) DO UPDATE SET stored_name=excluded.stored_name,original_name=excluded.original_name,mime=excluded.mime,uploaded_at=excluded.uploaded_at').run(first.id,stored,name,mime,new Date().toISOString());db.prepare("UPDATE bookings SET payment_status='receipt_submitted' WHERE id=? AND status='pending_payment'").run(first.id)})();if(old)try{fs.unlinkSync(path.join(receiptDir,old.stored_name))}catch{}const booking=bookingDetails(first.id);await emailProfessional(booking,'transfer_receipt');res.json({ok:true,booking})}catch{try{fs.unlinkSync(path.join(receiptDir,stored))}catch{}res.status(500).json({error:'No se pudo guardar el comprobante. Intentá nuevamente.'})}
  });
 });
 app.get('/api/businesses/:id/bookings/:bid/transfer-receipt',auth,(req,res)=>{const b=own(req.user.sub,req.params.id);if(!b)return res.status(403).json({error:'Acceso no autorizado'});const row=db.prepare('SELECT r.* FROM booking_transfer_receipts r JOIN bookings bk ON bk.id=r.booking_id WHERE bk.id=? AND bk.business_id=?').get(req.params.bid,b.id);if(!row)return res.status(404).json({error:'Comprobante no encontrado'});res.set('Cache-Control','no-store');res.set('X-Content-Type-Options','nosniff');res.type(row.mime).attachment(row.original_name).sendFile(path.join(receiptDir,row.stored_name))});
 const guarded=fn=>async(req,res)=>{const b=own(req.user.sub,req.params.id);if(!b)return res.status(403).json({error:'Acceso no autorizado'});try{await fn(req,res,b)}catch(e){res.status(400).json({error:e.message||'No se pudo actualizar el pago'})}};
 app.post('/api/businesses/:id/bookings/:bid/approve-transfer',auth,guarded(async(req,res,b)=>{
  const bk=pending(req.params.bid,b.id);if(!bk||bk.payment_method!=='bank_transfer')return res.status(409).json({error:'La reserva no está pendiente de transferencia. Si venció, creá una nueva reserva para verificar disponibilidad.'});
  if(req.body?.funds_received!==true)throw new Error('Confirmá que verificaste el dinero recibido en tu cuenta');const amount=Number(req.body.amount),paid=Math.round(amount*100);if(!Number.isFinite(amount)||paid<bk.amount_due_cents||paid>bk.total_cents)throw new Error('El importe recibido debe cubrir el anticipo y no superar el total del turno');
  const updated=db.prepare("UPDATE bookings SET status='confirmed',payment_status='approved',amount_paid_cents=?,hold_expires_at=NULL,manual_payment_confirmed_at=? WHERE id=? AND status='pending_payment' AND hold_expires_at>?").run(paid,new Date().toISOString(),bk.id,new Date().toISOString());if(!updated.changes)return res.status(409).json({error:'El plazo de la reserva venció'});const booking=bookingDetails(bk.id);await emailBooking(booking);await emailProfessional(booking,'paid');res.json({ok:true,booking});
 }));
 app.post('/api/businesses/:id/bookings/:bid/waive-advance',auth,guarded(async(req,res,b)=>{
  const bk=pending(req.params.bid,b.id);if(!bk)return res.status(409).json({error:'La reserva ya no está pendiente. Creá una nueva reserva si venció el plazo.'});if(req.body?.authorize!==true)throw new Error('Confirmá que autorizás el turno sin pago anticipado');db.prepare("UPDATE bookings SET status='confirmed',payment_status='not_required',payment_mode='none',amount_due_cents=0,hold_expires_at=NULL,payment_waived=1 WHERE id=?").run(bk.id);const booking=bookingDetails(bk.id);await emailBooking(booking);await emailProfessional(booking,'confirmed_without_advance');res.json({ok:true,booking});
 }));
}
