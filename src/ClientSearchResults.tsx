type Client={id:number|string;name:string;phone?:string;email?:string};
export default function ClientSearchResults({clients,onSelect}:{clients:Client[];onSelect:(client:Client)=>void}){
 return <ul className="manualClientResults" aria-label="Clientes encontrados">{clients.map(client=><li key={client.id}><button type="button" className="outline manualClientResult" onClick={()=>onSelect(client)}><span><b>{client.name}</b><small>{[client.phone,client.email].filter(Boolean).join(' · ')||'Sin datos de contacto'}</small></span><span className="manualClientSelect">Seleccionar</span></button></li>)}</ul>;
}
