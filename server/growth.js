import {db,getSetting} from './db.js';
import {paymentMethods} from './manual-payments.js';
import {validTime} from './calendar-periods.js';

db.exec(`CREATE TABLE IF NOT EXISTS growth_milestones(
 business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
 stage TEXT NOT NULL, occurred_at TEXT, source TEXT NOT NULL DEFAULT 'measured',
 PRIMARY KEY(business_id,stage)
);`);

export function milestone(id,stage,at=new Date().toISOString(),source='measured'){
 db.prepare('INSERT OR IGNORE INTO growth_milestones(business_id,stage,occurred_at,source) VALUES(?,?,?,?)').run(id,stage,at,source);
}

export function setupState(b,{record=true}={}){
 const plan=db.prepare('SELECT * FROM plans WHERE slug=?').get(b.plan_slug);
 const services=db.prepare('SELECT count(*) n FROM services WHERE business_id=? AND active=1').get(b.id).n;
 const team=Number(plan?.max_staff||1)>1;
 const staff=db.prepare('SELECT count(*) n FROM staff WHERE business_id=? AND active=1').get(b.id).n;
 const hours=team?db.prepare(`SELECT ss.start_time,ss.end_time FROM staff_schedules ss JOIN staff st ON st.id=ss.staff_id WHERE st.business_id=? AND st.active=1 AND ss.active=1`).all(b.id):db.prepare('SELECT start_time,end_time FROM schedules WHERE business_id=? AND active=1').all(b.id);
 const schedules=hours.filter(row=>validTime(row.start_time)&&validTime(row.end_time)&&row.start_time<row.end_time).length;
 const stages=new Set(db.prepare('SELECT stage FROM growth_milestones WHERE business_id=?').all(b.id).map(x=>x.stage));
 const methods=paymentMethods(b);
 const collectionReady=b.payment_mode==='none'||methods.some(method=>method==='mercadopago'?Boolean(b.mp_access_token_enc):method==='bank_transfer'?Boolean((b.bank_alias||b.bank_account)&&b.bank_holder):false);
 const steps=[
  {id:'services',title:'Cargá tus servicios',detail:services?`${services} servicio${services===1?'':'s'} disponible${services===1?'':'s'}.`:'Sumá al menos un servicio que se pueda reservar.',tab:'Servicios',done:services>0},
  ...(team?[{id:'team',title:'Presentá a tu equipo',detail:staff?`${staff} integrante${staff===1?'':'s'} con agenda.`:'Agregá a las personas que van a atender.',tab:'Equipo',done:staff>0}]:[]),
  {id:'schedule',title:'Revisá tus horarios',detail:schedules?'Abrí la agenda y guardá los días y horarios en que vas a atender.':'Habilitá al menos un horario de atención.',tab:team?'Equipo':'Agenda',done:schedules>0&&stages.has('schedule_reviewed')},
  {id:'payment',title:'Elegí cómo cobrar',detail:b.payment_mode==='none'?'Tu modalidad actual es reservar sin anticipo. También podés elegir seña o pago completo.':collectionReady?'Tenés un medio de cobro conectado. Guardá tu modalidad para confirmarla.':'Completá un medio de cobro para recibir la seña o el pago.',tab:'Pagos',done:collectionReady&&stages.has('payment_reviewed')},
 ];
 const ready=Boolean(steps.every(step=>step.done)&&b.status==='active'&&b.show_booking);
 if(record&&ready)milestone(b.id,'page_ready');
 steps.push({id:'share',title:'Compartí tu página',detail:'Copiá el enlace para ponerlo en tu bio, WhatsApp o redes.',tab:'Mi página',done:stages.has('page_shared')});
 return {steps,ready,completed:steps.filter(step=>step.done).length,total:steps.length,path:'/reservar/'+encodeURIComponent(b.slug)};
}

export function markSetup(id,step,{staff=false}={}){
 const b=db.prepare('SELECT * FROM businesses WHERE id=?').get(id);
 if(step==='schedule'&&!staff&&db.prepare('SELECT max_staff FROM plans WHERE slug=?').get(b.plan_slug)?.max_staff>1)return;
 milestone(id,step==='schedule'?'schedule_reviewed':'payment_reviewed');
 if(b)setupState(b);
}

