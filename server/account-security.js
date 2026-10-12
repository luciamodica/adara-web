import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import {db} from './db.js';
import {sendPasswordResetEmail,sendPasswordChangedEmail} from './email.js';

const pending=new Set(),ttl=30*60*1000;
const digest=value=>crypto.createHash('sha256').update(value).digest('hex');
const generic={ok:true,message:'Si existe una cuenta con ese email, recibirás un enlace para restablecer tu contraseña. Revisá también spam.'};
const production=()=>process.env.NODE_ENV==='production';
const frontend=()=>process.env.FRONTEND_URL||'http://localhost:5173';
export function minimumPassword(role){return role==='superadmin'?12:8}
export function validateNewPassword(value,role){
 if(typeof value!=='string'||value.length<minimumPassword(role))throw new Error(`La contraseña debe tener al menos ${minimumPassword(role)} caracteres.`);
 if(Buffer.byteLength(value,'utf8')>72)throw new Error('La contraseña es demasiado larga. Elegí una más corta.');
 if(role==='superadmin'&&value==='admin1234')throw new Error('Elegí una contraseña distinta a la de pruebas.');
 return value;
}
function allowed(key,limit,windowMs){
 const hashed=digest(key),now=Date.now();
 return db.transaction(()=>{
  db.prepare('DELETE FROM auth_rate_limits WHERE window_start<?').run(now-60*60*1000);
  const row=db.prepare('SELECT * FROM auth_rate_limits WHERE key=?').get(hashed);
  if(!row||row.window_start<=now-windowMs){db.prepare('INSERT INTO auth_rate_limits(key,count,window_start) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=1,window_start=excluded.window_start').run(hashed,now);return true}
  if(row.count>=limit)return false;
  db.prepare('UPDATE auth_rate_limits SET count=count+1 WHERE key=?').run(hashed);return true;
 })();
}
function background(fn){
 const task=new Promise(resolve=>setImmediate(()=>Promise.resolve().then(fn).catch(()=>console.error('No se pudo completar el email de seguridad.')).finally(resolve)));
 pending.add(task);task.finally(()=>pending.delete(task));
}
export async function drainPasswordEmails(){while(pending.size)await Promise.all([...pending])}
function createReset(user){
 const token=crypto.randomBytes(32).toString('hex'),hash=digest(token),expires=new Date(Date.now()+ttl).toISOString();
 db.prepare('DELETE FROM password_reset_tokens WHERE expires_at<?').run(new Date().toISOString());
 db.prepare('INSERT INTO password_reset_tokens(token_hash,user_id,session_version,expires_at) VALUES(?,?,?,?)').run(hash,user.id,user.session_version,expires);
 return {token,hash,url:`${frontend()}/restablecer-contrasena?token=${token}`};
}
function validReset(token){
 if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))return null;
 return db.prepare(`SELECT u.*,r.token_hash FROM password_reset_tokens r JOIN users u ON u.id=r.user_id WHERE r.token_hash=? AND r.used_at IS NULL AND r.expires_at>? AND r.session_version=u.session_version`).get(digest(token),new Date().toISOString());
}
function invalidateResetLinks(userId){db.prepare('UPDATE password_reset_tokens SET used_at=? WHERE user_id=? AND used_at IS NULL').run(new Date().toISOString(),userId)}
function notice(user){background(()=>sendPasswordChangedEmail({email:user.email,name:user.name,supportUrl:frontend()+'/#soporte'}))}
export function registerAccountSecurity(app,{auth}){
 app.use(['/restablecer-contrasena','/api/auth/forgot-password','/api/auth/reset-password','/api/auth/change-password'],(_req,res,next)=>{res.set('Cache-Control','no-store');res.set('Referrer-Policy','no-referrer');next()});
 app.post('/api/auth/forgot-password',(req,res)=>{
  const email=typeof req.body?.email==='string'?req.body.email.trim().toLowerCase():'';
  if(email.length>320||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return res.status(400).json({error:'Ingresá un email válido.'});
  if(production()&&!process.env.RESEND_API_KEY)return res.status(503).json({error:'El envío de correos no está disponible. Contactá a soporte.'});
  const ipOk=allowed('forgot-ip:'+req.ip,200,60*1000),emailOk=allowed('forgot-email:'+email,3,15*60*1000);
  if(!ipOk||!emailOk)return res.json(generic);
  if(!production()&&!process.env.RESEND_API_KEY){
   const user=db.prepare('SELECT * FROM users WHERE email=?').get(email),reset=user?createReset(user):null;
   return res.json({...generic,devResetUrl:reset?'/restablecer-contrasena?token='+reset.token:null});
  }
  // Always answer before looking up or contacting the mail provider.
  res.json(generic);
  background(async()=>{
   const user=db.prepare('SELECT * FROM users WHERE email=?').get(email);if(!user)return;
   const reset=createReset(user);
   try{await sendPasswordResetEmail({email:user.email,name:user.name,resetUrl:reset.url})}
   catch{db.prepare('UPDATE password_reset_tokens SET used_at=? WHERE token_hash=?').run(new Date().toISOString(),reset.hash);throw new Error('Email de recuperación no enviado')}
  });
 });
 app.post('/api/auth/reset-password/validate',(req,res)=>{
  if(!allowed('reset-check-ip:'+req.ip,100,60*1000))return res.status(429).json({error:'Esperá un minuto antes de volver a intentar.'});
  const user=validReset(req.body?.token);if(!user)return res.status(400).json({error:'El enlace venció o ya fue utilizado. Pedí uno nuevo.'});
  res.json({ok:true,min_length:minimumPassword(user.role)});
 });
 app.post('/api/auth/reset-password',async(req,res)=>{
  if(!allowed('reset-ip:'+req.ip,50,60*1000))return res.status(429).json({error:'Esperá un minuto antes de volver a intentar.'});
  const token=req.body?.token,user=validReset(token);if(!user)return res.status(400).json({error:'El enlace venció o ya fue utilizado. Pedí uno nuevo.'});
  try{
   const password=validateNewPassword(req.body?.password,user.role);if(password!==req.body?.confirmPassword)throw new Error('Las contraseñas no coinciden.');
   const hash=await bcrypt.hash(password,12);
   db.transaction(()=>{
    const current=validReset(token);if(!current)throw new Error('El enlace venció o ya fue utilizado. Pedí uno nuevo.');
    db.prepare('UPDATE users SET password_hash=?,session_version=session_version+1 WHERE id=?').run(hash,current.id);invalidateResetLinks(current.id);
   })();
   notice(user);res.clearCookie('session',{httpOnly:true,sameSite:'lax',secure:production()}).json({ok:true,message:'Contraseña restablecida. Ingresá con tu nueva contraseña.'});
  }catch(e){res.status(400).json({error:e.message})}
 });
 app.post('/api/auth/change-password',auth,async(req,res)=>{
  if(!allowed('change-user:'+req.user.sub,6,15*60*1000))return res.status(429).json({error:'Realizaste varios intentos. Esperá 15 minutos antes de volver a intentar.'});
  const user=db.prepare('SELECT * FROM users WHERE id=?').get(Number(req.user.sub)),current=req.body?.currentPassword;
  if(typeof current!=='string'||current.length>4000||!await bcrypt.compare(current,user.password_hash))return res.status(400).json({error:'La contraseña actual no es correcta.'});
  try{
   const password=validateNewPassword(req.body?.password,user.role);if(password!==req.body?.confirmPassword)throw new Error('Las contraseñas no coinciden.');
   if(await bcrypt.compare(password,user.password_hash))throw new Error('Elegí una contraseña distinta a la actual.');
   const hash=await bcrypt.hash(password,12);
   db.transaction(()=>{const r=db.prepare('UPDATE users SET password_hash=?,session_version=session_version+1 WHERE id=? AND session_version=?').run(hash,user.id,user.session_version);if(!r.changes)throw new Error('Tu sesión cambió. Volvé a ingresar.');invalidateResetLinks(user.id)})();
   notice(user);res.clearCookie('session',{httpOnly:true,sameSite:'lax',secure:production()}).json({ok:true,message:'Contraseña cambiada. Volvé a ingresar con tu nueva contraseña.'});
  }catch(e){res.status(400).json({error:e.message})}
 });
}
