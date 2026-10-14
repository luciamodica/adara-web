import crypto from 'node:crypto';
import {isIP} from 'node:net';
import {db} from './db.js';
import {sendSupportEmail} from './email.js';

db.exec(`CREATE TABLE IF NOT EXISTS platform_support_messages(id INTEGER PRIMARY KEY,name TEXT NOT NULL,email TEXT NOT NULL,message TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'new',email_status TEXT NOT NULL DEFAULT 'pending',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS support_rate_events(id INTEGER PRIMARY KEY,ip_key TEXT NOT NULL,email_key TEXT NOT NULL,created_ms INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_support_rate_time ON support_rate_events(created_ms);`);
const hash=s=>crypto.createHash('sha256').update((process.env.JWT_SECRET||'local-support')+s).digest('hex');
export function registerPlatformSupport(app,{auth,superOnly}){
 app.post('/api/public/support',async(req,res)=>{
  res.set('Cache-Control','no-store');const x=req.body||{};
  const origin=req.get('origin');if(origin&&origin!==new URL(process.env.FRONTEND_URL||'http://localhost:5173').origin)return res.status(403).json({error:'Enviá la consulta desde la página de Adara.'});
  if(x.website)return res.json({ok:true,message:'Gracias por tu consulta.'});
  const name=typeof x.name==='string'?x.name.trim():'',email=typeof x.email==='string'?x.email.trim().toLowerCase():'',message=typeof x.message==='string'?x.message.trim():'';
  if(!name||name.length>120||!email||email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||message.length<10||message.length>3000)return res.status(400).json({error:'Completá nombre, email válido y un mensaje de entre 10 y 3000 caracteres.'});
  if(x.acceptPrivacy!==true)return res.status(400).json({error:'Aceptá la política de privacidad para enviar la consulta.'});
  const forwarded=(req.get('x-forwarded-for')||'').split(',').at(-1)?.trim(),ip=process.env.NODE_ENV==='production'&&isIP(forwarded||'')?forwarded:req.ip||'unknown',ipKey=hash('ip:'+ip),emailKey=hash('email:'+email),now=Date.now();
  const accepted=db.transaction(()=>{
   db.prepare('DELETE FROM support_rate_events WHERE created_ms<?').run(now-86400000);
   const ipCount=db.prepare('SELECT count(*) n FROM support_rate_events WHERE ip_key=? AND created_ms>?').get(ipKey,now-900000).n,emailCount=db.prepare('SELECT count(*) n FROM support_rate_events WHERE email_key=? AND created_ms>?').get(emailKey,now-3600000).n;
   if(ipCount>=10||emailCount>=3)return false;
   db.prepare('INSERT INTO support_rate_events(ip_key,email_key,created_ms) VALUES(?,?,?)').run(ipKey,emailKey,now);
   return Number(db.prepare('INSERT INTO platform_support_messages(name,email,message) VALUES(?,?,?)').run(name,email,message).lastInsertRowid);
  }).immediate();
  if(!accepted)return res.status(429).json({error:'Ya recibimos varias consultas. Esperá unos minutos o contactanos por email.'});
  // The inbox is the authoritative delivery. Email failure never discards a message.
  let delivery='unconfigured';try{const result=await sendSupportEmail({name,email,message,id:accepted});delivery=result.sent?'sent':'unconfigured'}catch{delivery='failed'}
  db.prepare('UPDATE platform_support_messages SET email_status=? WHERE id=?').run(delivery,accepted);
  res.status(201).json({ok:true,message:'Recibimos tu consulta. Te responderemos al correo que dejaste.'});
 });
 app.get('/api/admin/support',auth,superOnly,(req,res)=>{
  res.set('Cache-Control','no-store');const before=req.query.before?Number(req.query.before):Number.MAX_SAFE_INTEGER;if(!Number.isSafeInteger(before)||before<1)return res.status(400).json({error:'Página inválida.'});
  const rows=db.prepare('SELECT * FROM platform_support_messages WHERE id<? ORDER BY id DESC LIMIT 51').all(before);res.json({messages:rows.slice(0,50),next_before:rows.length>50?rows[49].id:null});
 });
 app.patch('/api/admin/support/:mid',auth,superOnly,(req,res)=>{
  if(!Number.isSafeInteger(Number(req.params.mid))||Number(req.params.mid)<1||!['new','read','resolved'].includes(req.body?.status))return res.status(400).json({error:'Revisá el estado de la consulta.'});
  const result=db.prepare('UPDATE platform_support_messages SET status=? WHERE id=?').run(req.body.status,Number(req.params.mid));if(!result.changes)return res.status(404).json({error:'Consulta no encontrada.'});res.json({ok:true});
 });
}
