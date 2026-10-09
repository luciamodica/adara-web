import crypto from 'node:crypto';
import {db} from './db.js';
import {legalDraft} from './legal-texts.js';

db.exec(`CREATE TABLE IF NOT EXISTS platform_legal_draft(id INTEGER PRIMARY KEY CHECK(id=1),content_json TEXT NOT NULL,revision TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS platform_legal_publications(version INTEGER PRIMARY KEY AUTOINCREMENT,content_json TEXT NOT NULL,content_hash TEXT NOT NULL,published_at TEXT NOT NULL,published_by INTEGER NOT NULL REFERENCES users(id));
CREATE TABLE IF NOT EXISTS platform_legal_acceptances(id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL REFERENCES users(id),business_id INTEGER NOT NULL REFERENCES businesses(id),purpose TEXT NOT NULL CHECK(purpose IN ('registration','subscription')),reference TEXT,version INTEGER NOT NULL REFERENCES platform_legal_publications(version),content_hash TEXT NOT NULL,accepted_at TEXT NOT NULL);`);
db.prepare('INSERT OR IGNORE INTO platform_legal_draft(id,content_json,revision) VALUES(1,?,?)').run(JSON.stringify(legalDraft),crypto.randomUUID());
const latest=()=>db.prepare('SELECT * FROM platform_legal_publications ORDER BY version DESC LIMIT 1').get();
export function publicLegal(){const publication=latest();return publication?{published:true,version:publication.version,published_at:publication.published_at,...JSON.parse(publication.content_json)}:{published:false};}
export function legalConsent(body){
 const publication=latest();if(!publication)return null;
 if(body?.accept_legal!==true)throw Object.assign(Error('Leé y aceptá los términos y la política de privacidad para continuar.'),{status:400});
 if(body.legal_version!==publication.version)throw Object.assign(Error('Los textos legales se actualizaron. Recargá la página y revisalos antes de continuar.'),{status:409});
 return {version:publication.version,hash:publication.content_hash};
}
export function recordLegalAcceptance(consent,user,business,purpose,reference=null){if(consent)db.prepare('INSERT INTO platform_legal_acceptances(user_id,business_id,purpose,reference,version,content_hash,accepted_at) VALUES(?,?,?,?,?,?,?)').run(user,business,purpose,reference,consent.version,consent.hash,new Date().toISOString());}
const draftState=()=>{const draft=db.prepare('SELECT * FROM platform_legal_draft WHERE id=1').get(),published=latest();return {draft:JSON.parse(draft.content_json),revision:draft.revision,publication:published?{version:published.version,published_at:published.published_at}:null};};
const clean=(value,max)=>{if(typeof value!=='string'||value.length>max)throw Error('Revisá la longitud y el formato de los campos.');return value.trim();};
function validateDraft(value){
 const profile={},documents={};
 for(const key of ['name','email','street','city','province','country','tax_id'])profile[key]=clean(value?.profile?.[key]??'',key==='email'?254:250);
 if(!profile.name||!profile.street||!profile.email||!/^\S+@\S+\.\S+$/.test(profile.email))throw Error('Completá titular, dirección y un email válido.');
 if(profile.tax_id&&!/^\d{11}$/.test(profile.tax_id.replace(/[-\s]/g,'')))throw Error('El CUIT debe tener 11 dígitos, o quedar vacío si todavía no está definido.');
 for(const key of ['terms','privacy','subscription']){const title=clean(value?.documents?.[key]?.title,160),body=clean(value?.documents?.[key]?.body,30000);if(!title||body.length<100)throw Error('Los tres documentos necesitan un título y contenido.');documents[key]={title,body};}
 return {profile,documents};
}
function renderDraft(draft){
 if(!draft.profile.city||!draft.profile.province||!draft.profile.country)throw Error('Completá ciudad, provincia y país antes de publicar.');
 const p=draft.profile,tokens={titular:p.name,email:p.email,domicilio:[p.street,p.city,p.province,p.country].join(', '),datos_fiscales:p.tax_id?'CUIT: '+p.tax_id+'.':''};
 const documents=Object.fromEntries(Object.entries(draft.documents).map(([key,doc])=>[key,{title:doc.title,body:doc.body.replace(/\{\{([^{}]+)\}\}/g,(_match,token)=>{if(!Object.hasOwn(tokens,token))throw Error('Hay un marcador desconocido en los textos: '+token);return tokens[token];})}]));
 return {profile:p,documents};
}
export function registerPlatformLegal(app,{auth,superOnly}){
 app.get('/api/public/legal',(_req,res)=>res.set('Cache-Control','no-store').json(publicLegal()));
 app.get('/api/admin/legal',auth,superOnly,(_req,res)=>res.json(draftState()));
 app.put('/api/admin/legal',auth,superOnly,(req,res)=>{try{
  const current=draftState();if(req.body?.expected_revision!==current.revision)return res.status(409).json({error:'El borrador cambió en otra sesión. Recargá antes de guardar.'});
  const content=validateDraft(req.body.draft);db.prepare('UPDATE platform_legal_draft SET content_json=?,revision=? WHERE id=1').run(JSON.stringify(content),crypto.randomUUID());res.json(draftState());
 }catch(e){res.status(400).json({error:e.message})}});
 app.post('/api/admin/legal/publish',auth,superOnly,(req,res)=>{try{
  const current=draftState();if(req.body?.expected_revision!==current.revision)return res.status(409).json({error:'El borrador cambió. Recargá y revisá los textos antes de publicar.'});
  if(req.body.reviewed!==true)return res.status(400).json({error:'Confirmá que revisaste los textos y los datos que serán públicos.'});
  const content=JSON.stringify(renderDraft(validateDraft(current.draft))),hash=crypto.createHash('sha256').update(content).digest('hex');
  if(latest()?.content_hash===hash)return res.json(draftState());
  db.prepare('INSERT INTO platform_legal_publications(content_json,content_hash,published_at,published_by) VALUES(?,?,?,?)').run(content,hash,new Date().toISOString(),req.user.sub);res.json(draftState());
 }catch(e){res.status(400).json({error:e.message})}});
 app.get('/api/admin/legal/acceptances',auth,superOnly,(_req,res)=>res.json(db.prepare('SELECT a.id,a.purpose,a.version,a.content_hash,a.accepted_at,u.name,u.email,b.name business_name FROM platform_legal_acceptances a JOIN users u ON u.id=a.user_id JOIN businesses b ON b.id=a.business_id ORDER BY a.id DESC LIMIT 100').all()));
}
