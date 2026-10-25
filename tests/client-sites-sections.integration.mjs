import {randomBytes} from 'node:crypto';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Isolated fixtures use reserved .test domains, non-routable numbers and runtime credentials.
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'adara-client-sites-')),password=randomBytes(24).toString('base64url')+'Aa1!';
Object.assign(process.env,{NODE_ENV:'test',DATA_DIR:dir,UPLOADS_DIR:path.join(dir,'uploads'),JWT_SECRET:randomBytes(32).toString('hex'),RESEND_API_KEY:'',DISABLE_FEATURE_WORKER:'true',DEMO_PAYMENTS:'true',SUPERADMIN_EMAIL:'',SUPERADMIN_PASSWORD:''});
const networkFetch=global.fetch;global.fetch=(url,options)=>{if(String(url).startsWith('http://127.0.0.1:'))return networkFetch(url,options);throw Error('External transport forbidden for fixtures')};
const {app}=await import('../server/index.js'),{db}=await import('../server/db.js'),{readSections,validateSections}=await import('../server/page-layout.js'),{findClient}=await import('../server/features.js');
const server=app.listen(0);await new Promise(resolve=>server.once('listening',resolve));const base=`http://127.0.0.1:${server.address().port}/api`;let checks=0;
const check=fn=>{fn();checks++};
const checkAsync=async fn=>{await fn();checks++};
async function req(route,method='GET',body,cookie='',status=200){const response=await fetch(base+route,{method,headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)}),data=await response.json().catch(()=>({}));check(()=>assert.equal(response.status,status,JSON.stringify({route,data})));return {data,cookie:response.headers.get('set-cookie')?.split(';')[0]};}
async function owner(n,plan='adara'){
 await req('/auth/register','POST',{name:'Fixture Owner '+n,businessName:'Fixture Site '+n,email:`owner-${n}@fixture.example.test`,password,plan});
 const user=db.prepare('SELECT * FROM users WHERE email=?').get(`owner-${n}@fixture.example.test`),verified=await req('/auth/verify?token='+user.verify_token),business=(await req('/me','GET',undefined,verified.cookie)).data.businesses[0];
 return {cookie:verified.cookie,b:business,root:'/businesses/'+business.id};
}
try{
 const a=await owner(1),b=await owner(2,'adara-inicial'),unready=await owner(3),root=a.root+'/clients';
 const input={name:'Fixture Client A',email:'CLIENT-A@fixture.example.test',phone:'+00 000 000 0001',notes:'Nota ficticia'};
 await req(root,'POST',input,'',401);await req(root,'POST',input,b.cookie,403);
 const id=(await req(root,'POST',input,a.cookie,201)).data.id;
 let list=(await req(root,'GET',undefined,a.cookie)).data;check(()=>assert.equal(list.length,1));check(()=>assert.equal(list[0].email,'client-a@fixture.example.test'));check(()=>assert.equal(list[0].phone_normalized,'000000000001'));check(()=>assert.equal(list[0].booking_count,0));
 await req(root,'POST',{...input,name:'Fixture Duplicate'},a.cookie,409);await req(root,'POST',{name:'Fixture Duplicate',phone:'(00) 0000000001'},a.cookie,409);
 const minimal=(await req(root,'POST',{name:'Fixture without contact'},a.cookie,201)).data.id;
 const before=db.prepare('SELECT count(*) n FROM clients WHERE business_id=?').get(a.b.id).n;
 for(const bad of [{name:''},{name:[]},{name:'x'.repeat(121)},{name:'Fixture Invalid',email:'bad'},{name:'Fixture Invalid',phone:'javascript:alert(1)'},{name:'Fixture Invalid',phone:'123'},{name:'Fixture Invalid',notes:'x'.repeat(4001)}])await req(root,'POST',bad,a.cookie,400);
 check(()=>assert.equal(db.prepare('SELECT count(*) n FROM clients WHERE business_id=?').get(a.b.id).n,before));
 const otherId=(await req(b.root+'/clients','POST',input,b.cookie,201)).data.id;
 await req(root+'/'+id,'PATCH',{name:'Fixture denied'},b.cookie,403);await req(root+'/'+otherId,'PATCH',{name:'Fixture denied'},a.cookie,404);await req(root+'/'+id,'DELETE',undefined,b.cookie,403);await req(root+'/'+otherId,'DELETE',undefined,a.cookie,404);
 await req(root+'/'+minimal,'PATCH',{email:input.email.toLowerCase()},a.cookie,409);
 await req(root+'/'+id,'PATCH',{name:'Fixture Client Updated',phone:'000000000002',email:'client-updated@fixture.example.test',notes:'Nota actualizada'},a.cookie);
 const current=db.prepare('SELECT * FROM clients WHERE id=?').get(id);check(()=>assert.equal(current.phone_normalized,'000000000002'));check(()=>assert.equal(current.name,'Fixture Client Updated'));check(()=>assert.equal(findClient(a.b,current.email,current.phone).id,id));check(()=>assert.equal(findClient(a.b,'','000000000001'),undefined));
 // Editing a ficha updates existing booking contact data and unsent reminder recipients.
 const sid=(await req(a.root+'/services','POST',{name:'Servicio ficticio',price:15000,duration:30},a.cookie)).data.id,date=new Date(Date.now()+4*86400000).toISOString().slice(0,10);
 db.prepare("UPDATE schedules SET start_time='09:00',end_time='17:00',active=1 WHERE business_id=?").run(a.b.id);db.prepare("UPDATE businesses SET booking_notice_min=0,payment_mode='none' WHERE id=?").run(a.b.id);
 const booking=(await req(a.root+'/manual-bookings','POST',{serviceIds:[sid],date,time:'10:00',clientId:id},a.cookie,201)).data.booking;
 const payload={name:current.name,email:current.email,phone:current.phone_normalized,businessName:a.b.name,date,time:'10:00',url:'https://fixture.example.test/booking',text:'Fixture reminder'};
 db.prepare("INSERT INTO notification_jobs(business_id,booking_id,kind,channel,dedupe_key,payload_json) VALUES(?,?,'reminder','email','fixture-contact-update',?)").run(a.b.id,booking.id,JSON.stringify(payload));
 await req(root+'/'+id,'PATCH',{name:'Fixture Client Revised',email:'client-revised@fixture.example.test',phone:'000000000003'},a.cookie);
 const queued=JSON.parse(db.prepare("SELECT payload_json FROM notification_jobs WHERE dedupe_key='fixture-contact-update'").get().payload_json);check(()=>assert.equal(queued.name,'Fixture Client Revised'));check(()=>assert.equal(queued.email,'client-revised@fixture.example.test'));check(()=>assert.equal(queued.phone,'000000000003'));
 db.prepare('UPDATE clients SET waive_advance=1,payment_access_token=? WHERE id=?').run(randomBytes(24).toString('hex'),id);
 await req(root+'/'+id,'DELETE',undefined,a.cookie);await req(root+'/'+id,'DELETE',undefined,a.cookie);
 list=(await req(root,'GET',undefined,a.cookie)).data;check(()=>assert.ok(!list.some(c=>c.id===id)));await checkAsync(async()=>assert.equal((await req(root+'?archived=1','GET',undefined,a.cookie)).data[0].id,id));
 const saved=db.prepare('SELECT * FROM clients WHERE id=?').get(id);check(()=>assert.ok(saved.archived_at));check(()=>assert.equal(saved.payment_access_token,null));check(()=>assert.equal(saved.waive_advance,0));check(()=>assert.equal(db.prepare('SELECT status FROM bookings WHERE id=?').get(booking.id).status,'confirmed'));
 const bookings=(await req(a.root+'/bookings','GET',undefined,a.cookie)).data;check(()=>assert.equal(bookings.find(x=>x.id===booking.id).client,'Fixture Client Revised'));
 await req(root,'POST',{name:'Fixture Duplicate',phone:'000000000003'},a.cookie,409);await req(root+'/'+id,'PATCH',{name:'Fixture Hidden'},a.cookie,409);
 await req(root+'/'+id+'/restore','POST',{},b.cookie,403);await req(root+'/'+id+'/restore','POST',{},a.cookie);check(()=>assert.equal(db.prepare('SELECT archived_at FROM clients WHERE id=?').get(id).archived_at,null));
 // Reserving again restores the original contact, preserving all linked appointments.
 await req(root+'/'+id,'DELETE',undefined,a.cookie);
 await req('/public/'+a.b.slug+'/bookings','POST',{serviceIds:[sid],date,time:'12:00',clientName:'Fixture Client Revised',phone:'000000000003',email:'client-revised@fixture.example.test'});
 check(()=>assert.equal(db.prepare('SELECT archived_at FROM clients WHERE id=?').get(id).archived_at,null));check(()=>assert.equal(db.prepare('SELECT count(*) n FROM clients WHERE business_id=?').get(a.b.id).n,before));check(()=>assert.equal(db.prepare('SELECT count(*) n FROM bookings WHERE client_id=?').get(id).n,2));
 // Legacy layouts keep their order and append reviews, which can then move anywhere.
 const legacy=['faqs','posts','services','hero','promotions','booking'];db.prepare('UPDATE businesses SET section_order_json=? WHERE id=?').run(JSON.stringify(legacy),a.b.id);
 check(()=>assert.deepEqual(readSections(JSON.stringify(legacy)),[...legacy,'reviews']));check(()=>assert.deepEqual(validateSections(legacy),[...legacy,'reviews']));
 let page=(await req(a.root+'/page-settings','GET',undefined,a.cookie)).data.business;check(()=>assert.deepEqual(page.section_order,[...legacy,'reviews']));
 const reordered=['hero','reviews','services','booking','promotions','posts','faqs'];await req(a.root+'/page-settings','PUT',{...page,section_order:reordered},a.cookie);await checkAsync(async()=>assert.deepEqual((await req('/public/'+a.b.slug)).data.business.section_order,reordered));
 await req(a.root+'/page-settings','PUT',{...page,section_order:['hero','reviews','reviews','booking','promotions','posts','faqs']},a.cookie,400);check(()=>assert.deepEqual(readSections(db.prepare('SELECT section_order_json FROM businesses WHERE id=?').get(a.b.id).section_order_json),reordered));
 // Genuine, nonempty active sites only; the endpoint never exposes account or customer details.
 let sites=(await req('/public/home/sites')).data;check(()=>assert.equal(sites.length,1));check(()=>assert.equal(sites[0].name,a.b.name));check(()=>assert.equal(sites[0].path,'/reservar/'+a.b.slug));
 for(const key of ['email','phone','owner_id','bank_alias','mp_access_token_enc','clients','trial_ends_at','id'])check(()=>assert.equal(sites[0][key],undefined));
 db.prepare("UPDATE businesses SET status='suspended' WHERE id=?").run(a.b.id);await checkAsync(async()=>assert.equal((await req('/public/home/sites')).data.length,0));db.prepare("UPDATE businesses SET status='active' WHERE id=?").run(a.b.id);
 db.prepare('UPDATE users SET email_verified=0 WHERE id=?').run(a.b.owner_id);await checkAsync(async()=>assert.equal((await req('/public/home/sites')).data.length,0));db.prepare('UPDATE users SET email_verified=1 WHERE id=?').run(a.b.owner_id);
 await checkAsync(async()=>assert.ok(!(await req('/public/home/sites')).data.some(s=>s.path==='/reservar/'+unready.b.slug)));
 // Upgrade the former inverted payment policy without touching any price or custom plan.
 const prices=db.prepare('SELECT slug,monthly_price_cents,annual_price_cents FROM plans ORDER BY id').all();db.prepare("UPDATE plans SET mercadopago_enabled=CASE WHEN slug='adara' THEN 0 ELSE 1 END").run();db.prepare("UPDATE plans SET features_json='[\"Mercado Pago integrado\"]' WHERE slug='adara-inicial'").run();db.prepare("UPDATE plans SET features_json='[\"Cobros por transferencia\"]' WHERE slug='adara'").run();db.prepare("DELETE FROM platform_settings WHERE key='plan_payment_rules_v3'").run();
 await import('../server/plan-payments.js?fixture-upgrade');check(()=>assert.deepEqual(db.prepare('SELECT slug,monthly_price_cents,annual_price_cents FROM plans ORDER BY id').all(),prices));
 const plans=(await req('/public/plans')).data,initial=plans.find(p=>p.slug==='adara-inicial'),individual=plans.find(p=>p.slug==='adara');check(()=>assert.equal(initial.mercadopago_enabled,0));check(()=>assert.ok(!initial.features.some(f=>/mercado pago/i.test(f))));check(()=>assert.equal(individual.mercadopago_enabled,1));check(()=>assert.ok(individual.features.includes('Mercado Pago integrado')));check(()=>assert.ok(plans.find(p=>p.slug==='adara-equipo').features.includes('Mercado Pago integrado')));
 await req(b.root+'/payment-settings','PUT',{payment_mode:'none',payment_methods:['bank_transfer']},b.cookie);await req(b.root+'/payment-settings','PUT',{payment_mode:'none',payment_methods:['mercadopago']},b.cookie,400);await req(b.root+'/mercadopago/connect','GET',undefined,b.cookie,403);
 await req(a.root+'/payment-settings','PUT',{payment_mode:'none',payment_methods:['mercadopago','bank_transfer']},a.cookie);const settings=(await req(a.root+'/payment-settings','GET',undefined,a.cookie)).data;check(()=>assert.equal(settings.mercadopago_enabled,true));check(()=>assert.deepEqual(settings.payment_methods,['mercadopago','bank_transfer']));
 console.log(`OK: ${checks} comprobaciones de clientas, historial, contactos, sitios reales, reseñas ordenables y corrección de planes existentes.`);
}finally{global.fetch=networkFetch;await new Promise(resolve=>server.close(resolve));db.close();fs.rmSync(dir,{recursive:true,force:true})}
