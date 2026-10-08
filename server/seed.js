import bcrypt from 'bcryptjs';
import {db} from './db.js';
if(process.env.NODE_ENV==='production')throw new Error('db:seed es sólo para desarrollo. En producción configurá SUPERADMIN_EMAIL y SUPERADMIN_PASSWORD.');
const email='admin@adaraweb.local';
if(!db.prepare('SELECT 1 FROM users WHERE email=?').get(email)){
  db.prepare(`INSERT INTO users(name,email,password_hash,role,email_verified) VALUES(?,?,?,?,1)`).run('Super Admin',email,bcrypt.hashSync('admin1234',10),'superadmin');
}
console.log('Super Admin: admin@adaraweb.local / admin1234');
