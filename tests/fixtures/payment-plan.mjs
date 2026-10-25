// Existing payment scenarios use a custom single-agenda plan with Mercado Pago.
// The official Adara Individual restriction is exercised in booking-design-billing.
export function createPaymentFixturePlan(db){
 const slug='fixture-individual-mp',columns=db.prepare('PRAGMA table_info(plans)').all().map(c=>c.name).filter(name=>name!=='id');
 const select=columns.map(name=>name==='slug'?"'fixture-individual-mp'":name==='name'?"'Fixture individual con Mercado Pago'":name==='mercadopago_enabled'?'1':name==='public_enabled'?'1':`"${name}"`).join(',');
 db.exec(`INSERT OR IGNORE INTO plans(${columns.map(name=>`"${name}"`).join(',')}) SELECT ${select} FROM plans WHERE slug='adara'`);
 return slug;
}
