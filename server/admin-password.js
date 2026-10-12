import {db} from './db.js';
import bcrypt from 'bcryptjs';
import {validateNewPassword} from './account-security.js';

try {
  const email = String(process.env.SUPERADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.SUPERADMIN_PASSWORD || '';
  const admin = db.prepare("SELECT id FROM users WHERE email=? AND role='superadmin'").get(email);
  if (!admin) throw new Error('SUPERADMIN_EMAIL debe coincidir con una cuenta Super Admin existente.');
  validateNewPassword(password,'superadmin');
  db.transaction(()=>{db.prepare('UPDATE users SET password_hash=?,session_version=session_version+1 WHERE id=?').run(bcrypt.hashSync(password,12),admin.id);db.prepare('UPDATE password_reset_tokens SET used_at=? WHERE user_id=? AND used_at IS NULL').run(new Date().toISOString(),admin.id)})();
  console.log('Contraseña del Super Admin actualizada.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally { db.close(); }
