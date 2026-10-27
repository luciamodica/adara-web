export const PALETTE_FIELDS=['primary','accent','background','surface','text'];
export const isHexColor=value=>typeof value==='string'&&/^#[\da-f]{6}$/i.test(value);
const color=(value,fallback)=>isHexColor(value)?value.toLowerCase():fallback;
const rgb=hex=>hex.slice(1).match(/../g).map(x=>parseInt(x,16));
export function mixColors(a,b,weight=.5){const x=rgb(a),y=rgb(b);return '#'+x.map((n,i)=>Math.round(n*weight+y[i]*(1-weight)).toString(16).padStart(2,'0')).join('')}
const luminance=hex=>rgb(hex).map(n=>{n/=255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4}).reduce((sum,n,i)=>sum+n*[.2126,.7152,.0722][i],0);
export function colorContrast(a,b){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)}
export const buttonText=background=>colorContrast('#ffffff',background)>=colorContrast('#000000',background)?'#ffffff':'#000000';
export function readPagePalettes(value){
 let parsed=value;try{if(typeof value==='string')parsed=JSON.parse(value)}catch{return {}}
 if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))return {};
 const result={};for(const mode of ['light','dark']){if(!parsed[mode]||typeof parsed[mode]!=='object')continue;const palette={};for(const key of PALETTE_FIELDS)if(isHexColor(parsed[mode][key]))palette[key]=parsed[mode][key].toLowerCase();if(Object.keys(palette).length)result[mode]=palette}return result;
}
export function resolvePagePalettes(b={}){
 const saved=readPagePalettes(b.color_palettes??b.color_palettes_json);
 const background=color(b.background_color,'#fbf8f4'),primary=color(b.primary_color,'#9b6b61'),accent=color(b.accent_color,'#d8b7a8');
 const light={primary,accent,background,surface:luminance(background)<.2?mixColors('#ffffff',background,.08):'#ffffff',text:buttonText(background)};
 // Legacy color fields remain the canonical light brand colors for templates, QR codes and listings.
 Object.assign(light,saved.light,{primary,accent,background});
 const dark={primary:mixColors(primary,'#dceaff',.3),accent:'#a7cdff',background:'#0b1424',surface:'#142137',text:'#edf3ff',...saved.dark};
 return {light,dark};
}
export function paletteIssues(palette){
 if(PALETTE_FIELDS.some(key=>!isHexColor(palette?.[key])))return ['Usá colores con formato #RRGGBB.'];
 const issues=[];if(colorContrast(palette.text,palette.background)<4.5)issues.push('El texto necesita más contraste con el fondo.');if(colorContrast(palette.text,palette.surface)<4.5)issues.push('El texto necesita más contraste con las tarjetas.');return issues;
}
export function validatePagePalettes(value,b={}){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!['light','dark'].includes(key)))throw new Error('Revisá las paletas de modo claro y oscuro.');
 const result=resolvePagePalettes(b);
 for(const mode of ['light','dark']){
  if(value[mode]===undefined)continue;const palette=value[mode];
  if(!palette||typeof palette!=='object'||Array.isArray(palette)||Object.keys(palette).some(key=>!PALETTE_FIELDS.includes(key)))throw new Error('Revisá los colores del modo '+(mode==='light'?'claro.':'oscuro.'));
  for(const key of PALETTE_FIELDS)if(palette[key]!==undefined){if(!isHexColor(palette[key]))throw new Error('Usá colores con formato #RRGGBB.');result[mode][key]=palette[key].toLowerCase()}
  const issues=paletteIssues(result[mode]);if(issues.length)throw new Error('Modo '+(mode==='light'?'claro':'oscuro')+': '+issues.join(' '));
 }
 return result;
}
export function paletteTokens(palette){
 const {primary,accent,background,surface,text}=palette;
 let muted=mixColors(text,surface,.78);if(Math.min(colorContrast(muted,background),colorContrast(muted,surface))<4.5)muted=text;
 const link=Math.min(colorContrast(primary,background),colorContrast(primary,surface))>=4.5?primary:text;
 return {primary,accent,background,surface,text,muted,link,raised:mixColors(text,surface,.06),line:mixColors(text,surface,.3),buttonText:buttonText(primary),selectedText:buttonText(primary),scheme:luminance(background)<.2?'dark':'light'};
}
