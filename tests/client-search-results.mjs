import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {renderToStaticMarkup} from 'react-dom/server';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
const {default:Results}=await server.ssrLoadModule('/src/ClientSearchResults.tsx');
const clients=[{id:7,name:'José Pérez',phone:'1234',email:'jose@example.test'},{id:8,name:'José Pérez',phone:'5678'}];
let selected;
const result=Results({clients,onSelect:client=>{selected=client}});
const html=renderToStaticMarkup(result);
assert.equal((html.match(/<button/g)||[]).length,2);
assert.equal((html.match(/type="button"/g)||[]).length,2); // Selecting a client must never submit the booking form.
assert.ok(html.includes('José Pérez')&&html.includes('1234')&&html.includes('5678'));
const rows=result.props.children;
rows[1].props.children.props.onClick();
assert.equal(selected.id,8); // Same names remain distinguishable by contact and use the correct client ID.
rows[0].props.children.props.onClick();assert.equal(selected.id,7);
assert.equal((renderToStaticMarkup(Results({clients:[],onSelect(){}})).match(/<button/g)||[]).length,0);
console.log('OK: resultados visibles, contactos para distinguir nombres iguales, selección por ID y botones sin enviar el formulario.');

}finally{await server.close()}
