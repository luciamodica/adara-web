import {validHomeChannel} from './home-analytics-tag.js';
export const validHomePixel=id=>typeof id==='string'&&/^[1-9]\d{4,24}$/.test(id);

export function homeMetaDocument(id,channel){
 if(!validHomePixel(id)||!validHomeChannel(channel))throw Error('Configuración de Meta Pixel inválida.');
 const settings=JSON.stringify({id,channel});
 return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="referrer" content="no-referrer"><title>Adara Web</title><script>
 const settings={...${settings},origin:location.origin};
 // Strip the frame endpoint, ID and nonce before the SDK can inspect its URL.
 history.replaceState(null,'','/');
 const fbq=window.fbq=function(){fbq.callMethod?fbq.callMethod.apply(fbq,arguments):fbq.queue.push(arguments)};
 window._fbq=fbq;fbq.push=fbq;fbq.loaded=true;fbq.version='2.0';fbq.queue=[];fbq.disablePushState=true;
 fbq('consent','grant');fbq('set','autoConfig',false,settings.id);fbq('init',settings.id);
 function homeTagStatus(status){parent.postMessage({type:'adara-home-tag',channel:settings.channel,id:settings.id,status},settings.origin)}
 addEventListener('message',event=>{const d=event.data;
 if(event.source!==parent||event.origin!==settings.origin||!d||d.channel!==settings.channel)return;
 if(d.event==='revoke'){fbq('consent','revoke');return;}
 if(!['page_view','registration_start','sign_up'].includes(d.event)||!['/','/registro'].includes(d.path))return;
 history.replaceState(null,'',d.path);
 const name={page_view:'PageView',registration_start:'RegistrationStart',sign_up:'CompleteRegistration'}[d.event];
 fbq(d.event==='registration_start'?'trackSingleCustom':'trackSingle',settings.id,name,{page_path:d.path});
 });
 </script><script async src="https://connect.facebook.net/en_US/fbevents.js" onload="homeTagStatus('ready')" onerror="homeTagStatus('error')"></script></head><body></body></html>`;
}

export function registerHomeMeta(app,{getSetting}){
 app.get('/api/public/home-meta/frame',(req,res)=>{
  res.set({'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','X-Frame-Options':'SAMEORIGIN','Content-Security-Policy':"frame-ancestors 'self'"});
  const id=getSetting('home_meta_pixel_id','');
  if(getSetting('home_meta_enabled','0')!=='1'||!validHomePixel(id))return res.sendStatus(204);
  if(!validHomeChannel(req.query.channel))return res.status(400).send('Canal inválido.');
  if(req.query.id!==id)return res.status(409).send('La configuración de Meta Pixel cambió.');
  res.type('html').send(homeMetaDocument(id,req.query.channel));
 });
}
