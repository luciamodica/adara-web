export function validateSlotInterval(value,fallback=30){
 if(value===undefined)return fallback;
 const n=Number(value);if(!['number','string'].includes(typeof value)||!Number.isInteger(n)||n<5||n>720)throw new Error('El intervalo debe ser un número entero entre 5 y 720 minutos.');
 return n;
}
export function durationVisibility(value,current=1){
 if(value===undefined)return current;
 if(![true,false,0,1].includes(value))throw new Error('Revisá la opción de mostrar duración.');
 return value?1:0;
}
