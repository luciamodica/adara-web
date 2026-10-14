import {readQrSettings} from './qr-settings.js';
const color=(value,fallback)=>/^#[\da-f]{6}$/i.test(value||'')?value:fallback;
const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
export const luminance=hex=>rgb(hex).map(x=>{const n=x/255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4}).reduce((sum,x,i)=>sum+x*[.2126,.7152,.0722][i],0);
export const contrast=(a,b)=>(Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05);
export function qrBrand(b){
 const design=readQrSettings(b),custom=design.color_mode==='custom';
 const primary=color(custom?design.primary:b.primary_color,'#8d665b'),accent=color(custom?design.accent:b.accent_color,'#d9b8aa'),background=color(custom?design.background:b.background_color,'#fbf8f4');
 let channels=rgb(primary),ink=primary;
 // Keep the chosen hue, with enough contrast for scanning on a white quiet zone.
 while(contrast(ink,'#ffffff')<7){channels=channels.map(n=>Math.floor(n*.9));ink='#'+channels.map(n=>n.toString(16).padStart(2,'0')).join('')}
 const surface=!custom&&b.template_id==='noir'&&luminance(primary)<.3?primary:background;
 const requested=color(design.text_color,'#29231f');
 const foreground=contrast(surface,requested)>=4.5?requested:contrast(surface,'#29231f')>=4.5?'#29231f':'#ffffff';
 return {design,name:b.name,slug:b.slug,template:b.template_id,logo:b.logo_image||'',tagline:b.qr_tagline??'Tu próximo momento empieza acá',phone:b.phone||'',instagram:b.instagram||'',tiktok:b.tiktok||'',address:b.address||'',email:b.public_email||'',primary,accent,background:surface,foreground,qrInk:ink};
}
