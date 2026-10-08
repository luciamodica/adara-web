import path from 'node:path';

// Run before importing the database or integration modules.
if (process.env.NODE_ENV === 'production') {
  for (const name of ['JWT_SECRET', 'TOKEN_ENCRYPTION_KEY']) {
    const value = process.env[name] || '';
    if (value.length < 32 || /cambia|change-me|adara-local/i.test(value)) {
      throw new Error(`Configurá ${name} con una clave aleatoria de al menos 32 caracteres.`);
    }
  }
  for (const name of ['FRONTEND_URL', 'PUBLIC_API_URL']) {
    const value = process.env[name] || process.env.RENDER_EXTERNAL_URL;
    let url;
    try { url = new URL(value); } catch { /* report only the variable name */ }
    if (!url || url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/' || ['localhost','127.0.0.1'].includes(url.hostname)) {
      throw new Error(`Configurá ${name} con la dirección HTTPS del sitio, sin rutas adicionales.`);
    }
    process.env[name] = url.origin;
  }
  if (!process.env.DATA_DIR || !path.isAbsolute(process.env.DATA_DIR)) {
    throw new Error('Configurá DATA_DIR con la ruta absoluta del disco permanente.');
  }
  const uploadDir = process.env.UPLOADS_DIR || path.join(process.env.DATA_DIR, 'uploads');
  const relative = path.relative(path.resolve(process.env.DATA_DIR), path.resolve(uploadDir));
  if (!path.isAbsolute(uploadDir) || !relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('UPLOADS_DIR debe ser una subcarpeta de DATA_DIR para conservar las imágenes.');
  }
  process.env.UPLOADS_DIR = uploadDir;
  process.env.DEMO_PAYMENTS = 'false';
  process.env.DEMO_SUBSCRIPTIONS = 'false';
}
