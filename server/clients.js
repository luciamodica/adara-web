import {db} from './db.js';
import {normalizePhone} from './features-db.js';

const failure=(message,status=400)=>Object.assign(new Error(message),{status});
function contact(input,current={}){
 if(!input||typeof input!=='object'||Array.isArray(input))throw failure('Revisá los datos del cliente.');
 const result={};
 for(const [key,max] of Object.entries({name:120,email:254,phone:40,notes:4000})){
  const value=input[key]??current[key]??'';
  if(typeof value!=='string'||value.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value))throw failure('Revisá el nombre, contacto y notas del cliente.');
  result[key]=value.trim();
 }
 result.email=result.email.toLowerCase();result.phone_normalized=normalizePhone(result.phone);
 if(!result.name)throw failure('Completá el nombre del cliente.');
 if(result.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email))throw failure('Revisá el email.');
 if(result.phone&&(!/^[+\d\s().-]+$/.test(result.phone)||result.phone_normalized.length<7||result.phone_normalized.length>18))throw failure('Revisá el teléfono o WhatsApp.');
 return result;
}
function available(b,value,id=0){
 const match=db.prepare("SELECT archived_at FROM clients WHERE business_id=? AND id!=? AND ((?!='' AND lower(email)=?) OR (?!='' AND phone_normalized=?)) LIMIT 1").get(b.id,id,value.email,value.email,value.phone_normalized,value.phone_normalized);
 if(match)throw failure(match.archived_at?'Ese contacto está en Eliminados. Restaurá su ficha para conservar el historial.':'Ese email o WhatsApp ya pertenece a otro cliente.',409);
}
function updateReminders(client,value){
 for(const job of db.prepare("SELECT j.* FROM notification_jobs j JOIN bookings bk ON bk.id=j.booking_id WHERE bk.client_id=? AND j.business_id=? AND j.kind='reminder' AND j.status IN ('pending','local','unconfigured')").all(client.id,client.business_id)){
  const p=JSON.parse(job.payload_json);p.name=value.name;p.email=value.email;p.phone=value.phone_normalized;p.text=`Hola ${p.name}, recordá tu turno en ${p.businessName} el ${p.date} a las ${p.time}. Confirmá tu asistencia, reprogramá o cancelá: ${p.url}`;
  db.prepare('UPDATE notification_jobs SET payload_json=? WHERE id=?').run(JSON.stringify(p),job.id);
 }
}
export function registerClients(app,{auth,own}){
 const guard=fn=>(req,res)=>{const b=own(req.user.sub,req.params.id);if(!b)return res.sendStatus(403);try{return fn(req,res,b)}catch(error){res.status(error.status||400).json({error:error.message})}};
 const existing=(b,id)=>{const c=db.prepare('SELECT * FROM clients WHERE business_id=? AND id=?').get(b.id,id);if(!c)throw failure('Cliente no encontrado.',404);return c};
 // A new booking brings the same contact back without losing visits or payment history.
 db.exec(`CREATE TRIGGER IF NOT EXISTS client_restore_booking AFTER INSERT ON bookings BEGIN UPDATE clients SET archived_at=NULL WHERE id=NEW.client_id AND archived_at IS NOT NULL; END;
 CREATE TRIGGER IF NOT EXISTS client_restore_participant AFTER INSERT ON booking_participants BEGIN UPDATE clients SET archived_at=NULL WHERE id=NEW.client_id AND archived_at IS NOT NULL; END;`);
 app.get('/api/businesses/:id/clients',auth,guard((req,res,b)=>{
  const archived=req.query.archived==='1';
  const rows=db.prepare(`SELECT c.*,COUNT(bk.id) booking_count,MAX(bk.date) last_booking,COALESCE(SUM(CASE WHEN bk.payment_status='approved' THEN CASE WHEN EXISTS(SELECT 1 FROM booking_participants bp WHERE bp.booking_id=bk.id) THEN CAST(bk.amount_paid_cents/bk.party_size AS INTEGER) ELSE bk.amount_paid_cents END ELSE 0 END),0) paid_cents FROM clients c LEFT JOIN bookings bk ON (bk.client_id=c.id OR EXISTS(SELECT 1 FROM booking_participants bp WHERE bp.booking_id=bk.id AND bp.client_id=c.id)) WHERE c.business_id=? AND (c.archived_at IS NOT NULL)=? GROUP BY c.id ORDER BY c.id DESC`).all(b.id,archived?1:0);
  res.set('Cache-Control','no-store').json(rows);
 }));
 app.post('/api/businesses/:id/clients',auth,guard((req,res,b)=>{
  const value=contact(req.body),id=db.transaction(()=>{available(b,value);return Number(db.prepare('INSERT INTO clients(business_id,name,email,phone,phone_normalized,notes) VALUES(?,?,?,?,?,?)').run(b.id,value.name,value.email||null,value.phone,value.phone_normalized,value.notes).lastInsertRowid)}).immediate();
  res.status(201).json({id});
 }));
 app.patch('/api/businesses/:id/clients/:cid',auth,guard((req,res,b)=>{
  db.transaction(()=>{const c=existing(b,req.params.cid);if(c.archived_at)throw failure('Restaurá el cliente antes de editarlo.',409);const value=contact(req.body,c);available(b,value,c.id);
   db.prepare('UPDATE clients SET name=?,email=?,phone=?,phone_normalized=?,notes=? WHERE id=? AND business_id=?').run(value.name,value.email||null,value.phone,value.phone_normalized,value.notes,c.id,b.id);
   updateReminders(c,value);
  }).immediate();res.json({ok:true});
 }));
 app.delete('/api/businesses/:id/clients/:cid',auth,guard((req,res,b)=>{
  existing(b,req.params.cid);db.prepare('UPDATE clients SET archived_at=COALESCE(archived_at,?),waive_advance=0,payment_access_token=NULL WHERE id=? AND business_id=?').run(new Date().toISOString(),req.params.cid,b.id);res.json({ok:true});
 }));
 app.post('/api/businesses/:id/clients/:cid/restore',auth,guard((req,res,b)=>{
  existing(b,req.params.cid);db.prepare('UPDATE clients SET archived_at=NULL WHERE id=? AND business_id=?').run(req.params.cid,b.id);res.json({ok:true});
 }));
}
