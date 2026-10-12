import {db,getSetting} from './db.js';
export function homeContact(){return {home_whatsapp_enabled:getSetting('home_whatsapp_enabled','0')==='1',home_whatsapp_phone:getSetting('home_whatsapp_phone',''),home_whatsapp_message:getSetting('home_whatsapp_message','Hola, quiero conocer Adara Web.')}}
export function savePlatformSettings(x){
 const current=homeContact(),days=Number(x.trial_days??getSetting('trial_days','15')),grace=Number(x.billing_grace_days??getSetting('billing_grace_days','3'));
 if(![7,15].includes(days))throw new Error('La prueba gratuita debe durar 7 o 15 días');
 if(!Number.isInteger(grace)||grace<0||grace>14)throw new Error('El período de gracia debe ser de 0 a 14 días');
 if(x.home_whatsapp_enabled!==undefined&&typeof x.home_whatsapp_enabled!=='boolean')throw new Error('Revisá la opción de WhatsApp.');
 const enabled=x.home_whatsapp_enabled??current.home_whatsapp_enabled;
 const raw=x.home_whatsapp_phone??current.home_whatsapp_phone;
 if(typeof raw!=='string'||raw.length>35||!/^[+\d\s().-]*$/.test(raw))throw new Error('Ingresá un número de WhatsApp válido.');
 const phone=raw.replace(/\D/g,'');if((enabled&&!phone)||(phone&&!/^[1-9]\d{6,14}$/.test(phone)))throw new Error('Ingresá WhatsApp con código de país, sin 0 ni 15.');
 const message=x.home_whatsapp_message??current.home_whatsapp_message;if(typeof message!=='string'||message.length>500)throw new Error('El mensaje de WhatsApp debe tener hasta 500 caracteres.');
 const data={trial_days:days,billing_grace_days:grace,home_whatsapp_enabled:enabled?1:0,home_whatsapp_phone:phone,home_whatsapp_message:message.trim()};
 db.transaction(()=>{const put=db.prepare('INSERT INTO platform_settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');for(const [key,value] of Object.entries(data))put.run(key,String(value))})();
}
