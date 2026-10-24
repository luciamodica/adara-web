import fs from 'node:fs';
import path from 'node:path';
import industries from '../shared/industries.json' with {type:'json'};

export {industries};
export const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const signup=industry=>'/registro?category='+encodeURIComponent(industry.category);
export function industryMarkup(industry){
 const e=escapeHtml;
 return `<div class="platformHome"><header class="platformHeader"><a class="platformWordmark" href="/">Adara Web</a><nav class="industryFallbackNav"><a href="/#planes">Planes</a><a href="/login">Ingresar</a><a class="platformButton" href="${e(signup(industry))}">Probar gratis</a></nav></header><main class="industryPage"><nav class="industryBreadcrumb" aria-label="Ruta de navegación"><a href="/">Adara Web</a><span>/</span><span>${e(industry.label)}</span></nav><section class="industryHero"><div><span class="platformEyebrow">${e(industry.eyebrow)}</span><h1>${e(industry.heading)}</h1><p>${e(industry.intro)}</p><a class="platformButton" href="${e(signup(industry))}">Crear mi página</a><a class="platformSecondary" href="/#planes">Comparar planes</a><small>Sin tarjeta para comenzar</small></div><aside class="industryExample"><span>EJEMPLO DE ORGANIZACIÓN</span><h2>Tus servicios, a un clic.</h2>${industry.examples.map((name,i)=>`<div><span>0${i+1}</span><b>${e(name)}</b></div>`).join('')}<p>Servicios ilustrativos. Vos elegís nombres, precios y duración.</p></aside></section><section class="industryContext"><h2>${e(industry.contextTitle)}</h2><p>${e(industry.context)}</p></section><section class="industryFeatures" aria-label="Funciones para tu negocio">${industry.features.map(f=>`<article><h2>${e(f.title)}</h2><p>${e(f.text)}</p></article>`).join('')}</section><section class="industryContext"><h2>${e(industry.extraTitle)}</h2><p>${e(industry.extra)}</p></section><section class="industryFaq"><h2>Antes de empezar</h2>${industry.faqs.map(f=>`<details><summary>${e(f.question)}</summary><p>${e(f.answer)}</p></details>`).join('')}</section><section class="platformFinal"><h2>Tu próximo turno empieza con tu página.</h2><a class="platformButton" href="${e(signup(industry))}">Crear mi cuenta gratis</a><p>Consultá la duración de la prueba y los precios vigentes en <a href="/#planes">Planes</a>.</p></section><nav class="industryOther" aria-label="Adara por rubro">${industries.filter(i=>i.slug!==industry.slug).map(i=>`<a href="/para/${i.slug}">Adara para ${e(i.label.toLowerCase())}</a>`).join('')}</nav></main><footer class="platformHomeFooter"><a href="/">Adara Web</a><a href="/privacidad">Privacidad</a><a href="/terminos">Términos y condiciones</a></footer></div>`;
}
export function marketingDocument(template,{origin,industry=null}){
 const pathname=industry?'/para/'+industry.slug:'/',url=origin+pathname;
 const title=industry?.title||'Adara Web — Tu web, agenda y reservas online';
 const description=industry?.description||'Creá la página de tu negocio, organizá tus turnos y elegí cómo cobrar señas. Una agenda o un equipo, con planes y prueba gratis sin tarjeta.';
 const html=template.replace(/<title>[\s\S]*?<\/title>/i,`<title>${escapeHtml(title)}</title>`).replace(/<meta\s+name="description"[^>]*>/i,`<meta name="description" content="${escapeHtml(description)}" />`);
 const breadcrumb=industry?{'@context':'https://schema.org','@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'Adara Web',item:origin+'/'},{'@type':'ListItem',position:2,name:industry.label,item:url}]}:{'@context':'https://schema.org','@type':'WebSite',name:'Adara Web',url:origin+'/'};
 const metadata=`<link rel="canonical" href="${escapeHtml(url)}" /><meta property="og:type" content="website" /><meta property="og:title" content="${escapeHtml(title)}" /><meta property="og:description" content="${escapeHtml(description)}" /><meta property="og:url" content="${escapeHtml(url)}" /><meta property="og:image" content="${escapeHtml(origin+'/images/adara-blue-logo.png')}" /><script type="application/ld+json">${JSON.stringify(breadcrumb).replace(/</g,'\\u003c')}</script>`;
 const homeMarkup='<main class="industryContext"><h1>Tu web. Tus turnos. Todo en un solo lugar.</h1><p>Adara Web reúne tu página profesional, reservas online y gestión de tu negocio. Conocé nuestros planes y empezá tu prueba sin tarjeta.</p><a href="/registro">Crear mi cuenta</a><nav aria-label="Adara por rubro">'+industries.map(i=>`<a href="/para/${i.slug}">Agenda para ${escapeHtml(i.label.toLowerCase())}</a>`).join(' ')+'</nav></main>';
 return html.replace('</head>',metadata+'</head>').replace('<div id="root"></div>','<div id="root">'+(industry?industryMarkup(industry):homeMarkup)+'</div>');
}
export function registerMarketingPages(app,{distDir,frontendUrl,enabled}){
 const origin=new URL(frontendUrl).origin;
 app.get('/sitemap.xml',(_req,res)=>res.type('application/xml').set('Cache-Control','public, max-age=3600').send('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+['/',...industries.map(i=>'/para/'+i.slug)].map(route=>`<url><loc>${escapeHtml(origin+route)}</loc></url>`).join('')+'</urlset>'));
 app.get('/robots.txt',(_req,res)=>res.type('text/plain').send('User-agent: *\nAllow: /\nAllow: /api/public/\nDisallow: /api/\nSitemap: '+origin+'/sitemap.xml\n'));
 if(!enabled)return;
 const render=(req,res,industry)=>{const template=fs.readFileSync(path.join(distDir,'index.html'),'utf8');res.type('html').set('Cache-Control','no-store').send(marketingDocument(template,{origin,industry}));};
 app.get('/',(req,res)=>render(req,res,null));
 app.get('/para/:slug',(req,res)=>{
  const industry=industries.find(i=>i.slug===req.params.slug);
  if(!industry)return res.status(404).set('X-Robots-Tag','noindex').type('html').send('<!doctype html><html lang="es"><head><title>Página no encontrada | Adara Web</title></head><body><h1>Página no encontrada</h1><a href="/">Volver a Adara Web</a></body></html>');
  render(req,res,industry);
 });
 app.use((req,res,next)=>{if(/^\/(admin|super-admin|login|registro|mi-reserva|verificar-email|olvide-contrasena|restablecer-contrasena)(\/|$)/.test(req.path))res.set('X-Robots-Tag','noindex, nofollow');next();});
}
