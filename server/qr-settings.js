const fonts=['modern','editorial','friendly'],layouts=['minimal','frame','bold'];
const hex=v=>typeof v==='string'&&/^#[a-f0-9]{6}$/i.test(v);
export function readQrSettings(b){let value={};try{value=JSON.parse(b.qr_settings_json||'{}')}catch{}return value&&typeof value==='object'&&!Array.isArray(value)?value:{}}
export function validateQrSettings(x,current={}){
 if(!x||typeof x!=='object'||Array.isArray(x))throw Error('Revisá el diseño de tu QR.');
 const out={...current};
 for(const key of Object.keys(x)){
  const v=x[key];if(!['color_mode','primary','accent','background','text_color','font','layout','background_image','overlay','logo_size','show_logo_in_code'].includes(key))throw Error('Opción de diseño desconocida.');
  if(['primary','accent','background','text_color'].includes(key)&&!hex(v))throw Error('Elegí colores válidos para el QR.');
  if(key==='color_mode'&&!['page','custom'].includes(v))throw Error('Elegí los colores de tu página o colores propios.');
  if(key==='font'&&!fonts.includes(v))throw Error('Elegí una de las tipografías disponibles.');
  if(key==='layout'&&!layouts.includes(v))throw Error('Elegí un diseño disponible.');
  if(key==='background_image'&&(typeof v!=='string'||v.length>2048||(v&&!/^\/(uploads|images)\/[\w.-]+\.(png|jpe?g|webp|gif)$/i.test(v))))throw Error('Subí una imagen PNG, JPG, WebP o GIF para el fondo.');
  if(key==='overlay'&&(!Number.isInteger(v)||v<60||v>95))throw Error('La suavidad del fondo debe estar entre 60 y 95.');
  if(key==='logo_size'&&(!Number.isInteger(v)||v<80||v>220))throw Error('El tamaño del logo debe estar entre 80 y 220.');
  if(key==='show_logo_in_code'&&typeof v!=='boolean')throw Error('Revisá la opción del logo dentro del QR.');
  out[key]=v;
 }
 return out;
}
