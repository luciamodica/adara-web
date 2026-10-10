import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const initial=process.cwd(),temp=fs.mkdtempSync(path.join(os.tmpdir(),'adara-galleries-'));
process.chdir(temp);Object.assign(process.env,{NODE_ENV:'test',DISABLE_FEATURE_WORKER:'true',DATA_DIR:path.join(temp,'data'),UPLOADS_DIR:path.join(temp,'data','uploads'),DEMO_PAYMENTS:'true',RESEND_API_KEY:''});
const {app}=await import('../server/index.js'),{db}=await import('../server/db.js');
const server=app.listen(0);await new Promise(r=>server.once('listening',r));const base=`http://127.0.0.1:${server.address().port}/api`;let checks=0;
const check=fn=>{fn();checks++};
async function request(route,method='GET',body,cookie='',expected=200){const r=await fetch(base+route,{method,headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)});const data=await r.json().catch(()=>({}));check(()=>assert.equal(r.status,expected,JSON.stringify({route,data})));return {data,cookie:r.headers.get('set-cookie')?.split(';')[0]};}
async function owner(n){const {data}=await request('/auth/register','POST',{name:'Profesional '+n,businessName:'Estudio '+n,email:`gallery${n}@example.test`,password:'Fixture-password-42!',plan:'adara'});const verified=await request('/auth/verify?token='+new URL('http://localhost'+data.devVerifyUrl).searchParams.get('token'));return {cookie:verified.cookie,b:(await request('/me','GET',undefined,verified.cookie)).data.businesses[0]};}
try{
 const first=await owner(1),other=await owner(2),root=`/businesses/${first.b.id}`,images=['/uploads/a.png','/uploads/b.png','/uploads/c.png'];
 const legacy=(await request(root+'/services','POST',{name:'Servicio anterior',price:12000,duration:60,image_url:images[0]},first.cookie)).data;
 check(()=>assert.deepEqual(db.prepare('SELECT images_json FROM services WHERE id=?').get(legacy.id).images_json,JSON.stringify([images[0]])));
 db.prepare("UPDATE services SET images_json='[]' WHERE id=?").run(legacy.id);
 db.prepare("UPDATE businesses SET hero_image=?,hero_images_json='[]' WHERE id=?").run(images[0],first.b.id);
 let page=(await request(root+'/page-settings','GET',undefined,first.cookie)).data;
 check(()=>assert.deepEqual(page.business.hero_images,[images[0]]));check(()=>assert.equal(page.business.show_category,0));
 let list=(await request(root+'/services','GET',undefined,first.cookie)).data;check(()=>assert.deepEqual(list[0].images,[images[0]]));
 await request(root+'/page-settings','PUT',{...page.business,hero_images:images,show_category:true,category_label:'Tu estudio de belleza',show_promotions:0,show_posts:0},first.cookie);
 page=(await request(root+'/page-settings','GET',undefined,first.cookie)).data;check(()=>assert.deepEqual(page.business.hero_images,images));check(()=>assert.equal(page.business.hero_image,images[0]));check(()=>assert.equal(page.business.category_label,'Tu estudio de belleza'));check(()=>assert.equal(page.business.show_category,1));check(()=>assert.equal(page.business.show_promotions,0));check(()=>assert.equal(page.business.show_posts,0));
 let pub=(await request('/public/'+first.b.slug)).data;check(()=>assert.deepEqual(pub.business.hero_images,images));check(()=>assert.equal(pub.business.category_label,'Tu estudio de belleza'));check(()=>assert.equal(pub.business.show_category,1));
 const newService=(await request(root+'/services','POST',{name:'Manicura',description:'Servicio con galería',price:15000,duration:45,images},first.cookie)).data;
 const sid=newService.id;
 list=(await request(root+'/services','GET',undefined,first.cookie)).data;let svc=list.find(x=>x.id===sid);check(()=>assert.deepEqual(svc.images,images));check(()=>assert.equal(svc.image_url,images[0]));
 await request(root+`/services/${sid}`,'PUT',{...svc,price:svc.price_cents/100,duration:svc.duration_min,images:[images[2],images[0]]},first.cookie);
 pub=(await request('/public/'+first.b.slug)).data;check(()=>assert.deepEqual(pub.services.find(x=>x.id===sid).images,[images[2],images[0]]));check(()=>assert.equal(pub.services.find(x=>x.id===sid).image_url,images[2]));
 const before=db.prepare('SELECT * FROM businesses WHERE id=?').get(first.b.id);
 for(const invalid of [null,'no-array',Array(9).fill(images[0]),['javascript:alert(1)'],['data:text/html,hello'],['//evil.example/a.png'],[5],['https://example.test/a b.png']]){
  await request(root+'/page-settings','PUT',{...page.business,hero_title:'Must not change',hero_images:invalid},first.cookie,400);
  check(()=>assert.equal(db.prepare('SELECT hero_title FROM businesses WHERE id=?').get(first.b.id).hero_title,before.hero_title));
  await request(root+'/services','POST',{name:'Invalid',images:invalid},first.cookie,400);
  await request(root+`/services/${sid}`,'PUT',{name:'Must not change',images:invalid},first.cookie,400);
 }
 check(()=>assert.equal(db.prepare('SELECT name FROM services WHERE id=?').get(sid).name,'Manicura'));
 await request(root+'/page-settings','PUT',{...page.business,category_label:'x'.repeat(101)},first.cookie,400);
 await request(root+'/page-settings','PUT',{...page.business,category_label:[]},first.cookie,400);
 await request(root+'/page-settings','PUT',{...page.business,hero_images:[],show_category:false,category_label:''},first.cookie);
 page=(await request(root+'/page-settings','GET',undefined,first.cookie)).data;check(()=>assert.deepEqual(page.business.hero_images,[]));check(()=>assert.equal(page.business.hero_image,''));check(()=>assert.equal(page.business.show_category,0));
 await request(root+`/services/${sid}`,'PUT',{name:'Manicura',price:15000,duration:45,images:[]},first.cookie);svc=(await request(root+'/services','GET',undefined,first.cookie)).data.find(x=>x.id===sid);check(()=>assert.deepEqual(svc.images,[]));check(()=>assert.equal(svc.image_url,''));
 await request(root+'/page-settings','PUT',{...page.business,hero_images:images},other.cookie,403);
 await request(root+'/services','GET',undefined,other.cookie,403);await request(root+`/services/${sid}`,'PUT',{name:'Other owner',images},other.cookie,403);
 await request(`/businesses/${other.b.id}/services/${sid}`,'PUT',{name:'Other owner',images},other.cookie,404);
 await request(root+'/page-settings','PUT',{hero_images:images},'',401);
 await request(root+'/services','POST',{name:'Anonymous',images},'',401);
 const second=(await request(`/businesses/${other.b.id}/page-settings`,'GET',undefined,other.cookie)).data;
 check(()=>assert.deepEqual(second.business.hero_images,[]));check(()=>assert.equal(second.business.show_category,0));
 // A legacy editor can replace the cover, while omission preserves the new gallery.
 await request(root+'/page-settings','PUT',{...page.business,hero_images:images},first.cookie);
 const withoutGallery={...page.business};delete withoutGallery.hero_images;delete withoutGallery.hero_image;
 await request(root+'/page-settings','PUT',withoutGallery,first.cookie);check(()=>assert.deepEqual(JSON.parse(db.prepare('SELECT hero_images_json FROM businesses WHERE id=?').get(first.b.id).hero_images_json),images));
 await request(root+'/page-settings','PUT',{...withoutGallery,hero_image:images[2]},first.cookie);check(()=>assert.deepEqual(JSON.parse(db.prepare('SELECT hero_images_json FROM businesses WHERE id=?').get(first.b.id).hero_images_json),[images[2]]));
 await import('../server/features-db.js?gallery-migration-again');check(()=>assert.equal(db.prepare('SELECT hero_image FROM businesses WHERE id=?').get(first.b.id).hero_image,images[2]));
 console.log(`OK: ${checks} comprobaciones de galerías, orden, imágenes anteriores, portada, categorías, límites, rechazo atómico y aislamiento.`);
}finally{await new Promise(r=>server.close(r));db.close();process.chdir(initial);fs.rmSync(temp,{recursive:true,force:true});}
