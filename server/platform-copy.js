// Only platform metadata is updated. Tenant content and accepted legal versions
// are deliberately outside this migration.
export function neutralPlatformCopy(value){
 let text=String(value);
 for(const [before,after] of [['las clientas','los clientes'],['Las clientas','Los clientes'],['la clienta','el cliente'],['La clienta','El cliente'],['una clienta','un cliente'],['La profesional','El profesional'],['la profesional','el profesional'],['una profesional','un profesional'],['las profesionales','los profesionales'],['negocios de belleza','negocios'],['negocio de belleza','negocio'],['trabajo sola','trabajo por mi cuenta'],['trabajás sola','trabajás por tu cuenta']])text=text.replaceAll(before,after);
 return text.replace(/\bclientas\b/g,'clientes').replace(/\bClientas\b/g,'Clientes').replace(/\bclienta\b/g,'cliente').replace(/\bal profesional\b/g,'al profesional').replace(/\bdel profesional\b/g,'del profesional');
}
export function migratePlatformCopy(db){
 if(db.prepare("SELECT 1 FROM platform_settings WHERE key='unisex_platform_copy'").get())return;
 db.transaction(()=>{
  for(const p of db.prepare('SELECT id,description,features_json FROM plans').all()){
   const description=neutralPlatformCopy(p.description),features=JSON.stringify(JSON.parse(p.features_json).map(neutralPlatformCopy));
   if(description!==p.description||features!==p.features_json)db.prepare('UPDATE plans SET description=?,features_json=? WHERE id=?').run(description,features,p.id);
  }
  for(const faq of db.prepare('SELECT id,question,answer FROM platform_faqs').all()){
   const question=neutralPlatformCopy(faq.question),answer=neutralPlatformCopy(faq.answer);
   if(question!==faq.question||answer!==faq.answer)db.prepare('UPDATE platform_faqs SET question=?,answer=? WHERE id=?').run(question,answer,faq.id);
  }
  db.prepare("INSERT INTO platform_settings(key,value) VALUES('unisex_platform_copy','1')").run();
 })();
}
