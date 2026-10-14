export const HOME_CONSENT_KEY='adara-home-analytics-consent';
export const allowedHomePath=(path:string)=>path==='/'||path==='/registro';
export const validHomeId=(id:unknown):id is string=>typeof id==='string'&&/^G-[A-Z0-9]{4,30}$/.test(id);
export function homeTagDocument(id:string,origin:string,channel:string){
 if(!validHomeId(id)||!/^https?:\/\//.test(origin)||!/^home-[a-z0-9-]+$/.test(channel))throw Error('Configuración de medición inválida.');
 const settings=JSON.stringify({id,origin,channel}).replace(/</g,'\\u003c');
 // The SDK has its own document and never sees forms, private routes or tenant pages.
 return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="referrer" content="no-referrer"><title>Adara Web</title><script>
 const settings=${settings};window.dataLayer=[];function gtag(){dataLayer.push(arguments)}
 gtag('consent','default',{analytics_storage:'granted',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
 gtag('js',new Date());
 gtag('config',settings.id,{send_page_view:false,page_location:settings.origin+'/',page_referrer:'',allow_google_signals:false,allow_ad_personalization_signals:false});
 addEventListener('message',event=>{const d=event.data;
 if(event.source!==parent||event.origin!==settings.origin||!d||d.channel!==settings.channel||!['page_view','registration_start','sign_up'].includes(d.event)||!['/','/registro'].includes(d.path))return;
 let referrer='';try{if(d.referrer){const u=new URL(d.referrer);if(['http:','https:'].includes(u.protocol))referrer=u.origin+'/';}}catch{}
 gtag('event',d.event,{send_to:settings.id,page_location:settings.origin+d.path,page_referrer:referrer,page_title:d.path==='/'?'Adara Web — Home':'Adara Web — Registro',...(d.event==='sign_up'?{method:'email'}:{})});
 });
 </script><script async src="https://www.googletagmanager.com/gtag/js?id=${id}"></script></head><body></body></html>`;
}
export function createHomeTracker(win:Window,doc:Document){
 let frame:HTMLIFrameElement|undefined,id='',path='',consent=false,ready=false,queue:any[]=[],lastView='',channel='';
 const destroy=()=>{frame?.remove();frame=undefined;ready=false;queue=[];lastView='';channel='';};
 const externalReferrer=()=>{try{const u=new URL(doc.referrer);return ['https:','http:'].includes(u.protocol)&&u.origin!==win.location.origin?u.origin+'/':''}catch{return ''}};
 const post=(event:string)=>{
  if(!frame||!consent||!allowedHomePath(path))return;
  const data={channel,event,path,referrer:externalReferrer()};
  if(ready)frame.contentWindow?.postMessage(data,win.location.origin);else if(queue.length<30)queue.push(data);
 };
 return {
  sync(config:{home_ga_id?:string;home_analytics_enabled?:boolean},nextPath:string,accepted:boolean){
   path=nextPath;consent=accepted;
   if(!accepted||!config.home_analytics_enabled||!validHomeId(config.home_ga_id)||!allowedHomePath(nextPath)){destroy();return;}
   if(id!==config.home_ga_id){destroy();id=config.home_ga_id;}
   if(!frame){
    channel='home-'+(win.crypto?.randomUUID?.()||Date.now().toString(36));
    const created=doc.createElement('iframe');frame=created;created.hidden=true;created.title='Medición de visitas de Adara Web';created.setAttribute('aria-hidden','true');created.setAttribute('tabindex','-1');created.setAttribute('sandbox','allow-scripts allow-same-origin');created.referrerPolicy='no-referrer';created.srcdoc=homeTagDocument(id,win.location.origin,channel);
    created.addEventListener('load',()=>{if(frame!==created)return;ready=true;for(const data of queue)created.contentWindow?.postMessage(data,win.location.origin);queue=[];});doc.body.appendChild(created);
   }
   const view=id+':'+nextPath;if(lastView!==view){lastView=view;post('page_view');}
  },
  emit(event:'registration_start'|'sign_up'){if(['registration_start','sign_up'].includes(event))post(event)},
  destroy
 };
}
let activeTracker:ReturnType<typeof createHomeTracker>|undefined;
export function setActiveHomeTracker(tracker:ReturnType<typeof createHomeTracker>|undefined){activeTracker=tracker;}
export function trackHomeEvent(event:'registration_start'|'sign_up'){activeTracker?.emit(event);}
