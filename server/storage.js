import fs from 'node:fs';
import path from 'node:path';

export const dataDir = path.resolve(process.env.DATA_DIR || 'data');
export const uploadsDir = path.resolve(process.env.UPLOADS_DIR || (process.env.DATA_DIR ? path.join(dataDir, 'uploads') : 'server/uploads'));
export const receiptsDir = path.join(dataDir, 'transfer-receipts');
for (const directory of [dataDir, uploadsDir, receiptsDir]) fs.mkdirSync(directory, {recursive:true});
