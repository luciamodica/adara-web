import {db} from './db.js';
import bcrypt from 'bcryptjs';

try {
  const email = String(process.env.SUPERADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.SUPERADMIN_PASSWORD || '';
  const admin = db.prepare("SELECT id FROM users WHERE email=? AND role='superadmin'").get(email);
  if (!admin) throw new Error('SUPERADMIN_EMAIL debe coincidir con una cuenta Super Admin existente.');
  if (password.length < 12 || password === 'admin1234') throw new Error('SUPERADMIN_PASSWORD debe tener al menos 12 caracteres.');
  db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(bcrypt.hashSync(password,12), admin.id);
  console.log('Contraseña del Super Admin actualizada.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally { db.close(); }
