import {subscriptionOfferQuote,recordOfferUse} from './platform-offers.js';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import {db,getSetting} from './db.js';
import {dataDir} from './storage.js';
import {legalConsent,recordLegalAcceptance} from './platform-legal.js';

const now=()=>new Date().toISOString();
export function transferConfiguration(){
 let config={};try{config=JSON.parse(getSetting('subscription_transfer_settings','{}'))}catch{}
 const result={enabled:config.enabled===true,alias:config.alias||'',account:config.account||'',holder:config.holder||'',bank:config.bank||'',instructions:config.instructions||''};
 return {...result,configured:result.enabled&&Boolean((result.alias||result.account)&&result.holder)};
}
function publicTransfer(row){
 if(!row)return null;const {stored_name,mime,bank_details_json,...result}=row;
 let details={};try{details=JSON.parse(bank_details_json)}catch{}
 return {...result,bank_details:details};
}
const transferQuery=`SELECT t.*,s.plan_slug,s.plan_name,s.billing_cycle,s.amount_cents,b.name business_name,u.email owner_email FROM platform_subscription_transfers t JOIN platform_subscriptions s ON s.id=t.subscription_id JOIN businesses b ON b.id=t.business_id JOIN users u ON u.id=b.owner_id`;
export const subscriptionTransfers=id=>db.prepare(transferQuery+' WHERE t.business_id=? ORDER BY t.created_at DESC,t.rowid DESC LIMIT 30').all(id).map(publicTransfer);
export function registerSubscriptionTransfers(app,{auth,own,superOnly,lock,billingSummary,refreshBillingState,addBillingMonths}){
 db.exec(`CREATE TABLE IF NOT EXISTS platform_subscription_transfers(
  id TEXT PRIMARY KEY,business_id INTEGER NOT NULL REFERENCES businesses(id),subscription_id TEXT NOT NULL UNIQUE REFERENCES platform_subscriptions(id),
  status TEXT NOT NULL DEFAULT 'pending',bank_details_json TEXT NOT NULL,stored_name TEXT,receipt_name TEXT,mime TEXT,receipt_uploaded_at TEXT,
  payment_reference TEXT UNIQUE,period_start TEXT,period_end TEXT,reviewed_by INTEGER REFERENCES users(id),reviewed_at TEXT,rejection_reason TEXT,created_at TEXT NOT NULL);
  CREATE INDEX IF NOT EXISTS subscription_transfers_business ON platform_subscription_transfers(business_id,status);`);
 const directory=path.join(dataDir,'subscription-transfer-receipts');fs.mkdirSync(directory,{recursive:true});
 const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:5*1024*1024,files:1,fields:2}}).single('receipt');
 const get=id=>db.prepare(transferQuery+' WHERE t.id=?').get(String(id));
 const active=id=>db.prepare("SELECT * FROM platform_subscriptions WHERE business_id=? AND status IN ('creating','pending','authorized','paused')").get(id);
 const ownerGuard=fn=>async(req,res)=>{const b=own(req.user.sub,req.params.id);if(!b)return res.status(403).json({error:'Acceso no autorizado'});res.set('Cache-Control','no-store');try{await lock(b.id,()=>fn(req,res,b))}catch(e){res.status(e.status||400).json({error:e.message})}};
 const adminGuard=fn=>async(req,res)=>{res.set('Cache-Control','no-store');try{const row=get(req.params.tid);if(!row)return res.status(404).json({error:'Orden no encontrada'});await lock(row.business_id,()=>fn(req,res,row))}catch(e){res.status(e.status||400).json({error:e.message})}};
 const pending=(row,b)=>{if(!row||row.business_id!==b.id)throw Object.assign(Error('Orden no encontrada'),{status:404});if(!['pending','receipt_submitted'].includes(row.status))throw Object.assign(Error('La orden ya fue resuelta. Actualizá el panel.'),{status:409});};
 app.get('/api/admin/subscription-transfer-settings',auth,superOnly,(_req,res)=>res.set('Cache-Control','no-store').json(transferConfiguration()));
 app.put('/api/admin/subscription-transfer-settings',auth,superOnly,(req,res)=>{try{
  const x=req.body||{};if(typeof x.enabled!=='boolean')throw Error('Indicá si habilitás el pago por transferencia.');
  const config={enabled:x.enabled};for(const [key,max] of Object.entries({alias:20,account:22,holder:150,bank:100,instructions:1000})){if(typeof (x[key]??'')!=='string'||String(x[key]??'').length>max)throw Error('Revisá los datos de la cuenta.');config[key]=String(x[key]??'').trim();}
  if(config.alias&&!/^[a-zA-Z0-9.-]{6,20}$/.test(config.alias))throw Error('El alias debe tener entre 6 y 20 letras, números, puntos o guiones.');
  if(config.account&&!/^\d{22}$/.test(config.account))throw Error('El CBU/CVU debe tener 22 dígitos.');
  if(config.enabled&&(!(config.alias||config.account)||!config.holder))throw Error('Completá el alias o CBU/CVU y el titular antes de habilitar las transferencias.');
  db.prepare("INSERT INTO platform_settings(key,value) VALUES('subscription_transfer_settings',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(JSON.stringify(config));res.json(transferConfiguration());
 }catch(e){res.status(400).json({error:e.message})}});
 app.post('/api/businesses/:id/subscription/transfers',auth,ownerGuard((req,res,b)=>{
  if(b.status!=='active')throw Error('La cuenta está suspendida. Contactá a Adara.');
  const x=req.body||{};if(x.confirm_transfer!==true)throw Error('Confirmá el importe del pago por transferencia.');const consent=legalConsent(x);
  const user=db.prepare('SELECT email_verified FROM users WHERE id=?').get(b.owner_id);if(!user?.email_verified)throw Error('Verificá tu email antes de pagar tu suscripción.');
  const cycle=x.billing_cycle||b.billing_cycle;if(!['monthly','annual'].includes(cycle))throw Error('Elegí mensual o anual.');
  const plan=db.prepare('SELECT * FROM plans WHERE slug=? AND active=1').get(x.plan_slug||b.plan_slug);if(!plan||!plan.public_enabled&&plan.slug!==b.plan_slug)throw Error('El plan no está disponible.');
  if(Number(plan.max_staff||1)<db.prepare('SELECT count(*) n FROM staff WHERE business_id=? AND active=1').get(b.id).n)throw Error('Desactivá integrantes antes de elegir un plan con menos agendas.');
  const pendingContract=active(b.id),quote=subscriptionOfferQuote(b,plan,cycle,x.coupon_code||'',pendingContract?.id||''),amount=quote.amount_cents;
  if(!Number.isSafeInteger(amount)||amount<=0)throw Error('El importe a pagar debe ser mayor a cero.');
  if(x.expected_amount_cents!==amount)throw Object.assign(Error('El precio cambió. Actualizá y revisá el importe antes de continuar.'),{status:409});
  const live=active(b.id);if(live){
   if(live.provider==='bank_transfer'&&live.plan_slug===plan.slug&&live.billing_cycle===cycle&&live.amount_cents===amount){const row=db.prepare(transferQuery+' WHERE t.subscription_id=?').get(live.id);return res.json({transfer:publicTransfer(row)});}
   throw Object.assign(Error(live.provider==='bank_transfer'?'Tenés una orden pendiente. Completala o cancelala antes de elegir otra.':'Primero cancelá la renovación automática actual para pagar por transferencia y evitar dos cobros.'),{status:409});
  }
  const config=transferConfiguration();if(!config.configured)throw Object.assign(Error('Adara todavía debe cargar y habilitar los datos de su cuenta para transferencias.'),{status:503});
  const id=crypto.randomUUID(),sid=crypto.randomUUID(),created=now();
  db.transaction(()=>{
   db.prepare("INSERT INTO platform_subscriptions(id,business_id,plan_slug,plan_name,billing_cycle,amount_cents,provider,status,start_date,created_at,updated_at) VALUES(?,?,?,?,?,?,'bank_transfer','pending',?,?,?)").run(sid,b.id,plan.slug,plan.name,cycle,amount,created,created,created);
   db.prepare("INSERT INTO platform_subscription_transfers(id,business_id,subscription_id,bank_details_json,created_at) VALUES(?,?,?,?,?)").run(id,b.id,sid,JSON.stringify({alias:config.alias,account:config.account,holder:config.holder,bank:config.bank,instructions:config.instructions}),created);
   recordOfferUse(quote,sid,b,plan,cycle,x.coupon_code||'');
   recordLegalAcceptance(consent,b.owner_id,b.id,'subscription',sid);
  }).immediate();res.status(201).json({transfer:publicTransfer(get(id))});
 }));
 app.post('/api/businesses/:id/subscription/transfers/:tid/receipt',auth,ownerGuard(async(req,res,b)=>{
  pending(get(req.params.tid),b);
  await new Promise((resolve,reject)=>upload(req,res,error=>error?reject(Error(error.code==='LIMIT_FILE_SIZE'?'El comprobante puede pesar hasta 5 MB.':'Adjuntá un solo comprobante de hasta 5 MB.')):resolve()));
  if(!req.file)throw Error('Adjuntá un comprobante PDF, JPG o PNG.');const bytes=req.file.buffer;
  const mime=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'image/png':bytes[0]===255&&bytes[1]===216&&bytes[2]===255?'image/jpeg':bytes.subarray(0,5).toString()==='%PDF-'?'application/pdf':null;
  if(!mime)throw Error('El archivo debe ser PDF, JPG o PNG.');
  const row=get(req.params.tid);pending(row,b);const stored=crypto.randomBytes(24).toString('hex'),name=String(req.file.originalname||'Comprobante').replace(/[\r\n/\\]/g,' ').slice(0,160);
  try{fs.writeFileSync(path.join(directory,stored),bytes,{flag:'wx',mode:0o600});db.transaction(()=>{pending(get(row.id),b);db.prepare("UPDATE platform_subscription_transfers SET status='receipt_submitted',stored_name=?,receipt_name=?,mime=?,receipt_uploaded_at=? WHERE id=?").run(stored,name,mime,now(),row.id);}).immediate();}catch(e){try{fs.unlinkSync(path.join(directory,stored))}catch{}throw e;}
  if(row.stored_name)try{fs.unlinkSync(path.join(directory,row.stored_name))}catch{}
  res.json({ok:true,transfer:publicTransfer(get(row.id))});
 }));
 const receipt=(req,res,row)=>{if(!row?.stored_name)return res.status(404).json({error:'Comprobante no encontrado'});res.set('Cache-Control','no-store').set('X-Content-Type-Options','nosniff').type(row.mime).attachment(row.receipt_name).sendFile(path.join(directory,row.stored_name))};
 app.get('/api/businesses/:id/subscription/transfers/:tid/receipt',auth,(req,res)=>{const b=own(req.user.sub,req.params.id),row=get(req.params.tid);if(!b||row?.business_id!==b.id)return res.status(403).json({error:'Acceso no autorizado'});receipt(req,res,row)});
 app.get('/api/admin/subscription-transfers/:tid/receipt',auth,superOnly,(req,res)=>receipt(req,res,get(req.params.tid)));
 app.post('/api/businesses/:id/subscription/transfers/:tid/cancel',auth,ownerGuard((req,res,b)=>{
  const row=get(req.params.tid);pending(row,b);if(req.body?.confirm!==true)throw Error('Confirmá la cancelación de esta orden.');
  db.transaction(()=>{pending(get(row.id),b);db.prepare("UPDATE platform_subscription_transfers SET status='cancelled' WHERE id=?").run(row.id);db.prepare("UPDATE platform_subscriptions SET status='cancelled',updated_at=? WHERE id=?").run(now(),row.subscription_id);refreshBillingState(b.id);}).immediate();res.json(billingSummary(b.id));
 }));
 app.get('/api/admin/subscription-transfers',auth,superOnly,(_req,res)=>res.set('Cache-Control','no-store').json({configuration:transferConfiguration(),transfers:db.prepare(transferQuery+' ORDER BY t.created_at DESC,t.rowid DESC LIMIT 200').all().map(publicTransfer)}));
 app.post('/api/admin/subscription-transfers/:tid/approve',auth,superOnly,adminGuard((req,res,row)=>{
  const x=req.body||{};if(x.funds_received!==true)throw Error('Confirmá que verificaste el ingreso en la cuenta de Adara.');
  if(row.status==='approved')return res.json({ok:true,transfer:publicTransfer(row)});
  const amount=Number(x.amount),cents=Math.round(amount*100),reference=typeof x.reference==='string'?x.reference.trim().toLowerCase():'';
  if(!Number.isFinite(amount)||cents!==row.amount_cents)throw Error('El importe recibido debe coincidir con el importe de la orden.');
  if(reference.length<3||reference.length>120)throw Error('Anotá una referencia de la operación de entre 3 y 120 caracteres.');
  db.transaction(()=>{
   const current=get(row.id),b=db.prepare('SELECT * FROM businesses WHERE id=?').get(row.business_id);pending(current,b);
   if(b.status!=='active')throw Error('Reactivá la cuenta antes de acreditar la suscripción.');
   if(active(b.id)?.id!==current.subscription_id)throw Object.assign(Error('La orden ya no es la suscripción pendiente del negocio.'),{status:409});
   const plan=db.prepare('SELECT * FROM plans WHERE slug=?').get(current.plan_slug);if(!plan)throw Error('El plan ya no existe.');
   if(Number(plan.max_staff||1)<db.prepare('SELECT count(*) n FROM staff WHERE business_id=? AND active=1').get(b.id).n)throw Error('La cuenta tiene más integrantes que los permitidos por el plan elegido.');
   if(db.prepare('SELECT 1 FROM platform_subscription_transfers WHERE payment_reference=?').get(reference))throw Object.assign(Error('Esa operación ya fue acreditada. Revisá la referencia.'),{status:409});
   const start=new Date(Math.max(Date.now(),Date.parse(b.trial_ends_at)||0,Date.parse(b.subscription_paid_until)||0)).toISOString(),end=addBillingMonths(start,current.billing_cycle==='annual'?12:1),at=now();
   db.prepare("UPDATE platform_subscription_transfers SET status='approved',payment_reference=?,period_start=?,period_end=?,reviewed_by=?,reviewed_at=? WHERE id=?").run(reference,start,end,req.user.sub,at,row.id);
   db.prepare("UPDATE platform_subscriptions SET status='paid',activated_at=?,start_date=?,next_payment_date=NULL,updated_at=? WHERE id=?").run(at,start,at,row.subscription_id);
   db.prepare("INSERT INTO platform_subscription_payments(id,subscription_id,payment_id,amount_cents,currency,status,period_start,period_end,updated_at) VALUES(?,?,?,?,'ARS','approved',?,?,?)").run('transfer-'+row.id,row.subscription_id,'bank:'+reference,row.amount_cents,start,end,at);
   db.prepare('UPDATE businesses SET subscription_managed=1,subscription_paid_until=?,plan_slug=?,billing_cycle=? WHERE id=?').run(end,current.plan_slug,current.billing_cycle,b.id);refreshBillingState(b.id);
  }).immediate();res.json({ok:true,transfer:publicTransfer(get(row.id))});
 }));
 app.post('/api/admin/subscription-transfers/:tid/reject',auth,superOnly,adminGuard((req,res,row)=>{
  const reason=typeof req.body?.reason==='string'?req.body.reason.trim():'';if(reason.length<5||reason.length>1000)throw Error('Explicá el motivo de rechazo (entre 5 y 1000 caracteres).');
  db.transaction(()=>{const b=db.prepare('SELECT * FROM businesses WHERE id=?').get(row.business_id);pending(get(row.id),b);db.prepare("UPDATE platform_subscription_transfers SET status='rejected',rejection_reason=?,reviewed_by=?,reviewed_at=? WHERE id=?").run(reason,req.user.sub,now(),row.id);db.prepare("UPDATE platform_subscriptions SET status='failed',updated_at=? WHERE id=?").run(now(),row.subscription_id);refreshBillingState(b.id);}).immediate();res.json({ok:true,transfer:publicTransfer(get(row.id))});
 }));
}
