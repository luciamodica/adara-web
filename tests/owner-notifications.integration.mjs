import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import express from 'express';
import {registerOwnerNotifications} from '../server/owner-notifications.js';
const db=new Database(':memory:');
db.pragma('foreign_keys=ON');
db.exec(`CREATE TABLE users(id INTEGER PRIMARY KEY);INSERT INTO users VALUES(1),(2);
CREATE TABLE businesses(id INTEGER PRIMARY KEY,owner_id INTEGER);INSERT INTO businesses VALUES(1,1),(2,2);
CREATE TABLE clients(id INTEGER PRIMARY KEY,name TEXT);INSERT INTO clients VALUES(1,'José'),(2,'Ana');
CREATE TABLE bookings(id INTEGER PRIMARY KEY,business_id INTEGER,client_id INTEGER,date TEXT,start_time TEXT,status TEXT,booking_source TEXT DEFAULT 'online');
CREATE TABLE client_reviews(id INTEGER PRIMARY KEY,business_id INTEGER,name TEXT,rating INTEGER);
CREATE TABLE waitlist(id INTEGER PRIMARY KEY,business_id INTEGER,name TEXT,date TEXT,status TEXT);
CREATE TABLE booking_transfer_receipts(booking_id INTEGER PRIMARY KEY,uploaded_at TEXT);
INSERT INTO bookings VALUES(1,1,1,'2026-11-24','12:30','confirmed','online');`);
const app=express();app.use(express.json());
const auth=(req,res,next)=>{if(!req.headers['x-user'])return res.sendStatus(401);req.user={sub:Number(req.headers['x-user'])};next()};
const own=(uid,id)=>db.prepare('SELECT * FROM businesses WHERE id=? AND owner_id=?').get(Number(id),uid);
registerOwnerNotifications(app,{db,auth,own});registerOwnerNotifications({get(){},post(){}},{db,auth,own});
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const base=`http://127.0.0.1:${server.address().port}/api/businesses`;
const request=async(path='',{user=1,method='GET',body}={})=>{const r=await fetch(base+path,{method,headers:{...(user?{'x-user':String(user)}:{}),'content-type':'application/json'},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json().catch(()=>null)}};
let checks=0;const check=(actual,expected)=>{assert.deepEqual(actual,expected);checks++};
try{
 check((await request('/1/notifications',{user:0})).status,401);
 check((await request('/2/notifications')).status,403);
 check((await request('/1/notifications')).data.unread,0); // No historical flood.
 db.prepare("INSERT INTO bookings VALUES(2,1,1,'2026-11-25','12:30','pending_payment','online')").run();
 db.prepare("INSERT INTO bookings VALUES(3,1,1,'2026-11-25','14:00','confirmed','manual')").run();
 check((await request('/1/notifications')).data.unread,1);
 db.prepare("UPDATE bookings SET status='confirmed' WHERE id=2").run();
 db.prepare("UPDATE bookings SET status='confirmed' WHERE id=2").run();
 check((await request('/1/notifications')).data.unread,2); // Same status doesn't duplicate.
 db.prepare("UPDATE bookings SET status='cancelled' WHERE id=2").run();
 db.prepare("INSERT INTO client_reviews VALUES(1,1,'José',5)").run();
 db.prepare("INSERT INTO waitlist VALUES(1,1,'José','2026-11-26','waiting')").run();
 db.prepare("UPDATE waitlist SET status='notified' WHERE id=1").run();
 db.prepare("INSERT INTO booking_transfer_receipts VALUES(1,'2026-11-23T12:00:00Z')").run();
 db.prepare("UPDATE booking_transfer_receipts SET uploaded_at='2026-11-23T13:00:00Z'").run();
 db.prepare("INSERT INTO client_reviews VALUES(2,2,'Ana',4)").run();
 let feed=(await request('/1/notifications')).data;
 check(feed.unread,8);check(feed.items.length,8);check(feed.items.every(n=>n.business_id===1),true);
 check(feed.items.filter(n=>n.view==='waitlist').length,2);
 check(feed.items.some(n=>n.title==='Nueva reseña para revisar'&&n.section==='Reseñas de clientes'),true);
 check(feed.items.some(n=>n.title==='Comprobante recibido'&&n.section==='Pagos'),true);
 check((await request('/2/notifications',{user:2})).data.unread,1);
 const other=(await request('/2/notifications',{user:2})).data.items[0];
 await request('/1/notifications/read',{method:'POST',body:{id:other.id}});
 check((await request('/2/notifications',{user:2})).data.unread,1); // Cannot read another business's event.
 await request('/1/notifications/read',{method:'POST',body:{id:feed.items[0].id}});
 check((await request('/1/notifications')).data.unread,7);
 check((await request('/1/notifications')).data.items[0].is_read,1);
 await request('/1/notifications/read',{method:'POST',body:{through:feed.items[0].id}});
 check((await request('/1/notifications')).data.unread,0);
 db.prepare("INSERT INTO client_reviews VALUES(3,1,'Nueva',5)").run();
 check((await request('/1/notifications')).data.unread,1); // Read-all doesn't consume events arriving later.
 check((await request('/2/notifications/read',{method:'POST',body:{through:1000}})).status,403);
 check((await request('/1/notifications/read',{method:'POST',body:{id:-1}})).status,400);
 db.exec('BEGIN');db.prepare("INSERT INTO client_reviews VALUES(4,1,'Rollback',5)").run();db.exec('ROLLBACK');
 check((await request('/1/notifications')).data.unread,1); // Notification shares the event transaction.
 console.log(`OK: ${checks} comprobaciones de notificaciones, eventos, lectura persistente, aislamiento y transacciones.`);
}finally{await new Promise(r=>server.close(r));db.close()}
