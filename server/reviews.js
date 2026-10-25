import crypto from 'node:crypto';
import {db} from './db.js';
export function registerReviews(app,{auth,own}){
 app.get('/api/public/:slug/reviews',(req,res)=>{
  const b=db.prepare("SELECT id FROM businesses WHERE slug=? AND status='active'").get(req.params.slug);if(!b)return res.sendStatus(404);
  const reviews=db.prepare("SELECT id,name,rating,body,created_at FROM client_reviews WHERE business_id=? AND status='published' ORDER BY id DESC LIMIT 100").all(b.id);
  const stats=db.prepare("SELECT count(*) count,avg(rating) average FROM client_reviews WHERE business_id=? AND status='published'").get(b.id);
  res.json({reviews,...stats});
 });
 app.post('/api/public/:slug/reviews',(req,res)=>{
  const b=db.prepare("SELECT id FROM businesses WHERE slug=? AND status='active'").get(req.params.slug);if(!b)return res.sendStatus(404);
  const x=req.body||{},name=typeof x.name==='string'?x.name.trim():'',body=typeof x.body==='string'?x.body.trim():'',rating=Number(x.rating);
  if(!name||name.length>80||body.length<5||body.length>2000||!Number.isInteger(rating)||rating<1||rating>5||x.consent!==true)return res.status(400).json({error:'Completá nombre, calificación y comentario, y autorizá su publicación.'});
  const now=Date.now(),key=crypto.createHash('sha256').update(`${b.id}:${req.ip}:${String(req.headers['user-agent']||'')}:${name.toLowerCase()}`).digest('hex');
  const result=db.transaction(()=>{
   db.prepare('DELETE FROM review_submit_limits WHERE expires_at<?').run(now);
   const prior=db.prepare('SELECT count FROM review_submit_limits WHERE key=?').get(key);if(prior?.count>=5)return false;
   db.prepare('INSERT INTO review_submit_limits(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1').run(key,now+3600000);
   db.prepare('INSERT INTO client_reviews(business_id,name,rating,body) VALUES(?,?,?,?)').run(b.id,name,rating,body);return true;
  })();
  if(!result)return res.status(429).json({error:'Ya recibimos varias reseñas. Intentá nuevamente más tarde.'});
  res.status(201).json({ok:true,message:'¡Gracias por tu reseña! Valoramos que compartas tu experiencia.'});
 });
 app.get('/api/businesses/:id/reviews',auth,(req,res)=>{const b=own(req.user.sub,req.params.id);if(!b)return res.sendStatus(403);res.json(db.prepare('SELECT * FROM client_reviews WHERE business_id=? ORDER BY id DESC').all(b.id))});
 app.patch('/api/businesses/:id/reviews/:rid',auth,(req,res)=>{
  const b=own(req.user.sub,req.params.id);if(!b)return res.sendStatus(403);
  if(!['pending','published','hidden'].includes(req.body?.status))return res.status(400).json({error:'Estado de reseña inválido.'});
  const changed=db.prepare('UPDATE client_reviews SET status=? WHERE id=? AND business_id=?').run(req.body.status,req.params.rid,b.id);if(!changed.changes)return res.sendStatus(404);res.json({ok:true});
 });
}
