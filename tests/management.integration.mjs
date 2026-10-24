import bcrypt from 'bcryptjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {PNG} from 'pngjs';
import jsQR from 'jsqr';
const cwd=process.cwd(),temp=fs.mkdtempSync(path.join(os.tmpdir(),'adara-management-'));
process.chdir(temp);Object.assign(process.env,{NODE_ENV:'test',SUPERADMIN_EMAIL:'super-management@example.test',SUPERADMIN_PASSWORD:'Fixture-admin-password-42!',DATA_DIR:temp+'/data',UPLOADS_DIR:temp+'/data/uploads',FRONTEND_URL:'https://adara.example.test',DISABLE_FEATURE_WORKER:'true',DEMO_PAYMENTS:'false',RESEND_API_KEY:'fixture-only'});
const nativeFetch=global.fetch;let failEmail=false,emails=[],googleCalls=[];
global.fetch=async(url,options)=>{if(String(url).startsWith('http://127.0.0.1:'))return nativeFetch(url,options);if(String(url).startsWith('https://www.googleapis.com/calendar/')){googleCalls.push({url:String(url),method:options.method,body:options.body?JSON.parse(options.body):null});return new Response('{}',{status:200})}if(String(url)==='https://api.resend.com/emails'){emails.push(JSON.parse(options.body));return new Response(failEmail?'{}':'{"id":"fixture-only"}',{status:failEmail?503:200})}throw Error('No external calls allowed: '+url)};
const {app}=await import('../server/index.js'),{db}=await import('../server/db.js'),{contrast}=await import('../server/qr-brand.js');
const server=app.listen(0);await new Promise(r=>server.once('listening',r));const base=`http://127.0.0.1:${server.address().port}/api`;let checks=0;
const check=fn=>{fn();checks++};
const checkAsync=async fn=>{await fn();checks++};
async function req(route,method='GET',body,cookie='',status=200,headers={}){const r=await fetch(base+route,{method,headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{}),...headers},body:body===undefined?undefined:JSON.stringify(body)}),data=await r.json().catch(()=>({}));check(()=>assert.equal(r.status,status,JSON.stringify({route,data})));return {data,cookie:r.headers.get('set-cookie')?.split(';')[0]};}
async function owner(n,plan='adara'){await req('/auth/register','POST',{name:'Alex',businessName:'Estudio '+n,email:`owner${n}@example.test`,password:'Fixture-owner-42!',plan});const token=db.prepare('SELECT verify_token FROM users WHERE email=?').get(`owner${n}@example.test`).verify_token,v=await req('/auth/verify?token='+token);return {cookie:v.cookie,b:(await req('/me','GET',undefined,v.cookie)).data.businesses[0]};}
try{
 const one=await owner(1),two=await owner(2),root='/businesses/'+one.b.id,pub='/public/'+one.b.slug;
 const sid=(await req(root+'/services','POST',{name:'Corte',price:15000,duration:60},one.cookie)).data.id;
 const extra=(await req(root+'/services','POST',{name:'Peinado',price:5000,duration:30},one.cookie)).data.id;
 const foreign=(await req('/businesses/'+two.b.id+'/services','POST',{name:'Ajeno',price:1,duration:30},two.cookie)).data.id;
 const date=new Date(Date.now()+4*86400000).toISOString().slice(0,10),nextDate=new Date(Date.now()+5*86400000).toISOString().slice(0,10);
 for(const d of [date,nextDate])await req(root+'/tools/exceptions','POST',{date:d,closed:false,start_time:'09:00',end_time:'18:00'},one.cookie);
 await req(root+'/payment-settings','PUT',{payment_mode:'total'},one.cookie);
 const input={serviceIds:[sid,extra],date,time:'09:00',clientName:'Taylor',notes:'Reservado en el salón'};
 await req(root+'/manual-bookings','POST',input,'',401);await req(root+'/manual-bookings','POST',input,two.cookie,403);
 const availability=(await req(root+'/manual-bookings/availability','POST',input,one.cookie)).data;check(()=>assert.equal(availability.duration,90));check(()=>assert.equal(availability.total_cents,2000000));
 const beforeClients=db.prepare('SELECT count(*) n FROM clients').get().n,beforeBookings=db.prepare('SELECT count(*) n FROM bookings').get().n;
 for(const bad of [{date:'2026-02-30'},{date:'2020-01-01'},{time:'25:00'},{clientName:''},{phone:'javascript:alert(1)'},{email:'not-email'},{notes:'x'.repeat(2001)},{serviceIds:[foreign]},{serviceIds:[]},{clientId:99999},{sendEmail:'yes'},{sendEmail:true}])await req(root+'/manual-bookings','POST',{...input,...bad},one.cookie,bad.date==='2020-01-01'?409:400);
 check(()=>assert.equal(db.prepare('SELECT count(*) n FROM clients').get().n,beforeClients));check(()=>assert.equal(db.prepare('SELECT count(*) n FROM bookings').get().n,beforeBookings));
 const mailBefore=emails.length,created=(await req(root+'/manual-bookings','POST',input,one.cookie,201)).data,bk=created.booking;
 check(()=>assert.equal(bk.booking_source,'manual'));check(()=>assert.equal(bk.status,'confirmed'));check(()=>assert.equal(bk.end_time,'10:30'));check(()=>assert.equal(bk.amount_due_cents,0));check(()=>assert.equal(bk.amount_paid_cents,0));check(()=>assert.equal(bk.payment_status,'not_required'));check(()=>assert.equal(bk.items.length,2));check(()=>assert.equal(bk.total_cents,2000000));check(()=>assert.ok(bk.manage_url.startsWith('https://adara.example.test/mi-reserva/')));check(()=>assert.equal(created.email_status,'not_requested'));check(()=>assert.equal(emails.length,mailBefore));
 await checkAsync(async()=>assert.equal((await req(root+'/bookings','GET',undefined,one.cookie)).data[0].booking_source,'manual'));
 let slots=(await req(pub+'/availability?date='+date+'&serviceIds='+sid)).data.slots;check(()=>assert.ok(!slots.includes('09:00')&&!slots.includes('09:30')&&!slots.includes('10:00')));check(()=>assert.ok(slots.includes('10:30')));
 await req(root+'/manual-bookings','POST',{...input,time:'09:30',clientName:'Overlap'},one.cookie,409);
 check(()=>assert.equal(db.prepare('SELECT count(*) n FROM clients').get().n,beforeClients+1));
 await req(pub+'/bookings','POST',{serviceIds:[sid],date,time:'09:00',clientName:'Public overlap',phone:'5492235550000'},'',409);
 await req(root+'/bookings/'+bk.id,'PATCH',{date:nextDate,start_time:'11:00'},one.cookie);slots=(await req(pub+'/availability?date='+date+'&serviceIds='+sid)).data.slots;check(()=>assert.ok(slots.includes('09:00')));
 slots=(await req(pub+'/availability?date='+nextDate+'&serviceIds='+sid)).data.slots;check(()=>assert.ok(!slots.includes('11:00')));
 await req(root+'/bookings/'+bk.id,'PATCH',{status:'cancelled'},one.cookie);slots=(await req(pub+'/availability?date='+nextDate+'&serviceIds='+sid)).data.slots;check(()=>assert.ok(slots.includes('11:00')));
 // New clients can omit contact information; each anonymous contact stays distinct.
 const other=(await req(root+'/manual-bookings','POST',{...input,time:'11:00',clientName:'Sam'},one.cookie,201)).data.booking;
 check(()=>assert.notEqual(other.client_id,bk.client_id));
 const known=(await req(root+'/manual-bookings','POST',{...input,time:'13:00',clientId:bk.client_id,clientName:'Do not overwrite'},one.cookie,201)).data.booking;check(()=>assert.equal(known.client_id,bk.client_id));check(()=>assert.equal(known.client_name,'Taylor'));
 const foreignClient=Number(db.prepare('INSERT INTO clients(business_id,name) VALUES(?,?)').run(two.b.id,'Other tenant').lastInsertRowid);await req(root+'/manual-bookings','POST',{...input,time:'15:00',clientId:foreignClient},one.cookie,400);
 const notified=(await req(root+'/manual-bookings','POST',{...input,date:nextDate,time:'09:00',email:'notify@example.test',sendEmail:true},one.cookie,201)).data;check(()=>assert.equal(notified.email_status,'sent'));check(()=>assert.equal(emails.at(-1).to[0],'notify@example.test'));
 await req(root+'/manual-bookings','POST',{...input,date:nextDate,time:'13:00',email:'notify@example.test'},one.cookie,400);
 failEmail=true;const failed=(await req(root+'/manual-bookings','POST',{...input,date:nextDate,time:'15:00',email:'fail@example.test',sendEmail:true},one.cookie,201)).data;check(()=>assert.equal(failed.email_status,'failed'));check(()=>assert.equal(failed.booking.status,'confirmed'));failEmail=false;
 // Online disabled does not prevent the professional from filling their own agenda.
 db.prepare('UPDATE businesses SET show_booking=0 WHERE id=?').run(one.b.id);await req(root+'/manual-bookings','POST',{...input,date:nextDate,time:'11:00'},one.cookie,201);db.prepare('UPDATE businesses SET show_booking=1 WHERE id=?').run(one.b.id);
 db.prepare("UPDATE businesses SET status='suspended' WHERE id=?").run(one.b.id);await req(root+'/manual-bookings','POST',{...input,time:'16:00'},one.cookie,402);db.prepare("UPDATE businesses SET status='active' WHERE id=?").run(one.b.id);
 // A simultaneous collision has one winner, with no stray client or booking item.
 const concurrent=await Promise.all([nativeFetch(base+root+'/manual-bookings',{method:'POST',headers:{'Content-Type':'application/json',Cookie:one.cookie},body:JSON.stringify({...input,time:'16:00',clientName:'Concurrent A'})}),nativeFetch(base+root+'/manual-bookings',{method:'POST',headers:{'Content-Type':'application/json',Cookie:one.cookie},body:JSON.stringify({...input,time:'16:00',clientName:'Concurrent B'})})]);check(()=>assert.deepEqual(concurrent.map(r=>r.status).sort(),[201,409]));
 // Google receives manual bookings through the same create/update/delete workflow.
 const {encryptSecret}=await import('../server/crypto.js'),{syncCalendar}=await import('../server/google-calendar.js');
 db.prepare('UPDATE businesses SET google_access_enc=?,google_refresh_enc=?,google_expires_at=? WHERE id=?').run(encryptSecret('fixture-access'),encryptSecret('fixture-refresh'),new Date(Date.now()+3600000).toISOString(),one.b.id);
 await syncCalendar();const event=db.prepare('SELECT google_event_id FROM bookings WHERE id=?').get(other.id).google_event_id;check(()=>assert.ok(event));check(()=>assert.ok(googleCalls.some(c=>c.url.endsWith('/'+event)&&c.body?.summary==='Sam · Corte + Peinado')));
 await req(root+'/bookings/'+other.id,'PATCH',{start_time:'09:00'},one.cookie);await syncCalendar();check(()=>assert.ok(googleCalls.some(c=>c.url.endsWith('/'+event)&&c.body?.start.dateTime===date+'T09:00:00-03:00')));
 await req(root+'/bookings/'+other.id,'PATCH',{status:'cancelled'},one.cookie);await syncCalendar();check(()=>assert.ok(googleCalls.some(c=>c.url.endsWith('/'+event)&&c.method==='DELETE')));check(()=>assert.equal(db.prepare('SELECT google_event_id FROM bookings WHERE id=?').get(other.id).google_event_id,null));
 // Team agendas are independent; services and dates are checked per professional.
 const team=await owner(3,'adara-equipo'),teamRoot='/businesses/'+team.b.id,teamService=(await req(teamRoot+'/services','POST',{name:'Servicio de equipo',price:12000,duration:60},team.cookie)).data.id;
 const staffA=(await req(teamRoot+'/staff','POST',{name:'Alex',service_ids:[teamService]},team.cookie)).data.id,staffB=(await req(teamRoot+'/staff','POST',{name:'Sam',service_ids:[teamService]},team.cookie)).data.id;
 await req(teamRoot+'/tools/exceptions','POST',{date,closed:false,start_time:'09:00',end_time:'18:00'},team.cookie);
 const teamInput={serviceIds:[teamService],date,time:'10:00',clientName:'Cliente de equipo'};
 await req(teamRoot+'/manual-bookings','POST',teamInput,team.cookie,400);await req(teamRoot+'/manual-bookings','POST',{...teamInput,staffId:99999},team.cookie,400);
 const a=(await req(teamRoot+'/manual-bookings','POST',{...teamInput,staffId:staffA},team.cookie,201)).data.booking,bStaff=(await req(teamRoot+'/manual-bookings','POST',{...teamInput,staffId:staffB},team.cookie,201)).data.booking;check(()=>assert.equal(a.staff_id,staffA));check(()=>assert.equal(bStaff.staff_id,staffB));
 await req(teamRoot+'/manual-bookings','POST',{...teamInput,staffId:staffA},team.cookie,409);
 const blocked=(await req(teamRoot+'/tools/calendar-periods','POST',{date_from:nextDate,date_to:nextDate,staff_id:staffA,closed:true},team.cookie)).data;
 await req(teamRoot+'/manual-bookings','POST',{...teamInput,date:nextDate,staffId:staffA},team.cookie,409);
 await req(teamRoot+'/tools/calendar-periods/'+blocked.id,'DELETE',undefined,team.cookie);
 const unassigned=(await req(teamRoot+'/services','POST',{name:'Otro servicio',price:1000,duration:30},team.cookie)).data.id;
 await req(teamRoot+'/manual-bookings','POST',{...teamInput,serviceIds:[unassigned],time:'11:00',staffId:staffA},team.cookie,400);
 // Internal appointments bypass the public minimum notice but never blocks or interval rules.
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Argentina/Buenos_Aires',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 db.prepare('UPDATE businesses SET booking_notice_min=1440 WHERE id=?').run(two.b.id);
 await req('/businesses/'+two.b.id+'/tools/exceptions','POST',{date:today,closed:false,start_time:'00:00',end_time:'23:59'},two.cookie);
 const realNow=Date.now;Date.now=()=>Date.parse(today+'T12:00:00-03:00');
 try{
 const internalSlots=(await req('/businesses/'+two.b.id+'/manual-bookings/availability','POST',{serviceIds:[foreign],date:today},two.cookie)).data.slots,publicSlots=(await req('/public/'+two.b.slug+'/availability?date='+today+'&serviceIds='+foreign)).data.slots;
 check(()=>assert.ok(internalSlots.length>0));check(()=>assert.equal(publicSlots.length,0));
 await req('/businesses/'+two.b.id+'/manual-bookings','POST',{serviceIds:[foreign],date:today,time:internalSlots[0],clientName:'En persona'},two.cookie,201);
 }finally{Date.now=realNow}
 // QR drafts are independent, validated atomically, and stay readable.
 const initial=(await req(root+'/tools/qr','GET',undefined,one.cookie)).data;
 const settings={color_mode:'custom',primary:'#ffffff',accent:'#e9c5e0',background:'#121826',text_color:'#121826',font:'editorial',layout:'frame',background_image:'/images/beauty-example.jpeg',overlay:80,logo_size:200,show_logo_in_code:false};
 await req(root+'/tools/qr','PUT',{tagline:'Mi tarjeta',settings},two.cookie,403);
 const draft=(await req(root+'/tools/qr/preview','POST',{tagline:'Mi tarjeta',settings},one.cookie)).data;check(()=>assert.ok(contrast(draft.brand.qrInk,'#ffffff')>=7));check(()=>assert.ok(contrast(draft.brand.background,draft.brand.foreground)>=4.5));check(()=>assert.equal(db.prepare('SELECT qr_settings_json FROM businesses WHERE id=?').get(one.b.id).qr_settings_json,'{}'));
 const png=PNG.sync.read(Buffer.from(draft.dataUrl.split(',')[1],'base64')),decoded=jsQR(new Uint8ClampedArray(png.data),png.width,png.height);check(()=>assert.equal(decoded.data,draft.url));
 await req(root+'/tools/qr','PUT',{tagline:'Mi tarjeta',settings},one.cookie);check(()=>assert.equal(db.prepare('SELECT primary_color FROM businesses WHERE id=?').get(one.b.id).primary_color,one.b.primary_color));
 for(const bad of [{primary:'red'},{font:'injected'},{background_image:'https://evil.test/x.png'},{background_image:'/uploads/../x.png'},{overlay:40},{logo_size:300},{show_logo_in_code:'yes'},{layout:'other'},{unknown:'value'}])await req(root+'/tools/qr','PUT',{tagline:'Must not save',settings:bad},one.cookie,400);
 const saved=(await req(root+'/tools/qr','GET',undefined,one.cookie)).data;check(()=>assert.equal(saved.brand.tagline,'Mi tarjeta'));check(()=>assert.equal(saved.brand.design.font,'editorial'));check(()=>assert.equal(saved.brand.design.background_image,settings.background_image));
 const otherQR=(await req('/businesses/'+two.b.id+'/tools/qr','GET',undefined,two.cookie)).data;check(()=>assert.deepEqual(otherQR.brand.design,{}));
 // Admin-managed social links are official HTTPS URLs and updates are atomic.
 db.prepare('INSERT INTO users(name,email,password_hash,role,email_verified) VALUES(?,?,?,?,1)').run('Fixture Super','super-management@example.test',bcrypt.hashSync('Fixture-admin-password-42!',8),'superadmin');
 const admin=(await req('/auth/login','POST',{email:'super-management@example.test',password:'Fixture-admin-password-42!'})).cookie;
 await req('/admin/settings','PUT',{home_socials:{instagram:'https://www.instagram.com/adaraweb',tiktok:'https://www.tiktok.com/@adaraweb'}},one.cookie,403);
 await req('/admin/settings','PUT',{home_socials:{instagram:'https://www.instagram.com/adaraweb',tiktok:'https://www.tiktok.com/@adaraweb'}},admin);
 await checkAsync(async()=>assert.equal((await req('/public/config')).data.home_socials.instagram,'https://www.instagram.com/adaraweb'));
 for(const url of ['javascript:alert(1)','http://instagram.com/adara','https://instagram.com.evil.test/','https://evil.test','https://user:pass@instagram.com/'])await req('/admin/settings','PUT',{trial_days:7,home_socials:{instagram:url}},admin,400);
 await checkAsync(async()=>assert.equal((await req('/public/config')).data.trial_days,15));
 await req('/admin/settings','PUT',{home_socials:{instagram:''}},admin);await checkAsync(async()=>assert.equal((await req('/public/config')).data.home_socials.instagram,''));await checkAsync(async()=>assert.equal((await req('/public/config')).data.home_socials.tiktok,'https://www.tiktok.com/@adaraweb'));
 // Contact submissions persist even if email delivery fails; owners never see the inbox.
 const support={name:'Alex <script>',email:'support@example.test',message:'Hola, quisiera saber cómo funciona Adara.',acceptPrivacy:true};
 await req('/public/support','POST',support,'',403,{Origin:'https://evil.test'});await req('/public/support','POST',{...support,acceptPrivacy:false},'',400);await req('/public/support','POST',{...support,email:'bad'},'',400);await req('/public/support','POST',{...support,message:'x'.repeat(3001)},'',400);
 const supportBefore=db.prepare('SELECT count(*) n FROM platform_support_messages').get().n;await req('/public/support','POST',{...support,website:'bot'},'',200);check(()=>assert.equal(db.prepare('SELECT count(*) n FROM platform_support_messages').get().n,supportBefore));
 await req('/public/support','POST',support,'',201,{Origin:'https://adara.example.test'});check(()=>assert.equal(emails.at(-1).to[0],'adaraweb23@gmail.com'));check(()=>assert.equal(emails.at(-1).reply_to,support.email));check(()=>assert.ok(emails.at(-1).html.includes('&lt;script&gt;')));check(()=>assert.ok(!emails.at(-1).html.includes('<script>')));
 await req('/admin/support','GET',undefined,'',401);await req('/admin/support','GET',undefined,one.cookie,403);
 let inbox=(await req('/admin/support','GET',undefined,admin)).data;check(()=>assert.equal(inbox.messages[0].name,support.name));check(()=>assert.equal(inbox.messages[0].email_status,'sent'));
 await req('/admin/support/'+inbox.messages[0].id,'PATCH',{status:'resolved'},one.cookie,403);await req('/admin/support/'+inbox.messages[0].id,'PATCH',{status:'resolved'},admin);await checkAsync(async()=>assert.equal((await req('/admin/support','GET',undefined,admin)).data.messages[0].status,'resolved'));
 failEmail=true;await req('/public/support','POST',support,'',201);inbox=(await req('/admin/support','GET',undefined,admin)).data;check(()=>assert.equal(inbox.messages[0].email_status,'failed'));failEmail=false;
 delete process.env.RESEND_API_KEY;await req('/public/support','POST',support,'',201);await checkAsync(async()=>assert.equal((await req('/admin/support','GET',undefined,admin)).data.messages[0].email_status,'unconfigured'));
 await req('/public/support','POST',support,'',429);
 for(let n=0;n<55;n++)db.prepare('INSERT INTO platform_support_messages(name,email,message) VALUES(?,?,?)').run('Test '+n,'page@example.test','A saved support request.');
 inbox=(await req('/admin/support','GET',undefined,admin)).data;check(()=>assert.equal(inbox.messages.length,50));check(()=>assert.ok(inbox.next_before));const older=(await req('/admin/support?before='+inbox.next_before,'GET',undefined,admin)).data;check(()=>assert.equal(older.messages.length,8));check(()=>assert.ok(older.messages.every(x=>x.id<inbox.next_before)));
 await req('/admin/support/999999','PATCH',{status:'read'},admin,404);await req('/admin/support/1','PATCH',{status:'sent'},admin,400);
 console.log(`OK: ${checks} comprobaciones de turnos manuales, disponibilidad, cobros acordados, colisiones, QR personalizable, redes y soporte privado.`);
}finally{global.fetch=nativeFetch;await new Promise(r=>server.close(r));db.close();process.chdir(cwd);fs.rmSync(temp,{recursive:true,force:true})}
