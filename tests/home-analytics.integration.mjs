import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import bcrypt from 'bcryptjs';
import {HOME_CONSENT_KEY,allowedHomePath,createHomeTracker} from '../src/home-analytics.ts';

import {homeTagDocument} from '../server/home-analytics-tag.js';

let checks=0;const check=fn=>{fn();checks++};
const original=process.cwd(),temp=fs.mkdtempSync(path.join(os.tmpdir(),'adara-home-analytics-'));
process.chdir(temp);Object.assign(process.env,{NODE_ENV:'test',DATA_DIR:temp+'/data',UPLOADS_DIR:temp+'/data/uploads',DISABLE_FEATURE_WORKER:'true',RESEND_API_KEY:'',DEMO_PAYMENTS:'false'});
const {app}=await import('../server/index.js'),{db}=await import('../server/db.js');
const server=app.listen(0);await new Promise(r=>server.once('listening',r));const base=`http://127.0.0.1:${server.address().port}/api`;
async function req(route,method='GET',body,cookie='',expected=200){const r=await fetch(base+route,{method,headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)}),data=await r.json().catch(()=>({}));check(()=>assert.equal(r.status,expected,JSON.stringify({route,data})));return {data,cookie:r.headers.get('set-cookie')?.split(';')[0]};}
try{
 db.prepare('INSERT INTO users(name,email,password_hash,role,email_verified) VALUES(?,?,?,?,1)').run('Fixture Super','super-home@example.test',bcrypt.hashSync('Fixture-admin-password-42!',8),'superadmin');
 const admin=(await req('/auth/login','POST',{email:'super-home@example.test',password:'Fixture-admin-password-42!'})).cookie;
 const signup=(await req('/auth/register','POST',{name:'Alex',businessName:'Estudio',email:'owner-home@example.test',password:'Fixture-owner-password-42!',plan:'adara'})).data;
 const token=new URL('http://localhost'+signup.devVerifyUrl).searchParams.get('token'),owner=(await req('/auth/verify?token='+token)).cookie,business=(await req('/me','GET',undefined,owner)).data.businesses[0];
 let disabled=await fetch(base+'/public/home-analytics/frame?id=G-HOMETEST12&channel=home-test');check(()=>assert.equal(disabled.status,204));
 let config=(await req('/public/config')).data;check(()=>assert.equal(config.home_ga_id,''));check(()=>assert.equal(config.home_analytics_enabled,false));
 await req('/admin/settings','PUT',{home_ga_id:'G-HOMETEST12',home_analytics_enabled:true},'',401);await req('/admin/settings','PUT',{home_ga_id:'G-HOMETEST12',home_analytics_enabled:true},owner,403);
 for(const bad of [{home_ga_id:'G-<script>'},{home_ga_id:'UA-123-1'},{home_ga_id:'G-'},{home_ga_id:null},{home_ga_id:123},{home_analytics_enabled:'true'},{home_ga_id:'',home_analytics_enabled:true}])await req('/admin/settings','PUT',{trial_days:7,...bad},admin,400);
 config=(await req('/public/config')).data;check(()=>assert.equal(config.trial_days,30));check(()=>assert.equal(config.home_ga_id,''));
 await req('/admin/settings','PUT',{home_ga_id:' G-HOMETEST12 ',home_analytics_enabled:true},admin);config=(await req('/public/config')).data;check(()=>assert.equal(config.home_ga_id,'G-HOMETEST12'));check(()=>assert.equal(config.home_analytics_enabled,true));
 const frameResponse=await fetch(base+'/public/home-analytics/frame?id=G-HOMETEST12&channel=home-http-test'),frameHtml=await frameResponse.text();
 check(()=>assert.equal(frameResponse.status,200));check(()=>assert.match(frameResponse.headers.get('content-type'),/text\/html/));check(()=>assert.equal(frameResponse.headers.get('cache-control'),'no-store'));check(()=>assert.equal(frameResponse.headers.get('x-frame-options'),'SAMEORIGIN'));
 check(()=>assert.ok(frameHtml.includes('https://www.googletagmanager.com/gtag/js?id=G-HOMETEST12')));check(()=>assert.ok(frameHtml.includes('home-http-test')));check(()=>assert.ok(frameHtml.includes("onload=\"homeTagStatus('ready')\"")));
 for(const [query,status] of [['id=G-HOMETEST12',400],['id=G-HOMETEST12&channel=%3Cscript%3E',400],['id=G-OLDTEST12&channel=home-test',409]]){const response=await fetch(base+'/public/home-analytics/frame?'+query);check(()=>assert.equal(response.status,status));const text=await response.text();check(()=>assert.ok(!text.includes('googletagmanager')));}
 check(()=>assert.equal(db.prepare('SELECT ga_id FROM businesses WHERE id=?').get(business.id).ga_id,''));
 await req('/businesses/'+business.id+'/tools/settings','PUT',{ga_id:'G-TENANT1234'},owner);check(()=>assert.equal(db.prepare('SELECT ga_id FROM businesses WHERE id=?').get(business.id).ga_id,'G-TENANT1234'));
 await req('/admin/settings','PUT',{trial_days:7},admin);config=(await req('/public/config')).data;check(()=>assert.equal(config.home_ga_id,'G-HOMETEST12'));check(()=>assert.equal(config.home_analytics_enabled,true));
 await req('/admin/settings','PUT',{home_analytics_enabled:false},admin);config=(await req('/public/config')).data;check(()=>assert.equal(config.home_analytics_enabled,false));check(()=>assert.equal(config.home_ga_id,'G-HOMETEST12'));

 // Run the actual emitted tag document with an inert SDK. No Google requests are sent.
 let handler,commands=[];const parentMessages=[],parent={postMessage:(data,target)=>parentMessages.push({data,target})},origin='https://adara.example.test',channel='home-test-123';
 const html=homeTagDocument('G-HOMETEST12',channel),inline=html.match(/<script>([\s\S]*?)<\/script>/)[1],context={parent,location:{origin},URL,Date,addEventListener:(name,fn)=>{if(name==='message')handler=fn}};context.window=context;
 vm.runInNewContext(inline,context);commands=context.dataLayer;
 check(()=>assert.equal(parentMessages.length,0));context.homeTagStatus('ready');check(()=>assert.equal(parentMessages[0].data.status,'ready'));check(()=>assert.equal(parentMessages[0].target,origin));check(()=>assert.equal(parentMessages[0].data.id,'G-HOMETEST12'));
 check(()=>assert.equal(commands[0][0],'consent'));check(()=>assert.equal(commands[0][2].analytics_storage,'granted'));check(()=>assert.equal(commands[0][2].ad_storage,'denied'));check(()=>assert.equal(commands[2][2].send_page_view,false));check(()=>assert.equal(commands[2][2].allow_google_signals,false));
 const message={channel,event:'page_view',path:'/',referrer:'https://instagram.com/somewhere?email=private@example.test#secret'};
 handler({source:parent,origin,data:message});check(()=>assert.equal(commands.at(-1)[0],'event'));check(()=>assert.equal(commands.at(-1)[1],'page_view'));check(()=>assert.equal(commands.at(-1)[2].page_location,origin+'/'));check(()=>assert.equal(commands.at(-1)[2].page_referrer,'https://instagram.com/'));
 let before=commands.length;
 for(const bad of [{channel:'wrong'},{event:'purchase'},{path:'/reservar/estudio'},{path:'/mi-reserva/token'},{path:'/?email=person@example.test'},{path:'/registro?token=secret'}])handler({source:parent,origin,data:{...message,...bad}});
 handler({source:{},origin,data:message});handler({source:parent,origin:'https://evil.example',data:message});check(()=>assert.equal(commands.length,before));
 handler({source:parent,origin,data:{...message,event:'sign_up',path:'/registro',email:'must-not-send@example.test',name:'Private',password:'secret'}});check(()=>assert.equal(commands.at(-1)[1],'sign_up'));check(()=>assert.equal(commands.at(-1)[2].method,'email'));check(()=>assert.ok(!JSON.stringify(commands).includes('must-not-send')));check(()=>assert.ok(!JSON.stringify(commands).includes('secret')));
 for(const id of ['G-<script>','G-ABC</script>','UA-12345',null])check(()=>assert.throws(()=>homeTagDocument(id,channel)));

 // Route transitions and consent operate on a separate document, without a global gtag.
 const frames=[],sent=[],listeners=new Set(),win={location:{origin},crypto:{randomUUID:()=> 'unit-test-123'},addEventListener:(type,fn)=>listeners.add(fn),removeEventListener:(type,fn)=>listeners.delete(fn)};
 const ready=(frame,overrides={})=>{const data={type:'adara-home-tag',status:'ready',id:new URL(frame.src,origin).searchParams.get('id'),channel:new URL(frame.src,origin).searchParams.get('channel')};for(const fn of listeners)fn({source:frame.contentWindow,origin,data,...overrides})};
 const doc={referrer:'https://instagram.com/link?private=secret',createElement:tag=>{assert.equal(tag,'iframe');const listeners={},frame={hidden:false,title:'',attrs:{},srcdoc:'',removed:false,contentWindow:{postMessage:(data,target)=>sent.push({data,target})},setAttribute:(key,value)=>frame.attrs[key]=value,addEventListener:(event,fn)=>listeners[event]=fn,load:()=>listeners.load?.(),remove:()=>frame.removed=true};return frame},body:{appendChild:frame=>frames.push(frame)}};
 const tracker=createHomeTracker(win,doc),enabled={home_ga_id:'G-HOMETEST12',home_analytics_enabled:true};
 tracker.sync(enabled,'/',false);check(()=>assert.equal(frames.length,0));tracker.emit('registration_start');check(()=>assert.equal(sent.length,0));
 tracker.sync(enabled,'/',true);check(()=>assert.equal(frames.length,1));check(()=>assert.equal(sent.length,0));check(()=>assert.equal(frames[0].hidden,true));check(()=>assert.equal(frames[0].attrs.sandbox,'allow-scripts allow-same-origin'));check(()=>assert.equal(frames[0].srcdoc,''));check(()=>assert.ok(frames[0].src.startsWith('/api/public/home-analytics/frame?')));
 tracker.emit('registration_start');frames[0].load();check(()=>assert.equal(sent.length,0));ready(frames[0],{origin:'https://evil.example'});ready(frames[0],{source:{}});ready(frames[0],{data:{type:'adara-home-tag',status:'ready',id:'G-HOMETEST12',channel:'wrong'}});check(()=>assert.equal(sent.length,0));ready(frames[0]);check(()=>assert.equal(sent.length,2));ready(frames[0]);check(()=>assert.equal(sent.length,2));check(()=>assert.equal(sent[0].data.event,'page_view'));check(()=>assert.equal(sent[1].data.event,'registration_start'));check(()=>assert.equal(sent[0].data.referrer,'https://instagram.com/'));check(()=>assert.equal(sent[0].target,origin));
 tracker.sync(enabled,'/',true);check(()=>assert.equal(sent.length,2));tracker.sync(enabled,'/registro',true);tracker.emit('sign_up');check(()=>assert.equal(sent.at(-1).data.event,'sign_up'));check(()=>assert.equal(sent.at(-1).data.path,'/registro'));
 const privatePaths=['/admin','/super-admin','/login','/mi-reserva/private-token','/reservar/estudio','/verificar-email','/restablecer-contrasena','/privacidad'];
 for(const pathname of privatePaths){const count=frames.length;tracker.sync(enabled,pathname,true);tracker.emit('sign_up');check(()=>assert.equal(frames.length,count));check(()=>assert.equal(frames.at(-1).removed,true));check(()=>assert.equal(allowedHomePath(pathname),false));}
 const count=sent.length;tracker.sync(enabled,'/',true);tracker.sync(enabled,'/',false);ready(frames.at(-1));tracker.emit('sign_up');check(()=>assert.equal(sent.length,count));check(()=>assert.equal(frames.at(-1).removed,true));
 tracker.sync(enabled,'/',true);ready(frames.at(-1));tracker.sync({...enabled,home_ga_id:'G-NEWTAG1234'},'/',true);check(()=>assert.equal(frames.at(-2).removed,true));const beforeOld=sent.length;ready(frames.at(-2));check(()=>assert.equal(sent.length,beforeOld));ready(frames.at(-1));check(()=>assert.ok(frames.at(-1).src.includes('G-NEWTAG1234')));
 tracker.sync({...enabled,home_analytics_enabled:false},'/',true);check(()=>assert.equal(frames.at(-1).removed,true));check(()=>assert.equal(win.gtag,undefined));check(()=>assert.notEqual(HOME_CONSENT_KEY,'adara-analytics-'+business.id));tracker.destroy();check(()=>assert.equal(listeners.size,0));
 console.log(`OK: ${checks} comprobaciones de Analytics del Home: permisos, consentimiento, eventos, rutas, etiquetas aisladas y ausencia de datos personales.`);
}finally{await new Promise(r=>server.close(r));db.close();process.chdir(original);fs.rmSync(temp,{recursive:true,force:true})}
