import {db} from './db.js';
const add=(table,name,definition)=>{if(!db.prepare(`PRAGMA table_info(${table})`).all().some(x=>x.name===name))db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`)};
add('businesses','payment_hold_minutes','INTEGER NOT NULL DEFAULT 15');
add('businesses','qr_tagline',"TEXT NOT NULL DEFAULT 'Tu próximo momento empieza acá'");
add('businesses','hero_images_json',"TEXT NOT NULL DEFAULT '[]'");
add('businesses','show_category','INTEGER NOT NULL DEFAULT 0');
add('businesses','category_label',"TEXT NOT NULL DEFAULT ''");
add('services','images_json',"TEXT NOT NULL DEFAULT '[]'");
add('bookings','payment_review_required','INTEGER NOT NULL DEFAULT 0');
add('bookings','manual_override','INTEGER NOT NULL DEFAULT 0');
for(const [key,def] of Object.entries({payment_methods_json:`TEXT NOT NULL DEFAULT '["mercadopago"]'`,bank_alias:"TEXT NOT NULL DEFAULT ''",bank_account:"TEXT NOT NULL DEFAULT ''",bank_holder:"TEXT NOT NULL DEFAULT ''",bank_name:"TEXT NOT NULL DEFAULT ''",bank_instructions:"TEXT NOT NULL DEFAULT ''"}))add('businesses',key,def);
for(const [key,def] of Object.entries({payment_method:"TEXT NOT NULL DEFAULT 'mercadopago'",payment_details_json:'TEXT',manual_payment_confirmed_at:'TEXT',payment_waived:'INTEGER NOT NULL DEFAULT 0'}))add('bookings',key,def);
add('clients','waive_advance','INTEGER NOT NULL DEFAULT 0');
add('clients','payment_access_token','TEXT');
add('clients','archived_at','TEXT');
db.exec('CREATE TABLE IF NOT EXISTS booking_transfer_receipts(booking_id INTEGER PRIMARY KEY REFERENCES bookings(id) ON DELETE CASCADE,stored_name TEXT NOT NULL,original_name TEXT NOT NULL,mime TEXT NOT NULL,uploaded_at TEXT NOT NULL)');

// One-time migration of the former default. Existing trial end dates are preserved.
if(!db.prepare("SELECT 1 FROM platform_settings WHERE key='short_trial_migrated'").get())db.transaction(()=>{
 db.prepare("UPDATE platform_settings SET value='15' WHERE key='trial_days' AND value NOT IN ('7','15')").run();
 db.prepare("INSERT INTO platform_settings(key,value) VALUES('short_trial_migrated','1')").run();
})();
for(const [name,def] of Object.entries({waitlist_enabled:'INTEGER NOT NULL DEFAULT 1',reminders_enabled:'INTEGER NOT NULL DEFAULT 1',reminder_hours_json:"TEXT NOT NULL DEFAULT '[48,24]'",reminder_email:'INTEGER NOT NULL DEFAULT 1',reminder_whatsapp:'INTEGER NOT NULL DEFAULT 0',terms_required:'INTEGER NOT NULL DEFAULT 0',booking_terms:"TEXT NOT NULL DEFAULT ''",no_show_threshold:'INTEGER NOT NULL DEFAULT 2',loyalty_enabled:'INTEGER NOT NULL DEFAULT 0',loyalty_points:'INTEGER NOT NULL DEFAULT 10',loyalty_redeem_points:'INTEGER NOT NULL DEFAULT 100',loyalty_discount_cents:'INTEGER NOT NULL DEFAULT 100000',ga_id:"TEXT NOT NULL DEFAULT ''",meta_pixel_id:"TEXT NOT NULL DEFAULT ''",google_access_enc:'TEXT',google_refresh_enc:'TEXT',google_expires_at:'TEXT',google_connected_at:'TEXT'}))add('businesses',name,def);
for(const [name,def] of Object.entries({phone_normalized:"TEXT NOT NULL DEFAULT ''",blocked:'INTEGER NOT NULL DEFAULT 0',require_full_payment:'INTEGER NOT NULL DEFAULT 0'}))add('clients',name,def);
for(const [name,def] of Object.entries({google_revision:'INTEGER NOT NULL DEFAULT 0',attendance_confirmed_at:'TEXT',terms_accepted_at:'TEXT',terms_snapshot:'TEXT',series_id:'TEXT',google_synced_hash:'TEXT',google_event_id:'TEXT',google_error:'TEXT',loyalty_discount_cents:'INTEGER NOT NULL DEFAULT 0'}))add('bookings',name,def);
db.exec(`
CREATE TABLE IF NOT EXISTS calendar_exceptions(id INTEGER PRIMARY KEY, business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,date TEXT NOT NULL,staff_id INTEGER,closed INTEGER NOT NULL DEFAULT 0,start_time TEXT,end_time TEXT,reason TEXT NOT NULL DEFAULT '');
CREATE UNIQUE INDEX IF NOT EXISTS exception_unique ON calendar_exceptions(business_id,date,COALESCE(staff_id,0));
CREATE TABLE IF NOT EXISTS calendar_periods(id INTEGER PRIMARY KEY,business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,date_from TEXT NOT NULL,date_to TEXT NOT NULL,staff_id INTEGER,closed INTEGER NOT NULL DEFAULT 0,start_time TEXT,end_time TEXT,reason TEXT NOT NULL DEFAULT '');
CREATE INDEX IF NOT EXISTS calendar_period_business ON calendar_periods(business_id,date_from,date_to);
CREATE TABLE IF NOT EXISTS waitlist(id INTEGER PRIMARY KEY,business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,date TEXT NOT NULL,staff_id INTEGER,service_ids_json TEXT NOT NULL,party_size INTEGER NOT NULL DEFAULT 1,name TEXT NOT NULL,email TEXT,phone TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'waiting',token TEXT UNIQUE NOT NULL,consent_at TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS notification_jobs(id INTEGER PRIMARY KEY,business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,booking_id INTEGER REFERENCES bookings(id) ON DELETE CASCADE,waitlist_id INTEGER REFERENCES waitlist(id) ON DELETE CASCADE,kind TEXT NOT NULL,channel TEXT NOT NULL,dedupe_key TEXT UNIQUE NOT NULL,payload_json TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',attempts INTEGER NOT NULL DEFAULT 0,last_error TEXT,sent_at TEXT,next_attempt_at TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS packs(id INTEGER PRIMARY KEY,business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,service_id INTEGER NOT NULL REFERENCES services(id),name TEXT NOT NULL,sessions INTEGER NOT NULL,price_cents INTEGER NOT NULL,active INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS client_packs(id INTEGER PRIMARY KEY,business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,client_id INTEGER NOT NULL REFERENCES clients(id),pack_id INTEGER NOT NULL REFERENCES packs(id),code TEXT UNIQUE NOT NULL,sessions INTEGER NOT NULL,expires_at TEXT,paid_cents INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS pack_uses(booking_id INTEGER PRIMARY KEY REFERENCES bookings(id) ON DELETE CASCADE,client_pack_id INTEGER NOT NULL REFERENCES client_packs(id),restored INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS loyalty_ledger(id INTEGER PRIMARY KEY,client_id INTEGER NOT NULL REFERENCES clients(id),booking_id INTEGER REFERENCES bookings(id) ON DELETE CASCADE,kind TEXT NOT NULL,points INTEGER NOT NULL,UNIQUE(booking_id,kind));
CREATE TABLE IF NOT EXISTS loyalty_rewards(id INTEGER PRIMARY KEY,business_id INTEGER NOT NULL REFERENCES businesses(id),client_id INTEGER NOT NULL REFERENCES clients(id),code TEXT UNIQUE NOT NULL,points INTEGER NOT NULL,discount_cents INTEGER NOT NULL,used_booking_id INTEGER REFERENCES bookings(id),expires_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS analytics_events(id INTEGER PRIMARY KEY,business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,event TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS waitlist_date ON waitlist(business_id,date,status);
CREATE INDEX IF NOT EXISTS analytics_business ON analytics_events(business_id,created_at);
`);
add('calendar_exceptions','period_id','INTEGER REFERENCES calendar_periods(id) ON DELETE CASCADE');
// Existing single-day exceptions become editable periods, without changing availability.
db.transaction(()=>{
 for(const row of db.prepare('SELECT * FROM calendar_exceptions WHERE period_id IS NULL').all()){
  const period=db.prepare('INSERT INTO calendar_periods(business_id,date_from,date_to,staff_id,closed,start_time,end_time,reason) VALUES(?,?,?,?,?,?,?,?)').run(row.business_id,row.date,row.date,row.staff_id,row.closed,row.start_time,row.end_time,row.reason);
  db.prepare('UPDATE calendar_exceptions SET period_id=? WHERE id=?').run(Number(period.lastInsertRowid),row.id);
 }
})();
export const normalizePhone=p=>String(p||'').replace(/\D/g,'');
for(const c of db.prepare("SELECT id,phone FROM clients WHERE phone_normalized=''").all())db.prepare('UPDATE clients SET phone_normalized=? WHERE id=?').run(normalizePhone(c.phone),c.id);

add('bookings','booking_source',"TEXT NOT NULL DEFAULT 'online'");
add('businesses','qr_settings_json',"TEXT NOT NULL DEFAULT '{}'");
