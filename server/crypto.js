import crypto from 'crypto';
const keyMaterial = process.env.TOKEN_ENCRYPTION_KEY || process.env.JWT_SECRET || 'adara-local-encryption-key';
const key = crypto.createHash('sha256').update(keyMaterial).digest();

export function encryptSecret(value) {
  if (!value) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(String(value),'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64url');
}

export function decryptSecret(value) {
  if (!value) return null;
  const raw = Buffer.from(value,'base64url');
  const iv = raw.subarray(0,12), tag = raw.subarray(12,28), encrypted = raw.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}
