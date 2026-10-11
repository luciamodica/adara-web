import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const original=process.cwd(),temp=fs.mkdtempSync(path.join(os.tmpdir(),'adara-unisex-'));
process.chdir(temp);
Object.assign(process.env,{NODE_ENV:'test',DATA_DIR:temp+'/data',UPLOADS_DIR:temp+'/data/uploads',DISABLE_FEATURE_WORKER:'true',DEMO_PAYMENTS:'true',RESEND_API_KEY:''});
const {app}=await import('../server/index.js'),{db}=await import('../server/db.js'),{migratePlatformCopy}=await import('../server/platform-copy.js');
const server=app.listen(0);await new Promise(r=>server.once('listening',r));
const base=`http://127.0.0.1:${server.address().port}/api`;let checks=0;
const check=fn=>{fn();checks++};
async function req(route,method='GET',body,cookie='',expected=200){const r=await fetch(base+route,{method,headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)}),data=await r.json();check(()=>assert.equal(r.status,expected,JSON.stringify(data)));return {data,cookie:r.headers.get('set-cookie')?.split(';')[0]};}
try{
 let i=0,first;
 for(const category of ['Barbería','Peluquería','Bienestar y spa','Tatuajes y piercing','Servicios profesionales',undefined]){
  const {data}=await req('/auth/register','POST',{name:'Alex',businessName:'Estudio '+(++i),email:`unisex${i}@example.test`,password:'Strong-password-42!',category,plan:'adara'});
  const verified=await req('/auth/verify?token='+new URL('http://localhost'+data.devVerifyUrl).searchParams.get('token'));
  const me=await req('/me','GET',undefined,verified.cookie),b=me.data.businesses[0];
  check(()=>assert.equal(b.category,category||'Servicios profesionales'));
  check(()=>assert.equal(b.template_id,'atlas'));
  check(()=>assert.equal(b.heading_font,'modern'));
  check(()=>assert.equal(b.primary_color,'#0758df'));
  if(!first)first={b,cookie:verified.cookie};
 }
 const root='/businesses/'+first.b.id,page=(await req(root+'/page-settings','GET',undefined,first.cookie)).data;
 for(const id of ['atlas','clear','forest','carbon','silk','rose','sage','noir','pearl','muse'])check(()=>assert.ok(page.templates.some(t=>t.id===id)));
 db.prepare("UPDATE plans SET template_level=3 WHERE slug='adara'").run();
 for(const id of ['atlas','clear','forest','carbon']){
  const template=page.templates.find(t=>t.id===id);
  await req(root+'/page-settings','PUT',{...page.business,...template.defaults,template_id:id,primary_color:template.colors.primary,accent_color:template.colors.accent,background_color:template.colors.background},first.cookie);
  const stored=(await req(root+'/page-settings','GET',undefined,first.cookie)).data.business;
  check(()=>assert.equal(stored.template_id,id));check(()=>assert.equal(stored.heading_font,'modern'));
 }
 db.prepare("UPDATE plans SET template_level=1 WHERE slug='adara'").run();
 await req(root+'/page-settings','PUT',{...page.business,template_id:'carbon'},first.cookie,403);
 // Simulate an old installation: migrate only platform text, retaining prices,
 // customized tenant content and immutable published legal snapshots.
 db.prepare("DELETE FROM platform_settings WHERE key='unisex_platform_copy'").run();
 const plan=db.prepare('SELECT * FROM plans WHERE slug=?').get('adara');
 db.prepare('UPDATE plans SET description=?,features_json=? WHERE id=?').run('Para un negocio de belleza',JSON.stringify(['Historial de clientas']),plan.id);
 const faq=db.prepare('INSERT INTO platform_faqs(question,answer) VALUES(?,?)').run('¿Cómo reservan las clientas?','La clienta coordina con la profesional.');
 db.prepare('UPDATE businesses SET hero_title=?,category_label=?,primary_color=? WHERE id=?').run('Mis clientas, mi marca','Mi rubro personalizado','#8d665b',first.b.id);
 const tenantBefore=db.prepare('SELECT * FROM businesses WHERE id=?').get(first.b.id);
 const legalBefore=db.prepare('SELECT * FROM platform_legal_draft').all();
 const publication=db.prepare('INSERT INTO platform_legal_publications(content_json,content_hash,published_at,published_by) VALUES(?,?,?,?)').run('{"text":"Las clientas"}','snapshot-hash',new Date().toISOString(),first.b.owner_id);
 const acceptedBefore=db.prepare('SELECT * FROM platform_legal_publications').all();
 migratePlatformCopy(db);
 const migrated=db.prepare('SELECT * FROM plans WHERE id=?').get(plan.id);
 check(()=>assert.equal(migrated.description,'Para un negocio'));
 check(()=>assert.deepEqual(JSON.parse(migrated.features_json),['Historial de clientes']));
 for(const key of ['monthly_price_cents','annual_price_cents','max_services','template_level','active','max_staff','team_enabled'])check(()=>assert.equal(migrated[key],plan[key]));
 check(()=>assert.equal(db.prepare('SELECT question FROM platform_faqs WHERE id=?').get(faq.lastInsertRowid).question,'¿Cómo reservan los clientes?'));
 check(()=>assert.deepEqual(db.prepare('SELECT * FROM businesses WHERE id=?').get(first.b.id),tenantBefore));
 check(()=>assert.deepEqual(db.prepare('SELECT * FROM platform_legal_draft').all(),legalBefore));
 check(()=>assert.deepEqual(db.prepare('SELECT * FROM platform_legal_publications').all(),acceptedBefore));
 db.prepare('UPDATE plans SET description=? WHERE id=?').run('Texto personalizado posterior',plan.id);migratePlatformCopy(db);
 check(()=>assert.equal(db.prepare('SELECT description FROM plans WHERE id=?').get(plan.id).description,'Texto personalizado posterior'));
 console.log(`OK: ${checks} comprobaciones de identidad unisex, rubros, plantillas, tipografía, permisos y migración sin modificar precios, diseños ni textos legales aceptados.`);
}finally{await new Promise(r=>server.close(r));db.close();process.chdir(original);fs.rmSync(temp,{recursive:true,force:true});}