export function registerGrowth(app,{auth,own,superOnly,billingAccess}){
 // Existing dates are retained. A historical email verification has no invented date.
 if(!getSetting('growth_tracking_started_at'))db.transaction(()=>{
  const start=new Date().toISOString();
  db.prepare("INSERT INTO platform_settings(key,value) VALUES('growth_tracking_started_at',?)").run(start);
  for(const b of db.prepare('SELECT b.*,u.email_verified FROM businesses b JOIN users u ON u.id=b.owner_id').all()){
   milestone(b.id,'account_created',b.created_at,'historical');
   if(b.email_verified)milestone(b.id,'email_verified',null,'historical');
   const booking=db.prepare("SELECT min(created_at) at FROM bookings WHERE business_id=? AND booking_source='online'").get(b.id);
   if(booking.at){
    milestone(b.id,'first_booking',booking.at,'historical');
    for(const stage of ['schedule_reviewed','payment_reviewed','page_ready','page_shared'])milestone(b.id,stage,booking.at,'historical');
   }
   const payment=db.prepare("SELECT min(p.updated_at) at FROM platform_subscription_payments p JOIN platform_subscriptions s ON s.id=p.subscription_id WHERE s.business_id=? AND p.status='approved' AND p.review_reason IS NULL").get(b.id);
   if(payment.at)milestone(b.id,'subscription_paid',payment.at,'historical');
  }
 })();
 db.exec(`
 CREATE TRIGGER IF NOT EXISTS growth_registered AFTER INSERT ON businesses BEGIN
  INSERT OR IGNORE INTO growth_milestones(business_id,stage,occurred_at) VALUES(NEW.id,'account_created',NEW.created_at);
  INSERT OR IGNORE INTO growth_milestones(business_id,stage,occurred_at) SELECT NEW.id,'email_verified',CURRENT_TIMESTAMP WHERE EXISTS(SELECT 1 FROM users WHERE id=NEW.owner_id AND email_verified=1);
 END;
 CREATE TRIGGER IF NOT EXISTS growth_verified AFTER UPDATE OF email_verified ON users WHEN NEW.email_verified=1 AND OLD.email_verified=0 BEGIN
  INSERT OR IGNORE INTO growth_milestones(business_id,stage,occurred_at) SELECT id,'email_verified',CURRENT_TIMESTAMP FROM businesses WHERE owner_id=NEW.id;
 END;
 CREATE TRIGGER IF NOT EXISTS growth_booking AFTER INSERT ON bookings WHEN NEW.booking_source='online' AND NEW.series_id IS NULL BEGIN
  INSERT OR IGNORE INTO growth_milestones(business_id,stage,occurred_at) VALUES(NEW.business_id,'first_booking',NEW.created_at);
 END;
 CREATE TRIGGER IF NOT EXISTS growth_subscription_insert AFTER INSERT ON platform_subscription_payments WHEN NEW.status='approved' AND NEW.review_reason IS NULL AND NOT EXISTS(SELECT 1 FROM growth_milestones m JOIN platform_subscriptions s ON s.business_id=m.business_id WHERE s.id=NEW.subscription_id AND m.stage='subscription_paid') BEGIN
  INSERT OR IGNORE INTO growth_milestones(business_id,stage,occurred_at) SELECT business_id,'subscription_paid',NEW.updated_at FROM platform_subscriptions WHERE id=NEW.subscription_id;
 END;
 CREATE TRIGGER IF NOT EXISTS growth_subscription_update AFTER UPDATE ON platform_subscription_payments WHEN NEW.status='approved' AND NEW.review_reason IS NULL AND NOT EXISTS(SELECT 1 FROM growth_milestones m JOIN platform_subscriptions s ON s.business_id=m.business_id WHERE s.id=NEW.subscription_id AND m.stage='subscription_paid') BEGIN
  INSERT OR IGNORE INTO growth_milestones(business_id,stage,occurred_at) SELECT business_id,'subscription_paid',NEW.updated_at FROM platform_subscriptions WHERE id=NEW.subscription_id;
 END;`);

 app.get('/api/businesses/:id/setup',auth,(req,res)=>{
  const b=own(req.user.sub,req.params.id);if(!b)return res.sendStatus(403);
  res.set('Cache-Control','no-store').json({...setupState(b),can_receive_bookings:billingAccess(b)});
 });
 app.post('/api/businesses/:id/setup/share',auth,(req,res)=>{
  const b=own(req.user.sub,req.params.id);if(!b)return res.sendStatus(403);
  if(!setupState(b).ready||!billingAccess(b))return res.status(409).json({error:'Completá servicios, horarios y pagos, y revisá el acceso de tu plan antes de compartir.'});
  milestone(b.id,'page_shared');res.json({ok:true,...setupState(b)});
 });
 app.get('/api/admin/growth',auth,superOnly,(req,res)=>{
  const days=String(req.query.days||'30');if(!['7','30','90','365','all'].includes(days))return res.status(400).json({error:'Elegí un período válido.'});
  const since=days==='all'?null:new Date(Date.now()-Number(days)*86400000).toISOString();
  const cohort=db.prepare('SELECT * FROM businesses WHERE (? IS NULL OR datetime(created_at)>=datetime(?))').all(since,since);
  for(const b of cohort)setupState(b);
  const names={account_created:'Cuentas creadas',email_verified:'Email verificado',page_ready:'Página preparada',first_booking:'Primera reserva online',subscription_paid:'Primer pago de suscripción aprobado'};
  const rows=Object.entries(names).map(([stage,label])=>{
   const count=db.prepare('SELECT count(*) n FROM growth_milestones m JOIN businesses b ON b.id=m.business_id WHERE m.stage=? AND (? IS NULL OR datetime(b.created_at)>=datetime(?))').get(stage,since,since).n;
   return {stage,label,count,percent:cohort.length?Math.round(count/cohort.length*100):0};
  });
  const waiting=db.prepare("SELECT count(*) n FROM businesses b JOIN users u ON u.id=b.owner_id WHERE u.email_verified=0 AND (? IS NULL OR datetime(b.created_at)>=datetime(?))").get(since,since).n;
  res.set('Cache-Control','no-store').json({days,since,total:cohort.length,tracking_started_at:getSetting('growth_tracking_started_at'),rows,unverified:waiting});
 });
}
