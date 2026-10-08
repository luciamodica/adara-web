import fs from 'node:fs/promises';
import path from 'node:path';
import {db} from './db.js';
import {dataDir,uploadsDir,receiptsDir} from './storage.js';

const destination=path.join(dataDir,'backups',new Date().toISOString().replace(/[:.]/g,'-'));
try {
  await fs.mkdir(destination,{recursive:true,mode:0o700});
  // SQLite's online backup includes committed WAL changes.
  await db.backup(path.join(destination,'app.db'));
  await fs.chmod(path.join(destination,'app.db'),0o600);
  await fs.cp(uploadsDir,path.join(destination,'uploads'),{recursive:true});
  await fs.cp(receiptsDir,path.join(destination,'transfer-receipts'),{recursive:true});
  await fs.writeFile(path.join(destination,'backup.json'),JSON.stringify({created_at:new Date().toISOString(),database:'app.db',uploads:'uploads',receipts:'transfer-receipts',secrets_included:false},null,2),{mode:0o600});
  console.log(`Copia creada en ${destination}. Descargala y guardá las claves de entorno por separado.`);
} catch(error) {
  await fs.rm(destination,{recursive:true,force:true});
  console.error(`No se pudo completar la copia: ${error.message}`);
  process.exitCode=1;
} finally { db.close(); }
