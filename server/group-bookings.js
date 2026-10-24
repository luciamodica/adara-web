import {db} from './db.js';
import {normalizePhone} from './features-db.js';
import {validTime,validDate} from './calendar-periods.js';

const minutes=time=>Number(time.slice(0,2))*60+Number(time.slice(3));
const clock=value=>`${String(Math.floor(value/60)).padStart(2,'0')}:${String(value%60).padStart(2,'0')}`;
export const participantsFor=id=>db.prepare('SELECT name,phone,email,start_time,end_time,position FROM booking_participants WHERE booking_id=? ORDER BY position').all(id);
export function groupSelection(b,x,quote,services){
 if(!x.individualSlots&&!x.participants)return null; // Compatibility with existing contiguous reservations.
 if(!Array.isArray(x.participants)||x.participants.length!==quote.party_size||quote.party_size<2)throw new Error('Completá los datos y el horario de cada persona.');
 if(x.repeatDays)throw new Error('Los turnos grupales se reservan para una sola fecha.');
 if(!validDate(x.date))throw new Error('Elegí una fecha válida para todo el grupo.');
 const duration=services.reduce((sum,s)=>sum+Number(s.duration_min),0);
 const people=x.participants.map((p,index)=>{
  if(!p||typeof p!=='object')throw new Error('Revisá los datos de cada persona.');
  const name=String(p.name||'').trim(),phone=String(p.phone||'').trim(),email=String(p.email||'').trim().toLowerCase(),time=String(p.time||'');
  if(!name||name.length>100||!normalizePhone(phone)||phone.length>40)throw new Error(`Completá nombre y WhatsApp de la persona ${index+1}.`);
  if((b.require_email&&!email)||(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))||email.length>254)throw new Error(`Revisá el email de la persona ${index+1}.`);
  if(p.date!==undefined&&p.date!==x.date)throw new Error('Todas las personas deben reservar para la misma fecha.');
  if(!validTime(time)||minutes(time)+duration>1440)throw new Error(`Elegí un horario válido para la persona ${index+1}.`);
  return {name,phone,email,time,end:clock(minutes(time)+duration),position:index};
 });
 const ordered=[...people].sort((a,z)=>a.time.localeCompare(z.time));
 if(ordered.some((p,i)=>i>0&&p.time<ordered[i-1].end))throw new Error('Los horarios del grupo no pueden superponerse.');
 return {people,start:ordered[0].time,end:ordered.at(-1).end};
}
export function validateGroupAvailability(group,args,availabilityFor){
 for(const person of group.people){
  const duration=minutes(person.end)-minutes(person.time);
  const services=args.services.map((s,i)=>({...s,duration_min:i===0?duration:0}));
  if(!availabilityFor({...args,services,partySize:1}).includes(person.time))throw new Error('Uno de los horarios ya no está disponible. Revisá todos los turnos del grupo.');
 }
}
export function storeParticipants(id,b,group,findClient){
 if(!group)return;
 for(const person of group.people){
  let client=findClient(b,person.email,person.phone);
  if(!client){const row=db.prepare('INSERT INTO clients(business_id,name,email,phone,phone_normalized) VALUES(?,?,?,?,?)').run(b.id,person.name,person.email||null,person.phone,normalizePhone(person.phone));client={id:row.lastInsertRowid}}
  db.prepare('INSERT INTO booking_participants(booking_id,client_id,position,name,phone,email,start_time,end_time) VALUES(?,?,?,?,?,?,?,?)').run(id,client.id,person.position,person.name,person.phone,person.email||null,person.time,person.end);
 }
}
export function shiftedGroup(booking,date,time){
 const people=participantsFor(booking.id);if(!people.length)return null;
 const shift=minutes(time)-minutes(booking.start_time);
 if(!validDate(date)||!validTime(time)||people.some(p=>minutes(p.start_time)+shift<0||minutes(p.end_time)+shift>1440))throw new Error('Los horarios del grupo deben quedar dentro del mismo día.');
 return {people:people.map(p=>({...p,time:clock(minutes(p.start_time)+shift),end:clock(minutes(p.end_time)+shift)})),start:time,end:clock(Math.max(...people.map(p=>minutes(p.end_time)+shift)))};
}
export function moveParticipants(id,group){if(group)for(const p of group.people)db.prepare('UPDATE booking_participants SET start_time=?,end_time=? WHERE booking_id=? AND position=?').run(p.time,p.end,id,p.position)}
