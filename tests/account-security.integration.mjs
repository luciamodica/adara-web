import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {fork,spawnSync} from 'node:child_process';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Only this test process intercepts Resend. No real email or payment is sent.
if(process.argv.includes('--child')){
 const nativeFetch=global.fetch,mails=[];let fail=false;
 global.fetch=async(url,options)=>{if(String(url)==='https://api.resend.com/emails'){mails.push(JSON.parse(options.body));return new Response('{}',{status:fail?503:200})}return nativeFetch(url,options)};
 const {app}=await import('../server/index.js'),{db}=await import('../server/db.js'),{drainPasswordEmails}=await import('../server/account-security.js');
 const server=app.listen(0,'127.0.0.1',()=>process.send({port:server.address().port}));
 process.on('message',async message=>{
  if(message.drain){await drainPasswordEmails();process.send({mails:mails.splice(0)})}
  if(message.mail){fail=message.mail==='fail';process.env.RESEND_API_KEY=message.mail==='off'?'':'fixture-only';process.send({changed:true})}
  if(message.stop){await drainPasswordEmails();server.close(()=>{db.close();process.exit(0)})}
 });
}else{
 const project=fileURLToPath(new URL('../',import.meta.url)),temp=fs.mkdtempSync(path.join(os.tmpdir(),'adara-security-'));
 const env={...process.env,NODE_ENV:'production',JWT_SECRET:'fixture-session-secret-'.repeat(3),TOKEN_ENCRYPTION_KEY:'fixture-encryption-secret-'.repeat(3),DATA_DIR:temp+'/persistent',UPLOADS_DIR:temp+'/persistent/uploads',FRONTEND_URL:'https://adara.example.test',PUBLIC_API_URL:'https://adara.example.test',SUPERADMIN_EMAIL:'super@example.test',SUPERADMIN_PASSWORD:'Strong-fixture-password-42!',RESEND_API_KEY:'fixture-only',DISABLE_FEATURE_WORKER:'true',DEMO_PAYMENTS:'false',DEMO_SUBSCRIPTIONS:'false'};
 let child,base,db,logs='',checks=0;
 const check=fn=>{fn();checks++},checkAsync=async fn=>{await fn();checks++},digest=value=>crypto.createHash('sha256').update(value).digest('hex');
 async function start(){logs='';child=fork(fileURLToPath(import.meta.url),['--child'],{cwd:temp,env,silent:true});child.stdout.on('data',v=>logs+=v);child.stderr.on('data',v=>logs+=v);const port=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error(logs)),10000);child.once('message',m=>{clearTimeout(timer);resolve(m.port)});child.once('exit',c=>{clearTimeout(timer);reject(Error('Start failed '+c+' '+logs))})});base='http://127.0.0.1:'+port}
 async function stop(){if(!child)return;const exited=new Promise(r=>child.once('exit',r));child.send({stop:true});await exited;child=null}
 async function message(m){const response=new Promise(r=>child.once('message',r));child.send(m);return response}
 async function req(route,method='GET',body,cookie='',status=200){const response=await fetch(base+'/api'+route,{method,headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)}),data=await response.json().catch(()=>({}));check(()=>assert.equal(response.status,status,JSON.stringify({route,data})));return {data,response,cookie:response.headers.get('set-cookie')?.split(';')[0]}}
 async function login(email,password,status=200){return req('/auth/login','POST',{email,password},'',status)}
 async function owner(n){const email=`owner${n}@example.test`,password='Fixture-owner-password-42!';await req('/auth/register','POST',{name:'Alex <script>',businessName:'Estudio '+n,email,password,plan:'adara'});const u=db.prepare('SELECT * FROM users WHERE email=?').get(email);const verified=await req('/auth/verify?token='+u.verify_token);return {u,email,password,cookie:verified.cookie,b:db.prepare('SELECT * FROM businesses WHERE owner_id=?').get(u.id)}}
 async function resetLink(email){await req('/auth/forgot-password','POST',{email});const {mails}=await message({drain:true});const mail=mails.find(m=>m.to.includes(email)&&m.subject.includes('Restablecé'));check(()=>assert.ok(mail,'Reset email captured'));return {mail,token:new URL(mail.html.match(/href="([^"]*restablecer-contrasena[^"]*)"/)[1]).searchParams.get('token')}}
 const reset=(token,password,status=200,extra={})=>req('/auth/reset-password','POST',{token,password,confirmPassword:password,...extra},'',status);
 try{
  await start();db=new Database(env.DATA_DIR+'/app.db');const one=await owner(1),two=await owner(2);await message({drain:true});
  const admin=await login(env.SUPERADMIN_EMAIL,env.SUPERADMIN_PASSWORD);
  const oldLegacy='session='+jwt.sign({sub:String(one.u.id),role:'owner'},env.JWT_SECRET,{expiresIn:'7d'});await req('/me','GET',undefined,oldLegacy);
  const forgedRole='session='+jwt.sign({sub:String(one.u.id),role:'superadmin',sv:0},env.JWT_SECRET,{expiresIn:'7d'});await req('/admin/settings','GET',undefined,forgedRole,403);
  await req('/auth/change-password','POST',{},'',401);
  await req('/auth/forgot-password','POST',{email:'bad'},'',400);
  const known=await req('/auth/forgot-password','POST',{email:' OWNER1@EXAMPLE.TEST '}),unknown=await req('/auth/forgot-password','POST',{email:'missing@example.test'});
  check(()=>assert.deepEqual(known.data,unknown.data));check(()=>assert.equal(known.data.devResetUrl,undefined));check(()=>assert.equal(known.response.headers.get('cache-control'),'no-store'));check(()=>assert.equal(known.response.headers.get('referrer-policy'),'no-referrer'));
  const initial=(await message({drain:true})).mails;check(()=>assert.equal(initial.length,1));check(()=>assert.ok(initial[0].html.includes('Alex &lt;script&gt;')));check(()=>assert.ok(!initial[0].html.includes('Alex <script>')));
  const first=new URL(initial[0].html.match(/href="([^"]*restablecer-contrasena[^"]*)"/)[1]).searchParams.get('token');
  let stored=db.prepare('SELECT * FROM password_reset_tokens WHERE user_id=?').get(one.u.id);check(()=>assert.equal(stored.token_hash,digest(first)));check(()=>assert.notEqual(stored.token_hash,first));check(()=>assert.ok(new Date(stored.expires_at).getTime()>Date.now()+29*60*1000));
  check(()=>assert.equal(db.prepare('SELECT session_version FROM users WHERE id=?').get(one.u.id).session_version,0));await req('/me','GET',undefined,one.cookie);
  const validation=await req('/auth/reset-password/validate','POST',{token:first});check(()=>assert.equal(validation.data.min_length,8));await req('/auth/reset-password/validate','POST',{token:first});
  for(const token of ['',null,123,'x'.repeat(64),first+'x'])await req('/auth/reset-password/validate','POST',{token},'',400);
  const second=await resetLink(one.email);await req('/auth/reset-password/validate','POST',{token:first});check(()=>assert.notEqual(first,second.token));
  await reset(first,'short',400);await reset(first,'New-password-42!',400,{confirmPassword:'Different-password'});await reset(first,'é'.repeat(40),400);
  const oldHash=db.prepare('SELECT password_hash FROM users WHERE id=?').get(one.u.id).password_hash;check(()=>assert.ok(bcrypt.compareSync(one.password,oldHash)));
  const changed=await reset(first,'New-owner-password-42!');check(()=>assert.match(changed.response.headers.get('set-cookie'),/session=;/));check(()=>assert.match(changed.response.headers.get('set-cookie'),/Secure/));check(()=>assert.ok(!JSON.stringify(changed.data).includes('session')));
  await req('/me','GET',undefined,one.cookie,401);await req('/me','GET',undefined,oldLegacy,401);await req('/me','GET',undefined,two.cookie);
  await reset(first,'Another-password-42!',400);await reset(second.token,'Another-password-42!',400);await login(one.email,one.password,401);
  one.password='New-owner-password-42!';one.cookie=(await login(one.email,one.password)).cookie;await req('/me','GET',undefined,one.cookie);
  const notices=(await message({drain:true})).mails;check(()=>assert.equal(notices.length,1));check(()=>assert.ok(notices[0].subject.includes('contraseña')));check(()=>assert.ok(!notices[0].html.includes(one.password)));
  db.prepare('DELETE FROM auth_rate_limits').run();const expiry=await resetLink(one.email);db.prepare('UPDATE password_reset_tokens SET expires_at=? WHERE token_hash=?').run(new Date(Date.now()-1).toISOString(),digest(expiry.token));await reset(expiry.token,'Another-password-42!',400);
  const race=await resetLink(one.email);const attempts=await Promise.all([fetch(base+'/api/auth/reset-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:race.token,password:'Race-password-42!',confirmPassword:'Race-password-42!'})}),fetch(base+'/api/auth/reset-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:race.token,password:'Race-password-42!',confirmPassword:'Race-password-42!'})})]);check(()=>assert.deepEqual(attempts.map(r=>r.status).sort(),[200,400]));await message({drain:true});one.password='Race-password-42!';one.cookie=(await login(one.email,one.password)).cookie;
  const outstanding=await resetLink(one.email);const version=db.prepare('SELECT session_version FROM users WHERE id=?').get(one.u.id).session_version;
  const change=(password,status=400,extra={})=>req('/auth/change-password','POST',{currentPassword:one.password,password,confirmPassword:password,...extra},one.cookie,status);
  await change('Replacement-password-42!',400,{currentPassword:'wrong'});await change('tiny');await change('Replacement-password-42!',400,{confirmPassword:'other'});await change(one.password);await change('a'.repeat(73));
  check(()=>assert.equal(db.prepare('SELECT session_version FROM users WHERE id=?').get(one.u.id).session_version,version));
  await change('Replacement-password-42!',200,{userId:two.u.id,role:'superadmin'});await req('/me','GET',undefined,one.cookie,401);await reset(outstanding.token,'Another-password-42!',400);await req('/me','GET',undefined,two.cookie);await login(two.email,two.password);
  one.password='Replacement-password-42!';one.cookie=(await login(one.email,one.password)).cookie;await message({drain:true});
  const adminReset=await resetLink(env.SUPERADMIN_EMAIL);const min=(await req('/auth/reset-password/validate','POST',{token:adminReset.token})).data.min_length;check(()=>assert.equal(min,12));await reset(adminReset.token,'12345678901',400);await reset(adminReset.token,'New-admin-password-42!');await req('/admin/settings','GET',undefined,admin.cookie,401);
  const adminNew=await login(env.SUPERADMIN_EMAIL,'New-admin-password-42!');await req('/auth/change-password','POST',{currentPassword:'New-admin-password-42!',password:'12345678901',confirmPassword:'12345678901'},adminNew.cookie,400);
  await req('/auth/change-password','POST',{currentPassword:'New-admin-password-42!',password:'Panel-admin-password-42!',confirmPassword:'Panel-admin-password-42!'},adminNew.cookie);await message({drain:true});await req('/admin/settings','GET',undefined,adminNew.cookie,401);
  const adminCurrent=await login(env.SUPERADMIN_EMAIL,'Panel-admin-password-42!');db.prepare('DELETE FROM auth_rate_limits').run();const cliLink=await resetLink(env.SUPERADMIN_EMAIL);
  const cli=spawnSync(process.execPath,[project+'server/admin-password.js'],{cwd:temp,env:{...env,SUPERADMIN_PASSWORD:'Cli-admin-password-42!'},encoding:'utf8'});check(()=>assert.equal(cli.status,0,cli.stderr));await req('/admin/settings','GET',undefined,adminCurrent.cookie,401);await reset(cliLink.token,'Another-admin-password-42!',400);await login(env.SUPERADMIN_EMAIL,'Cli-admin-password-42!');
  await message({mail:'off'});const off=await req('/auth/forgot-password','POST',{email:one.email},'',503);check(()=>assert.equal(off.data.devResetUrl,undefined));await message({mail:'fail'});db.prepare('DELETE FROM auth_rate_limits').run();const failed=await req('/auth/forgot-password','POST',{email:one.email});check(()=>assert.deepEqual(failed.data,known.data));await message({drain:true});check(()=>assert.equal(db.prepare('SELECT count(*) n FROM password_reset_tokens WHERE user_id=? AND used_at IS NULL AND expires_at>?').get(one.u.id,new Date().toISOString()).n,0));await message({mail:'ok'});
  // Resetting a password must not bypass verification of the email address.
  db.prepare('UPDATE users SET email_verified=0 WHERE id=?').run(two.u.id);const unverified=await resetLink(two.email);await reset(unverified.token,'Unverified-password-42!');await message({drain:true});await login(two.email,'Unverified-password-42!',403);check(()=>assert.equal(db.prepare('SELECT email_verified FROM users WHERE id=?').get(two.u.id).email_verified,0));db.prepare('UPDATE users SET email_verified=1 WHERE id=?').run(two.u.id);
  // Settings validate before mutating schedules or other business fields.
  const root='/businesses/'+one.b.id,pub='/public/'+one.b.slug,service=(await req(root+'/services','POST',{name:'Sesión',price:1000,duration:60},one.cookie)).data;
  const date=new Date(Date.now()+3*86400000).toISOString().slice(0,10);await req(root+'/tools/exceptions','POST',{date,closed:false,start_time:'09:00',end_time:'18:00'},one.cookie);
  const schedule=(await req(root+'/schedule','GET',undefined,one.cookie)).data;
  for(const interval of [90,120,137]){await req(root+'/schedule','PUT',{...schedule,slot_interval_min:interval},one.cookie);const slots=(await req(pub+`/availability?date=${date}&serviceIds=${service.id}`)).data.slots;const minutes=t=>Number(t.slice(0,2))*60+Number(t.slice(3));check(()=>assert.equal(minutes(slots[1])-minutes(slots[0]),interval));check(()=>assert.equal((db.prepare('SELECT slot_interval_min FROM businesses WHERE id=?').get(one.b.id)).slot_interval_min,interval))}
  const originalSchedule=db.prepare('SELECT * FROM schedules WHERE business_id=? ORDER BY weekday').all(one.b.id);
  for(const interval of [0,4,721,90.5,'',null,'invalid',true])await req(root+'/schedule','PUT',{...schedule,slot_interval_min:interval,schedule:[{weekday:1,start_time:'03:00',end_time:'04:00',active:true}]},one.cookie,400);
  check(()=>assert.deepEqual(db.prepare('SELECT * FROM schedules WHERE business_id=? ORDER BY weekday').all(one.b.id),originalSchedule));check(()=>assert.equal(db.prepare('SELECT slot_interval_min FROM businesses WHERE id=?').get(one.b.id).slot_interval_min,137));
  const settings=(await req(root+'/settings','GET',undefined,one.cookie)).data.business;await req(root+'/settings','PUT',{...settings,slot_interval_min:120,show_service_duration:false},one.cookie);await checkAsync(async()=>assert.equal((await req(pub)).data.business.show_service_duration,0));
  const page=(await req(root+'/page-settings','GET',undefined,one.cookie)).data.business;await req(root+'/page-settings','PUT',{...page,show_service_duration:true},one.cookie);await checkAsync(async()=>assert.equal((await req(pub)).data.business.show_service_duration,1));
  for(const value of ['false',null,2])await req(root+'/page-settings','PUT',{...page,hero_title:'Invalid mutation',show_service_duration:value},one.cookie,400);
  check(()=>assert.notEqual(db.prepare('SELECT hero_title FROM businesses WHERE id=?').get(one.b.id).hero_title,'Invalid mutation'));
  const twoCookie=(await login(two.email,'Unverified-password-42!')).cookie;await req(root+'/settings','PUT',{...settings,slot_interval_min:90},twoCookie,403);await req(root+'/page-settings','PUT',{...page,show_service_duration:false},twoCookie,403);
  await req(root+'/page-settings','PUT',{...page,show_service_duration:false},one.cookie);await req(root+'/page-settings','PUT',{...page,show_service_duration:undefined},one.cookie);await checkAsync(async()=>assert.equal((await req(pub)).data.business.show_service_duration,0));check(()=>assert.equal(db.prepare('SELECT show_service_duration FROM businesses WHERE id=?').get(two.b.id).show_service_duration,1));
  const quote=(await req(pub+'/quote','POST',{serviceIds:[service.id]})).data;check(()=>assert.equal(quote.duration_min,60));db.prepare("UPDATE businesses SET payment_mode='none',require_email=0 WHERE id=?").run(one.b.id);
  const booked=(await req(pub+'/bookings','POST',{serviceIds:[service.id],date,time:'09:00',clientName:'Prueba',phone:'5492235551234',acceptTerms:true})).data.booking;check(()=>assert.equal(booked.end_time,'10:00'));check(()=>assert.equal(booked.status,'confirmed'));
  // Per-account request limit survives a server restart without storing raw emails.
  db.prepare('DELETE FROM auth_rate_limits').run();for(let n=0;n<4;n++)await req('/auth/forgot-password','POST',{email:one.email});let limited=(await message({drain:true})).mails.filter(m=>m.subject.includes('Restablecé'));check(()=>assert.equal(limited.length,3));check(()=>assert.ok(!JSON.stringify(db.prepare('SELECT * FROM auth_rate_limits').all()).includes(one.email)));
  await stop();await start();await req('/auth/forgot-password','POST',{email:one.email});limited=(await message({drain:true})).mails;check(()=>assert.equal(limited.length,0));await req('/me','GET',undefined,oldLegacy,401);await req('/me','GET',undefined,one.cookie);await checkAsync(async()=>assert.equal((await req(pub)).data.business.show_service_duration,0));
  console.log(`OK: ${checks} comprobaciones de recuperación, cambio de contraseña, enlaces, sesiones, permisos, límites persistentes, intervalos y duración pública.`);
 }finally{await stop();if(db)db.close();fs.rmSync(temp,{recursive:true,force:true})}
}
