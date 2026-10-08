import {db} from './db.js';
import {normalizePhone} from './features-db.js';
export function privatePaymentClient(b,x){
 if(!x.clientAccess)return null;
 const c=db.prepare('SELECT * FROM clients WHERE business_id=? AND payment_access_token=? AND waive_advance=1').get(b.id,String(x.clientAccess));
 if(!c||c.blocked)throw new Error('El enlace privado no está disponible. Contactá a la profesional.');
 if(normalizePhone(x.phone)!==c.phone_normalized||(c.email&&String(x.email||'').trim().toLowerCase()!==String(c.email).toLowerCase()))throw new Error('Usá los datos de la clienta autorizada para este enlace privado.');
 return c;
}
