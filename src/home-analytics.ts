export const HOME_META_CONSENT_KEY='adara-home-meta-consent';
export const validHomePixel=(id:unknown):id is string=>typeof id==='string'&&/^[1-9]\d{4,24}$/.test(id);
export const HOME_CONSENT_KEY='adara-home-analytics-consent';
export const allowedHomePath=(path:string)=>path==='/'||path==='/registro';
export const validHomeId=(id:unknown):id is string=>typeof id==='string'&&/^G-[A-Z0-9]{4,30}$/.test(id);
export function readHomeChoices(storage:Pick<Storage,'getItem'>){
 const read=(key:string)=>{try{const value=storage.getItem(key);return value==='yes'||value==='no'?value:null}catch{return null}};
 return {ga:read(HOME_CONSENT_KEY),meta:read(HOME_META_CONSENT_KEY)};
}
export function needsHomeConsent(config:any,choices:{ga:string|null;meta:string|null}){
 return !!((config.home_analytics_enabled&&validHomeId(config.home_ga_id)&&choices.ga===null)||(config.home_meta_enabled&&validHomePixel(config.home_meta_pixel_id)&&choices.meta===null));
}
export function createHomeTracker(win:Window,doc:Document,provider:'ga'|'meta'='ga'){
 const meta=provider==='meta';
 let frame:HTMLIFrameElement|undefined,id='',path='',consent=false,ready=false,queue:any[]=[],lastView='',channel='';
 const receive=(event:MessageEvent)=>{
  const data=event.data;
  if(!frame||event.source!==frame.contentWindow||event.origin!==win.location.origin||!data||data.type!=='adara-home-tag'||data.channel!==channel||data.id!==id)return;
  if(data.status!=='ready')return;
  ready=true;for(const item of queue)frame.contentWindow?.postMessage(item,win.location.origin);queue=[];
 };
 const destroy=()=>{win.removeEventListener('message',receive);frame?.remove();frame=undefined;ready=false;queue=[];lastView='';channel='';};
 const externalReferrer=()=>{try{const u=new URL(doc.referrer);return ['https:','http:'].includes(u.protocol)&&u.origin!==win.location.origin?u.origin+'/':''}catch{return ''}};
 const post=(event:string)=>{
  if(!frame||!consent||!allowedHomePath(path))return;
  const data={channel,event,path,referrer:externalReferrer()};
  if(ready)frame.contentWindow?.postMessage(data,win.location.origin);else if(queue.length<30)queue.push(data);
 };
 return {
  sync(config:{home_ga_id?:string;home_analytics_enabled?:boolean;home_meta_pixel_id?:string;home_meta_enabled?:boolean},nextPath:string,accepted:boolean){
   const nextId=meta?config.home_meta_pixel_id:config.home_ga_id,enabled=meta?config.home_meta_enabled:config.home_analytics_enabled;
   path=nextPath;consent=accepted;
   if(!accepted||!enabled||!(meta?validHomePixel(nextId):validHomeId(nextId))||!allowedHomePath(nextPath)){destroy();return;}
   if(id!==nextId){destroy();id=nextId;}
   if(!frame){
    channel='home-'+(win.crypto?.randomUUID?.()||Date.now().toString(36));
    const created=doc.createElement('iframe');frame=created;created.hidden=true;created.title=meta?'Publicidad de Adara Web con Meta Pixel':'Medición de visitas de Adara Web';created.setAttribute('aria-hidden','true');created.setAttribute('tabindex','-1');created.setAttribute('sandbox','allow-scripts allow-same-origin');created.referrerPolicy='no-referrer';created.src=(meta?'/api/public/home-meta/frame?id=':'/api/public/home-analytics/frame?id=')+encodeURIComponent(id)+'&channel='+encodeURIComponent(channel);
    win.addEventListener('message',receive);doc.body.appendChild(created);
   }
   const view=id+':'+nextPath;if(lastView!==view){lastView=view;post('page_view');}
  },
  emit(event:'registration_start'|'sign_up'){if(['registration_start','sign_up'].includes(event))post(event)},
  destroy
 };
}
export const createHomeMetaTracker=(win:Window,doc:Document)=>createHomeTracker(win,doc,'meta');
let activeMetaTracker:ReturnType<typeof createHomeMetaTracker>|undefined;
export function setActiveHomeMetaTracker(tracker:ReturnType<typeof createHomeMetaTracker>|undefined){activeMetaTracker=tracker;}
let activeTracker:ReturnType<typeof createHomeTracker>|undefined;
export function setActiveHomeTracker(tracker:ReturnType<typeof createHomeTracker>|undefined){activeTracker=tracker;}
export function trackHomeEvent(event:'registration_start'|'sign_up'){activeTracker?.emit(event);activeMetaTracker?.emit(event);}
