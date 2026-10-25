import {randomBytes} from 'node:crypto';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {crc32,deflateRawSync} from 'node:zlib';
import bcrypt from 'bcryptjs';
import express from 'express';

const ownerPassword=randomBytes(24).toString('base64url')+'Aa1!',adminPassword=randomBytes(24).toString('base64url')+'Aa1!';
// Synthetic contacts and generated credentials; external requests are mocked.
const cwd=process.cwd(),temp=fs.mkdtempSync(path.join(os.tmpdir(),'adara-growth-'));
process.chdir(temp);
Object.assign(process.env,{NODE_ENV:'test',DATA_DIR:temp+'/data',UPLOADS_DIR:temp+'/uploads',DISABLE_FEATURE_WORKER:'true',DEMO_PAYMENTS:'true',RESEND_API_KEY:''});
const nativeFetch=global.fetch;
global.fetch=(url,options)=>{if(String(url).startsWith('http://127.0.0.1:'))return nativeFetch(url,options);throw Error('Unexpected external request: '+url)};
const {db}=await import('../server/db.js');
await import('../server/features-db.js');
await import('../server/platform-billing.js');
const legacyUser=Number(db.prepare("INSERT INTO users(name,email,password_hash,email_verified,created_at) VALUES('Legacy','legacy@example.test','unused',1,'2020-01-01 10:00:00')").run().lastInsertRowid);
const legacy=Number(db.prepare("INSERT INTO businesses(owner_id,name,slug,created_at) VALUES(?,'Legacy','legacy','2020-01-01 10:00:00')").run(legacyUser).lastInsertRowid);
const legacyClient=Number(db.prepare("INSERT INTO clients(business_id,name,phone) VALUES(?,'Historical client','0000000000005')").run(legacy).lastInsertRowid);
db.prepare("INSERT INTO bookings(business_id,client_id,date,start_time,end_time,status,created_at) VALUES(?,?,'2020-01-02','09:00','09:30','completed','2020-01-01 12:00:00')").run(legacy,legacyClient);
const {app}=await import('../server/index.js');
const {parseCsv,validateWorkbookZip,previewClients}=await import('../server/client-imports.js');
const {industries,registerMarketingPages,marketingDocument}=await import('../server/marketing-pages.js');
const server=app.listen(0);await new Promise(resolve=>server.once('listening',resolve));
const base=`http://127.0.0.1:${server.address().port}/api`;
let checks=0,marketingServer;
const check=fn=>{fn();checks++};
async function req(route,method='GET',body,cookie='',expected=200){
 const response=await fetch(base+route,{method,headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)});
 const data=await response.json().catch(()=>({}));check(()=>assert.equal(response.status,expected,JSON.stringify({route,data})));return {data,cookie:response.headers.get('set-cookie')?.split(';')[0]};
}
async function owner(n,plan='adara-inicial'){
 await req('/auth/register','POST',{name:'Owner '+n,businessName:'Business '+n,email:`growth${n}@example.test`,password:ownerPassword,plan});
 const user=db.prepare('SELECT id,verify_token FROM users WHERE email=?').get(`growth${n}@example.test`);
 const cookie=(await req('/auth/verify?token='+user.verify_token)).cookie;
 const b=(await req('/me','GET',undefined,cookie)).data.businesses[0];return {b,cookie,root:'/businesses/'+b.id};
}
async function preview(owner,content,name='clients.csv',mapping,expected=200){
 const form=new FormData();form.append('file',new Blob([content]),name);if(mapping)form.append('mapping',JSON.stringify(mapping));
 const response=await fetch(base+owner.root+'/clients/import/preview',{method:'POST',headers:owner.cookie?{Cookie:owner.cookie}:{},body:form});
 const data=await response.json();check(()=>assert.equal(response.status,expected,JSON.stringify(data)));return data;
}
function zip(entries){
 const local=[],central=[];let offset=0;
 for(const [name,value] of Object.entries(entries)){
  const filename=Buffer.from(name),data=Buffer.from(value),compressed=deflateRawSync(data),crc=crc32(data);
  const head=Buffer.alloc(30);head.writeUInt32LE(0x04034b50);head.writeUInt16LE(20,4);head.writeUInt16LE(8,8);head.writeUInt32LE(crc,14);head.writeUInt32LE(compressed.length,18);head.writeUInt32LE(data.length,22);head.writeUInt16LE(filename.length,26);
  local.push(head,filename,compressed);
  const entry=Buffer.alloc(46);entry.writeUInt32LE(0x02014b50);entry.writeUInt16LE(20,4);entry.writeUInt16LE(20,6);entry.writeUInt16LE(8,10);entry.writeUInt32LE(crc,16);entry.writeUInt32LE(compressed.length,20);entry.writeUInt32LE(data.length,24);entry.writeUInt16LE(filename.length,28);entry.writeUInt32LE(offset,42);
  central.push(entry,filename);offset+=head.length+filename.length+compressed.length;
 }
 const directory=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(Object.keys(entries).length,8);end.writeUInt16LE(Object.keys(entries).length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);return Buffer.concat([...local,directory,end]);
}
const xlsx=xml=>zip({
 '[Content_Types].xml':'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
 '_rels/.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
 'xl/workbook.xml':'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Clientes" sheetId="1" r:id="rId1"/></sheets></workbook>',
 'xl/_rels/workbook.xml.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
 'xl/worksheets/sheet1.xml':'<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'+xml+'</sheetData></worksheet>',
});
const textCell=(cell,value)=>`<c r="${cell}" t="inlineStr"><is><t>${value}</t></is></c>`;

