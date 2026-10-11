import {db} from './db.js';

export const validDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(String(value))&&!Number.isNaN(Date.parse(value))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;
export const validTime=value=>/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(value));
export const listPeriods=businessId=>db.prepare('SELECT p.*,s.name staff_name FROM calendar_periods p LEFT JOIN staff s ON s.id=p.staff_id WHERE p.business_id=? ORDER BY p.date_from,p.id').all(businessId);
export function savePeriod(businessId,input,periodId=0){
 const from=String(input.date_from??input.date??''),to=String(input.date_to??input.date??from),staffId=input.staff_id?Number(input.staff_id):null,closed=Boolean(input.closed);
 if(!validDate(from)||!validDate(to))throw new Error('Elegí fechas válidas desde y hasta');
 if(to<from)throw new Error('La fecha hasta debe ser igual o posterior a la fecha desde');
 const days=Math.round((Date.parse(to+'T12:00:00Z')-Date.parse(from+'T12:00:00Z'))/86400000)+1;
 if(days>366)throw new Error('Cada período puede abarcar hasta 366 días');
 if(staffId!==null&&(!Number.isInteger(staffId)||staffId<1||!db.prepare('SELECT 1 FROM staff WHERE id=? AND business_id=?').get(staffId,businessId)))throw new Error('Elegí un profesional de tu negocio');
 if(!closed&&(!validTime(input.start_time)||!validTime(input.end_time)||input.start_time>=input.end_time))throw new Error('El horario de cierre debe ser posterior al de apertura');
 if(periodId!==0&&(!Number.isInteger(periodId)||periodId<1))throw new Error('Período inválido');
 const current=periodId?db.prepare('SELECT * FROM calendar_periods WHERE id=? AND business_id=?').get(periodId,businessId):null;
 if(periodId&&!current)throw new Error('No encontramos ese período');
 const conflict=db.prepare('SELECT id FROM calendar_periods WHERE business_id=? AND COALESCE(staff_id,0)=? AND date_from<=? AND date_to>=? AND id!=? LIMIT 1').get(businessId,staffId||0,to,from,periodId);
 if(conflict)throw new Error('Ya hay un período para esa agenda en alguna de esas fechas. Editalo o elegí otro rango.');
 const start=closed?null:input.start_time,end=closed?null:input.end_time,reason=String(input.reason||'').trim().slice(0,250);
 const id=db.transaction(()=>{
  let id=periodId;
  if(current){db.prepare('DELETE FROM calendar_exceptions WHERE business_id=? AND period_id=?').run(businessId,id);db.prepare('UPDATE calendar_periods SET date_from=?,date_to=?,staff_id=?,closed=?,start_time=?,end_time=?,reason=? WHERE id=? AND business_id=?').run(from,to,staffId,closed?1:0,start,end,reason,id,businessId)}
  else id=Number(db.prepare('INSERT INTO calendar_periods(business_id,date_from,date_to,staff_id,closed,start_time,end_time,reason) VALUES(?,?,?,?,?,?,?,?)').run(businessId,from,to,staffId,closed?1:0,start,end,reason).lastInsertRowid);
  const insert=db.prepare('INSERT INTO calendar_exceptions(business_id,date,staff_id,closed,start_time,end_time,reason,period_id) VALUES(?,?,?,?,?,?,?,?)');
  for(let n=0;n<days;n++){const day=new Date(from+'T12:00:00Z');day.setUTCDate(day.getUTCDate()+n);insert.run(businessId,day.toISOString().slice(0,10),staffId,closed?1:0,start,end,reason,id)}
  return id;
 })();
 const affected=db.prepare("SELECT count(*) n FROM bookings WHERE business_id=? AND date>=? AND date<=? AND (status='confirmed' OR (status='pending_payment' AND hold_expires_at>?)) AND (?=0 OR staff_id=?) AND (?=1 OR start_time<? OR end_time>?)").get(businessId,from,to,new Date().toISOString(),staffId||0,staffId||0,closed?1:0,start,end).n;
 return {ok:true,id,days,affected_bookings:affected};
}
export function removePeriod(businessId,id){
 if(!db.prepare('SELECT 1 FROM calendar_periods WHERE id=? AND business_id=?').get(id,businessId))throw new Error('No encontramos ese período');
 db.transaction(()=>{db.prepare('DELETE FROM calendar_exceptions WHERE business_id=? AND period_id=?').run(businessId,id);db.prepare('DELETE FROM calendar_periods WHERE business_id=? AND id=?').run(businessId,id)})();
 return {ok:true};
}
