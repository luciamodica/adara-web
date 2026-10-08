export async function api(path:string,options:any={}){
  const isForm=options.body instanceof FormData;
  const response=await fetch('/api'+path,{
    ...options,
    headers:{...(isForm?{}:{'Content-Type':'application/json'}),...(options.headers||{})}
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.error||'Ocurrió un error');
  return data;
}

export const money=(cents:number)=>new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format((Number(cents)||0)/100);
export const pesos=(value:number)=>new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(Number(value)||0);
export const fmtDate=(iso:string)=>iso?new Date(iso+'T12:00:00').toLocaleDateString('es-AR',{day:'2-digit',month:'2-digit',year:'numeric'}):'';