try{
 // The migration restores known historical facts without inventing verification dates.
 check(()=>assert.equal(db.prepare("SELECT occurred_at FROM growth_milestones WHERE business_id=? AND stage='email_verified'").get(legacy).occurred_at,null));
 check(()=>assert.equal(db.prepare("SELECT occurred_at FROM growth_milestones WHERE business_id=? AND stage='first_booking'").get(legacy).occurred_at,'2020-01-01 12:00:00'));
 const one=await owner(1),two=await owner(2),team=await owner(3,'adara-equipo');
 const adminId=db.prepare("INSERT INTO users(name,email,password_hash,role,email_verified) VALUES('Fixture Admin','growth-admin@example.test',?,'superadmin',1)").run(bcrypt.hashSync(adminPassword,8)).lastInsertRowid;
 const admin=(await req('/auth/login','POST',{email:'growth-admin@example.test',password:adminPassword})).cookie;
 await req(one.root+'/setup','GET',undefined,'',401);await req(one.root+'/setup','GET',undefined,two.cookie,403);
 let setup=(await req(one.root+'/setup','GET',undefined,one.cookie)).data;
 check(()=>assert.equal(setup.completed,0));check(()=>assert.equal(setup.total,4));check(()=>assert.equal(setup.ready,false));
 await req(one.root+'/setup/share','POST',{},one.cookie,409);
 const schedule=Array.from({length:7},(_,weekday)=>({weekday,active:true,start_time:'09:00',end_time:'18:00'}));
 const service=(await req(one.root+'/services','POST',{name:'Cuidado',price:1000,duration_auto:true},one.cookie)).data.id;
 await req(one.root+'/schedule','PUT',{schedule,slot_interval_min:30},one.cookie);
 await req(one.root+'/payment-settings','PUT',{payment_mode:'none'},one.cookie);
 setup=(await req(one.root+'/setup','GET',undefined,one.cookie)).data;
 check(()=>assert.equal(setup.ready,true));check(()=>assert.equal(setup.completed,3));check(()=>assert.equal(setup.path,'/reservar/'+one.b.slug));
 await req(one.root+'/setup/share','POST',{},one.cookie);await req(one.root+'/setup/share','POST',{},one.cookie);
 setup=(await req(one.root+'/setup','GET',undefined,one.cookie)).data;check(()=>assert.equal(setup.completed,4));
 check(()=>assert.equal(db.prepare("SELECT count(*) n FROM growth_milestones WHERE business_id=? AND stage='page_shared'").get(one.b.id).n,1));
 db.prepare('UPDATE services SET active=0 WHERE id=?').run(service);setup=(await req(one.root+'/setup','GET',undefined,one.cookie)).data;check(()=>assert.equal(setup.ready,false));await req(one.root+'/setup/share','POST',{},one.cookie,409);db.prepare('UPDATE services SET active=1 WHERE id=?').run(service);
 await req(one.root+'/payment-settings','PUT',{payment_mode:'total',payment_methods:['mercadopago']},one.cookie,400);setup=(await req(one.root+'/setup','GET',undefined,one.cookie)).data;check(()=>assert.equal(setup.ready,true));
 await req(one.root+'/payment-settings','PUT',{payment_mode:'total',payment_methods:['bank_transfer'],bank_alias:'fixture.alias',bank_holder:'Fixture Holder'},one.cookie);setup=(await req(one.root+'/setup','GET',undefined,one.cookie)).data;check(()=>assert.equal(setup.ready,true));
 await req(one.root+'/payment-settings','PUT',{payment_mode:'none'},one.cookie);
 setup=(await req(team.root+'/setup','GET',undefined,team.cookie)).data;check(()=>assert.equal(setup.total,5));check(()=>assert.equal(setup.steps.find(step=>step.id==='team').done,false));
 await req(team.root+'/services','POST',{name:'Equipo',price:10,duration:30},team.cookie);
 const member=(await req(team.root+'/staff','POST',{name:'Profesional'},team.cookie)).data.id;
 await req(team.root+'/schedule','PUT',{schedule},team.cookie);setup=(await req(team.root+'/setup','GET',undefined,team.cookie)).data;check(()=>assert.equal(setup.steps.find(step=>step.id==='schedule').done,false));
 await req(team.root+'/staff/'+member+'/schedule','PUT',{schedule},team.cookie);await req(team.root+'/payment-settings','PUT',{payment_mode:'none'},team.cookie);
 setup=(await req(team.root+'/setup','GET',undefined,team.cookie)).data;check(()=>assert.equal(setup.ready,true));

 // Imports preview data, skip both classes of duplicate and preserve existing customer data.
 const original=Number(db.prepare("INSERT INTO clients(business_id,name,email,phone,phone_normalized,notes) VALUES(?,'Existing','existing@example.test','+00 000 0000 0008','0000000000008','Keep me')").run(one.b.id).lastInsertRowid);
 const csv='\uFEFFNombre;Apellido;WhatsApp;Email;Notas\r\nAna;García;+00 000 0000 0003;ANA@example.test;"Prefiere la tarde; diseño simple"\r\nBea;;0000000000007;;"Dos líneas\ncon comillas ""dobles"""\r\nOtra;;0000000000008;EXISTING@example.test;No reemplazar\r\nAna repetida;;0000000000003;;Duplicada\r\nInválida;;12;no-es-email;Revisar\r\n';
 const before=db.prepare('SELECT count(*) n FROM clients WHERE business_id=?').get(one.b.id).n;
 await preview({...one,cookie:''},csv,'clients.csv',undefined,401);await preview({...one,cookie:two.cookie},csv,'clients.csv',undefined,403);
 const first=await preview(one,csv);
 check(()=>assert.deepEqual(first.summary,{ready:2,duplicate:2,invalid:1}));check(()=>assert.equal(first.rows[0].name,'Ana García'));check(()=>assert.equal(first.rows[0].email,'ana@example.test'));check(()=>assert.match(first.rows[1].notes,/Dos líneas\ncon comillas "dobles"/));
 check(()=>assert.equal(db.prepare('SELECT count(*) n FROM clients WHERE business_id=?').get(one.b.id).n,before));
 await req(two.root+'/clients/import/'+first.id+'/commit','POST',{rows:[2]},two.cookie,404);
 await req(one.root+'/clients/import/'+first.id+'/commit','POST',{rows:[4]},one.cookie,400);
 await req(one.root+'/clients/import/'+first.id+'/commit','POST',{rows:[2,2]},one.cookie,400);
 const imported=(await req(one.root+'/clients/import/'+first.id+'/commit','POST',{rows:[2,3]},one.cookie)).data;
 check(()=>assert.equal(imported.created,2));check(()=>assert.equal(imported.skipped,0));
 const again=(await req(one.root+'/clients/import/'+first.id+'/commit','POST',{rows:[2,3]},one.cookie)).data;check(()=>assert.equal(again.already_imported,true));
 check(()=>assert.equal(db.prepare('SELECT count(*) n FROM clients WHERE business_id=?').get(one.b.id).n,before+2));check(()=>assert.equal(db.prepare('SELECT notes FROM clients WHERE id=?').get(original).notes,'Keep me'));check(()=>assert.equal(db.prepare('SELECT rows_json FROM client_imports WHERE id=?').get(first.id).rows_json,'[]'));
 const other=await preview(two,'Persona,Contacto,Comentarios\nLuz,0000000000004,Texto');check(()=>assert.equal(other.needs_mapping,true));check(()=>assert.equal(other.id,null));
 const mapped=await preview(two,'Persona,Contacto,Comentarios\nLuz,0000000000004,Texto','clients.csv',{name:0,phone:1,notes:2});check(()=>assert.equal(mapped.summary.ready,1));
 await req(two.root+'/clients/import/'+mapped.id+'/commit','POST',{rows:[2]},two.cookie);
 await preview(two,'Nombre,WhatsApp\nLuz,0000000000004','clients.csv',{name:0,phone:0},400);
 const raced=await preview(one,'Nombre,WhatsApp\nRaced,0000000000001');db.prepare("INSERT INTO clients(business_id,name,phone,phone_normalized) VALUES(?,'Concurrent','0000000000001','0000000000001')").run(one.b.id);
 const racedResult=(await req(one.root+'/clients/import/'+raced.id+'/commit','POST',{rows:[2]},one.cookie)).data;check(()=>assert.equal(racedResult.created,0));check(()=>assert.equal(racedResult.skipped,1));
 const expired=await preview(one,'Nombre,Email\nVencida,expired@example.test');db.prepare("UPDATE client_imports SET expires_at='2020-01-01' WHERE id=?").run(expired.id);await req(one.root+'/clients/import/'+expired.id+'/commit','POST',{rows:[2]},one.cookie,410);
 await preview(one,'Nombre,Email\nAna,ana@example.test','clients.xls',undefined,400);await preview(one,'Nombre,Email\n"Sin cerrar,ana@example.test','clients.csv',undefined,400);await preview(one,Buffer.alloc(2*1024*1024+1),'clients.csv',undefined,400);
 await preview(one,'Nombre,Email\n'+Array.from({length:2001},(_,i)=>`Persona ${i},person${i}@example.test`).join('\n'),'clients.csv',undefined,400);
 check(()=>assert.deepEqual(parseCsv('sep=;\r\nNombre;Email\r\n"Ana; Luz";ana@example.test\r\n'),[['Nombre','Email'],['Ana; Luz','ana@example.test']]));
 const workbook=xlsx('<row r="1">'+textCell('A1','Nombre')+textCell('B1','WhatsApp')+'</row><row r="2">'+textCell('A2','Desde Excel')+'<c r="B2"><v>0000000000002</v></c></row>');
 check(()=>assert.doesNotThrow(()=>validateWorkbookZip(workbook)));
 const excel=await preview(one,workbook,'clients.xlsx');check(()=>assert.equal(excel.rows[0].phone,'0000000000002'));check(()=>assert.equal(excel.rows[0].name,'Desde Excel'));
 const withDate=[['Nombre','Email','Última visita'],['Fecha no importada','unused@example.test',new Date()]];
 check(()=>assert.equal(previewClients(one.b.id,withDate,{name:0,email:1,phone:-1,surname:-1,notes:-1})[0].status,'ready'));
 check(()=>assert.equal(previewClients(one.b.id,withDate,{name:0,email:-1,phone:2,surname:-1,notes:-1})[0].status,'invalid'));
 const invalidEmail=await preview(two,'Nombre,Email\nCorreo para revisar,wrong@@example.test');check(()=>assert.equal(invalidEmail.summary.invalid,1));
 await req(one.root+'/clients/import/'+excel.id+'/commit','POST',{rows:[2]},one.cookie);
 check(()=>assert.throws(()=>validateWorkbookZip(xlsx('<row r="1048576">'+textCell('A1048576','Huge')+'</row>')),/filas/));
 check(()=>assert.throws(()=>validateWorkbookZip(xlsx('<row r="1">'+textCell('XFD1','Huge')+'</row>')),/columnas/));
 const badZip=Buffer.from(workbook),central=badZip.indexOf(Buffer.from([0x50,0x4b,0x01,0x02]));badZip.writeUInt32LE(100*1024*1024,central+24);
 check(()=>assert.throws(()=>validateWorkbookZip(badZip),/grande/));await preview(one,Buffer.from('not-an-excel'),'clients.xlsx',undefined,400);
 const template=await fetch(base+one.root+'/clients/import/template',{headers:{Cookie:one.cookie}});check(()=>assert.equal(template.status,200));const templateText=await template.text();check(()=>assert.match(templateText,/Nombre;Apellido;WhatsApp;Email;Notas/));

 // Testimonials require the administrator and explicit publication permission.
 const initiallyEmpty=(await req('/public/testimonials')).data;check(()=>assert.deepEqual(initiallyEmpty,[]));
 await req('/admin/testimonials','GET',undefined,one.cookie,403);await req('/admin/testimonials','GET',undefined,'',401);
 const opinion={business_id:one.b.id,name:'Profesional de prueba',role:'Manicura',quote:'Una opinión real autorizada para una prueba aislada.',published:true};
 await req('/admin/testimonials','POST',opinion,admin,400);
 await req('/admin/testimonials','POST',{...opinion,consent:true},one.cookie,403);
 const testimonial=(await req('/admin/testimonials','POST',{...opinion,consent:true},admin,201)).data.id;
 let opinions=(await req('/public/testimonials')).data;check(()=>assert.equal(opinions.length,1));check(()=>assert.equal(opinions[0].path,'/reservar/'+one.b.slug));for(const key of ['business_id','consent_at','email','owner_id'])check(()=>assert.ok(!(key in opinions[0])));
 await req('/admin/testimonials/'+testimonial,'PUT',{quote:'Una opinión cambiada necesita volver a confirmar autorización.'},admin,400);
 await req('/admin/testimonials/'+testimonial,'PUT',{published:false},admin);opinions=(await req('/public/testimonials')).data;check(()=>assert.equal(opinions.length,0));
 await req('/admin/testimonials/'+testimonial,'PUT',{published:true},admin);
 db.prepare("UPDATE businesses SET status='inactive' WHERE id=?").run(one.b.id);opinions=(await req('/public/testimonials')).data;check(()=>assert.equal(opinions.length,0));
 await req('/admin/testimonials/'+testimonial,'PUT',{published:false},admin);db.prepare("UPDATE businesses SET status='active' WHERE id=?").run(one.b.id);
 await req('/admin/testimonials/'+testimonial,'PUT',{published:true},admin);
 db.prepare('UPDATE users SET email_verified=0 WHERE id=?').run(one.b.owner_id);opinions=(await req('/public/testimonials')).data;check(()=>assert.equal(opinions.length,0));db.prepare('UPDATE users SET email_verified=1 WHERE id=?').run(one.b.owner_id);
 const testimonialBusinesses=(await req('/admin/testimonials/businesses?q=Business','GET',undefined,admin)).data;check(()=>assert.ok(testimonialBusinesses.some(b=>b.id===one.b.id)));check(()=>assert.ok(!JSON.stringify(testimonialBusinesses).includes('@example.test')));

 // Operational milestones are idempotent, administrator-only and are not sent to analytics providers.
 await req('/admin/growth','GET',undefined,one.cookie,403);await req('/admin/growth','GET',undefined,'',401);await req('/admin/growth?days=invalid','GET',undefined,admin,400);
 db.prepare("INSERT INTO bookings(business_id,client_id,date,start_time,end_time,booking_source) VALUES(?,?,'2030-01-01','09:00','09:30','manual')").run(one.b.id,original);
 check(()=>assert.equal(db.prepare("SELECT count(*) n FROM growth_milestones WHERE business_id=? AND stage='first_booking'").get(one.b.id).n,0));
 const date=new Date(Date.now()+7*86400000).toISOString().slice(0,10);db.prepare('UPDATE businesses SET booking_notice_min=0 WHERE id=?').run(one.b.id);
 await req('/public/'+one.b.slug+'/bookings','POST',{serviceIds:[service],date,time:'09:00',clientName:'Online fixture',phone:'0000000000006'});
 check(()=>assert.equal(db.prepare("SELECT count(*) n FROM growth_milestones WHERE business_id=? AND stage='first_booking'").get(one.b.id).n,1));
 const now=new Date().toISOString();
 db.prepare("INSERT INTO platform_subscriptions(id,business_id,plan_slug,plan_name,billing_cycle,amount_cents,provider,status,start_date,created_at,updated_at) VALUES('growth-sub',?,'adara-inicial','Inicial','monthly',990000,'demo','authorized',?,?,?)").run(one.b.id,now,now,now);
 db.prepare("INSERT INTO platform_subscription_payments(id,subscription_id,amount_cents,currency,status,updated_at) VALUES('growth-payment','growth-sub',990000,'ARS','pending',?)").run(now);
 check(()=>assert.equal(db.prepare("SELECT count(*) n FROM growth_milestones WHERE business_id=? AND stage='subscription_paid'").get(one.b.id).n,0));
 db.prepare("UPDATE platform_subscription_payments SET status='approved',review_reason='Needs review' WHERE id='growth-payment'").run();check(()=>assert.equal(db.prepare("SELECT count(*) n FROM growth_milestones WHERE business_id=? AND stage='subscription_paid'").get(one.b.id).n,0));
 db.prepare("UPDATE platform_subscription_payments SET review_reason=NULL WHERE id='growth-payment'").run();db.prepare("UPDATE platform_subscription_payments SET review_reason=NULL WHERE id='growth-payment'").run();
 check(()=>assert.doesNotThrow(()=>db.prepare("INSERT INTO platform_subscription_payments(id,subscription_id,amount_cents,currency,status,updated_at) VALUES('growth-payment','growth-sub',990000,'ARS','approved',?) ON CONFLICT(id) DO UPDATE SET status=excluded.status,updated_at=excluded.updated_at").run(now)));
 check(()=>assert.equal(db.prepare("SELECT count(*) n FROM growth_milestones WHERE business_id=? AND stage='subscription_paid'").get(one.b.id).n,1));
 const report=(await req('/admin/growth?days=30','GET',undefined,admin)).data;check(()=>assert.equal(report.total,3));check(()=>assert.equal(report.rows.find(row=>row.stage==='subscription_paid').count,1));check(()=>assert.equal(report.rows.find(row=>row.stage==='first_booking').count,1));check(()=>assert.ok(!JSON.stringify(report).includes('@example.test')));for(const row of report.rows)check(()=>assert.ok(row.count<=report.total));
 const all=(await req('/admin/growth?days=all','GET',undefined,admin)).data;check(()=>assert.equal(all.total,4));check(()=>assert.equal(all.rows.find(row=>row.stage==='first_booking').count,2));
 const marked=db.prepare('SELECT count(*) n FROM growth_milestones').get().n;await req('/admin/growth?days=all','GET',undefined,admin);check(()=>assert.equal(db.prepare('SELECT count(*) n FROM growth_milestones').get().n,marked));

 // Search engines receive each industry's full content and distinct metadata without executing JavaScript.
 const directory=path.join(temp,'web');fs.mkdirSync(directory);const templateHtml='<!doctype html><html lang="es"><head><title>Adara</title><meta name="description" content="Default" /></head><body><div id="root"></div><script type="module" src="/assets/app.js"></script></body></html>';fs.writeFileSync(path.join(directory,'index.html'),templateHtml);
 const marketing=express();registerMarketingPages(marketing,{distDir:directory,frontendUrl:'https://adara.example.test',enabled:true});marketing.get('/login',(_req,res)=>res.send('Login'));
 marketingServer=marketing.listen(0);await new Promise(resolve=>marketingServer.once('listening',resolve));const origin=`http://127.0.0.1:${marketingServer.address().port}`;
 const titles=new Set();
 for(const industry of industries){
  const response=await fetch(origin+'/para/'+industry.slug),html=await response.text();check(()=>assert.equal(response.status,200));check(()=>assert.ok(html.includes('<h1>'+industry.heading+'</h1>')));check(()=>assert.ok(html.includes(industry.faqs[0].answer)));check(()=>assert.ok(html.includes('rel="canonical" href="https://adara.example.test/para/'+industry.slug+'"')));check(()=>assert.ok(html.includes('application/ld+json')));check(()=>assert.ok(html.includes('/registro?category='+encodeURIComponent(industry.category))));titles.add(html.match(/<title>(.*?)<\/title>/)[1]);
 }
 check(()=>assert.equal(titles.size,3));
 const missing=await fetch(origin+'/para/not-a-category');check(()=>assert.equal(missing.status,404));check(()=>assert.match(missing.headers.get('x-robots-tag'),/noindex/));
 const login=await fetch(origin+'/login');check(()=>assert.match(login.headers.get('x-robots-tag'),/noindex/));
 const sitemap=await fetch(origin+'/sitemap.xml'),xml=await sitemap.text();check(()=>assert.match(sitemap.headers.get('content-type'),/xml/));check(()=>assert.equal((xml.match(/<loc>/g)||[]).length,4));check(()=>assert.ok(!xml.includes('/admin')));
 const robots=await (await fetch(origin+'/robots.txt')).text();check(()=>assert.ok(robots.includes('Sitemap: https://adara.example.test/sitemap.xml')));check(()=>assert.ok(robots.includes('Allow: /api/public/')));
 const escaped=marketingDocument(templateHtml,{origin:'https://adara.example.test',industry:{...industries[0],title:'A <script> & "quoted"'}});check(()=>assert.ok(!escaped.includes('<title>A <script>')));check(()=>assert.ok(escaped.includes('A &lt;script&gt; &amp; &quot;quoted&quot;')));
 console.log(`OK: ${checks} comprobaciones de inicio guiado, importación CSV/Excel, duplicados, aislamiento, hitos de crecimiento, testimonios autorizados y páginas por rubro.`);
}finally{
 if(marketingServer)await new Promise(resolve=>marketingServer.close(resolve));
 await new Promise(resolve=>server.close(resolve));db.close();global.fetch=nativeFetch;process.chdir(cwd);fs.rmSync(temp,{recursive:true,force:true});
}
