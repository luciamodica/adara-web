import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const cwd=process.cwd(),temp=fs.mkdtempSync(path.join(os.tmpdir(),'adara-manual-whatsapp-'));
process.chdir(temp);
Object.assign(process.env,{NODE_ENV:'development',DISABLE_FEATURE_WORKER:'true',DEMO_PAYMENTS:'false',FRONTEND_URL:'https://adara.example.test',RESEND_API_KEY:'fixture-only',WHATSAPP_ACCESS_TOKEN:'fixture-only',WHATSAPP_PHONE_NUMBER_ID:'fixture-only',WHATSAPP_GRAPH_VERSION:'fixture-only',WHATSAPP_REMINDER_TEMPLATE:'fixture-only',WHATSAPP_WAITLIST_TEMPLATE:'fixture-only'});
const nativeFetch=global.fetch;let providerCalls=0;
global.fetch=async(url,options)=>{if(String(url).startsWith('https://api.resend.com/'))return new Response('{"id":"fixture-only"}',{status:200});if(String(url).startsWith('http://127.0.0.1:'))return nativeFetch(url,options);providerCalls++;throw Error('No external messages allowed in this test')};
const {app}=await import('../server/index.js'),{db}=await import('../server/db.js');
const server=app.listen(0);await new Promise(resolve=>server.once('listening',resolve));
const base=`http://127.0.0.1:${server.address().port}/api`;let checks=0;
const check=fn=>{fn();checks++};
async function req(route,method='GET',body,cookie='',status=200){const response=await fetch(base+route,{method,headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)}),data=await response.json().catch(()=>({}));check(()=>assert.equal(response.status,status,JSON.stringify({route,data})));return {response,data,cookie:response.headers.get('set-cookie')?.split(';')[0]}}
async function owner(n){const {data}=await req('/auth/register','POST',{name:'Alex '+n,businessName:'Estudio '+n,email:`owner${n}@example.test`,password:'Fixture-password-42!',plan:'adara'});const token=db.prepare('SELECT verify_token FROM users WHERE email=?').get(`owner${n}@example.test`).verify_token;const verified=await req('/auth/verify?token='+token),me=await req('/me','GET',undefined,verified.cookie);return {cookie:verified.cookie,b:me.data.businesses[0]}}
try{
 const one=await owner(1),other=await owner(2),root=`/businesses/${one.b.id}/tools`;
 await req(`/businesses/${one.b.id}/payment-settings`,'PUT',{payment_mode:'none'},one.cookie);
 const service=(await req(`/businesses/${one.b.id}/services`,'POST',{name:'Corte + peinado',price:20000,duration:60},one.cookie)).data.id;
 const date=new Date(Date.now()+4*86400000).toISOString().slice(0,10);
 await req(root+'/exceptions','POST',{date,closed:false,start_time:'10:00',end_time:'11:00'},one.cookie);
 const booking=(await req(`/public/${one.b.slug}/bookings`,'POST',{serviceIds:[service],date,time:'10:00',clientName:'Alex & José',phone:'+54 9 223 555 0000',email:'client@example.test'})).data.booking;
 const route=root+`/bookings/${booking.id}/whatsapp`;
 await req(route,'GET',undefined,'',401);await req(route,'GET',undefined,other.cookie,403);
 await req(`/businesses/${other.b.id}/tools/bookings/${booking.id}/whatsapp`,'GET',undefined,other.cookie,400);
 for(const id of ['0','-1','1.5','invalid','999999'])await req(root+`/bookings/${id}/whatsapp`,'GET',undefined,one.cookie,400);
 const before=db.prepare('SELECT * FROM bookings WHERE id=?').get(booking.id),clientsBefore=db.prepare('SELECT * FROM clients WHERE id=?').get(booking.client_id),jobsBefore=db.prepare('SELECT * FROM notification_jobs').all();
 const first=await req(route+'?phone=12345678&url=https://evil.example&business=Other','GET',undefined,one.cookie);
 check(()=>assert.equal(first.response.headers.get('cache-control'),'no-store'));
 check(()=>assert.equal(first.response.headers.get('referrer-policy'),'no-referrer'));
 check(()=>assert.equal(first.data.phone,'5492235550000'));
 check(()=>assert.ok(first.data.text.includes(`Hola Alex & José, te recordamos tu turno en ${one.b.name}`)));
 check(()=>assert.ok(first.data.text.includes(date.split('-').reverse().join('/'))));
 check(()=>assert.ok(first.data.text.includes('10:00')));
 check(()=>assert.ok(first.data.text.includes('Corte + peinado')));
 check(()=>assert.ok(first.data.text.includes(`https://adara.example.test/mi-reserva/${booking.manage_token}`)));
 check(()=>assert.ok(!first.data.text.includes('evil.example')));
 await req(route,'GET',undefined,one.cookie);
 check(()=>assert.deepEqual(db.prepare('SELECT * FROM bookings WHERE id=?').get(booking.id),before));
 check(()=>assert.deepEqual(db.prepare('SELECT * FROM clients WHERE id=?').get(booking.client_id),clientsBefore));
 check(()=>assert.deepEqual(db.prepare('SELECT * FROM notification_jobs').all(),jobsBefore));
 // Fresh edits, with the private link and the current recipient rather than request input.
 db.prepare('UPDATE bookings SET start_time=?,end_time=? WHERE id=?').run('12:00','13:00',booking.id);
 db.prepare('UPDATE clients SET name=?,phone=? WHERE id=?').run('Sam <script>','',booking.client_id);
 const edited=(await req(route,'GET',undefined,one.cookie)).data;
 check(()=>assert.equal(edited.time,'12:00'));check(()=>assert.equal(edited.client,'Sam <script>'));check(()=>assert.equal(edited.phone,''));check(()=>assert.ok(!edited.text.includes('a las 10:00')));
 for(const status of ['pending_payment','cancelled','completed','no_show']){db.prepare('UPDATE bookings SET status=? WHERE id=?').run(status,booking.id);await req(route,'GET',undefined,one.cookie,400)}
 db.prepare('UPDATE bookings SET status=?,date=? WHERE id=?').run('confirmed','2020-01-01',booking.id);await req(route,'GET',undefined,one.cookie,400);
 db.prepare('UPDATE bookings SET date=?,manage_token=NULL WHERE id=?').run(date,booking.id);await req(route,'GET',undefined,one.cookie,400);
 db.prepare('UPDATE bookings SET manage_token=?,start_time=?,end_time=? WHERE id=?').run(booking.manage_token,'10:00','11:00',booking.id);
 await req(`/public/${one.b.slug}/waitlist`,'POST',{date,serviceIds:[service],name:'Taylor',phone:'5492235551111',consent:true});
 const waiting=db.prepare('SELECT * FROM waitlist WHERE business_id=?').get(one.b.id),waitRoute=root+`/waitlist/${waiting.id}/whatsapp`;
 await req(waitRoute,'GET',undefined,'',401);await req(waitRoute,'GET',undefined,other.cookie,403);
 await req(`/businesses/${other.b.id}/tools/waitlist/${waiting.id}/whatsapp`,'GET',undefined,other.cookie,400);
 await req(waitRoute,'GET',undefined,one.cookie,400); // fully booked
 db.prepare("UPDATE bookings SET status='cancelled' WHERE id=?").run(booking.id);
 const notice=await req(waitRoute,'GET',undefined,one.cookie);
 check(()=>assert.equal(notice.response.headers.get('cache-control'),'no-store'));
 check(()=>assert.ok(notice.data.text.includes(`https://adara.example.test/reservar/${one.b.slug}`)));
 check(()=>assert.ok(!notice.data.text.includes(booking.manage_token)));
 check(()=>assert.ok(notice.data.text.includes('El aviso no guarda el horario')));
 check(()=>assert.ok(notice.data.text.includes('10:00')));
 check(()=>assert.deepEqual(db.prepare('SELECT * FROM waitlist WHERE id=?').get(waiting.id),waiting));
 db.prepare("UPDATE waitlist SET status='notified' WHERE id=?").run(waiting.id);await req(waitRoute,'GET',undefined,one.cookie);
 db.prepare("UPDATE bookings SET status='confirmed' WHERE id=?").run(booking.id);await req(waitRoute,'GET',undefined,one.cookie,400);
 db.prepare("UPDATE bookings SET status='cancelled' WHERE id=?").run(booking.id);
 db.prepare("UPDATE waitlist SET status='closed' WHERE id=?").run(waiting.id);await req(waitRoute,'GET',undefined,one.cookie,400);
 db.prepare("UPDATE waitlist SET status='waiting',date='2020-01-01' WHERE id=?").run(waiting.id);await req(waitRoute,'GET',undefined,one.cookie,400);
 db.prepare('UPDATE waitlist SET date=?,consent_at=? WHERE id=?').run(date,'',waiting.id);await req(waitRoute,'GET',undefined,one.cookie,400);
 db.prepare('UPDATE waitlist SET consent_at=? WHERE id=?').run(new Date().toISOString(),waiting.id);
 db.prepare('UPDATE services SET active=0 WHERE id=?').run(service);await req(waitRoute,'GET',undefined,one.cookie,400);
 db.prepare('UPDATE services SET active=1 WHERE id=?').run(service);
 db.prepare('UPDATE businesses SET waitlist_enabled=0 WHERE id=?').run(one.b.id);await req(waitRoute,'GET',undefined,one.cookie,400);
 db.prepare('UPDATE businesses SET waitlist_enabled=1 WHERE id=?').run(one.b.id);
 // Preparation still works with no API tokens, while email configuration stays intact.
 for(const key of ['WHATSAPP_ACCESS_TOKEN','WHATSAPP_PHONE_NUMBER_ID','WHATSAPP_GRAPH_VERSION','WHATSAPP_REMINDER_TEMPLATE','WHATSAPP_WAITLIST_TEMPLATE'])delete process.env[key];
 await req(waitRoute,'GET',undefined,one.cookie);db.prepare("UPDATE bookings SET status='confirmed' WHERE id=?").run(booking.id);await req(route,'GET',undefined,one.cookie);
 const tools=(await req(root,'GET',undefined,one.cookie)).data;check(()=>assert.equal(tools.providers.whatsapp,false));check(()=>assert.equal(tools.providers.email,true));
 check(()=>assert.deepEqual(db.prepare('SELECT * FROM notification_jobs').all(),jobsBefore));check(()=>assert.equal(providerCalls,0));
 console.log(`OK: ${checks} comprobaciones de WhatsApp manual: permisos, enlace privado, cambios recientes, estados, disponibilidad, lista de espera y preparación sin envíos ni cambios de datos.`);
}finally{global.fetch=nativeFetch;await new Promise(resolve=>server.close(resolve));db.close();process.chdir(cwd);fs.rmSync(temp,{recursive:true,force:true})}
