import crypto from 'node:crypto';
import path from 'node:path';
import {inflateRawSync} from 'node:zlib';
import multer from 'multer';
import {readSheet} from 'read-excel-file/node';
import {db} from './db.js';
import {normalizePhone} from './features-db.js';

const maxBytes=2*1024*1024,maxRows=2000,maxColumns=40;
db.exec(`CREATE TABLE IF NOT EXISTS client_imports(
 id TEXT PRIMARY KEY,business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
 rows_json TEXT NOT NULL,created_at TEXT NOT NULL,expires_at TEXT NOT NULL,committed_at TEXT,result_json TEXT
); CREATE INDEX IF NOT EXISTS client_import_business ON client_imports(business_id,created_at);`);

// Bound both the advertised and actual decompressed size before the XLSX parser runs.
export function validateWorkbookZip(bytes){
 const end=bytes.lastIndexOf(Buffer.from([0x50,0x4b,0x05,0x06]));
 if(end<0||end+22>bytes.length||end+22+bytes.readUInt16LE(end+20)!==bytes.length)throw Error('El Excel no es un archivo .xlsx válido.');
 const entries=bytes.readUInt16LE(end+10),start=bytes.readUInt32LE(end+16),size=bytes.readUInt32LE(end+12);
 if(bytes.readUInt16LE(end+4)||bytes.readUInt16LE(end+6)||entries!==bytes.readUInt16LE(end+8)||!entries||entries>600||start+size>end)throw Error('El Excel tiene una estructura o tamaño no admitidos.');
 let offset=start,total=0;
 for(let i=0;i<entries;i++){
  if(offset+46>end||bytes.readUInt32LE(offset)!==0x02014b50)throw Error('El Excel está dañado.');
  const flags=bytes.readUInt16LE(offset+8),method=bytes.readUInt16LE(offset+10),compressed=bytes.readUInt32LE(offset+20),length=bytes.readUInt32LE(offset+24),local=bytes.readUInt32LE(offset+42);
  const filename=bytes.subarray(offset+46,offset+46+bytes.readUInt16LE(offset+28)).toString('utf8');
  if(filename.includes('..')||filename.startsWith('/')||/[\u0000\\]/.test(filename))throw Error('El Excel contiene rutas inválidas.');
  total+=length;
  if(flags&1||![0,8].includes(method)||length>8*1024*1024||total>16*1024*1024||local+30>start||bytes.readUInt32LE(local)!==0x04034b50)throw Error('El Excel es demasiado grande o está protegido. Exportalo como CSV.');
  const from=local+30+bytes.readUInt16LE(local+26)+bytes.readUInt16LE(local+28);
  if(from+compressed>start)throw Error('El Excel está dañado.');
  let actual;
  try{actual=method===0?bytes.subarray(from,from+compressed):inflateRawSync(bytes.subarray(from,from+compressed),{maxOutputLength:Math.min(8*1024*1024,length+1)});}catch{throw Error('El Excel está dañado o supera el tamaño admitido.');}
  if(actual.length!==length)throw Error('El Excel contiene tamaños inválidos.');
  if(/^xl\/worksheets\/[^/]+\.xml$/.test(filename)){
   const xml=actual.toString('utf8'),rows=xml.match(/<(?:\w+:)?row\b/g)||[];
   if(rows.length>maxRows+1)throw Error('Importá hasta 2000 clientas por archivo.');
   for(const match of xml.matchAll(/<(?:\w+:)?row\b[^>]*\br=["'](\d+)["']/g))if(Number(match[1])>maxRows+1)throw Error('La hoja debe usar las primeras 2001 filas. Quitá filas vacías o exportá como CSV.');
   for(const match of xml.matchAll(/<(?:\w+:)?c\b[^>]*\br=["']([A-Za-z]+)(\d+)["']/g)){
    const column=[...match[1].toUpperCase()].reduce((value,char)=>value*26+char.charCodeAt(0)-64,0);
    if(column>maxColumns||Number(match[2])>maxRows+1)throw Error('La hoja admite hasta 40 columnas y 2000 clientas. Quitá celdas sobrantes o exportá como CSV.');
   }
  }
  offset+=46+bytes.readUInt16LE(offset+28)+bytes.readUInt16LE(offset+30)+bytes.readUInt16LE(offset+32);
 }
 if(offset!==start+size)throw Error('El Excel está dañado.');
}

function decode(bytes){
 if(bytes[0]===255&&bytes[1]===254)return new TextDecoder('utf-16le').decode(bytes.subarray(2));
 if(bytes[0]===254&&bytes[1]===255)return new TextDecoder('utf-16be').decode(bytes.subarray(2));
 try{return new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{return new TextDecoder('windows-1252').decode(bytes);}
}
export function parseCsv(text){
 text=text.replace(/^\uFEFF/,'');
 let delimiter;
 const separator=text.match(/^sep=([;,\t])\r?\n/i);if(separator){delimiter=separator[1];text=text.slice(separator[0].length);}
 if(!delimiter){
  const first=text.split(/\r?\n/,1)[0];let quoted=false;const counts={',':0,';':0,'\t':0};
  for(let i=0;i<first.length;i++){if(first[i]==='"'){if(quoted&&first[i+1]==='"')i++;else quoted=!quoted;}else if(!quoted&&first[i] in counts)counts[first[i]]++;}
  delimiter=Object.keys(counts).sort((a,b)=>counts[b]-counts[a])[0];
 }
 const rows=[];let row=[],cell='',quoted=false,closed=false;
 const pushCell=()=>{row.push(cell);cell='';closed=false;if(row.length>maxColumns)throw Error('La planilla admite hasta 40 columnas.');};
 const pushRow=()=>{pushCell();if(row.some(value=>value.trim()))rows.push(row);row=[];if(rows.length>maxRows+1)throw Error('Importá hasta 2000 clientas por archivo.');};
 for(let i=0;i<text.length;i++){
  const char=text[i];
  if(quoted){if(char==='"'){if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=char;}
  else if(char==='"'){if(cell||closed)throw Error('Revisá las comillas del CSV.');quoted=true;}
  else if(char===delimiter)pushCell();
  else if(char==='\n'||char==='\r'){if(char==='\r'&&text[i+1]==='\n')i++;pushRow();}
  else if(closed){if(!/\s/.test(char))throw Error('Revisá los separadores del CSV.');}
  else cell+=char;
  if(cell.length>4096)throw Error('Una celda es demasiado larga (máximo 4096 caracteres).');
 }
 if(quoted)throw Error('Hay una celda con comillas sin cerrar.');
 if(cell||row.length||closed)pushRow();
 return rows;
}
const normalize=value=>String(value||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
const aliases={name:['nombre','nombres','nombrecompleto','cliente','clienta','name','fullname','contacto'],surname:['apellido','apellidos','lastname','surname'],phone:['telefono','celular','whatsapp','movil','phone','tel','phonenumber','numero'],email:['email','correo','correoelectronico','mail'],notes:['notas','observaciones','notes']};
export function suggestMapping(columns){return Object.fromEntries(Object.entries(aliases).map(([key,names])=>{const indexes=columns.map((name,i)=>names.includes(normalize(name))?i:-1).filter(i=>i>=0);return [key,indexes.length===1?indexes[0]:-1];}));}
function validateMapping(input,columns){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Revisá las columnas de la planilla.');
 const mapping=Object.fromEntries(Object.keys(aliases).map(key=>[key,input[key]===undefined?-1:input[key]]));
 if(Object.values(mapping).some(index=>!Number.isInteger(index)||index< -1||index>=columns.length))throw Error('Elegí columnas válidas.');
 const chosen=Object.values(mapping).filter(index=>index>=0);if(new Set(chosen).size!==chosen.length)throw Error('Usá una columna distinta para cada dato.');
 return mapping;
}
function indexFor(business){
 const emails=new Map(),phones=new Map();
 for(const c of db.prepare('SELECT id,email,phone,phone_normalized FROM clients WHERE business_id=?').all(business)){
  if(c.email)emails.set(c.email.trim().toLowerCase(),c.id);
  const phone=c.phone_normalized||normalizePhone(c.phone);if(phone)phones.set(phone,c.id);
 }
 return {emails,phones};
}
function classify(input,index){
 const row={...input};
 if(!row.name||row.name.length>120||(!row.phone&&!row.email)||row.phone&&(!/^[+\d\s().-]+$/.test(row.phone)||normalizePhone(row.phone).length<7||normalizePhone(row.phone).length>18)||row.email&&(row.email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email))||row.notes.length>2000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(Object.values(row).join(''))){return {...row,status:'invalid',reason:'Revisá el nombre, un WhatsApp o email válido y la longitud de las notas.'};}
 const email=row.email?index.emails.get(row.email):null,phone=row.phone?index.phones.get(normalizePhone(row.phone)):null;
 if(email||phone)return {...row,status:'duplicate',reason:email&&phone&&email!==phone?'El email y el WhatsApp coinciden con fichas distintas. Revisalas antes de importar.':'Ese email o WhatsApp ya aparece en tus clientes o en otra fila del archivo.'};
 const key='row-'+row.row;if(row.email)index.emails.set(row.email,key);if(row.phone)index.phones.set(normalizePhone(row.phone),key);
 return {...row,status:'ready',reason:'Nueva clienta'};
}
export function previewClients(business,table,mapping){
 const index=indexFor(business),value=(row,key)=>mapping[key]>=0?String(row[mapping[key]]??'').trim():'';
 return table.slice(1).map((row,i)=>{
  const input={row:i+2,name:[value(row,'name'),value(row,'surname')].filter(Boolean).join(' ').replace(/\s+/g,' '),phone:value(row,'phone').replace(/^'/,''),email:value(row,'email').toLowerCase(),notes:value(row,'notes')};
  if(Object.values(mapping).some(column=>column>=0&&row[column] instanceof Date))return {...input,status:'invalid',reason:'Una columna seleccionada contiene una fecha. Elegí columnas de texto para los datos de contacto.'};
  return classify(input,index);
 });
}

export function registerClientImports(app,{auth,own}){
 const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:maxBytes,files:1,fields:1,fieldSize:4096}}).single('file');
 const owner=(req,res,next)=>{const b=own(req.user.sub,req.params.id);if(!b)return res.status(403).json({error:'Acceso no autorizado.'});req.importBusiness=b;next();};
 app.get('/api/businesses/:id/clients/import/template',auth,owner,(_req,res)=>res.type('text/csv').attachment('plantilla-clientas.csv').send('\uFEFFNombre;Apellido;WhatsApp;Email;Notas\r\n'));
 app.post('/api/businesses/:id/clients/import/preview',auth,owner,(req,res)=>{
  res.set('Cache-Control','no-store');upload(req,res,async error=>{
   if(error)return res.status(400).json({error:'Adjuntá un solo archivo CSV, TSV o Excel .xlsx de hasta 2 MB.'});
   try{
    if(!req.file)throw Error('Elegí una planilla para revisar.');
    const extension=path.extname(req.file.originalname).toLowerCase();if(!['.csv','.tsv','.xlsx'].includes(extension))throw Error('Usá un CSV, TSV o Excel .xlsx. Los archivos .xls se deben guardar como .xlsx o CSV.');
    const now=new Date().toISOString();
    db.prepare('DELETE FROM client_imports WHERE (committed_at IS NULL AND expires_at<?) OR (committed_at IS NOT NULL AND datetime(committed_at)<datetime(?,\'-30 days\'))').run(now,now);
    if(db.prepare('SELECT count(*) n FROM client_imports WHERE business_id=? AND datetime(created_at)>datetime(?,\'-5 minutes\')').get(req.importBusiness.id,now).n>=20)return res.status(429).json({error:'Revisaste varias planillas. Esperá unos minutos y volvé a intentar.'});
    let table;
    if(extension==='.xlsx'){validateWorkbookZip(req.file.buffer);table=await readSheet(req.file.buffer,{parseNumber:string=>string});}else table=parseCsv(decode(req.file.buffer));
    table=table.filter(row=>row.some(value=>value!==null&&String(value).trim()!==''));
    if(table.length<2)throw Error('La planilla debe tener encabezados y al menos una clienta.');
    if(table.length>maxRows+1||table.some(row=>row.length>maxColumns))throw Error('Importá hasta 2000 clientas y 40 columnas por archivo.');
    if(table.some(row=>row.some(cell=>typeof cell==='object'&&cell!==null&&!(cell instanceof Date)||String(cell??'').length>4096)))throw Error('Usá texto en las columnas de nombre, teléfono, email y notas.');
    const columns=table[0].map(value=>String(value??'').trim().slice(0,120));
    const mapping=validateMapping(req.body.mapping?JSON.parse(req.body.mapping):suggestMapping(columns),columns);
    const needs_mapping=mapping.name<0||mapping.phone<0&&mapping.email<0;
    const rows=needs_mapping?[]:previewClients(req.importBusiness.id,table,mapping);
    const id=crypto.randomBytes(24).toString('hex'),expires=new Date(Date.now()+15*60000).toISOString();
    if(!needs_mapping)db.prepare('INSERT INTO client_imports(id,business_id,rows_json,created_at,expires_at) VALUES(?,?,?,?,?)').run(id,req.importBusiness.id,JSON.stringify(rows),now,expires);
    res.json({id:needs_mapping?null:id,columns,mapping,needs_mapping,rows,total:table.length-1,expires_at:needs_mapping?null:expires,summary:{ready:rows.filter(row=>row.status==='ready').length,duplicate:rows.filter(row=>row.status==='duplicate').length,invalid:rows.filter(row=>row.status==='invalid').length}});
   }catch(e){res.status(400).json({error:e instanceof SyntaxError?'Revisá la selección de columnas.':e.message?.startsWith('Invalid')?'El archivo Excel no se pudo leer. Guardalo nuevamente como .xlsx o CSV.':e.message||'No se pudo leer la planilla.'});}
  });
 });
 app.post('/api/businesses/:id/clients/import/:token/commit',auth,owner,(req,res)=>{
  res.set('Cache-Control','no-store');
  const saved=db.prepare('SELECT * FROM client_imports WHERE id=? AND business_id=?').get(req.params.token,req.importBusiness.id);
  if(!saved)return res.status(404).json({error:'La vista previa no existe. Volvé a elegir el archivo.'});
  if(saved.committed_at)return res.json({...JSON.parse(saved.result_json),already_imported:true});
  if(Date.parse(saved.expires_at)<=Date.now())return res.status(410).json({error:'La vista previa venció. Revisá el archivo nuevamente antes de importar.'});
  const rows=JSON.parse(saved.rows_json),selected=req.body?.rows;
  if(!Array.isArray(selected)||!selected.length||selected.length>maxRows||selected.some(n=>!Number.isInteger(n))||new Set(selected).size!==selected.length||selected.some(n=>!rows.some(row=>row.row===n&&row.status==='ready')))return res.status(400).json({error:'Seleccioná al menos una fila válida de la vista previa.'});
  const result=db.transaction(()=>{
   const current=db.prepare('SELECT committed_at,result_json FROM client_imports WHERE id=?').get(saved.id);if(current.committed_at)return {...JSON.parse(current.result_json),already_imported:true};
   const index=indexFor(req.importBusiness.id);let created=0,skipped=0;
   const insert=db.prepare('INSERT INTO clients(business_id,name,email,phone,phone_normalized,notes) VALUES(?,?,?,?,?,?)');
   for(const row of rows.filter(row=>selected.includes(row.row))){
    if(classify(row,index).status!=='ready'){skipped++;continue;}
    insert.run(req.importBusiness.id,row.name,row.email||null,row.phone,normalizePhone(row.phone),row.notes);created++;
   }
   const summary={ok:true,created,skipped,selected:selected.length};
   db.prepare("UPDATE client_imports SET committed_at=?,result_json=?,rows_json='[]' WHERE id=?").run(new Date().toISOString(),JSON.stringify(summary),saved.id);
   return summary;
  }).immediate();
  res.json(result);
 });
}
