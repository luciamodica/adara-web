import fonts from '../shared/fonts.json';
export function fontTheme(form:any){
 const heading=fonts.headings.find(x=>x.id===form.heading_font)||fonts.headings[1],body=fonts.bodies.find(x=>x.id===form.body_font)||fonts.bodies[0];
 return {'--public-heading':heading.family,'--public-heading-weight':String(heading.weight),'--public-heading-style':heading.style,'--public-body':body.family};
}
export default function FontPicker({type,value,onChange}:{type:'headings'|'bodies';value:string;onChange:(value:string)=>void}){
 const options=fonts[type],selected=options.find(x=>x.id===value)||options[0];
 return <><select value={value} onChange={e=>onChange(e.target.value)}>{options.map(x=><option key={x.id} value={x.id}>{x.label}</option>)}</select><span className={'fontPickerSample '+(type==='headings'?'headingSample':'')} style={{fontFamily:selected.family,fontStyle:type==='headings'?(selected as any).style:'normal',fontWeight:type==='headings'?(selected as any).weight:400}}>{type==='headings'?'Tu marca, con personalidad.':'Reservá tu próximo turno. ¡Te esperamos!'}</span></>;
}
