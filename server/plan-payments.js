import {db,getSetting} from './db.js';

if(!db.prepare('PRAGMA table_info(plans)').all().some(c=>c.name==='mercadopago_enabled'))db.exec('ALTER TABLE plans ADD COLUMN mercadopago_enabled INTEGER NOT NULL DEFAULT 1');
db.prepare("UPDATE plans SET mercadopago_enabled=CASE WHEN slug='adara-inicial' THEN 0 ELSE 1 END WHERE slug IN ('adara-inicial','adara','adara-equipo')").run();
export const planHasMercadoPago=plan=>plan?.slug!=='adara-inicial'&&Number(plan?.mercadopago_enabled??1)===1;
export function mercadoPagoAllowed(b){return planHasMercadoPago(db.prepare('SELECT * FROM plans WHERE slug=?').get(b.plan_slug));}
export function paymentFeatures(plan,features=[]){
 const allowed=planHasMercadoPago(plan),result=features.map(text=>String(text).replace(/Mercado Pago propio/gi,'Mercado Pago integrado')).filter(text=>allowed||!/mercado\s*pago/i.test(text));
 if(!result.some(text=>/transferencia/i.test(text)))result.push('Cobros por transferencia');
 if(allowed&&!result.some(text=>/mercado\s*pago/i.test(text)))result.push('Mercado Pago integrado');
 return result;
}
if(!getSetting('plan_payment_rules_v3'))db.transaction(()=>{
 for(const plan of db.prepare('SELECT * FROM plans').all()){
  let features=[];try{features=JSON.parse(plan.features_json)}catch{}
  db.prepare('UPDATE plans SET features_json=? WHERE id=?').run(JSON.stringify(paymentFeatures(plan,features)),plan.id);
 }
 db.prepare("INSERT INTO platform_settings(key,value) VALUES('plan_payment_rules_v3','1')").run();
})();
