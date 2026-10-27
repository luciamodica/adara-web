import {db,getSetting} from './db.js';
db.exec(`CREATE TABLE IF NOT EXISTS platform_faqs(id INTEGER PRIMARY KEY,question TEXT NOT NULL,answer TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1,display_order INTEGER NOT NULL DEFAULT 0)`);
const defaults=[
 ['¿Necesito saber diseñar o programar?','No. Elegís una plantilla, cargás tus imágenes y servicios, y personalizás los colores y secciones desde tu panel.'],
 ['¿Puedo usar Adara si trabajo por mi cuenta?','Sí. El plan Individual está pensado para un profesional con una agenda. Si trabajás con otras personas, el plan Equipo permite administrar agendas independientes.'],
 ['¿Cómo reservan mis clientes?','Compartís el enlace de tu página por redes, WhatsApp o tu QR. El cliente elige servicios, fecha y horario, completa sus datos y paga según tu configuración.'],
 ['¿Qué sucede si no pagan la seña?','El turno queda pendiente durante el plazo que definís en tu panel. Al vencer, se cancela y el horario se libera. Con transferencia, el profesional verifica el ingreso antes de confirmar.'],
 ['¿Puedo modificar horarios o cargar vacaciones?','Sí. Podés bloquear un día o un horario, y guardar períodos desde una fecha hasta otra para vacaciones o cambios temporales.'],
 ['¿Cuánto dura la prueba gratuita?','Tenés {dias_prueba} días para conocer Adara Web. Podés crear tu cuenta sin cargar una tarjeta y probar tu página, tu agenda y las herramientas del panel.']
];
if(!db.prepare("SELECT 1 FROM platform_settings WHERE key='home_faq_seeded'").get())db.transaction(()=>{if(!db.prepare('SELECT 1 FROM platform_faqs LIMIT 1').get())defaults.forEach(([q,a],i)=>db.prepare('INSERT INTO platform_faqs(question,answer,display_order) VALUES(?,?,?)').run(q,a,i));db.prepare("INSERT INTO platform_settings(key,value) VALUES('home_faq_seeded','1')").run()})();
export function registerPlatformFaqs(app,{auth,superOnly}){
 app.get('/api/public/faqs',(_req,res)=>res.json(db.prepare('SELECT id,question,answer FROM platform_faqs WHERE active=1 ORDER BY display_order,id').all().map(x=>({...x,answer:x.answer.replaceAll('{dias_prueba}',getSetting('trial_days','30'))}))));
 app.get('/api/admin/home-faqs',auth,superOnly,(_req,res)=>res.json(db.prepare('SELECT * FROM platform_faqs ORDER BY display_order,id').all()));
 const save=(req,res)=>{const current=req.params.id?db.prepare('SELECT * FROM platform_faqs WHERE id=?').get(req.params.id):null;if(req.params.id&&!current)return res.status(404).json({error:'Pregunta no encontrada'});const x=req.body||{},q=String(x.question??current?.question??'').trim(),a=String(x.answer??current?.answer??'').trim(),order=Number(x.display_order??current?.display_order??db.prepare('SELECT COALESCE(MAX(display_order),-1)+1 n FROM platform_faqs').get().n);if(!q||!a||q.length>200||a.length>4000||!Number.isInteger(order)||order<0||order>10000)return res.status(400).json({error:'Completá pregunta y respuesta. Revisá el orden y la longitud de los textos.'});const active=x.active===undefined?current?.active??1:x.active?1:0;if(current){db.prepare('UPDATE platform_faqs SET question=?,answer=?,active=?,display_order=? WHERE id=?').run(q,a,active,order,current.id);res.json({ok:true,id:current.id})}else{const result=db.prepare('INSERT INTO platform_faqs(question,answer,active,display_order) VALUES(?,?,?,?)').run(q,a,active,order);res.json({ok:true,id:Number(result.lastInsertRowid)})}};
 app.post('/api/admin/home-faqs',auth,superOnly,save);
 app.put('/api/admin/home-faqs/:id',auth,superOnly,save);
 app.delete('/api/admin/home-faqs/:id',auth,superOnly,(req,res)=>{const r=db.prepare('DELETE FROM platform_faqs WHERE id=?').run(req.params.id);if(!r.changes)return res.status(404).json({error:'Pregunta no encontrada'});res.json({ok:true})});
}
