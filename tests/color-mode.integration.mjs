import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import assert from 'node:assert/strict';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
let checks=0;
for(const [saved,systemDark,expected,blocked] of [
 ['dark',false,'dark'],['light',true,'light'],[null,true,'dark'],[null,false,'light'],
 ['invalid',true,'dark'],['invalid',false,'light'],[null,true,'dark',true],[null,false,'light',true],
]){
 const root={dataset:{},style:{}};
 runInNewContext(script,{localStorage:{getItem(key){assert.equal(key,'adara-color-mode');if(blocked)throw Error('Storage unavailable');return saved}},matchMedia:()=>({matches:systemDark}),document:{documentElement:root}});
 assert.equal(root.dataset.colorMode,expected);
 assert.equal(root.style.colorScheme,expected);
 checks++;
}
console.log(`OK: ${checks} casos de modo inicial: preferencia guardada, sistema, valores inválidos y almacenamiento bloqueado.`);

// Normal-size text must remain readable on every dark reading surface.
const css=readFileSync(new URL('../src/color-mode.css',import.meta.url),'utf8');
const token=name=>{const value=css.match(new RegExp(`--mode-${name}:(#[a-f0-9]{6})`,'i'))?.[1];assert.ok(value,`Missing ${name} color`);return value};
const luminance=hex=>hex.slice(1).match(/../g).map(c=>parseInt(c,16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4).reduce((sum,c,i)=>sum+c*[.2126,.7152,.0722][i],0);
const contrast=(foreground,background)=>{const a=luminance(foreground),b=luminance(background);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05)};
let paletteChecks=0;
for(const text of ['ink','muted','link'])for(const background of ['bg','surface','raised']){
 assert.ok(contrast(token(text),token(background))>=4.5,`${text} must reach 4.5:1 on ${background}`);paletteChecks++;
}
assert.ok(contrast('#ffffff','#2563d9')>=4.5,'The active billing-period label must remain readable');paletteChecks++;
assert.ok(contrast('#0b1424','#b6d7ff')>=4.5,'Selected calendar days must remain readable');paletteChecks++;
console.log(`OK: ${paletteChecks} combinaciones de contraste de texto, enlaces y controles seleccionados.`);
