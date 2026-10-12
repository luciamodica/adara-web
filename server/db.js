import Database from 'better-sqlite3';
import path from 'node:path';
import {dataDir} from './storage.js';

export const db = new Database(path.join(dataDir, 'app.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'owner',
  email_verified INTEGER NOT NULL DEFAULT 0,
  verify_token TEXT,
  verify_expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS plans(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  monthly_price_cents INTEGER NOT NULL DEFAULT 0,
  annual_price_cents INTEGER NOT NULL DEFAULT 0,
  max_services INTEGER NOT NULL DEFAULT 100,
  max_promotions INTEGER NOT NULL DEFAULT 30,
  max_posts INTEGER NOT NULL DEFAULT 100,
  max_coupons INTEGER NOT NULL DEFAULT 50,
  analytics_enabled INTEGER NOT NULL DEFAULT 1,
  template_level INTEGER NOT NULL DEFAULT 3,
  features_json TEXT NOT NULL DEFAULT '[]',
  active INTEGER NOT NULL DEFAULT 1,
  public_enabled INTEGER NOT NULL DEFAULT 1,
  highlighted INTEGER NOT NULL DEFAULT 1,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS platform_settings(
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS businesses(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL UNIQUE,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  category TEXT NOT NULL DEFAULT 'Belleza',
  phone TEXT NOT NULL DEFAULT '',
  instagram TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  hero_title TEXT NOT NULL DEFAULT 'Tu momento, tu espacio',
  hero_text TEXT NOT NULL DEFAULT 'Reservá tu próximo turno online.',
  hero_image TEXT NOT NULL DEFAULT '',
  logo_image TEXT NOT NULL DEFAULT '',
  template_id TEXT NOT NULL DEFAULT 'silk',
  primary_color TEXT NOT NULL DEFAULT '#9b6b61',
  accent_color TEXT NOT NULL DEFAULT '#d8b7a8',
  background_color TEXT NOT NULL DEFAULT '#fbf8f4',
  plan_slug TEXT NOT NULL DEFAULT 'adara',
  billing_cycle TEXT NOT NULL DEFAULT 'monthly',
  subscription_status TEXT NOT NULL DEFAULT 'trialing',
  trial_ends_at TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  booking_horizon_days INTEGER NOT NULL DEFAULT 90,
  slot_interval_min INTEGER NOT NULL DEFAULT 30,
  payment_mode TEXT NOT NULL DEFAULT 'none',
  deposit_type TEXT NOT NULL DEFAULT 'fixed',
  deposit_value INTEGER NOT NULL DEFAULT 0,
  mp_access_token_enc TEXT,
  mp_refresh_token_enc TEXT,
  mp_token_expires_at TEXT,
  mp_user_id TEXT,
  mp_connected_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(owner_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(plan_slug) REFERENCES plans(slug)
);

CREATE TABLE IF NOT EXISTS services(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  price_cents INTEGER NOT NULL DEFAULT 0,
  duration_min INTEGER NOT NULL DEFAULT 60,
  active INTEGER NOT NULL DEFAULT 1,
  display_order INTEGER NOT NULL DEFAULT 0,
  group_discount_enabled INTEGER NOT NULL DEFAULT 0,
  group_min_people INTEGER NOT NULL DEFAULT 2,
  group_discount_percent INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS schedules(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER NOT NULL,
  weekday INTEGER NOT NULL,
  start_time TEXT NOT NULL DEFAULT '09:00',
  end_time TEXT NOT NULL DEFAULT '18:00',
  active INTEGER NOT NULL DEFAULT 1,
  UNIQUE(business_id,weekday),
  FOREIGN KEY(business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS blocks(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  start_time TEXT,
  end_time TEXT,
  all_day INTEGER NOT NULL DEFAULT 0,
  reason TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS clients(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(business_id,email),
  FOREIGN KEY(business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS coupons(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER NOT NULL,
  code TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'percent',
  value INTEGER NOT NULL DEFAULT 0,
  min_total_cents INTEGER NOT NULL DEFAULT 0,
  max_uses INTEGER NOT NULL DEFAULT 0,
  start_date TEXT,
  end_date TEXT,
  service_id INTEGER,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(business_id,code),
  FOREIGN KEY(business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY(service_id) REFERENCES services(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS bookings(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER NOT NULL,
  client_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed',
  payment_status TEXT NOT NULL DEFAULT 'not_required',
  payment_mode TEXT NOT NULL DEFAULT 'none',
  party_size INTEGER NOT NULL DEFAULT 1,
  subtotal_cents INTEGER NOT NULL DEFAULT 0,
  group_discount_cents INTEGER NOT NULL DEFAULT 0,
  coupon_discount_cents INTEGER NOT NULL DEFAULT 0,
  coupon_id INTEGER,
  coupon_code TEXT,
  total_cents INTEGER NOT NULL DEFAULT 0,
  amount_due_cents INTEGER NOT NULL DEFAULT 0,
  amount_paid_cents INTEGER NOT NULL DEFAULT 0,
  selection_summary TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  hold_expires_at TEXT,
  mp_preference_id TEXT,
  mp_payment_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY(client_id) REFERENCES clients(id),
  FOREIGN KEY(coupon_id) REFERENCES coupons(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS booking_items(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id INTEGER NOT NULL,
  service_id INTEGER NOT NULL,
  service_name TEXT NOT NULL,
  price_cents INTEGER NOT NULL,
  duration_min INTEGER NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  line_subtotal_cents INTEGER NOT NULL DEFAULT 0,
  line_discount_cents INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY(booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
  FOREIGN KEY(service_id) REFERENCES services(id)
);

CREATE TABLE IF NOT EXISTS promotions(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  discount_percent INTEGER NOT NULL DEFAULT 0,
  image_url TEXT NOT NULL DEFAULT '',
  start_date TEXT,
  end_date TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  show_banner INTEGER NOT NULL DEFAULT 0,
  banner_text TEXT NOT NULL DEFAULT '',
  banner_bg TEXT NOT NULL DEFAULT '#2d2723',
  banner_text_color TEXT NOT NULL DEFAULT '#ffffff',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS posts(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS faqs(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(business_id) REFERENCES businesses(id) ON DELETE CASCADE
);
`);

function hasColumn(table, column){
  return db.prepare(`PRAGMA table_info(${table})`).all().some(x=>x.name===column);
}
function addColumn(table, column, definition){
  if(!hasColumn(table,column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

// Migraciones seguras para bases creadas con entregas anteriores.
addColumn('plans','max_coupons','INTEGER NOT NULL DEFAULT 50');
addColumn('plans','public_enabled','INTEGER NOT NULL DEFAULT 1');
addColumn('plans','max_staff','INTEGER NOT NULL DEFAULT 1');
addColumn('plans','team_enabled','INTEGER NOT NULL DEFAULT 0');
addColumn('services','group_discount_enabled','INTEGER NOT NULL DEFAULT 0');
addColumn('services','group_min_people','INTEGER NOT NULL DEFAULT 2');
addColumn('services','group_discount_percent','INTEGER NOT NULL DEFAULT 0');

addColumn('users','session_version','INTEGER NOT NULL DEFAULT 0');
addColumn('businesses','show_service_duration','INTEGER NOT NULL DEFAULT 1');
db.exec(`
CREATE TABLE IF NOT EXISTS password_reset_tokens(
 token_hash TEXT PRIMARY KEY,
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 session_version INTEGER NOT NULL,
 expires_at TEXT NOT NULL,
 used_at TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS password_reset_user ON password_reset_tokens(user_id);
CREATE TABLE IF NOT EXISTS auth_rate_limits(
 key TEXT PRIMARY KEY,
 count INTEGER NOT NULL,
 window_start INTEGER NOT NULL
);
`);
addColumn('promotions','show_banner','INTEGER NOT NULL DEFAULT 0');
addColumn('promotions','service_ids_json',"TEXT NOT NULL DEFAULT '[]'");
addColumn('promotions','pricing_mode',"TEXT NOT NULL DEFAULT 'percent'");
addColumn('promotions','price_before_cents','INTEGER');
addColumn('promotions','price_after_cents','INTEGER');
addColumn('bookings','promotion_id','INTEGER');
addColumn('bookings','promotion_title',"TEXT NOT NULL DEFAULT ''");
addColumn('bookings','promotion_discount_cents','INTEGER NOT NULL DEFAULT 0');
addColumn('bookings','promotion_before_cents','INTEGER');
addColumn('booking_items','line_promotion_discount_cents','INTEGER NOT NULL DEFAULT 0');
addColumn('businesses','section_order_json',`TEXT NOT NULL DEFAULT '["hero","booking","promotions","services","posts","faqs"]'`);
addColumn('businesses','hero_image_fit',"TEXT NOT NULL DEFAULT 'contain'");

addColumn('promotions','banner_text',"TEXT NOT NULL DEFAULT ''");
addColumn('promotions','banner_bg',"TEXT NOT NULL DEFAULT '#2d2723'");
addColumn('promotions','banner_text_color',"TEXT NOT NULL DEFAULT '#ffffff'");
addColumn('bookings','party_size','INTEGER NOT NULL DEFAULT 1');
addColumn('bookings','subtotal_cents','INTEGER NOT NULL DEFAULT 0');
addColumn('bookings','group_discount_cents','INTEGER NOT NULL DEFAULT 0');
addColumn('bookings','coupon_discount_cents','INTEGER NOT NULL DEFAULT 0');
addColumn('bookings','coupon_id','INTEGER');
addColumn('bookings','coupon_code','TEXT');
addColumn('booking_items','quantity','INTEGER NOT NULL DEFAULT 1');
addColumn('booking_items','line_subtotal_cents','INTEGER NOT NULL DEFAULT 0');
addColumn('booking_items','line_discount_cents','INTEGER NOT NULL DEFAULT 0');

// Personalización avanzada de página y configuración del negocio.
addColumn('businesses','public_email',"TEXT NOT NULL DEFAULT ''");
addColumn('businesses','tiktok',"TEXT NOT NULL DEFAULT ''");
addColumn('businesses','website',"TEXT NOT NULL DEFAULT ''");
addColumn('businesses','seo_title',"TEXT NOT NULL DEFAULT ''");
addColumn('businesses','seo_description',"TEXT NOT NULL DEFAULT ''");
addColumn('businesses','notification_email',"TEXT NOT NULL DEFAULT ''");
addColumn('businesses','cancellation_policy',"TEXT NOT NULL DEFAULT ''");
addColumn('businesses','confirmation_message',"TEXT NOT NULL DEFAULT ''");
addColumn('businesses','booking_notice_min','INTEGER NOT NULL DEFAULT 120');
addColumn('businesses','cancellation_hours','INTEGER NOT NULL DEFAULT 24');
addColumn('businesses','allow_group_bookings','INTEGER NOT NULL DEFAULT 1');
addColumn('businesses','max_party_size','INTEGER NOT NULL DEFAULT 6');
addColumn('businesses','require_email','INTEGER NOT NULL DEFAULT 0');
addColumn('businesses','show_address','INTEGER NOT NULL DEFAULT 1');
addColumn('businesses','heading_font',"TEXT NOT NULL DEFAULT 'editorial'");
addColumn('businesses','body_font',"TEXT NOT NULL DEFAULT 'clean'");
addColumn('businesses','hero_layout',"TEXT NOT NULL DEFAULT 'overlay'");
addColumn('businesses','hero_height',"TEXT NOT NULL DEFAULT 'large'");
addColumn('businesses','hero_align',"TEXT NOT NULL DEFAULT 'left'");
addColumn('businesses','header_style',"TEXT NOT NULL DEFAULT 'classic'");
addColumn('businesses','service_card_style',"TEXT NOT NULL DEFAULT 'image-top'");
addColumn('businesses','button_style',"TEXT NOT NULL DEFAULT 'pill'");
addColumn('businesses','image_ratio',"TEXT NOT NULL DEFAULT 'landscape'");
addColumn('businesses','content_width',"TEXT NOT NULL DEFAULT 'wide'");
addColumn('businesses','footer_style',"TEXT NOT NULL DEFAULT 'dark'");
addColumn('businesses','show_promotions','INTEGER NOT NULL DEFAULT 1');
addColumn('businesses','show_posts','INTEGER NOT NULL DEFAULT 1');
addColumn('businesses','show_description','INTEGER NOT NULL DEFAULT 1');
addColumn('businesses','show_footer_contact','INTEGER NOT NULL DEFAULT 1');
addColumn('businesses','show_faqs','INTEGER NOT NULL DEFAULT 1');
addColumn('businesses','show_whatsapp_float','INTEGER NOT NULL DEFAULT 1');
addColumn('businesses','whatsapp_message',"TEXT NOT NULL DEFAULT 'Hola, quiero consultar por un turno'");
addColumn('businesses','show_services','INTEGER NOT NULL DEFAULT 1');
addColumn('businesses','show_booking','INTEGER NOT NULL DEFAULT 1');
addColumn('businesses','custom_monthly_price_cents','INTEGER');
addColumn('businesses','custom_annual_price_cents','INTEGER');
addColumn('businesses','admin_notes',"TEXT NOT NULL DEFAULT ''");
addColumn('bookings','manage_token','TEXT');
addColumn('bookings','staff_id','INTEGER');
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_manage_token ON bookings(manage_token)');

db.exec(`
CREATE TABLE IF NOT EXISTS staff(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(business_id) REFERENCES businesses(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS staff_schedules(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  staff_id INTEGER NOT NULL,
  weekday INTEGER NOT NULL,
  start_time TEXT NOT NULL DEFAULT '09:00',
  end_time TEXT NOT NULL DEFAULT '18:00',
  active INTEGER NOT NULL DEFAULT 0,
  UNIQUE(staff_id,weekday),
  FOREIGN KEY(staff_id) REFERENCES staff(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS staff_services(
  staff_id INTEGER NOT NULL,
  service_id INTEGER NOT NULL,
  PRIMARY KEY(staff_id,service_id),
  FOREIGN KEY(staff_id) REFERENCES staff(id) ON DELETE CASCADE,
  FOREIGN KEY(service_id) REFERENCES services(id) ON DELETE CASCADE
);
`);

// Planes iniciales. El Super Admin puede editar precios, visibilidad y límites sin tocar código.
const individual = db.prepare('SELECT * FROM plans WHERE slug=?').get('adara');
if(!individual){
  db.prepare(`INSERT INTO plans(slug,name,description,monthly_price_cents,annual_price_cents,max_services,max_promotions,max_posts,max_coupons,analytics_enabled,template_level,features_json,active,public_enabled,highlighted,display_order,max_staff,team_enabled)
  VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    'adara','Adara Individual','Para profesionales independientes que trabajan con una sola agenda.',
    2490000,24900000,100,30,100,50,1,3,
    JSON.stringify(['Página profesional premium','Agenda y reservas inteligentes','Servicios e imágenes','Promociones y banner superior','Cupones y descuentos grupales','Mercado Pago propio','Clientes y estadísticas']),
    1,1,1,1,1,0
  );
}else{
  db.prepare(`UPDATE plans SET max_staff=1,team_enabled=0 WHERE slug='adara'`).run();
}
const team = db.prepare('SELECT * FROM plans WHERE slug=?').get('adara-equipo');
if(!team){
  db.prepare(`INSERT INTO plans(slug,name,description,monthly_price_cents,annual_price_cents,max_services,max_promotions,max_posts,max_coupons,analytics_enabled,template_level,features_json,active,public_enabled,highlighted,display_order,max_staff,team_enabled)
  VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    'adara-equipo','Adara Equipo','Para estudios con varias profesionales, agendas independientes y reservas por integrante.',
    4990000,49900000,250,80,200,100,1,3,
    JSON.stringify(['Todo lo de Adara Individual','Hasta 10 integrantes','Agenda independiente por profesional','El cliente elige con quién reservar','Servicios asignables por integrante','Panel unificado del equipo']),
    1,1,0,2,10,1
  );
}else{
  db.prepare(`UPDATE plans SET max_staff=CASE WHEN max_staff<2 THEN 10 ELSE max_staff END,team_enabled=1 WHERE slug='adara-equipo'`).run();
}

db.prepare(`INSERT OR IGNORE INTO platform_settings(key,value) VALUES('trial_days','15')`).run();

export function getSetting(key, fallback='') {
  const row = db.prepare('SELECT value FROM platform_settings WHERE key=?').get(key);
  return row?.value ?? fallback;
}

export function getPlan(slug) {
  return db.prepare('SELECT * FROM plans WHERE slug=? AND active=1').get(slug);
}
