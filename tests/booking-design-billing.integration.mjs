import bcrypt from 'bcryptjs';
import {randomBytes} from 'node:crypto';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const ownerPassword=randomBytes(24).toString('base64url')+'Aa1!',adminPassword=randomBytes(24).toString('base64url')+'Aa1!';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'adara-improvements-'));
Object.assign(process.env,{NODE_ENV:'development',DATA_DIR:dir,UPLOADS_DIR:path.join(dir,'uploads'),JWT_SECRET:randomBytes(32).toString('hex'),DISABLE_FEATURE_WORKER:'true',RESEND_API_KEY:'',MP_BILLING_ACCESS_TOKEN:'',MP_BILLING_WEBHOOK_SECRET:'',DEMO_SUBSCRIPTIONS:'true',DEMO_PAYMENTS:'true',SUPERADMIN_EMAIL:'admin@adaraweb.local',SUPERADMIN_PASSWORD:adminPassword});
const {app}=await import('../server/index.js'),{db}=await import('../server/db.js'),{addBillingMonths}=await import('../server/platform-billing.js');
db.prepare("INSERT INTO users(name,email,password_hash,role,email_verified) VALUES('Fixture Super','admin@adaraweb.local',?,'superadmin',1)").run(bcrypt.hashSync(adminPassword,8));
const server=app.listen(0);await new Promise(resolve=>server.once('listening',resolve));const base=`http://127.0.0.1:${server.address().port}/api`;let checks=0;
const check=fn=>{fn();checks++};
async function request(route,method='GET',body,cookie='',expected=200){
 const multipart=body instanceof FormData,response=await fetch(base+route,{method,headers:{...(!multipart?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{})},body:body===undefined?undefined:multipart?body:JSON.stringify(body)}),data=await response.json().catch(()=>({}));
 check(()=>assert.equal(response.status,expected,JSON.stringify({route,status:response.status,data})));return {data,cookie:response.headers.get('set-cookie')?.split(';')[0]};
}
async function owner(n,plan='adara'){
 const registered=await request('/auth/register','POST',{name:'Fixture '+n,email:`improvements${n}@example.test`,password:ownerPassword,businessName:'Prueba mejoras '+n,plan});
 const token=new URL('https://x'+registered.data.devVerifyUrl).searchParams.get('token'),verified=await request('/auth/verify?token='+token),me=await request('/me','GET',undefined,verified.cookie);
 return {cookie:verified.cookie,b:me.data.businesses[0],root:'/businesses/'+me.data.businesses[0].id};
}
try{
 const a=await owner(1),b=await owner(2),login=await request('/auth/login','POST',{email:'admin@adaraweb.local',password:adminPassword}),admin=login.cookie;
 const tomorrow=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Argentina/Buenos_Aires',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(Date.now()+2*86400000));
 const sid=(await request(a.root+'/services','POST',{name:'Servicio largo',price:15000,duration:60,duration_auto:false},a.cookie)).data.id;
 const short=(await request(a.root+'/services','POST',{name:'Servicio corto',price:5000,duration:30,duration_auto:false},a.cookie)).data.id;
 db.prepare("UPDATE schedules SET start_time='09:00',end_time='17:00',active=1 WHERE business_id=?").run(a.b.id);
 await request(a.root+'/payment-settings','PUT',{payment_mode:'total',payment_methods:['bank_transfer'],bank_alias:'fixture.adara',bank_holder:'Titular de prueba'},a.cookie);
 const settings=(await request(a.root+'/payment-settings','GET',undefined,a.cookie)).data;check(()=>assert.equal(settings.mercadopago_enabled,true));check(()=>assert.deepEqual(settings.payment_methods,['bank_transfer']));
 await request(a.root+'/payment-settings','PUT',{payment_mode:'total',payment_methods:['mercadopago','bank_transfer']},a.cookie);await request(a.root+'/payment-settings','PUT',{payment_mode:'total',payment_methods:['bank_transfer']},a.cookie);
 const plans=(await request('/public/plans')).data,individual=plans.find(p=>p.slug==='adara');check(()=>assert.equal(individual.mercadopago_enabled,1));check(()=>assert.ok(individual.features.includes('Mercado Pago integrado')));check(()=>assert.ok(plans.filter(p=>p.slug==='adara-inicial').every(p=>p.mercadopago_enabled===0&&!p.features.some(x=>/mercado pago/i.test(x)))));
 const publicStore=(await request('/public/'+a.b.slug)).data;check(()=>assert.deepEqual(JSON.parse(publicStore.business.payment_methods_json),['bank_transfer']));check(()=>assert.equal(publicStore.business.bank_alias,undefined));
 const manual={serviceIds:[sid],date:tomorrow,time:'18:00',clientName:'Cliente manual',notes:'Horario extra'};
 await request(a.root+'/manual-bookings','POST',manual,a.cookie,409);
 const created=(await request(a.root+'/manual-bookings','POST',{...manual,overrideSchedule:true},a.cookie,201)).data.booking;
 check(()=>assert.equal(created.start_time,'18:00'));check(()=>assert.equal(created.end_time,'19:00'));check(()=>assert.equal(created.manual_override,1));check(()=>assert.equal(created.status,'confirmed'));check(()=>assert.equal(created.total_cents,1500000));
 await request(a.root+'/manual-bookings','POST',{...manual,time:'18:30',overrideSchedule:true},a.cookie,409);
 const publicSlots=(await request('/public/'+a.b.slug+'/availability?date='+tomorrow+'&serviceIds='+sid)).data.slots;check(()=>assert.ok(!publicSlots.includes('18:00')));
 await request('/public/'+a.b.slug+'/bookings','POST',{...manual,phone:'5492235551100',time:'20:00',overrideSchedule:true},'',409);
 await request(a.root+'/manual-bookings','POST',{...manual,time:'23:30',overrideSchedule:true},a.cookie,409);
 db.prepare('INSERT INTO blocks(business_id,date,all_day,start_time,end_time,reason) VALUES(?,?,0,?,?,?)').run(a.b.id,tomorrow,'20:00','21:00','Bloqueo de prueba');
 await request(a.root+'/manual-bookings','POST',{...manual,time:'20:00',overrideSchedule:true},a.cookie,409);
 const changed=(await request(a.root+'/manual-bookings/'+created.id,'PUT',{...manual,serviceIds:[short],time:'18:17',overrideSchedule:true,clientId:created.client_id},a.cookie)).data.booking;
 check(()=>assert.equal(changed.end_time,'18:47'));check(()=>assert.equal(changed.total_cents,500000));check(()=>assert.equal(changed.items.length,1));check(()=>assert.equal(changed.items[0].service_id,short));check(()=>assert.equal(changed.manage_token,created.manage_token));
 await request(a.root+'/manual-bookings/'+created.id,'PUT',{...manual,serviceIds:[short],overrideSchedule:true},b.cookie,403);
 const promo=(await request(a.root+'/promotions','POST',{title:'Combo de prueba',pricing_mode:'fixed',price_after:12000,service_ids:[sid,short],active:true,show_banner:true},a.cookie)).data.id;
 const special=(await request(a.root+'/manual-bookings','POST',{...manual,time:'21:00',serviceIds:[sid,short],promotionId:promo,overrideSchedule:true},a.cookie,201)).data.booking;
 check(()=>assert.equal(special.total_cents,1200000));check(()=>assert.equal(special.subtotal_cents,2000000));check(()=>assert.equal(special.promotion_id,promo));check(()=>assert.equal(special.promotion_discount_cents,800000));check(()=>assert.equal(special.items.reduce((n,i)=>n+i.line_promotion_discount_cents,0),800000));
 await request(a.root+'/manual-bookings/'+special.id,'PUT',{...manual,time:'21:00',serviceIds:[short],promotionId:promo,overrideSchedule:true},a.cookie,400);
 check(()=>assert.equal(db.prepare('SELECT total_cents FROM bookings WHERE id=?').get(special.id).total_cents,1200000));
 const plain=(await request(a.root+'/manual-bookings/'+special.id,'PUT',{...manual,time:'21:00',serviceIds:[short],promotionId:null,overrideSchedule:true},a.cookie)).data.booking;
 check(()=>assert.equal(plain.promotion_id,null));check(()=>assert.equal(plain.total_cents,500000));check(()=>assert.equal(plain.end_time,'21:30'));
 const before=db.prepare('SELECT count(*) n FROM clients WHERE business_id=?').get(a.b.id).n;
 const races=await Promise.all(['A','B'].map(name=>fetch(base+a.root+'/manual-bookings',{method:'POST',headers:{'Content-Type':'application/json',Cookie:a.cookie},body:JSON.stringify({...manual,time:'22:15',serviceIds:[short],clientName:'Carrera '+name,overrideSchedule:true})})));
 check(()=>assert.deepEqual(races.map(r=>r.status).sort(),[201,409]));check(()=>assert.equal(db.prepare('SELECT count(*) n FROM clients WHERE business_id=?').get(a.b.id).n,before+1));
 // Private subscription transfers: quote -> proof -> independently verified credit.
 await request('/admin/subscription-transfer-settings','PUT',{enabled:true,alias:'adara.fixture',holder:'Adara de prueba'},a.cookie,403);
 await request('/admin/subscription-transfer-settings','PUT',{enabled:true,account:'123',holder:'Adara'},admin,400);
 const price=individual.monthly_price_cents,orderInput={plan_slug:'adara',billing_cycle:'monthly',confirm_transfer:true,expected_amount_cents:price};
 await request(a.root+'/subscription/transfers','POST',orderInput,a.cookie,503);
 await request('/admin/subscription-transfer-settings','PUT',{enabled:true,alias:'adara.fixture',holder:'Adara de prueba',bank:'Banco de prueba',instructions:'Sólo prueba local.'},admin);
 await request(a.root+'/subscription/transfers','POST',{...orderInput,expected_amount_cents:1},a.cookie,409);
 await request(a.root+'/subscription/transfers','POST',{...orderInput,confirm_transfer:false},a.cookie,400);
 const order=(await request(a.root+'/subscription/transfers','POST',orderInput,a.cookie,201)).data.transfer;
 check(()=>assert.equal(order.amount_cents,price));check(()=>assert.equal(order.bank_details.alias,'adara.fixture'));check(()=>assert.equal(order.stored_name,undefined));check(()=>assert.equal(db.prepare('SELECT subscription_paid_until FROM businesses WHERE id=?').get(a.b.id).subscription_paid_until,null));
 const duplicate=(await request(a.root+'/subscription/transfers','POST',orderInput,a.cookie)).data.transfer;check(()=>assert.equal(duplicate.id,order.id));
 await request(a.root+'/subscription','POST',{authorize_recurring:true},a.cookie,400);
 await request('/admin/subscription-transfer-settings','PUT',{enabled:true,alias:'cuenta.nueva',holder:'Otra cuenta de prueba'},admin);
 const bankSnapshot=(await request(a.root+'/subscription','GET',undefined,a.cookie)).data;check(()=>assert.equal(bankSnapshot.transfers[0].bank_details.alias,'adara.fixture'));
 const proof=new FormData();proof.append('receipt',new Blob(['%PDF-1.4\nComprobante ficticio\n%%EOF'],{type:'application/pdf'}),'comprobante-prueba.pdf');
 const uploaded=(await request(a.root+'/subscription/transfers/'+order.id+'/receipt','POST',proof,a.cookie)).data.transfer;
 check(()=>assert.equal(uploaded.status,'receipt_submitted'));check(()=>assert.equal(uploaded.stored_name,undefined));check(()=>assert.equal(db.prepare('SELECT count(*) n FROM platform_subscription_payments').get().n,0));
 let receipt=await fetch(base+a.root+'/subscription/transfers/'+order.id+'/receipt',{headers:{Cookie:a.cookie}});check(()=>assert.equal(receipt.status,200));check(()=>assert.equal(receipt.headers.get('cache-control'),'no-store'));check(()=>assert.ok(receipt.headers.get('content-disposition').includes('attachment')));
 receipt=await fetch(base+a.root+'/subscription/transfers/'+order.id+'/receipt',{headers:{Cookie:b.cookie}});check(()=>assert.equal(receipt.status,403));
 receipt=await fetch(base+'/admin/subscription-transfers/'+order.id+'/receipt',{headers:{Cookie:a.cookie}});check(()=>assert.equal(receipt.status,403));
 const approval={amount:price/100,reference:'BANK-OP-001',funds_received:true};
 await request('/admin/subscription-transfers/'+order.id+'/approve','POST',approval,a.cookie,403);
 await request('/admin/subscription-transfers/'+order.id+'/approve','POST',{...approval,funds_received:false},admin,400);
 await request('/admin/subscription-transfers/'+order.id+'/approve','POST',{...approval,amount:1},admin,400);
 await request('/admin/subscription-transfers/'+order.id+'/approve','POST',{...approval,reference:''},admin,400);
 check(()=>assert.equal(db.prepare('SELECT count(*) n FROM platform_subscription_payments').get().n,0));
 const approved=(await request('/admin/subscription-transfers/'+order.id+'/approve','POST',approval,admin)).data.transfer;
 check(()=>assert.equal(approved.status,'approved'));check(()=>assert.equal(approved.period_start,a.b.trial_ends_at));check(()=>assert.equal(approved.period_end,addBillingMonths(a.b.trial_ends_at,1)));
 let billing=(await request(a.root+'/subscription','GET',undefined,a.cookie)).data;check(()=>assert.equal(billing.paid_until,approved.period_end));check(()=>assert.equal(billing.subscription.provider,'bank_transfer'));check(()=>assert.equal(billing.subscription.status,'paid'));check(()=>assert.equal(billing.subscription.next_payment_date,null));check(()=>assert.ok(billing.access_allowed));
 await request('/admin/subscription-transfers/'+order.id+'/approve','POST',approval,admin);check(()=>assert.equal(db.prepare('SELECT count(*) n FROM platform_subscription_payments').get().n,1));check(()=>assert.equal(db.prepare('SELECT subscription_paid_until FROM businesses WHERE id=?').get(a.b.id).subscription_paid_until,approved.period_end));
 const next=(await request(a.root+'/subscription/transfers','POST',orderInput,a.cookie,201)).data.transfer;
 await request('/admin/subscription-transfers/'+next.id+'/approve','POST',approval,admin,409);
 const extended=(await request('/admin/subscription-transfers/'+next.id+'/approve','POST',{...approval,reference:'BANK-OP-002'},admin)).data.transfer;
 check(()=>assert.equal(extended.period_start,approved.period_end));check(()=>assert.equal(extended.period_end,addBillingMonths(approved.period_end,1)));
 const rejected=(await request(b.root+'/subscription/transfers','POST',orderInput,b.cookie,201)).data.transfer;
 await request('/admin/subscription-transfers/'+rejected.id+'/reject','POST',{reason:'No se verificó un ingreso en la cuenta de prueba.'},admin);
 check(()=>assert.equal(db.prepare('SELECT subscription_paid_until FROM businesses WHERE id=?').get(b.b.id).subscription_paid_until,null));
 const again=(await request(b.root+'/subscription/transfers','POST',orderInput,b.cookie,201)).data.transfer;
 await request(b.root+'/subscription/transfers/'+again.id+'/cancel','POST',{confirm:true},b.cookie);
 check(()=>assert.equal(db.prepare('SELECT status FROM platform_subscription_transfers WHERE id=?').get(again.id).status,'cancelled'));
 await request(b.root+'/subscription','POST',{authorize_recurring:true},b.cookie);
 await request(b.root+'/subscription/transfers','POST',orderInput,b.cookie,409);
 await request(b.root+'/subscription/cancel','POST',{confirm:true},b.cookie);
 const upcoming=new Date(Date.now()+3*86400000).toISOString();db.prepare("UPDATE businesses SET subscription_paid_until=?,subscription_managed=1,subscription_status='active' WHERE id=?").run(upcoming,a.b.id);
 const dashboard=(await request(a.root+'/dashboard','GET',undefined,a.cookie)).data;check(()=>assert.equal(dashboard.billing_notice.days,3));check(()=>assert.equal(dashboard.billing_notice.kind,'expiry'));
 db.prepare('UPDATE businesses SET subscription_paid_until=? WHERE id=?').run(new Date(Date.now()+20*86400000).toISOString(),a.b.id);const laterDashboard=(await request(a.root+'/dashboard','GET',undefined,a.cookie)).data;check(()=>assert.equal(laterDashboard.billing_notice,null));
 // New design settings and review feedback survive the full API round trip.
 const page=(await request(a.root+'/page-settings','GET',undefined,a.cookie)).data.business;
 for(const [index,heading]of ['geometric','rounded','condensed','handwritten'].entries()){
  await request(a.root+'/page-settings','PUT',{...page,heading_font:heading,body_font:index%2?'serif':'rounded',hero_layout:['split','arch','offset','cinematic'][index],hero_height:index%2?'xl':'compact'},a.cookie);
  const displayed=(await request('/public/'+a.b.slug)).data.business;check(()=>assert.equal(displayed.heading_font,heading));check(()=>assert.equal(displayed.body_font,index%2?'serif':'rounded'));check(()=>assert.equal(displayed.hero_height,index%2?'xl':'compact'));
 }
 await request(a.root+'/promotions/'+promo,'PUT',{banner_price_mode:'price'},a.cookie);
 const banner=(await request('/public/'+a.b.slug)).data.promotions.find(p=>p.id===promo);check(()=>assert.equal(banner.banner_price_mode,'price'));check(()=>assert.equal(banner.price_after_cents,1200000));
 await request(a.root+'/promotions/'+promo,'PUT',{banner_price_mode:'invalid'},a.cookie,400);check(()=>assert.equal(db.prepare('SELECT banner_price_mode FROM promotions WHERE id=?').get(promo).banner_price_mode,'price'));
 const review=(await request('/public/'+a.b.slug+'/reviews','POST',{name:'Clienta de prueba',body:'Reseña ficticia para comprobar el agradecimiento.',rating:5,consent:true},'',201)).data;
 check(()=>assert.match(review.message,/gracias/i));check(()=>assert.doesNotMatch(review.message,/pendiente/i));check(()=>assert.equal(db.prepare('SELECT status FROM client_reviews WHERE business_id=?').get(a.b.id).status,'pending'));check(()=>assert.equal((db.prepare("SELECT count(*) n FROM client_reviews WHERE business_id=? AND status='published'").get(a.b.id)).n,0));
 // The original cancellation endpoint also closes a transfer order consistently.
 const cancelThroughLegacy=(await request(b.root+'/subscription/transfers','POST',orderInput,b.cookie,201)).data.transfer;
 await request(b.root+'/subscription/cancel','POST',{confirm:true},b.cookie);check(()=>assert.equal(db.prepare('SELECT status FROM platform_subscription_transfers WHERE id=?').get(cancelThroughLegacy.id).status,'cancelled'));
 // Existing manual bookings stay editable after expiration; creating a new one stays blocked.
 db.prepare("UPDATE businesses SET subscription_managed=1,subscription_paid_until=?,trial_ends_at=? WHERE id=?").run(new Date(Date.now()-3600000).toISOString(),new Date(Date.now()-86400000).toISOString(),a.b.id);
 await request(a.root+'/manual-bookings','POST',{...manual,time:'16:00',bookingId:created.id},a.cookie,402);
 const afterExpiry=(await request(a.root+'/manual-bookings/'+created.id,'PUT',{...manual,serviceIds:[short],time:'18:17',overrideSchedule:true,clientId:created.client_id,notes:'Edición luego del vencimiento'},a.cookie)).data.booking;check(()=>assert.equal(afterExpiry.notes,'Edición luego del vencimiento'));
 await request(a.root+'/manual-bookings/availability','POST',{...manual,serviceIds:[short],time:'18:17',overrideSchedule:true,bookingId:created.id},a.cookie);
 console.log(`OK: ${checks} comprobaciones de horarios excepcionales, edición manual, promociones, reglas de pago por plan, transferencias privadas, confirmación idempotente y avisos de vencimiento.`);
}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));db.close();fs.rmSync(dir,{recursive:true,force:true})}
