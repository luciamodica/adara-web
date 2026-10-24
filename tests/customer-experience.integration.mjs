import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const cwd=process.cwd(),temp=fs.mkdtempSync(path.join(os.tmpdir(),'adara-experience-'));
process.chdir(temp);Object.assign(process.env,{NODE_ENV:'test',DATA_DIR:temp+'/data',UPLOADS_DIR:temp+'/uploads',DISABLE_FEATURE_WORKER:'true',DEMO_PAYMENTS:'true',RESEND_API_KEY:''});
const originalFetch=global.fetch;global.fetch=(url,options)=>{if(String(url).startsWith('http://127.0.0.1:'))return originalFetch(url,options);throw Error('Unexpected external call')};
const {app,featureWorker}=await import('../server/index.js'),{db}=await import('../server/db.js');
const server=app.listen(0);await new Promise(resolve=>server.once('listening',resolve));const base=`http://127.0.0.1:${server.address().port}/api`;let checks=0;
const check=fn=>{fn();checks++};
async function req(route,method='GET',body,cookie='',expected=200){const response=await fetch(base+route,{method,headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)}),data=await response.json().catch(()=>({}));check(()=>assert.equal(response.status,expected,JSON.stringify({route,data})));return {data,cookie:response.headers.get('set-cookie')?.split(';')[0]};}
async function owner(n,plan='adara'){await req('/auth/register','POST',{name:'Fixture '+n,businessName:'Fixture '+n,email:`fixture${n}@example.test`,password:'Fixture-only-password42!',plan});const token=db.prepare('SELECT verify_token FROM users WHERE email=?').get(`fixture${n}@example.test`).verify_token,verified=await req('/auth/verify?token='+token),b=(await req('/me','GET',undefined,verified.cookie)).data.businesses[0];return {b,cookie:verified.cookie,root:'/businesses/'+b.id,pub:'/public/'+b.slug};}
const date=new Date(Date.now()+7*86400000).toISOString().slice(0,10),nextDate=new Date(Date.now()+8*86400000).toISOString().slice(0,10);
try{
 const initial=(await req('/public/plans')).data.find(p=>p.slug==='adara-inicial');check(()=>assert.equal(initial.monthly_price_cents,990000));check(()=>assert.equal(initial.annual_price_cents,9900000));check(()=>assert.equal(initial.basic_only,1));
 const one=await owner(1),two=await owner(2),basic=await owner(3,'adara-inicial');
 const schedule=Array.from({length:7},(_,weekday)=>({weekday,active:true,start_time:'09:00',end_time:'18:00'}));
 await req(one.root+'/schedule','PUT',{schedule,slot_interval_min:30},one.cookie);db.prepare("UPDATE businesses SET payment_mode='none',booking_notice_min=0,cancellation_hours=0 WHERE id=?").run(one.b.id);
 const automatic=(await req(one.root+'/services','POST',{name:'Auto',price:1000,duration_auto:true},one.cookie)).data.id;
 const manual=(await req(one.root+'/services','POST',{name:'Fijo',price:1000,duration:60},one.cookie)).data.id;
 check(()=>assert.equal(db.prepare('SELECT duration_min FROM services WHERE id=?').get(automatic).duration_min,30));
 await req(one.root+'/schedule','PUT',{schedule,slot_interval_min:15},one.cookie);
 check(()=>assert.equal(db.prepare('SELECT duration_min FROM services WHERE id=?').get(automatic).duration_min,15));check(()=>assert.equal(db.prepare('SELECT duration_min FROM services WHERE id=?').get(manual).duration_min,60));
 await req(one.root+'/services/'+automatic,'PUT',{name:'Grupo',price:1000,duration:30,duration_auto:false,group_discount_enabled:true,group_min_people:2,group_discount_percent:10},one.cookie);
 const participants=[['Ana','09:00'],['Bea','11:00'],['Cami','14:30']].map(([name,time],index)=>({name,time,phone:'549223555000'+index,email:`person${index}@example.test`}));
 const input={serviceIds:[automatic],partySize:3,individualSlots:true,date,participants};
 for(const bad of [{participants:participants.slice(0,2)},{participants:participants.map((p,i)=>i===1?{...p,date:nextDate}:p)},{participants:participants.map((p,i)=>i===1?{...p,time:'09:15'}:p)},{participants:participants.map((p,i)=>i===1?{...p,phone:''}:p)},{participants:undefined},{repeatDays:7}])await req(one.pub+'/bookings','POST',{...input,...bad},'',400);
 check(()=>assert.equal(db.prepare('SELECT count(*) n FROM bookings').get().n,0));
 const booking=(await req(one.pub+'/bookings','POST',input)).data.booking;
 check(()=>assert.equal(booking.total_cents,270000));check(()=>assert.equal(booking.participants.length,3));check(()=>assert.equal(booking.start_time,'09:00'));check(()=>assert.equal(booking.end_time,'15:00'));
 const slots=async()=> (await req(one.pub+`/availability?date=${date}&serviceIds=${automatic}`)).data.slots;
 let available=await slots();for(const slot of ['09:00','11:00','14:30'])check(()=>assert.ok(!available.includes(slot)));for(const slot of ['10:00','12:00','15:00'])check(()=>assert.ok(available.includes(slot)));
 const ownerRows=(await req(one.root+'/bookings','GET',undefined,one.cookie)).data;check(()=>assert.equal(ownerRows[0].participants.length,3));
 check(()=>assert.equal((db.prepare("SELECT count(*) n FROM booking_participants WHERE booking_id=?").get(booking.id)).n,3));
 const dashboard=(await req(one.root+'/dashboard','GET',undefined,one.cookie)).data;check(()=>assert.equal(dashboard.stats.upcoming,3));
 const clients=(await req(one.root+'/clients','GET',undefined,one.cookie)).data;check(()=>assert.equal(clients.length,3));for(const client of clients)check(()=>assert.equal(client.booking_count,1));
 const second=await req(one.pub+'/bookings','POST',{serviceIds:[automatic],date,time:'10:00',clientName:'En el hueco',phone:'5492236660000'});check(()=>assert.equal(second.data.booking.start_time,'10:00'));
 await req(one.pub+'/bookings','POST',{...input,participants:participants.map((p,i)=>({...p,phone:'549223777000'+i}))},'',409);
 const token=booking.manage_token;
 await req('/public/manage-booking/'+token+'/reschedule','POST',{date,time:'10:00'},'',409);
 check(()=>assert.equal(db.prepare('SELECT start_time FROM booking_participants WHERE booking_id=? AND position=0').get(booking.id).start_time,'09:00'));
 await req('/public/manage-booking/'+token+'/reschedule','POST',{date,time:'09:30'});
 check(()=>assert.deepEqual(db.prepare('SELECT start_time FROM booking_participants WHERE booking_id=? ORDER BY position').all(booking.id).map(p=>p.start_time),['09:30','11:30','15:00']));
 await req(one.root+'/bookings/'+booking.id,'PATCH',{date:nextDate,start_time:'09:00'},one.cookie);
 const managed=(await req('/public/manage-booking/'+token)).data;check(()=>assert.equal(managed.date,nextDate));check(()=>assert.equal(managed.participants.length,3));
 await req(one.root+'/bookings/'+booking.id,'PATCH',{status:'completed'},one.cookie);check(()=>assert.equal(db.prepare('SELECT end_time FROM bookings WHERE id=?').get(booking.id).end_time,'15:00'));
 const series=(await req(one.root+'/tools/bookings/'+booking.id+'/recur','POST',{interval_days:7,count:1},one.cookie)).data.bookings;check(()=>assert.equal(series[0].participants.length,3));check(()=>assert.deepEqual(series[0].participants.map(p=>p.start_time),['09:00','11:00','14:30']));
 await req(one.root+'/bookings/'+booking.id,'PATCH',{status:'cancelled'},one.cookie);
 // A single shared payment holds and releases each member's slot together.
 await req(one.root+'/payment-settings','PUT',{payment_mode:'deposit',deposit_type:'percent',deposit_value:50},one.cookie);
 const paidPeople=participants.slice(0,2).map((p,i)=>({...p,time:i?'17:00':'16:00'}));
 const pending=(await req(one.pub+'/bookings','POST',{...input,partySize:2,participants:paidPeople})).data.booking;
 check(()=>assert.equal(pending.status,'pending_payment'));check(()=>assert.equal(pending.amount_due_cents,90000));
 db.prepare('UPDATE bookings SET hold_expires_at=? WHERE id=?').run(new Date(Date.now()-1000).toISOString(),pending.id);available=await slots();check(()=>assert.ok(available.includes('16:00')&&available.includes('17:00')));
 const pending2=(await req(one.pub+'/bookings','POST',{...input,partySize:2,participants:paidPeople})).data.booking;
 await req(one.pub+`/bookings/${pending2.id}/demo-approve`,'POST',{token:pending2.manage_token});check(()=>assert.equal(db.prepare('SELECT status FROM bookings WHERE id=?').get(pending2.id).status,'confirmed'));available=await slots();check(()=>assert.ok(!available.includes('16:00')&&!available.includes('17:00')));
 // Participant restrictions and professional calendars also apply to groups.
 db.prepare('UPDATE clients SET blocked=1 WHERE business_id=? AND phone=?').run(one.b.id,participants[2].phone);
 await req(one.pub+'/bookings','POST',{...input,date:nextDate},'',400);
 db.prepare('UPDATE clients SET blocked=0 WHERE business_id=?').run(one.b.id);
 const team=await owner(4,'adara-equipo');await req(team.root+'/schedule','PUT',{schedule,slot_interval_min:30},team.cookie);db.prepare("UPDATE businesses SET payment_mode='none',booking_notice_min=0 WHERE id=?").run(team.b.id);
 const teamService=(await req(team.root+'/services','POST',{name:'Equipo',price:1000,duration:30},team.cookie)).data.id;
 const staffA=(await req(team.root+'/staff','POST',{name:'Profesional A',service_ids:[teamService]},team.cookie)).data.id,staffB=(await req(team.root+'/staff','POST',{name:'Profesional B',service_ids:[teamService]},team.cookie)).data.id;
 await req(team.pub+'/bookings','POST',{...input,partySize:2,serviceIds:[teamService],staffId:staffA,participants:participants.slice(0,2)});
 const slotsB=(await req(team.pub+`/availability?date=${date}&serviceIds=${teamService}&staffId=${staffB}`)).data.slots;check(()=>assert.ok(slotsB.includes('09:00')&&slotsB.includes('11:00')));
 const unauthorized=await req(one.pub+`/bookings/${pending2.id}/status?token=incorrect`,'GET',undefined,'',404);check(()=>assert.ok(!('participants' in unauthorized.data)));
 // Reseñas are private until their own professional approves them.
 const review={name:'Cliente de prueba',rating:5,body:'Muy buena atención.',consent:true};
 for(const bad of [{rating:0},{rating:6},{rating:2.5},{name:''},{body:'x'},{consent:false}])await req(one.pub+'/reviews','POST',{...review,...bad},'',400);
 await req(one.pub+'/reviews','POST',review,'',201);let publicReviews=(await req(one.pub+'/reviews')).data;check(()=>assert.equal(publicReviews.count,0));
 const reviews=(await req(one.root+'/reviews','GET',undefined,one.cookie)).data,id=reviews[0].id;check(()=>assert.equal(reviews[0].status,'pending'));
 await req(one.root+'/reviews/'+id,'PATCH',{status:'published'},two.cookie,403);await req(two.root+'/reviews/'+id,'PATCH',{status:'published'},two.cookie,404);await req(one.root+'/reviews/'+id,'PATCH',{status:'published'},one.cookie);
 publicReviews=(await req(one.pub+'/reviews')).data;check(()=>assert.equal(publicReviews.count,1));check(()=>assert.equal(publicReviews.average,5));check(()=>assert.equal(publicReviews.reviews[0].name,review.name));check(()=>assert.ok(!('status' in publicReviews.reviews[0])));
 await req(one.root+'/reviews/'+id,'PATCH',{status:'hidden'},one.cookie);publicReviews=(await req(one.pub+'/reviews')).data;check(()=>assert.equal(publicReviews.count,0));
 for(let i=0;i<4;i++)await req(one.pub+'/reviews','POST',review,'',201);await req(one.pub+'/reviews','POST',review,'',429);
 // Initial has an enforced feature set and an actual ten-service limit.
 for(const endpoint of ['promotions','posts','coupons','tools'])await req(basic.root+'/'+endpoint,'GET',undefined,basic.cookie,403);
 for(let i=0;i<10;i++)await req(basic.root+'/services','POST',{name:'Básico '+i,price:1,duration_auto:true},basic.cookie);
 await req(basic.root+'/services','POST',{name:'Once',price:1},basic.cookie,403);
 await req(basic.pub+'/quote','POST',{serviceIds:[db.prepare('SELECT id FROM services WHERE business_id=? LIMIT 1').get(basic.b.id).id],couponCode:'ANY'},'',400);
 db.prepare("INSERT INTO notification_jobs(business_id,kind,channel,dedupe_key,payload_json) VALUES(?,'reminder','email','initial-job-fixture','{}')").run(basic.b.id);await featureWorker.processJobs();check(()=>assert.equal(db.prepare("SELECT status FROM notification_jobs WHERE dedupe_key='initial-job-fixture'").get().status,'cancelled'));
 const savedPrice=initial.monthly_price_cents+100;db.prepare("UPDATE plans SET monthly_price_cents=? WHERE slug='adara-inicial'").run(savedPrice);
 const migrated=await import('../server/db.js?experience-idempotency');check(()=>assert.equal(migrated.db.prepare("SELECT count(*) n FROM plans WHERE slug='adara-inicial'").get().n,1));check(()=>assert.equal(migrated.db.prepare("SELECT monthly_price_cents FROM plans WHERE slug='adara-inicial'").get().monthly_price_cents,savedPrice));migrated.db.close();
 console.log(`OK: ${checks} comprobaciones de plan Inicial, duración automática, grupos, horarios separados, colisiones, pagos y reseñas moderadas.`);
}finally{await new Promise(resolve=>server.close(resolve));db.close();global.fetch=originalFetch;process.chdir(cwd);fs.rmSync(temp,{recursive:true,force:true})}
