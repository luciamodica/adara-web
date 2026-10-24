import {db} from './db.js';
import {validDate} from './calendar-periods.js';

const day=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Argentina/Buenos_Aires',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const idsOf=p=>{try{return JSON.parse(p.service_ids_json||'[]')}catch{return []}};
export function publicPromotion(p){
 const ids=idsOf(p),services=ids.map(id=>db.prepare('SELECT id,name,price_cents,duration_min,duration_auto FROM services WHERE id=? AND business_id=? AND active=1').get(id,p.business_id));
 const available=ids.length>0&&services.every(Boolean),base=available?services.reduce((s,x)=>s+x.price_cents,0):null;
 const after=p.pricing_mode==='fixed'?p.price_after_cents:base===null?null:base-Math.round(base*p.discount_percent/100);
 const before=p.price_before_cents??base;
 const percent=before>0&&after!==null?Math.max(0,Math.round((before-after)*100/before)):p.discount_percent;
 return {...p,service_ids:ids,services:services.filter(Boolean),reservable:available&&(p.pricing_mode!=='fixed'||after!==null&&after<=base),price_before_cents:before,price_after_cents:after,display_discount_percent:percent};
}
function validate(b,x,current={}){
 const text=(key,max,fallback='')=>{const value=x[key]??current[key]??fallback;if(typeof value!=='string'||value.length>max)throw new Error('Revisá '+key);return value.trim()};
 const money=(key,column)=>{if(x[key]===undefined)return current[column]??null;if(x[key]===''||x[key]===null)return null;const n=Number(x[key]);if(!Number.isFinite(n)||n<0||!Number.isSafeInteger(Math.round(n*100))||n>100000000)throw new Error('Revisá los precios de la promoción.');return Math.round(n*100)};
 const title=text('title',160);if(!title)throw new Error('Escribí un título');
 const discount=Number(x.discount_percent??current.discount_percent??0);if(!Number.isFinite(discount)||discount<0||discount>100)throw new Error('El porcentaje debe ser entre 0 y 100.');
 const mode=x.pricing_mode??current.pricing_mode??'percent';if(!['percent','fixed'].includes(mode))throw new Error('Elegí porcentaje o precio promocional.');
 const ids=x.service_ids===undefined?idsOf(current):x.service_ids;
 if(!Array.isArray(ids)||ids.length>20||new Set(ids).size!==ids.length||ids.some(id=>!Number.isInteger(id)||id<=0))throw new Error('Revisá los servicios de la promoción.');
 const existing=idsOf(current),services=ids.map(id=>db.prepare('SELECT * FROM services WHERE id=? AND business_id=?').get(id,b.id));if(services.some(s=>!s||!s.active&&!existing.includes(s.id)))throw new Error('Elegí servicios activos de tu negocio.');
 const before=money('price_before','price_before_cents'),after=money('price_after','price_after_cents');
 if(mode==='fixed'&&after===null)throw new Error('Ingresá el precio promocional.');
 if(mode==='fixed'&&before!==null&&after>before)throw new Error('El precio de ahora no puede superar el precio anterior.');
 if(mode==='fixed'&&ids.length&&after>services.reduce((s,x)=>s+x.price_cents,0))throw new Error('El precio promocional no puede superar la suma de los servicios.');
 const dates={};for(const key of ['start_date','end_date']){const value=x[key]===undefined?current[key]:x[key];dates[key]=value||null;if(value&&!validDate(value))throw new Error('Revisá las fechas de la promoción.');}
 if(dates.start_date&&dates.end_date&&dates.start_date>dates.end_date)throw new Error('La fecha hasta debe ser posterior a la fecha desde.');
 for(const key of ['active','show_banner'])if(x[key]!==undefined&&![true,false,0,1].includes(x[key]))throw new Error('Revisá el estado de la promoción.');
 const color=key=>{const v=x[key]??current[key]??(key==='banner_bg'?'#2d2723':'#ffffff');if(!/^#[0-9a-f]{6}$/i.test(v))throw new Error('Elegí un color válido.');return v};
 return {title,description:text('description',5000),discount_percent:discount,image_url:text('image_url',2048),...dates,active:x.active===undefined?(current.active??1):(x.active?1:0),show_banner:x.show_banner===undefined?(current.show_banner??0):(x.show_banner?1:0),banner_text:text('banner_text',300,title),banner_bg:color('banner_bg'),banner_text_color:color('banner_text_color'),service_ids_json:JSON.stringify(ids),pricing_mode:mode,price_before_cents:before,price_after_cents:mode==='fixed'?after:null};
}
export function registerPromotions(app,{auth,own,enforceCountLimit}){
 const base='/api/businesses/:id/promotions';
 app.get(base,auth,(req,res)=>{const b=own(req.user.sub,req.params.id);if(!b)return res.sendStatus(403);res.json(db.prepare('SELECT * FROM promotions WHERE business_id=? ORDER BY id DESC').all(b.id).map(publicPromotion))});
 const save=(req,res,editing)=>{
  const b=own(req.user.sub,req.params.id);if(!b)return res.sendStatus(403);
  const current=editing?db.prepare('SELECT * FROM promotions WHERE id=? AND business_id=?').get(req.params.pid,b.id):{};if(!current)return res.sendStatus(404);
  if(!editing&&!enforceCountLimit(res,b,'promotions','max_promotions'))return;
  try{const data=validate(b,req.body||{},current),keys=Object.keys(data);
   if(editing)db.prepare(`UPDATE promotions SET ${keys.map(k=>k+'=?').join(',')} WHERE id=? AND business_id=?`).run(...Object.values(data),current.id,b.id);
   else {const r=db.prepare(`INSERT INTO promotions(business_id,${keys.join(',')}) VALUES(${['business_id',...keys].map(()=>'?').join(',')})`).run(b.id,...Object.values(data));return res.json({id:Number(r.lastInsertRowid)})}
   res.json({ok:true});
  }catch(e){res.status(400).json({error:e.message})}
 };
 app.post(base,auth,(req,res)=>save(req,res,false));app.put(base+'/:pid',auth,(req,res)=>save(req,res,true));
 app.delete(base+'/:pid',auth,(req,res)=>{const b=own(req.user.sub,req.params.id);if(!b)return res.sendStatus(403);db.prepare('DELETE FROM promotions WHERE id=? AND business_id=?').run(req.params.pid,b.id);res.json({ok:true})});
}
export function resolvePromotion(b,services,id,date=''){
 if(id===undefined||id===null||id==='')return null;
 if(!Number.isInteger(Number(id))||Number(id)<=0)throw new Error('Elegí una promoción válida.');
 const raw=db.prepare('SELECT * FROM promotions WHERE id=? AND business_id=? AND active=1').get(Number(id),b.id);
 if(!raw||!b.show_promotions)throw new Error('La promoción ya no está disponible.');
 const today=day();if(raw.start_date&&raw.start_date>today||raw.end_date&&raw.end_date<today)throw new Error('La promoción no está vigente.');
 if(date&&(raw.start_date&&date<raw.start_date||raw.end_date&&date>raw.end_date))throw new Error('Elegí un turno dentro de la vigencia de la promoción.');
 const p=publicPromotion(raw);if(!p.reservable)throw new Error('Los servicios de la promoción ya no están disponibles.');
 const ids=services.map(s=>s.id);if(ids.length!==p.service_ids.length||p.service_ids.some(id=>!ids.includes(id)))throw new Error('La promoción corresponde únicamente a los servicios indicados.');
 return p;
}
export function applyPromotion(quote,p){
 if(!p)return quote;
 const total=p.price_after_cents*quote.party_size,discount=quote.subtotal_cents-total;
 if(discount<0)throw new Error('El precio de la promoción cambió. Consultá al profesional.');
 // Only one benefit applies: promotion pricing replaces group discounts.
 const items=quote.items.map(i=>({...i,line_discount_cents:0,line_after_group_cents:i.line_subtotal_cents}));
 let remaining=discount;
 items.forEach(item=>{const share=quote.subtotal_cents?Math.floor(discount*item.line_subtotal_cents/quote.subtotal_cents):0;item.line_promotion_discount_cents=share;remaining-=share});
 for(const item of items){const extra=Math.min(remaining,item.line_subtotal_cents-item.line_promotion_discount_cents);item.line_promotion_discount_cents+=extra;remaining-=extra;}

 return {...quote,items,group_discount_cents:0,coupon_discount_cents:0,total_cents:total,promotion_discount_cents:discount,promotion:{id:p.id,title:p.title,price_before_cents:p.price_before_cents*quote.party_size,price_after_cents:total}};
}
