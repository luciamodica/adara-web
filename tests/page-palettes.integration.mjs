import {randomBytes} from 'node:crypto';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import jwt from 'jsonwebtoken';
import {resolvePagePalettes,validatePagePalettes,paletteTokens,colorContrast,readPagePalettes} from '../shared/page-palettes.js';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'adara-palettes-'));
Object.assign(process.env,{NODE_ENV:'test',DATA_DIR:dir,UPLOADS_DIR:path.join(dir,'uploads'),JWT_SECRET:randomBytes(32).toString('hex'),DISABLE_FEATURE_WORKER:'true',DEMO_PAYMENTS:'true',RESEND_API_KEY:'',SUPERADMIN_EMAIL:'',SUPERADMIN_PASSWORD:''});
const {app}=await import('../server/index.js'),{db}=await import('../server/db.js');
const server=app.listen(0);await new Promise(r=>server.once('listening',r));const base=`http://127.0.0.1:${server.address().port}/api`;let checks=0;
const check=fn=>{fn();checks++};
async function request(route,method='GET',body,cookie='',status=200){const r=await fetch(base+route,{method,headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)});const data=await r.json().catch(()=>({}));check(()=>assert.equal(r.status,status,JSON.stringify({route,data})));return data}
function owner(n){const id=db.prepare("INSERT INTO users(name,email,password_hash,role,email_verified) VALUES(?,?,?,'owner',1)").run('Profesional de prueba',`palettes-${n}@fixture.example.test`,randomBytes(32).toString('hex')).lastInsertRowid;const bid=db.prepare("INSERT INTO businesses(owner_id,name,slug,plan_slug,trial_ends_at,primary_color,accent_color,background_color) VALUES(?,?,?,'adara',?,'#aa6688','#ddbbcc','#fff7fb')").run(id,'Estudio de prueba '+n,'palettes-fixture-'+n,new Date(Date.now()+15*86400000).toISOString()).lastInsertRowid;return {b:db.prepare('SELECT * FROM businesses WHERE id=?').get(bid),root:'/businesses/'+bid,cookie:'session='+jwt.sign({sub:String(id),role:'owner',sv:0},process.env.JWT_SECRET)}}
try{
 const a=owner(1),b=owner(2),route=a.root+'/page-settings';
 let page=(await request(route,'GET',undefined,a.cookie)).business;
 check(()=>assert.deepEqual(page.color_palettes,{}));check(()=>assert.equal(page.primary_color,'#aa6688'));check(()=>assert.equal(a.b.color_palettes_json,'{}'));
 await request(route,'PUT',{...page,hero_text:'Edición sin cambiar paletas'},a.cookie);check(()=>assert.equal(db.prepare('SELECT color_palettes_json FROM businesses WHERE id=?').get(a.b.id).color_palettes_json,'{}'));
 await request(route,'PUT',{},'',401);await request(route,'PUT',{},b.cookie,403);
 const palettes={light:{primary:'#aa4488',accent:'#ddbbcc',background:'#fff7fb',surface:'#ffffff',text:'#2b2030'},dark:{primary:'#c09eff',accent:'#9edfd3',background:'#160e24',surface:'#271b39',text:'#f5efff'}};
 await request(route,'PUT',{...page,color_palettes:palettes},a.cookie);
 page=(await request(route,'GET',undefined,a.cookie)).business;
 check(()=>assert.deepEqual(page.color_palettes,palettes));check(()=>assert.equal(page.primary_color,palettes.light.primary));check(()=>assert.equal(page.background_color,palettes.light.background));check(()=>assert.equal(page.accent_color,palettes.light.accent));
 const publicPage=(await request('/public/'+a.b.slug)).business;check(()=>assert.deepEqual(publicPage.color_palettes,palettes));check(()=>assert.equal(publicPage.color_palettes_json,undefined));check(()=>assert.deepEqual(JSON.parse(db.prepare('SELECT color_palettes_json FROM businesses WHERE id=?').get(a.b.id).color_palettes_json),palettes));
 check(()=>assert.equal(db.prepare('SELECT color_palettes_json FROM businesses WHERE id=?').get(b.b.id).color_palettes_json,'{}'));check(()=>assert.equal(db.prepare('SELECT plan_slug FROM businesses WHERE id=?').get(a.b.id).plan_slug,'adara'));
 const before=db.prepare('SELECT * FROM businesses WHERE id=?').get(a.b.id);
 const invalid=[null,[],{unknown:{}},{dark:null},{dark:[]},{dark:{primary:'red'}},{dark:{primary:'#fff'}},{dark:{primary:'url(javascript:alert(1))'}},{dark:{surface:12}},{dark:{text:'#271b39'}},{light:{surface:'#2b2030'}},{dark:{other:'#ffffff'}}];
 for(const color_palettes of invalid){await request(route,'PUT',{...page,hero_title:'Must not be saved',color_palettes},a.cookie,400);const after=db.prepare('SELECT * FROM businesses WHERE id=?').get(a.b.id);check(()=>assert.equal(after.hero_title,before.hero_title));check(()=>assert.equal(after.color_palettes_json,before.color_palettes_json))}
 // Old clients can still edit a page without deleting the new palettes.
 const legacy={...page,hero_text:'Texto actualizado'};delete legacy.color_palettes;await request(route,'PUT',legacy,a.cookie);const legacySaved=(await request(route,'GET',undefined,a.cookie)).business;check(()=>assert.deepEqual(legacySaved.color_palettes,palettes));
 // Partial palette updates keep the other mode independent.
 await request(route,'PUT',{...page,color_palettes:{dark:{primary:'#ffcc88'}}},a.cookie);const saved=(await request(route,'GET',undefined,a.cookie)).business;check(()=>assert.equal(saved.color_palettes.dark.primary,'#ffcc88'));check(()=>assert.deepEqual(saved.color_palettes.light,palettes.light));
 for(const palette of Object.values(resolvePagePalettes(saved))){const tokens=paletteTokens(palette);check(()=>assert.ok(colorContrast(tokens.text,tokens.background)>=4.5));check(()=>assert.ok(colorContrast(tokens.text,tokens.surface)>=4.5));check(()=>assert.ok(colorContrast(tokens.muted,tokens.surface)>=4.5));check(()=>assert.ok(colorContrast(tokens.buttonText,tokens.primary)>=4.5));check(()=>assert.ok(colorContrast(tokens.link,tokens.surface)>=4.5))}
 // Switching an uncustomized light template to a dark design derives readable defaults from its new background.
 const fresh=owner(3),freshPage=(await request(fresh.root+'/page-settings','GET',undefined,fresh.cookie)).business;
 await request(fresh.root+'/page-settings','PUT',{...freshPage,primary_color:'#bcaaff',accent_color:'#aabbcc',background_color:'#151515',color_palettes:{light:{primary:'#bcaaff',accent:'#aabbcc',background:'#151515'}}},fresh.cookie);
 const changed=(await request(fresh.root+'/page-settings','GET',undefined,fresh.cookie)).business;check(()=>assert.equal(changed.color_palettes.light.text,'#ffffff'));check(()=>assert.ok(colorContrast(changed.color_palettes.light.text,changed.color_palettes.light.surface)>=4.5));
 for(const bg of ['#000000','#ffffff','#f0e0d0','#19334a']){const defaults=resolvePagePalettes({background_color:bg});check(()=>assert.doesNotThrow(()=>validatePagePalettes(defaults,{background_color:bg})))}
 check(()=>assert.deepEqual(readPagePalettes('{bad'),{}));check(()=>assert.deepEqual(readPagePalettes('{"dark":{"primary":"red","text":"#FFFFFF"}}'),{dark:{text:'#ffffff'}}));
 console.log(`OK: ${checks} comprobaciones de paletas independientes: permisos, persistencia, API pública, compatibilidad y contraste.`);
}finally{await new Promise(r=>server.close(r));db.close();fs.rmSync(dir,{recursive:true,force:true})}
