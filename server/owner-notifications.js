export function registerOwnerNotifications(app,{db,auth,own}){
 db.exec(`
 CREATE TABLE IF NOT EXISTS panel_notifications(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  title TEXT NOT NULL, detail TEXT NOT NULL DEFAULT '', section TEXT NOT NULL,
  view TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
 );
 CREATE INDEX IF NOT EXISTS panel_notifications_business ON panel_notifications(business_id,id DESC);
 CREATE TABLE IF NOT EXISTS panel_notification_reads(
  notification_id INTEGER NOT NULL REFERENCES panel_notifications(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY(notification_id,user_id)
 );
 CREATE TRIGGER IF NOT EXISTS panel_new_booking AFTER INSERT ON bookings WHEN NEW.booking_source!='manual' BEGIN
  INSERT INTO panel_notifications(business_id,title,detail,section) VALUES(NEW.business_id,'Nueva reserva',(SELECT name FROM clients WHERE id=NEW.client_id)||' · '||NEW.date||' · '||NEW.start_time,'Turnos');
 END;
 CREATE TRIGGER IF NOT EXISTS panel_booking_status AFTER UPDATE OF status ON bookings WHEN OLD.status!=NEW.status AND NEW.status IN ('confirmed','cancelled') BEGIN
  INSERT INTO panel_notifications(business_id,title,detail,section) VALUES(NEW.business_id,CASE NEW.status WHEN 'confirmed' THEN 'Turno confirmado' ELSE 'Turno cancelado' END,(SELECT name FROM clients WHERE id=NEW.client_id)||' · '||NEW.date||' · '||NEW.start_time,'Turnos');
 END;
 CREATE TRIGGER IF NOT EXISTS panel_new_review AFTER INSERT ON client_reviews BEGIN
  INSERT INTO panel_notifications(business_id,title,detail,section) VALUES(NEW.business_id,'Nueva reseña para revisar',NEW.name||' · '||NEW.rating||' estrellas','Reseñas de clientes');
 END;
 CREATE TRIGGER IF NOT EXISTS panel_new_waitlist AFTER INSERT ON waitlist BEGIN
  INSERT INTO panel_notifications(business_id,title,detail,section,view) VALUES(NEW.business_id,'Nuevo cliente en espera',NEW.name||' · '||NEW.date,'Turnos','waitlist');
 END;
 CREATE TRIGGER IF NOT EXISTS panel_waitlist_available AFTER UPDATE OF status ON waitlist WHEN OLD.status!=NEW.status AND NEW.status='notified' BEGIN
  INSERT INTO panel_notifications(business_id,title,detail,section,view) VALUES(NEW.business_id,'Hay un lugar para un cliente en espera',NEW.name||' · '||NEW.date,'Turnos','waitlist');
 END;
 CREATE TRIGGER IF NOT EXISTS panel_receipt_insert AFTER INSERT ON booking_transfer_receipts BEGIN
  INSERT INTO panel_notifications(business_id,title,detail,section) SELECT b.business_id,'Comprobante recibido',c.name||' · '||b.date||' · '||b.start_time,'Pagos' FROM bookings b JOIN clients c ON c.id=b.client_id WHERE b.id=NEW.booking_id;
 END;
 CREATE TRIGGER IF NOT EXISTS panel_receipt_update AFTER UPDATE OF uploaded_at ON booking_transfer_receipts WHEN OLD.uploaded_at!=NEW.uploaded_at BEGIN
  INSERT INTO panel_notifications(business_id,title,detail,section) SELECT b.business_id,'Comprobante actualizado',c.name||' · '||b.date||' · '||b.start_time,'Pagos' FROM bookings b JOIN clients c ON c.id=b.client_id WHERE b.id=NEW.booking_id;
 END;
 `);
 app.get('/api/businesses/:id/notifications',auth,(req,res)=>{
  const b=own(req.user.sub,req.params.id);if(!b)return res.sendStatus(403);
  const uid=Number(req.user.sub);
  const items=db.prepare(`SELECT n.*,EXISTS(SELECT 1 FROM panel_notification_reads r WHERE r.notification_id=n.id AND r.user_id=?) AS is_read FROM panel_notifications n WHERE n.business_id=? ORDER BY n.id DESC LIMIT 50`).all(uid,b.id);
  const unread=db.prepare(`SELECT count(*) count FROM panel_notifications n WHERE business_id=? AND NOT EXISTS(SELECT 1 FROM panel_notification_reads r WHERE r.notification_id=n.id AND r.user_id=?)`).get(b.id,uid).count;
  res.set('Cache-Control','no-store').json({items,unread});
 });
 app.post('/api/businesses/:id/notifications/read',auth,(req,res)=>{
  const b=own(req.user.sub,req.params.id);if(!b)return res.sendStatus(403);
  const through=Number(req.body?.through),id=Number(req.body?.id),uid=Number(req.user.sub);
  if(!Number.isSafeInteger(through)||through<1){if(!Number.isSafeInteger(id)||id<1)return res.status(400).json({error:'Seleccioná un aviso válido.'});
   db.prepare('INSERT OR IGNORE INTO panel_notification_reads(notification_id,user_id) SELECT id,? FROM panel_notifications WHERE business_id=? AND id=?').run(uid,b.id,id);
  }else db.prepare('INSERT OR IGNORE INTO panel_notification_reads(notification_id,user_id) SELECT id,? FROM panel_notifications WHERE business_id=? AND id<=?').run(uid,b.id,through);
  res.json({ok:true});
 });
}
