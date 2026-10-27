import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import bcrypt from 'bcryptjs';
import {homeMetaDocument} from '../server/home-meta-tag.js';
import {HOME_CONSENT_KEY,HOME_META_CONSENT_KEY,readHomeChoices,needsHomeConsent,createHomeTracker,createHomeMetaTracker,setActiveHomeTracker,setActiveHomeMetaTracker,trackHomeEvent} from '../src/home-analytics.ts';

let checks=0;const check=fn=>{fn();checks++};
const original=process.cwd(),temp=fs.mkdtempSync(path.join(os.tmpdir(),'adara-home-meta-'));
process.chdir(temp);Object.assign(process.env,{NODE_ENV:'test',DATA_DIR:temp+'/data',UPLOADS_DIR:temp+'/data/uploads',DISABLE_FEATURE_WORKER:'true',RESEND_API_KEY:'',DEMO_PAYMENTS:'false'});
const {app}=await import('../server/index.js'),{db}=await import('../server/db.js');
const server=app.listen(0);await new Promise(r=>server.once('listening',r));const base=`http://127.0.0.1:${server.address().port}/api`;
async function req(route,method='GET',body,cookie='',status=200){const r=await fetch(base+route,{method,headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)}),data=await r.json().catch(()=>({}));check(()=>assert.equal(r.status,status,JSON.stringify({route,data})));return {data,cookie:r.headers.get('set-cookie')?.split(';')[0]};}
const pixel='123456789012345',enabled={home_meta_pixel_id:pixel,home_meta_enabled:true},gaEnabled={home_ga_id:'G-HOMESAFE12',home_analytics_enabled:true},both={...gaEnabled,...enabled};
try{
 db.prepare('INSERT INTO users(name,email,password_hash,role,email_verified) VALUES(?,?,?,?,1)').run('Fixture Super','super-meta@example.test',bcrypt.hashSync('Fixture-admin-password-42!',8),'superadmin');
 const admin=(await req('/auth/login','POST',{email:'super-meta@example.test',password:'Fixture-admin-password-42!'})).cookie;
 const signup=(await req('/auth/register','POST',{name:'Alex',businessName:'Estudio',email:'owner-meta@example.test',password:'Fixture-owner-password-42!',plan:'adara'})).data;
 const token=new URL('http://localhost'+signup.devVerifyUrl).searchParams.get('token'),owner=(await req('/auth/verify?token='+token)).cookie,business=(await req('/me','GET',undefined,owner)).data.businesses[0];
 let config=(await req('/public/config')).data;check(()=>assert.equal(config.home_meta_pixel_id,''));check(()=>assert.equal(config.home_meta_enabled,false));
 const initialFrame=await fetch(base+'/public/home-meta/frame?id='+pixel+'&channel=home-test');check(()=>assert.equal(initialFrame.status,204));
 await req('/admin/settings','PUT',enabled,'',401);await req('/admin/settings','PUT',enabled,owner,403);
 for(const bad of [{home_meta_pixel_id:null},{home_meta_pixel_id:123456789},{home_meta_pixel_id:'<script>'},{home_meta_pixel_id:'12345&injection=1'},{home_meta_pixel_id:'G-12345'},{home_meta_pixel_id:'01234567890'},{home_meta_pixel_id:'1'.repeat(26)},{home_meta_pixel_id:'' ,home_meta_enabled:true},{home_meta_enabled:'true'}])await req('/admin/settings','PUT',{trial_days:7,...bad},admin,400);
 config=(await req('/public/config')).data;check(()=>assert.equal(config.trial_days,30));check(()=>assert.equal(config.home_meta_pixel_id,''));
 await req('/admin/settings','PUT',{...gaEnabled,home_meta_pixel_id:' '+pixel+' ',home_meta_enabled:true},admin);
 config=(await req('/public/config')).data;check(()=>assert.equal(config.home_meta_pixel_id,pixel));check(()=>assert.equal(config.home_meta_enabled,true));check(()=>assert.equal(config.home_ga_id,gaEnabled.home_ga_id));check(()=>assert.equal(config.home_analytics_enabled,true));
 await req('/admin/settings','PUT',{trial_days:7},admin);config=(await req('/public/config')).data;check(()=>assert.equal(config.home_meta_pixel_id,pixel));check(()=>assert.equal(config.home_meta_enabled,true));
 check(()=>assert.equal(db.prepare('SELECT meta_pixel_id FROM businesses WHERE id=?').get(business.id).meta_pixel_id,''));
 await req('/businesses/'+business.id+'/tools/settings','PUT',{meta_pixel_id:'999999999999999'},owner);config=(await req('/public/config')).data;check(()=>assert.equal(config.home_meta_pixel_id,pixel));
 const response=await fetch(base+'/public/home-meta/frame?id='+pixel+'&channel=home-http-test'),html=await response.text();
 check(()=>assert.equal(response.status,200));check(()=>assert.match(response.headers.get('content-type'),/text\/html/));check(()=>assert.equal(response.headers.get('cache-control'),'no-store'));check(()=>assert.equal(response.headers.get('x-frame-options'),'SAMEORIGIN'));check(()=>assert.equal(response.headers.get('referrer-policy'),'no-referrer'));
 check(()=>assert.ok(html.includes('https://connect.facebook.net/en_US/fbevents.js')));check(()=>assert.ok(!html.includes('googletagmanager')));check(()=>assert.ok(!html.includes('<noscript>')));
 for(const [query,status] of [['id='+pixel,400],['id='+pixel+'&channel=%3Cscript%3E',400],['id=999999999999999&channel=home-test',409],['id='+pixel+'&channel='+('home-'+('a'.repeat(101))),400]]){const r=await fetch(base+'/public/home-meta/frame?'+query);check(()=>assert.equal(r.status,status));const text=await r.text();check(()=>assert.ok(!text.includes('fbevents')));}
 await req('/admin/settings','PUT',{home_meta_enabled:false},admin);config=(await req('/public/config')).data;check(()=>assert.equal(config.home_meta_enabled,false));check(()=>assert.equal(config.home_analytics_enabled,true));const disabled=await fetch(base+'/public/home-meta/frame?id='+pixel+'&channel=home-test');check(()=>assert.equal(disabled.status,204));

 // Execute the actual served bootstrap; the remote SDK remains inert.
 const urls=[],statuses=[],origin='https://adara.example.test',parent={postMessage:(data,target)=>statuses.push({data,target})},channel='home-http-test';let handler;
 const context={location:{origin},history:{replaceState:(_state,_title,url)=>urls.push(url)},parent,addEventListener:(type,fn)=>{if(type==='message')handler=fn}};context.window=context;
 vm.runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],context);
 check(()=>assert.equal(urls[0],'/'));check(()=>assert.equal(context.fbq.disablePushState,true));
 const commands=context.fbq.queue;check(()=>assert.deepEqual(Array.from(commands[0]),['consent','grant']));check(()=>assert.deepEqual(Array.from(commands[1]),['set','autoConfig',false,pixel]));check(()=>assert.deepEqual(Array.from(commands[2]),['init',pixel]));check(()=>assert.equal(commands.length,3));check(()=>assert.equal(statuses.length,0));
 context.homeTagStatus('ready');check(()=>assert.equal(statuses[0].data.id,pixel));check(()=>assert.equal(statuses[0].data.channel,channel));check(()=>assert.equal(statuses[0].target,origin));
 const message={channel,event:'page_view',path:'/',email:'private@example.test',password:'secret',token:'private-token',referrer:'https://example.com/?email=secret'};
 handler({source:parent,origin,data:message});check(()=>assert.equal(commands.at(-1)[0],'trackSingle'));check(()=>assert.equal(commands.at(-1)[1],pixel));check(()=>assert.equal(commands.at(-1)[2],'PageView'));check(()=>assert.equal(commands.at(-1)[3].page_path,'/'));
 handler({source:parent,origin,data:{...message,event:'registration_start',path:'/registro'}});check(()=>assert.equal(commands.at(-1)[0],'trackSingleCustom'));check(()=>assert.equal(commands.at(-1)[2],'RegistrationStart'));
 handler({source:parent,origin,data:{...message,event:'sign_up',path:'/registro'}});check(()=>assert.equal(commands.at(-1)[0],'trackSingle'));check(()=>assert.equal(commands.at(-1)[2],'CompleteRegistration'));check(()=>assert.equal(urls.at(-1),'/registro'));
 const before=commands.length;
 for(const bad of [{event:'purchase'},{event:'Lead'},{path:'/admin'},{path:'/mi-reserva/private-token'},{path:'/reservar/estudio'},{path:'/?email=secret'},{path:'/registro?token=private-token'},{channel:'wrong'}])handler({source:parent,origin,data:{...message,...bad}});
 handler({source:{},origin,data:message});handler({source:parent,origin:'https://evil.example',data:message});check(()=>assert.equal(commands.length,before));
 for(const secret of ['private@example.test','secret','private-token']){check(()=>assert.ok(!JSON.stringify(commands).includes(secret)));check(()=>assert.ok(!JSON.stringify(urls).includes(secret)));}
 for(const bad of ['<script>',null,'G-1234','12345" onload="alert(1)'])check(()=>assert.throws(()=>homeMetaDocument(bad,channel)));

 // Old Analytics choices never authorize the newly added advertising tag.
 const storage=new Map([[HOME_CONSENT_KEY,'yes']]),storageApi={getItem:key=>storage.get(key)||null};
 let choices=readHomeChoices(storageApi);check(()=>assert.equal(choices.ga,'yes'));check(()=>assert.equal(choices.meta,null));check(()=>assert.equal(needsHomeConsent(both,choices),true));check(()=>assert.equal(needsHomeConsent(gaEnabled,choices),false));
 storage.set(HOME_META_CONSENT_KEY,'no');choices=readHomeChoices(storageApi);check(()=>assert.equal(needsHomeConsent(both,choices),false));check(()=>assert.equal(choices.ga,'yes'));check(()=>assert.equal(choices.meta,'no'));
 storage.set(HOME_META_CONSENT_KEY,'unexpected');check(()=>assert.equal(readHomeChoices(storageApi).meta,null));check(()=>assert.equal(readHomeChoices({getItem:()=>{throw Error('blocked')}}).meta,null));

 const frames=[],sent=[],listeners=new Set();let counter=0;
 const win={location:{origin},crypto:{randomUUID:()=> 'unit-'+(++counter)},addEventListener:(_type,fn)=>listeners.add(fn),removeEventListener:(_type,fn)=>listeners.delete(fn)};
 const doc={referrer:'https://example.com/?email=private@example.test',createElement:()=>{const f={src:'',attrs:{},removed:false,contentWindow:{postMessage:(data,target)=>sent.push({frame:f,data,target})},setAttribute:(key,value)=>f.attrs[key]=value,remove:()=>f.removed=true};return f},body:{appendChild:f=>frames.push(f)}};
 const ready=(frame,overrides={})=>{const u=new URL(frame.src,origin),data={type:'adara-home-tag',status:'ready',id:u.searchParams.get('id'),channel:u.searchParams.get('channel')};for(const fn of listeners)fn({source:frame.contentWindow,origin,data,...overrides})};
 const ga=createHomeTracker(win,doc),meta=createHomeMetaTracker(win,doc);
 ga.sync(both,'/',true);meta.sync(both,'/',false);check(()=>assert.equal(frames.length,1));check(()=>assert.ok(frames[0].src.includes('home-analytics')));
 ga.sync(both,'/',false);meta.sync(both,'/',true);check(()=>assert.equal(frames[0].removed,true));check(()=>assert.equal(frames.length,2));check(()=>assert.ok(frames[1].src.includes('home-meta')));check(()=>assert.equal(win.fbq,undefined));
 const metaFrame=frames.at(-1);ready(metaFrame,{origin:'https://evil.example'});ready(metaFrame,{source:{}});check(()=>assert.equal(sent.length,0));ready(metaFrame);check(()=>assert.equal(sent.length,1));ready(metaFrame);check(()=>assert.equal(sent.length,1));
 ga.sync(both,'/',true);ready(frames.at(-1));setActiveHomeTracker(ga);setActiveHomeMetaTracker(meta);trackHomeEvent('registration_start');check(()=>assert.equal(sent.filter(x=>x.data.event==='registration_start').length,2));
 meta.sync(both,'/registro',true);meta.emit('sign_up');check(()=>assert.equal(sent.at(-1).data.path,'/registro'));check(()=>assert.equal(sent.at(-1).data.event,'sign_up'));
 meta.sync(both,'/registro',false);const count=sent.length;ready(metaFrame);meta.emit('sign_up');check(()=>assert.equal(sent.length,count));check(()=>assert.equal(metaFrame.removed,true));
 for(const pathname of ['/admin','/super-admin','/login','/verificar-email','/mi-reserva/token','/reservar/estudio','/restablecer-contrasena','/privacidad']){const n=frames.length;meta.sync(both,pathname,true);meta.emit('sign_up');check(()=>assert.equal(frames.length,n));check(()=>assert.equal(sent.length,count));}
 meta.sync(enabled,'/',true);const old=frames.at(-1);meta.sync({...enabled,home_meta_pixel_id:'999999999999999'},'/',true);check(()=>assert.equal(old.removed,true));ready(old);check(()=>assert.equal(sent.length,count));ready(frames.at(-1));check(()=>assert.equal(sent.at(-1).data.event,'page_view'));
 meta.sync({...enabled,home_meta_enabled:false},'/',true);check(()=>assert.equal(frames.at(-1).removed,true));ga.destroy();meta.destroy();setActiveHomeTracker(undefined);setActiveHomeMetaTracker(undefined);check(()=>assert.equal(listeners.size,0));
 console.log(`OK: ${checks} comprobaciones de Meta Pixel del Home: permisos, consentimiento separado, migración, eventos, URLs, aislamiento y convivencia con Analytics.`);
}finally{setActiveHomeTracker(undefined);setActiveHomeMetaTracker(undefined);await new Promise(r=>server.close(r));db.close();process.chdir(original);fs.rmSync(temp,{recursive:true,force:true})}
