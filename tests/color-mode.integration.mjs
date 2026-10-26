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
