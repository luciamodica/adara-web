export const DEFAULT_SECTIONS=['hero','booking','promotions','services','posts','faqs','reviews'];
const valid=list=>Array.isArray(list)&&new Set(list).size===list.length&&list.every(x=>DEFAULT_SECTIONS.includes(x))&&(list.length===DEFAULT_SECTIONS.length||list.length===DEFAULT_SECTIONS.length-1&&!list.includes('reviews'));
export function readSections(value){
 try{const list=Array.isArray(value)?value:JSON.parse(value||'[]');if(valid(list))return list.includes('reviews')?list:[...list,'reviews']}catch{}
 return [...DEFAULT_SECTIONS];
}
export function validateSections(value){
 if(!valid(value))throw new Error('El orden debe incluir cada sección una sola vez.');
 return readSections(value);
}
