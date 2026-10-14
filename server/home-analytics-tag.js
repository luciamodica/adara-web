export const validHomeId=id=>typeof id==='string'&&/^G-[A-Z0-9]{4,30}$/.test(id);
export const validHomeChannel=channel=>typeof channel==='string'&&/^home-[a-z0-9-]{1,100}$/.test(channel);

export function homeTagDocument(id,channel){
 if(!validHomeId(id)||!validHomeChannel(channel))throw Error('Configuración de medición inválida.');
 const settings=JSON.stringify({id,channel}).replace(/</g,'\\u003c');
 // A real same-origin document gives the SDK a stable URL and cookie context.
 // Only the explicit, sanitized events below cross into this document.
 return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="referrer" content="no-referrer"><title>Adara Web</title><script>
 const settings={...${settings},origin:location.origin};window.dataLayer=[];function gtag(){dataLayer.push(arguments)}
 function homeTagStatus(status){parent.postMessage({channel:settings.channel,type:'adara-home-tag',status,id:settings.id},settings.origin)}
 gtag('consent','default',{analytics_storage:'granted',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
 gtag('js',new Date());
 gtag('config',settings.id,{send_page_view:false,page_location:settings.origin+'/',page_referrer:'',allow_google_signals:false,allow_ad_personalization_signals:false});
 addEventListener('message',event=>{const d=event.data;
 if(event.source!==parent||event.origin!==settings.origin||!d||d.channel!==settings.channel||!['page_view','registration_start','sign_up'].includes(d.event)||!['/','/registro'].includes(d.path))return;
 let referrer='';try{if(d.referrer){const u=new URL(d.referrer);if(['http:','https:'].includes(u.protocol))referrer=u.origin+'/';}}catch{}
 gtag('event',d.event,{send_to:settings.id,page_location:settings.origin+d.path,page_referrer:referrer,page_title:d.path==='/'?'Adara Web — Home':'Adara Web — Registro',...(d.event==='sign_up'?{method:'email'}:{})});
 });
 </script><script async src="https://www.googletagmanager.com/gtag/js?id=${id}" onload="homeTagStatus('ready')" onerror="homeTagStatus('error')"></script></head><body></body></html>`;
}

export function registerHomeAnalytics(app,{getSetting}){
 app.get('/api/public/home-analytics/frame',(req,res)=>{
  res.set({'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','X-Frame-Options':'SAMEORIGIN','Content-Security-Policy':"frame-ancestors 'self'"});
  const id=getSetting('home_ga_id','');
  if(getSetting('home_analytics_enabled','0')!=='1'||!validHomeId(id))return res.sendStatus(204);
  if(!validHomeChannel(req.query.channel))return res.status(400).send('Canal inválido.');
  if(req.query.id!==id)return res.status(409).send('La configuración de medición cambió.');
  res.type('html').send(homeTagDocument(id,req.query.channel));
 });
}
