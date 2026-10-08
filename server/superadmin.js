import bcrypt from 'bcryptjs';

export function bootstrapSuperAdmin(db) {
  if (process.env.NODE_ENV !== 'production') return;
  const admins = db.prepare("SELECT * FROM users WHERE role='superadmin'").all();
  if (admins.some(admin => bcrypt.compareSync('admin1234', admin.password_hash))) {
    throw new Error('El Super Admin conserva la contraseña local. Cambiala con npm run admin:password antes de publicar.');
  }
  // The environment only bootstraps a new installation; never resets an account.
  if (admins.length) return;
  const email = String(process.env.SUPERADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.SUPERADMIN_PASSWORD || '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 12 || password === 'admin1234') {
    throw new Error('Configurá SUPERADMIN_EMAIL y SUPERADMIN_PASSWORD (mínimo 12 caracteres) para el primer inicio.');
  }
  if (db.prepare('SELECT 1 FROM users WHERE email=?').get(email)) {
    throw new Error('El email elegido para Super Admin ya pertenece a otra cuenta. Elegí otro email.');
  }
  db.prepare('INSERT INTO users(name,email,password_hash,role,email_verified) VALUES(?,?,?,?,1)').run('Super Admin', email, bcrypt.hashSync(password,12), 'superadmin');
  console.log('Cuenta Super Admin creada.');
}
