export const DEFAULT_SECTIONS=['hero','booking','promotions','services','posts','faqs'];
export function readSections(value){
 try{const list=Array.isArray(value)?value:JSON.parse(value||'[]');if(list.length===DEFAULT_SECTIONS.length&&new Set(list).size===list.length&&list.every(x=>DEFAULT_SECTIONS.includes(x)))return list}catch{}
 return [...DEFAULT_SECTIONS];
}
export function validateSections(value){
 if(!Array.isArray(value)||value.length!==DEFAULT_SECTIONS.length||new Set(value).size!==value.length||value.some(x=>!DEFAULT_SECTIONS.includes(x)))throw new Error('El orden debe incluir cada sección una sola vez.');
 return value;
}
