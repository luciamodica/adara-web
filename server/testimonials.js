import {db} from './db.js';

db.exec(`CREATE TABLE IF NOT EXISTS platform_testimonials(
 id INTEGER PRIMARY KEY, business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
 name TEXT NOT NULL, role TEXT NOT NULL DEFAULT '', quote TEXT NOT NULL,
 consent_at TEXT, published INTEGER NOT NULL DEFAULT 0, display_order INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);`);
const text=(x,max)=>typeof x==='string'&&x.trim().length<=max?x.trim():'';

export function registerTestimonials(app,{auth,superOnly}){
 app.get('/api/public/testimonials',(_req,res)=>{
  const rows=db.prepare(`SELECT t.id,t.name,t.role,t.quote,b.name business_name,b.slug,b.category,b.logo_image FROM platform_testimonials t JOIN businesses b ON b.id=t.business_id JOIN users u ON u.id=b.owner_id WHERE t.published=1 AND t.consent_at IS NOT NULL AND b.status='active' AND u.email_verified=1 ORDER BY t.display_order,t.id LIMIT 12`).all();
  res.json(rows.map(({slug,...row})=>({...row,path:'/reservar/'+encodeURIComponent(slug)})));
 });
 app.get('/api/admin/testimonials/businesses',auth,superOnly,(req,res)=>{
  const q=typeof req.query.q==='string'?req.query.q.trim().slice(0,100):'';
  res.set('Cache-Control','no-store').json(db.prepare(`SELECT b.id,b.name,b.slug,u.name owner_name FROM businesses b JOIN users u ON u.id=b.owner_id WHERE b.status='active' AND u.email_verified=1 AND (b.name LIKE ? OR u.name LIKE ?) ORDER BY b.name LIMIT 100`).all('%'+q+'%','%'+q+'%'));
 });
 app.get('/api/admin/testimonials',auth,superOnly,(_req,res)=>res.set('Cache-Control','no-store').json(db.prepare('SELECT t.*,b.name business_name FROM platform_testimonials t JOIN businesses b ON b.id=t.business_id ORDER BY t.display_order,t.id DESC').all()));
 const save=(req,res)=>{
  const current=req.params.id?db.prepare('SELECT * FROM platform_testimonials WHERE id=?').get(req.params.id):null;
  if(req.params.id&&!current)return res.status(404).json({error:'Testimonio no encontrado.'});
  const x=req.body||{},id=Number(x.business_id??current?.business_id),name=text(x.name??current?.name,120),role=text(x.role??current?.role??'',120),quote=text(x.quote??current?.quote,1000),order=Number(x.display_order??current?.display_order??0);
  const business=Number.isSafeInteger(id)?db.prepare('SELECT b.status,u.email_verified FROM businesses b JOIN users u ON u.id=b.owner_id WHERE b.id=?').get(id):null;
  if(!business||name.length<2||quote.length<20||String(x.role??current?.role??'').length>120||!Number.isInteger(order)||order<0||order>10000)return res.status(400).json({error:'Elegí un negocio y completá nombre, opinión (20 a 1000 caracteres) y orden válido.'});
  if(x.published!==undefined&&typeof x.published!=='boolean')return res.status(400).json({error:'Revisá la visibilidad.'});
  if(x.consent!==undefined&&typeof x.consent!=='boolean')return res.status(400).json({error:'Revisá la autorización.'});
  const published=x.published??Boolean(current?.published),changed=Boolean(current&&(name!==current.name||quote!==current.quote||id!==current.business_id||role!==current.role));
  if(published&&(business.status!=='active'||!business.email_verified))return res.status(400).json({error:'Sólo se publican testimonios de negocios activos y con email verificado.'});
  let consent=x.consent===true?(current?.consent_at||new Date().toISOString()):x.consent===false||changed?null:current?.consent_at||null;
  if(published&&!consent)return res.status(400).json({error:'Confirmá que tenés autorización para publicar esta opinión y los datos de su autora o autor.'});
  if(current){db.prepare('UPDATE platform_testimonials SET business_id=?,name=?,role=?,quote=?,consent_at=?,published=?,display_order=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(id,name,role,quote,consent,published?1:0,order,current.id);return res.json({ok:true,id:current.id});}
  const result=db.prepare('INSERT INTO platform_testimonials(business_id,name,role,quote,consent_at,published,display_order) VALUES(?,?,?,?,?,?,?)').run(id,name,role,quote,consent,published?1:0,order);
  res.status(201).json({ok:true,id:Number(result.lastInsertRowid)});
 };
 app.post('/api/admin/testimonials',auth,superOnly,save);
 app.put('/api/admin/testimonials/:id',auth,superOnly,save);
}
