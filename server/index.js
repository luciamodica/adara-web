import './production-env.js';
import {transferConfiguration} from './subscription-transfers.js';
import fontOptions from '../shared/fonts.json' with {type:'json'};
import {mercadoPagoAllowed,planHasMercadoPago,paymentFeatures} from './plan-payments.js';
import {registerGrowth,markSetup} from './growth.js';
import {registerTestimonials} from './testimonials.js';
import {registerPublicSites} from './public-sites.js';
import {registerClientImports} from './client-imports.js';
import {registerClients} from './clients.js';
import {registerMarketingPages} from './marketing-pages.js';
import {registerReviews} from './reviews.js';
import {participantsFor,groupSelection,validateGroupAvailability,storeParticipants,shiftedGroup,moveParticipants} from './group-bookings.js';
import {registerHomeMeta} from './home-meta-tag.js';
import {registerHomeAnalytics} from './home-analytics-tag.js';
import {registerManualBookings} from './manual-bookings.js';
import {registerPlatformSupport} from './platform-support.js';
import {registerAccountSecurity} from './account-security.js';
import {validateSlotInterval,durationVisibility} from './booking-display.js';
import {homeContact,savePlatformSettings} from './platform-contact.js';
import {validateSections,readSections} from './page-layout.js';
import {registerPromotions,publicPromotion,resolvePromotion,applyPromotion} from './promotions.js';
import {migratePlatformCopy} from './platform-copy.js';
import {galleryFromRequest,serviceGallery,businessGallery} from './image-gallery.js';
import {registerPlatformLegal,legalConsent,recordLegalAcceptance} from './platform-legal.js';
import {registerPlatformBilling,billingAccess,billingSummary,subscriptionExpiryNotice,billingConfiguration,refreshBillingState} from './platform-billing.js';
import {paymentMethods,bankDetails,decoratePayment,validatePaymentSettings,registerManualPayments} from './manual-payments.js';
import {registerPlatformFaqs} from './platform-faqs.js';
import express from 'express';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import crypto from 'crypto';
import path from 'path';
import {pathToFileURL,fileURLToPath} from 'url';
import fs from 'fs';
import {db,getPlan,getSetting} from './db.js';
import {sendVerificationEmail,sendBookingEmail,sendProfessionalNotification} from './email.js';
import {authorizationUrl,createPreference,exchangeCode,fetchPayment,oauthConfigured} from './mercadopago.js';
import {encryptSecret} from './crypto.js';
import {registerFeatures,findClient,applyBenefits,storeBenefits,reconcileBenefits,reserveSeries,expireHolds} from './features.js';
import {normalizePhone} from './features-db.js';
import {validDate,validTime} from './calendar-periods.js';
import {uploadsDir} from './storage.js';
import {bootstrapSuperAdmin} from './superadmin.js';

const app=express();
const PORT=Number(process.env.PORT||3001);
const SECRET=process.env.JWT_SECRET||'adara-local-change-me';
const FRONTEND_URL=process.env.FRONTEND_URL||'http://localhost:5173';
const DEMO_PAYMENTS=(process.env.DEMO_PAYMENTS ?? (process.env.NODE_ENV==='production'?'false':'true'))==='true';
const PRODUCTION=process.env.NODE_ENV==='production';
const distDir=fileURLToPath(new URL('../dist/',import.meta.url));
if(PRODUCTION&&!fs.existsSync(path.join(distDir,'index.html')))throw new Error('Falta compilar la web. Ejecutá npm run build antes de iniciar producción.');
migratePlatformCopy(db);
bootstrapSuperAdmin(db);

app.disable('x-powered-by');
app.use(express.json({limit:'2mb'}));
app.use(cookieParser());
app.get('/api/health',(_req,res)=>{try{db.prepare('SELECT 1').get();res.set('Cache-Control','no-store').json({ok:true})}catch{res.status(503).json({ok:false})}});
app.use('/uploads',express.static(uploadsDir,{maxAge:'1h',dotfiles:'deny',setHeaders:res=>res.set('X-Content-Type-Options','nosniff')}));
app.use('/uploads',(_req,res)=>res.sendStatus(404));

const storage=multer.diskStorage({
  destination:(_req,_file,cb)=>cb(null,uploadsDir),
  filename:(_req,file,cb)=>{
    const ext=(path.extname(file.originalname)||'.jpg').toLowerCase().replace(/[^.a-z0-9]/g,'');
    cb(null,`${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`);
  }
});
const upload=multer({
  storage,
  limits:{fileSize:7*1024*1024},
  fileFilter:(_req,file,cb)=>file.mimetype.startsWith('image/')?cb(null,true):cb(new Error('Solo se permiten imágenes'))
});

const slugify=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'negocio';
const uniqueSlug=n=>{let base=slugify(n),s=base,i=1;while(db.prepare('SELECT 1 FROM businesses WHERE slug=?').get(s))s=`${base}-${++i}`;return s};
const sessionToken=u=>jwt.sign({sub:String(u.id),role:u.role,sv:Number(u.session_version||0)},SECRET,{expiresIn:'7d'});
const stateToken=(businessId,userId)=>jwt.sign({businessId,userId,purpose:'mp_oauth'},SECRET,{expiresIn:'15m'});
const auth=(req,res,next)=>{try{const claims=jwt.verify(req.cookies.session,SECRET),u=db.prepare('SELECT id,role,session_version FROM users WHERE id=?').get(Number(claims.sub));if(!u||Number(claims.sv??0)!==u.session_version)throw new Error('Sesión vencida');req.user={...claims,role:u.role};next()}catch{return res.status(401).json({error:'Iniciá sesión'})}};
const superOnly=(req,res,next)=>req.user?.role==='superadmin'?next():res.status(403).json({error:'Acceso no autorizado'});
const own=(uid,id)=>db.prepare('SELECT * FROM businesses WHERE id=? AND owner_id=?').get(Number(id),Number(uid));
const publicPlan=p=>({...p,mercadopago_enabled:planHasMercadoPago(p)?1:0,features:paymentFeatures(p,safeJson(p.features_json,[]))});
const safeJson=(x,fallback)=>{try{return JSON.parse(x)}catch{return fallback}};
const cents=x=>Math.max(0,Math.round(Number(x||0)*100));
const nowIso=()=>new Date().toISOString();
app.use('/api/businesses/:id',auth,(req,res,next)=>{const b=own(req.user.sub,req.params.id);if(b&&getBusinessPlan(b).basic_only&&/^\/(promotions|posts|coupons|tools)(\/|$)/.test(req.path))return res.status(403).json({error:'Esta herramienta está disponible desde Adara Individual.'});next()});
registerReviews(app,{auth,own});
export const billingWorker=registerPlatformBilling(app,{auth,own,superOnly,getBusinessPlan,publicPlan});
registerGrowth(app,{auth,own,superOnly,billingAccess});
registerTestimonials(app,{auth,superOnly});
registerPublicSites(app);
registerClientImports(app,{auth,own});
registerClients(app,{auth,own});
const dateOnly=d=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Argentina/Buenos_Aires',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(d));
const toMinutes=t=>{const[a,b]=String(t||'00:00').split(':').map(Number);return a*60+b};
const fromMinutes=m=>`${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
const addDays=(iso,days)=>{const d=new Date(`${iso}T12:00:00-03:00`);d.setDate(d.getDate()+days);return dateOnly(d)};

const TEMPLATES=[
{"id": "atlas", "name": "Atlas Studio", "description": "Azul nítido, portada dividida y tipografía moderna.", "level": 1, "colors": {"primary": "#0758df", "accent": "#35c9ed", "background": "#f6faff"}, "defaults": {"hero_layout": "split", "hero_height": "large", "hero_align": "left", "header_style": "minimal", "service_card_style": "editorial", "button_style": "soft", "image_ratio": "landscape", "content_width": "wide", "footer_style": "light", "heading_font": "modern", "body_font": "clean"}},
{"id": "clear", "name": "Clear Space", "description": "Blanco luminoso, líneas simples y una composición centrada.", "level": 1, "colors": {"primary": "#1b4965", "accent": "#a8dce7", "background": "#fafcfd"}, "defaults": {"hero_layout": "centered", "hero_height": "medium", "hero_align": "center", "header_style": "centered", "service_card_style": "minimal", "button_style": "soft", "image_ratio": "square", "content_width": "narrow", "footer_style": "light", "heading_font": "modern", "body_font": "clean"}},
{"id": "forest", "name": "Forest Ritual", "description": "Verde profundo, equilibrio natural y bloques asimétricos.", "level": 2, "colors": {"primary": "#245347", "accent": "#98b8a5", "background": "#f4f8f5"}, "defaults": {"hero_layout": "offset", "hero_height": "large", "hero_align": "left", "header_style": "floating", "service_card_style": "offset", "button_style": "soft", "image_ratio": "square", "content_width": "wide", "footer_style": "light", "heading_font": "modern", "body_font": "clean"}},
{"id": "carbon", "name": "Carbon Studio", "description": "Grafito, contraste y una portada con presencia.", "level": 2, "colors": {"primary": "#14202c", "accent": "#8eacbf", "background": "#f5f7fa"}, "defaults": {"hero_layout": "cinematic", "hero_height": "xl", "hero_align": "left", "header_style": "dark", "service_card_style": "horizontal", "button_style": "square", "image_ratio": "landscape", "content_width": "wide", "footer_style": "dark", "heading_font": "modern", "body_font": "clean"}},
  {id:'silk',name:'Silk Editorial',description:'Portada dividida, tipografía editorial y tarjetas tipo revista.',level:1,colors:{primary:'#8d665b',accent:'#d9b8aa',background:'#fbf8f4'},defaults:{hero_layout:'split',hero_height:'large',hero_align:'left',header_style:'minimal',service_card_style:'editorial',button_style:'pill',image_ratio:'portrait',content_width:'wide',footer_style:'light',heading_font:'editorial',body_font:'clean'}},
  {id:'rose',name:'Rose Atelier',description:'Boutique suave, portada superpuesta y detalles delicados.',level:1,colors:{primary:'#8d5e62',accent:'#e8c9c8',background:'#fff9f7'},defaults:{hero_layout:'overlay',hero_height:'large',hero_align:'left',header_style:'classic',service_card_style:'soft',button_style:'pill',image_ratio:'landscape',content_width:'wide',footer_style:'soft',heading_font:'romantic',body_font:'clean'}},
  {id:'sage',name:'Sage Ritual',description:'Calma de spa, portada centrada y composición aireada.',level:2,colors:{primary:'#5f6d63',accent:'#cbd4cc',background:'#f7f8f3'},defaults:{hero_layout:'centered',hero_height:'medium',hero_align:'center',header_style:'centered',service_card_style:'minimal',button_style:'soft',image_ratio:'square',content_width:'narrow',footer_style:'light',heading_font:'serif-soft',body_font:'clean'}},
  {id:'noir',name:'Noir Studio',description:'Alto contraste, lujo contemporáneo y servicios horizontales.',level:2,colors:{primary:'#1f1b19',accent:'#b89473',background:'#f4efe9'},defaults:{hero_layout:'cinematic',hero_height:'xl',hero_align:'left',header_style:'dark',service_card_style:'horizontal',button_style:'square',image_ratio:'landscape',content_width:'wide',footer_style:'dark',heading_font:'fashion',body_font:'clean'}},
  {id:'pearl',name:'Pearl Maison',description:'Champagne luminoso, portada en arco y composición refinada.',level:3,colors:{primary:'#6c5d54',accent:'#d8c3a8',background:'#fffdf9'},defaults:{hero_layout:'arch',hero_height:'xl',hero_align:'center',header_style:'minimal',service_card_style:'luxury',button_style:'pill',image_ratio:'portrait',content_width:'narrow',footer_style:'champagne',heading_font:'editorial',body_font:'elegant'}},
  {id:'muse',name:'Muse Modern',description:'Diseño de autor, bloques asimétricos y presencia visual fuerte.',level:3,colors:{primary:'#5b3e48',accent:'#caa6ad',background:'#faf6f2'},defaults:{hero_layout:'offset',hero_height:'large',hero_align:'left',header_style:'floating',service_card_style:'offset',button_style:'soft',image_ratio:'square',content_width:'wide',footer_style:'dark',heading_font:'fashion',body_font:'clean'}}
];

function getBusinessPlan(business){return db.prepare('SELECT * FROM plans WHERE slug=?').get(business.plan_slug)||getPlan('adara')||db.prepare('SELECT * FROM plans WHERE active=1 ORDER BY display_order,id LIMIT 1').get()}
function enforceCountLimit(res,business,table,field){
  const plan=getBusinessPlan(business),limit=Number(plan[field]||0),count=db.prepare(`SELECT count(*) n FROM ${table} WHERE business_id=?`).get(business.id).n;
  if(limit>0&&count>=limit){res.status(403).json({error:`Llegaste al límite de tu plan (${limit}). Podés cambiar de plan para agregar más.`});return false}return true;
}
function cleanupExpiredHolds(businessId){
  expireHolds(businessId);
}
function businessSchedule(businessId){return db.prepare('SELECT * FROM schedules WHERE business_id=? ORDER BY weekday').all(businessId)}
function staffSchedule(staffId){return db.prepare('SELECT * FROM staff_schedules WHERE staff_id=? ORDER BY weekday').all(Number(staffId))}
function staffServices(staffId){return db.prepare('SELECT service_id FROM staff_services WHERE staff_id=? ORDER BY service_id').all(Number(staffId)).map(x=>Number(x.service_id))}
function staffCanDoServices(staffId,serviceIds){const assigned=staffServices(staffId);if(!assigned.length)return true;return serviceIds.every(id=>assigned.includes(Number(id)))}
function activeBookingsForDate(businessId,date,excludeBookingId=0,staffId=null){
  cleanupExpiredHolds(businessId);
  if(staffId)return db.prepare(`SELECT COALESCE(bp.start_time,bk.start_time) start_time,COALESCE(bp.end_time,bk.end_time) end_time FROM bookings bk LEFT JOIN booking_participants bp ON bp.booking_id=bk.id WHERE bk.business_id=? AND bk.date=? AND bk.status IN ('confirmed','pending_payment') AND bk.id!=? AND bk.staff_id=?`).all(businessId,date,Number(excludeBookingId||0),Number(staffId));
  return db.prepare(`SELECT COALESCE(bp.start_time,bk.start_time) start_time,COALESCE(bp.end_time,bk.end_time) end_time FROM bookings bk LEFT JOIN booking_participants bp ON bp.booking_id=bk.id WHERE bk.business_id=? AND bk.date=? AND bk.status IN ('confirmed','pending_payment') AND bk.id!=? AND bk.staff_id IS NULL`).all(businessId,date,Number(excludeBookingId||0));
}
function availabilityFor({business,date,services,partySize=1,excludeBookingId=0,staffId=null,manual=false,overrideSchedule=false,time=null}){
  if(!date||!services?.length)return [];
  const selected=new Date(`${date}T12:00:00`);if(Number.isNaN(selected.getTime()))return [];
  const today=dateOnly(new Date());if(date<today||(!manual&&date>addDays(today,Number(business.booking_horizon_days||90))))return [];
  const weekday=selected.getDay();let sch;
  if(staffId){const staff=db.prepare('SELECT * FROM staff WHERE id=? AND business_id=? AND active=1').get(Number(staffId),business.id);if(!staff)return [];if(!staffCanDoServices(staff.id,services.map(x=>x.id)))return [];sch=db.prepare('SELECT * FROM staff_schedules WHERE staff_id=? AND weekday=? AND active=1').get(staff.id,weekday)}
  else sch=db.prepare('SELECT * FROM schedules WHERE business_id=? AND weekday=? AND active=1').get(business.id,weekday);
  const exception=db.prepare('SELECT * FROM calendar_exceptions WHERE business_id=? AND date=? AND (staff_id=? OR staff_id IS NULL) ORDER BY staff_id IS NOT NULL DESC LIMIT 1').get(business.id,date,staffId||0);
  if(exception){if(exception.closed)return [];sch={start_time:exception.start_time,end_time:exception.end_time};}
  if(manual&&overrideSchedule)sch={start_time:'00:00',end_time:'24:00'};
  if(!sch)return [];
  const allDay=db.prepare('SELECT 1 FROM blocks WHERE business_id=? AND date=? AND all_day=1').get(business.id,date);if(allDay)return [];
  const duration=services.reduce((sum,x)=>sum+Number(x.duration_min||0),0)*Math.max(1,Math.min(10,Number(partySize)||1));
  const busy=activeBookingsForDate(business.id,date,excludeBookingId,staffId),blocks=db.prepare('SELECT start_time,end_time FROM blocks WHERE business_id=? AND date=? AND all_day=0').all(business.id,date),occupied=[...busy,...blocks];
  const step=Math.max(5,Number(business.slot_interval_min||30)),start=toMinutes(sch.start_time),end=toMinutes(sch.end_time),out=[];
  const candidates=manual&&time?[toMinutes(time)]:Array.from({length:Math.max(0,Math.floor((end-start-duration)/step)+1)},(_,i)=>start+i*step);
  for(const m of candidates){if(!Number.isFinite(m)||m<start||m+duration>end)continue;const finish=m+duration,overlaps=occupied.some(x=>m<toMinutes(x.end_time||'23:59')&&finish>toMinutes(x.start_time||'00:00'));if(!overlaps){const startIso=new Date(`${date}T${fromMinutes(m)}:00-03:00`);if(startIso.getTime()>Date.now()+Math.max(0,Number(manual?0:business.booking_notice_min||120))*60*1000)out.push(fromMinutes(m))}}
  return out;
}
function calculatePayment(business,totalCents){
  if(business.payment_mode==='total')return {mode:'total',due:totalCents};
  if(business.payment_mode==='deposit'){
    const due=business.deposit_type==='percent'?Math.round(totalCents*Math.min(100,Math.max(0,Number(business.deposit_value||0)))/100):Math.min(totalCents,Math.max(0,Number(business.deposit_value||0)));
    return {mode:'deposit',due};
  }
  return {mode:'none',due:0};
}

function computeQuote({business,services,partySize=1,couponCode='',promotionId,date='',packCode='',rewardCode=''}){
  if(getBusinessPlan(business).basic_only&&(promotionId||couponCode||packCode||rewardCode))throw new Error('Promociones, cupones y beneficios avanzados están disponibles desde Adara Individual.');
  const promotion=resolvePromotion(business,services,promotionId,date);
  if(promotion&&partySize!==undefined&&!Number.isInteger(Number(partySize)))throw new Error('Elegí una cantidad entera de personas.');
  if(promotion&&(couponCode||packCode||rewardCode))throw new Error('La promoción no se combina con cupones, packs o canjes.');
  cleanupExpiredHolds(business.id);
  const maxPeople=business.allow_group_bookings?Math.max(1,Number(business.max_party_size||6)):1;
  const people=Math.max(1,Math.min(maxPeople,Number(partySize)||1));
  const items=services.map(s=>{
    const lineSubtotal=Number(s.price_cents||0)*people;
    const eligible=Boolean(s.group_discount_enabled)&&people>=Math.max(2,Number(s.group_min_people||2));
    const pct=eligible?Math.max(0,Math.min(100,Number(s.group_discount_percent||0))):0;
    const groupDiscount=Math.round(lineSubtotal*pct/100);
    return {...s,quantity:people,line_subtotal_cents:lineSubtotal,line_discount_cents:groupDiscount,line_after_group_cents:lineSubtotal-groupDiscount};
  });
  const subtotal=items.reduce((sum,x)=>sum+x.line_subtotal_cents,0);
  const groupDiscount=items.reduce((sum,x)=>sum+x.line_discount_cents,0);
  const afterGroup=subtotal-groupDiscount;
  let coupon=null,couponDiscount=0;
  const code=String(couponCode||'').trim().toUpperCase();
  if(code){
    coupon=db.prepare('SELECT * FROM coupons WHERE business_id=? AND code=? AND active=1').get(business.id,code);
    if(!coupon)throw new Error('El cupón no existe o está pausado');
    const today=dateOnly(new Date());
    if(coupon.start_date&&coupon.start_date>today)throw new Error('El cupón todavía no está vigente');
    if(coupon.end_date&&coupon.end_date<today)throw new Error('El cupón venció');
    if(Number(coupon.min_total_cents||0)>afterGroup)throw new Error(`El cupón requiere un mínimo de $${Math.round(Number(coupon.min_total_cents||0)/100).toLocaleString('es-AR')}`);
    if(Number(coupon.max_uses||0)>0){
      const used=db.prepare(`SELECT count(*) n FROM bookings WHERE coupon_id=? AND status!='cancelled'`).get(coupon.id).n;
      if(used>=Number(coupon.max_uses))throw new Error('El cupón alcanzó su límite de usos');
    }
    const eligibleBase=coupon.service_id?items.filter(x=>Number(x.id)===Number(coupon.service_id)).reduce((sum,x)=>sum+x.line_after_group_cents,0):afterGroup;
    if(coupon.service_id&&!eligibleBase)throw new Error('Este cupón no aplica a los servicios seleccionados');
    couponDiscount=coupon.type==='fixed'?Math.min(eligibleBase,Number(coupon.value||0)):Math.round(eligibleBase*Math.max(0,Math.min(100,Number(coupon.value||0)))/100);
  }
  const total=Math.max(0,afterGroup-couponDiscount);
  const duration=items.reduce((sum,x)=>sum+Number(x.duration_min||0)*people,0);
  return applyPromotion({party_size:people,items,subtotal_cents:subtotal,group_discount_cents:groupDiscount,coupon_discount_cents:couponDiscount,total_cents:total,duration_min:duration,coupon:coupon?{id:coupon.id,code:coupon.code,type:coupon.type,value:coupon.value}:null},promotion);
}
function bookingDetails(id){
  const held=db.prepare('SELECT business_id FROM bookings WHERE id=?').get(id);if(held)cleanupExpiredHolds(held.business_id);
  const booking=db.prepare(`SELECT bk.*,c.name client_name,c.email client_email,c.phone client_phone,b.name business_name,b.slug business_slug,b.cancellation_hours,b.cancellation_policy,s.name staff_name FROM bookings bk JOIN clients c ON c.id=bk.client_id JOIN businesses b ON b.id=bk.business_id LEFT JOIN staff s ON s.id=bk.staff_id WHERE bk.id=?`).get(id);
  if(!booking)return null;
  booking.participants=participantsFor(id);
  booking.items=db.prepare('SELECT * FROM booking_items WHERE booking_id=? ORDER BY id').all(id);
  booking.manage_url=booking.manage_token?`${FRONTEND_URL}/mi-reserva/${booking.manage_token}`:'';
  return decoratePayment(booking);
}
function bookingCanChange(booking){
  if(!booking||!['confirmed','pending_payment'].includes(booking.status))return false;
  const appointment=new Date(`${booking.date}T${booking.start_time}:00-03:00`).getTime();
  const deadline=appointment-Math.max(0,Number(booking.cancellation_hours||0))*60*60*1000;
  return Date.now()<deadline;
}
async function emailBooking(booking){
  if(!booking?.client_email||!booking?.manage_url)return;
  try{await sendBookingEmail({email:booking.client_email,clientName:booking.client_name,businessName:booking.business_name,summary:booking.selection_summary,date:booking.date,time:booking.start_time,totalCents:booking.total_cents,status:booking.status,holdExpiresAt:booking.hold_expires_at,paymentMethod:booking.payment_method,manageUrl:booking.manage_url})}catch(e){console.error('Email de reserva:',e.message)}
}
async function emailProfessional(booking,event='new'){
  if(!booking)return;
  const dest=db.prepare(`SELECT COALESCE(NULLIF(b.notification_email,''),NULLIF(b.public_email,''),u.email) email,b.name business_name FROM businesses b JOIN users u ON u.id=b.owner_id WHERE b.id=?`).get(booking.business_id);
  if(!dest?.email)return;
  try{await sendProfessionalNotification({email:dest.email,businessName:dest.business_name,clientName:booking.client_name,summary:booking.selection_summary,date:booking.date,time:booking.start_time,status:booking.status,event})}catch(e){console.error('Aviso profesional:',e.message)}
}

// ---------- Planes públicos ----------
app.get('/api/public/plans',(_req,res)=>res.json(db.prepare('SELECT * FROM plans WHERE active=1 AND public_enabled=1 ORDER BY display_order,id').all().map(publicPlan)));
app.get('/api/public/config',(_req,res)=>res.json({subscription_transfer_available:transferConfiguration().configured,trial_days:Number(getSetting('trial_days','15')),...homeContact()}));
registerHomeAnalytics(app,{getSetting});
registerHomeMeta(app,{getSetting});
registerPlatformFaqs(app,{auth,superOnly});
registerPlatformLegal(app,{auth,superOnly});
app.get('/api/public/templates',(_req,res)=>res.json(TEMPLATES));

// ---------- Autenticación y verificación ----------
app.post('/api/auth/register',async(req,res)=>{
  if(PRODUCTION&&!process.env.RESEND_API_KEY)return res.status(503).json({error:'El registro estará disponible cuando se configure el envío de emails.'});
  let consent;try{consent=legalConsent(req.body)}catch(e){return res.status(e.status||400).json({error:e.message})}
  const{name,email,password,businessName,category,plan,billingCycle='monthly'}=req.body||{};
  if(!name||!email||!password||!businessName)return res.status(400).json({error:'Completá todos los campos obligatorios'});
  if(String(password).length<8)return res.status(400).json({error:'La contraseña debe tener al menos 8 caracteres'});
  const selectedPlan=(plan?db.prepare('SELECT * FROM plans WHERE slug=? AND active=1 AND public_enabled=1').get(plan):null)||db.prepare('SELECT * FROM plans WHERE active=1 AND public_enabled=1 ORDER BY display_order,id LIMIT 1').get();if(!selectedPlan)return res.status(400).json({error:'No hay un plan disponible en este momento'});
  if(!['monthly','annual'].includes(billingCycle))return res.status(400).json({error:'Elegí facturación mensual o anual'});
  const tx=db.transaction(()=>{
    const vt=crypto.randomBytes(32).toString('hex');
    const expiry=new Date(Date.now()+24*60*60*1000).toISOString();
    const u=db.prepare('INSERT INTO users(name,email,password_hash,verify_token,verify_expires_at) VALUES(?,?,?,?,?)').run(String(name).trim(),String(email).trim().toLowerCase(),bcrypt.hashSync(password,10),vt,expiry);
    const trialDays=Math.max(0,Number(getSetting('trial_days','15')));
    const trialEnd=new Date(Date.now()+trialDays*86400000).toISOString();
    const b=db.prepare(`INSERT INTO businesses(owner_id,name,slug,category,trial_ends_at,plan_slug,billing_cycle) VALUES(?,?,?,?,?,?,?)`).run(u.lastInsertRowid,String(businessName).trim(),uniqueSlug(businessName),category||'Servicios profesionales',trialEnd,selectedPlan.slug,billingCycle);
    const starter=TEMPLATES.find(t=>t.id==='atlas');
    const defaults={template_id:starter.id,primary_color:starter.colors.primary,accent_color:starter.colors.accent,background_color:starter.colors.background,...starter.defaults};
    db.prepare(`UPDATE businesses SET ${Object.keys(defaults).map(k=>`${k}=?`).join(',')} WHERE id=?`).run(...Object.values(defaults),b.lastInsertRowid);
    for(let d=0;d<7;d++)db.prepare('INSERT INTO schedules(business_id,weekday,start_time,end_time,active) VALUES(?,?,?,?,?)').run(b.lastInsertRowid,d,d===0?'10:00':'09:00',d===0?'14:00':'18:00',d===0?0:1);
    recordLegalAcceptance(consent,u.lastInsertRowid,b.lastInsertRowid,'registration');
    return {userId:u.lastInsertRowid,businessId:b.lastInsertRowid,token:vt};
  });
  let created;
  try{
    created=tx();
  }catch(e){
    const msg=String(e?.code||'').includes('UNIQUE')?'Ese email ya está registrado':(e?.message||'No se pudo crear la cuenta');
    return res.status(400).json({error:msg});
  }
  const verifyUrl=`${FRONTEND_URL}/verificar-email?token=${created.token}`;
  try{
    const mail=await sendVerificationEmail({email:String(email).trim().toLowerCase(),name,verifyUrl});
    return res.json({ok:true,email:String(email).trim().toLowerCase(),emailSent:mail.sent,devVerifyUrl:!PRODUCTION&&mail.dev?`/verificar-email?token=${created.token}`:null});
  }catch(e){
    console.error('Email de verificación:',e.message);
    return res.json({ok:true,email:String(email).trim().toLowerCase(),emailSent:false,emailError:true,devVerifyUrl:PRODUCTION?null:`/verificar-email?token=${created.token}`});
  }
});
app.post('/api/auth/resend-verification',async(req,res)=>{
  if(PRODUCTION&&!process.env.RESEND_API_KEY)return res.status(503).json({error:'El envío de emails todavía no está configurado.'});
  const email=String(req.body?.email||'').trim().toLowerCase();
  if(!email)return res.status(400).json({error:'Escribí tu email'});
  const u=db.prepare('SELECT * FROM users WHERE email=?').get(email);
  if(!u)return res.json({ok:true,message:'Si existe una cuenta con ese email, enviamos un nuevo enlace.'});
  if(u.email_verified)return res.json({ok:true,alreadyVerified:true});
  const token=crypto.randomBytes(32).toString('hex'),expiry=new Date(Date.now()+24*60*60*1000).toISOString();
  db.prepare('UPDATE users SET verify_token=?,verify_expires_at=? WHERE id=?').run(token,expiry,u.id);
  const verifyUrl=`${FRONTEND_URL}/verificar-email?token=${token}`;
  try{const mail=await sendVerificationEmail({email:u.email,name:u.name,verifyUrl});return res.json({ok:true,emailSent:mail.sent,devVerifyUrl:!PRODUCTION&&mail.dev?`/verificar-email?token=${token}`:null})}
  catch(e){console.error('Reenvío de verificación:',e.message);return res.json({ok:true,emailSent:false,emailError:true,devVerifyUrl:PRODUCTION?null:`/verificar-email?token=${token}`})}
});
app.get('/api/auth/verify',(req,res)=>{
  const u=db.prepare('SELECT * FROM users WHERE verify_token=?').get(req.query.token);
  if(!u)return res.status(400).json({error:'El enlace no es válido o ya fue utilizado'});
  if(u.verify_expires_at&&new Date(u.verify_expires_at).getTime()<Date.now())return res.status(400).json({error:'El enlace venció. Pedí uno nuevo.'});
  db.prepare('UPDATE users SET email_verified=1,verify_token=NULL,verify_expires_at=NULL WHERE id=?').run(u.id);
  res.cookie('session',sessionToken(u),{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production'}).json({ok:true,role:u.role});
});
app.post('/api/auth/login',(req,res)=>{
  const u=db.prepare('SELECT * FROM users WHERE email=?').get(String(req.body?.email||'').trim().toLowerCase());
  if(!u||!bcrypt.compareSync(req.body?.password||'',u.password_hash))return res.status(401).json({error:'Email o contraseña incorrectos'});
  if(u.role!=='superadmin'&&!u.email_verified)return res.status(403).json({error:'Primero verificá tu email',needsVerification:true});
  res.cookie('session',sessionToken(u),{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production'}).json({ok:true,role:u.role});
});
registerAccountSecurity(app,{auth});
app.post('/api/auth/logout',(_req,res)=>res.clearCookie('session').json({ok:true}));
app.get('/api/me',auth,(req,res)=>{
  const u=db.prepare('SELECT id,name,email,role,email_verified,created_at FROM users WHERE id=?').get(Number(req.user.sub));
  for(const b of db.prepare('SELECT id FROM businesses WHERE owner_id=?').all(Number(req.user.sub)))refreshBillingState(b.id);
  const businesses=db.prepare(`SELECT b.*,p.name plan_name,p.max_services,p.max_promotions,p.max_posts,p.max_coupons,p.analytics_enabled,p.template_level,p.max_staff,p.team_enabled,p.basic_only FROM businesses b JOIN plans p ON p.slug=b.plan_slug WHERE b.owner_id=?`).all(Number(req.user.sub));
  res.json({user:u,businesses:businesses.map(b=>({...b,subscription_access:billingAccess(b)}))});
});

// ---------- Panel del profesional ----------
app.get('/api/businesses/:id/dashboard',auth,(req,res)=>{
  const b=own(req.user.sub,req.params.id);if(!b)return res.sendStatus(403);cleanupExpiredHolds(b.id);
  const today=dateOnly(new Date());
  const stats={
    services:db.prepare('SELECT count(*) n FROM services WHERE business_id=? AND active=1').get(b.id).n,
    clients:db.prepare('SELECT count(*) n FROM clients WHERE business_id=? AND archived_at IS NULL').get(b.id).n,
    today:db.prepare(`SELECT COALESCE(sum(CASE WHEN EXISTS(SELECT 1 FROM booking_participants bp WHERE bp.booking_id=bookings.id) THEN party_size ELSE 1 END),0) n FROM bookings WHERE business_id=? AND date=? AND status!='cancelled'`).get(b.id,today).n,
    upcoming:db.prepare(`SELECT COALESCE(sum(CASE WHEN EXISTS(SELECT 1 FROM booking_participants bp WHERE bp.booking_id=bookings.id) THEN party_size ELSE 1 END),0) n FROM bookings WHERE business_id=? AND date>=? AND status IN ('confirmed','pending_payment')`).get(b.id,today).n,
    paid_cents:db.prepare(`SELECT COALESCE(sum(amount_paid_cents),0) n FROM bookings WHERE business_id=? AND payment_status='approved'`).get(b.id).n
  };
  const upcoming=db.prepare(`SELECT bk.*,c.name client FROM bookings bk JOIN clients c ON c.id=bk.client_id WHERE bk.business_id=? AND bk.date>=? AND bk.status IN ('confirmed','pending_payment') ORDER BY bk.date,bk.start_time LIMIT 10`).all(b.id,today).map(x=>({...x,participants:participantsFor(x.id),items:db.prepare('SELECT service_name FROM booking_items WHERE booking_id=?').all(x.id).map(i=>i.service_name)}));
  res.json({business:b,plan:publicPlan(getBusinessPlan(b)),stats,upcoming,billing_notice:subscriptionExpiryNotice(b)});
});

app.get('/api/businesses/:id/services',auth,(req,res)=>{const b=own(req.user.sub,req.params.id);if(!b)return res.sendStatus(403);res.json(db.prepare('SELECT * FROM services WHERE business_id=? ORDER BY display_order,id DESC').all(b.id).map(serviceGallery))});
app.post('/api/businesses/:id/services',auth,(req,res)=>{
  const b=own(req.user.sub,req.params.id);if(!b)return res.sendStatus(403);if(!enforceCountLimit(res,b,'services','max_services'))return;
  const x=req.body||{};if(!x.name)return res.status(400).json({error:'Escribí el nombre del servicio'});
  const auto=x.duration_auto===true||x.duration_auto===1;
  if(x.duration_auto!==undefined&&![true,false,0,1].includes(x.duration_auto))return res.status(400).json({error:'Revisá la duración automática.'});
  let images;try{images=galleryFromRequest(x,'images','image_url')}catch(e){return res.status(400).json({error:e.message})}
  const r=db.prepare(`INSERT INTO services(business_id,name,description,image_url,price_cents,duration_min,active,group_discount_enabled,group_min_people,group_discount_percent,images_json) VALUES(?,?,?,?,?,?,1,?,?,?,?)`).run(b.id,String(x.name).trim(),x.description||'',images[0]||'',cents(x.price),auto?Number(b.slot_interval_min||30):Math.max(5,Number(x.duration||60)),x.group_discount_enabled?1:0,Math.max(2,Number(x.group_min_people||2)),Math.max(0,Math.min(100,Number(x.group_discount_percent||0))),JSON.stringify(images));
  db.prepare('UPDATE services SET duration_auto=? WHERE id=?').run(auto?1:0,r.lastInsertRowid);
  res.json({id:r.lastInsertRowid});
});
app.put('/api/businesses/:id/services/:sid',auth,(req,res)=>{
  const b=own(req.user.sub,req.params.id);if(!b)return res.sendStatus(403);const x=req.body||{},current=db.prepare('SELECT * FROM services WHERE id=? AND business_id=?').get(req.params.sid,b.id);if(!current)return res.status(404).json({error:'Servicio no encontrado'});
  const auto=x.duration_auto===undefined?Boolean(current.duration_auto):x.duration_auto===true||x.duration_auto===1;
  if(x.duration_auto!==undefined&&![true,false,0,1].includes(x.duration_auto))return res.status(400).json({error:'Revisá la duración automática.'});
  let images;try{images=galleryFromRequest(x,'images','image_url',current)}catch(e){return res.status(400).json({error:e.message})}
  if(!String(x.name||'').trim())return res.status(400).json({error:'Escribí el nombre del servicio'});
  db.prepare(`UPDATE services SET name=?,description=?,image_url=?,price_cents=?,duration_min=?,active=?,group_discount_enabled=?,group_min_people=?,group_discount_percent=?,images_json=? WHERE id=? AND business_id=?`).run(x.name,x.description||'',images[0]||'',cents(x.price),auto?Number(b.slot_interval_min||30):Math.max(5,Number(x.duration||60)),x.active===false?0:1,x.group_discount_enabled?1:0,Math.max(2,Number(x.group_min_people||2)),Math.max(0,Math.min(100,Number(x.group_discount_percent||0))),JSON.stringify(images),req.params.sid,b.id);db.prepare('UPDATE services SET duration_auto=? WHERE id=? AND business_id=?').run(auto?1:0,req.params.sid,b.id);res.json({ok:true});
});
app.delete('/api/businesses/:id/services/:sid',auth,(req,res)=>{
  const b=own(req.user.sub,req.params.id);if(!b)return res.sendStatus(403);
  const used=db.prepare('SELECT 1 FROM booking_items WHERE service_id=? LIMIT 1').get(req.params.sid);
  if(used){db.prepare('UPDATE services SET active=0 WHERE id=? AND business_id=?').run(req.params.sid,b.id);return res.json({ok:true,archived:true})}
  db.prepare('UPDATE coupons SET service_id=NULL WHERE service_id=? AND business_id=?').run(req.params.sid,b.id);db.prepare('DELETE FROM services WHERE id=? AND business_id=?').run(req.params.sid,b.id);res.json({ok:true});
});

registerPromotions(app,{auth,own,enforceCountLimit});

app.get('/api/businesses/:id/coupons',auth,(req,res)=>{const b=own(req.user.sub,req.params.id);if(!b)return res.sendStatus(403);const rows=db.prepare(`SELECT c.*,s.name service_name,(SELECT count(*) FROM bookings bk WHERE bk.coupon_id=c.id AND bk.status!='cancelled') uses FROM coupons c LEFT JOIN services s ON s.id=c.service_id WHERE c.business_id=? ORDER BY c.id DESC`).all(b.id);res.json(rows)});
app.post('/api/businesses/:id/coupons',auth,(req,res)=>{const b=own(req.user.sub,req.params.id);if(!b)return res.sendStatus(403);if(!enforceCountLimit(res,b,'coupons','max_coupons'))return;const x=req.body||{},code=String(x.code||'').trim().toUpperCase().replace(/\s+/g,'');if(!code)return res.status(400).json({error:'Escribí un código'});if(!['percent','fixed'].includes(x.type||'percent'))return res.status(400).json({error:'Tipo de cupón inválido'});const value=x.type==='fixed'?cents(x.value):Math.max(0,Math.min(100,Math.round(Number(x.value||0))));try{const r=db.prepare(`INSERT INTO coupons(business_id,code,type,value,min_total_cents,max_uses,start_date,end_date,service_id,active) VALUES(?,?,?,?,?,?,?,?,?,1)`).run(b.id,code,x.type||'percent',value,cents(x.min_total),Math.max(0,Number(x.max_uses||0)),x.start_date||null,x.end_date||null,x.service_id?Number(x.service_id):null);res.json({id:r.lastInsertRowid})}catch(e){return res.status(400).json({error:'Ese código ya existe'})}});
app.put('/api/businesses/:id/coupons/:cid',auth,(req,res)=>{const b=own(req.user.sub,req.params.id);if(!b)return res.sendStatus(403);const c=db.prepare('SELECT * FROM coupons WHERE id=? AND business_id=?').get(req.params.cid,b.id);if(!c)return res.sendStatus(404);const x=req.body||{};db.prepare('UPDATE coupons SET active=? WHERE id=? AND business_id=?').run(x.active?1:0,c.id,b.id);res.json({ok:true})});
app.delete('/api/businesses/:id/coupons/:cid',auth,(req,res)=>{const b=own(req.user.sub,req.params.id);if(!b)return res.sendStatus(403);db.prepare('DELETE FROM coupons WHERE id=? AND business_id=?').run(req.params.cid,b.id);res.json({ok:true})});

app.get('/api/businesses/:id/posts',auth,(req,res)=>{const b=own(req.user.sub,req.params.id);if(!b)return res.sendStatus(403);res.json(db.prepare('SELECT * FROM posts WHERE business_id=? ORDER BY id DESC').all(b.id))});
app.post('/api/businesses/:id/posts',auth,(req,res)=>{const b=own(req.user.sub,req.params.id);if(!b)return res.sendStatus(403);if(!enforceCountLimit(res,b,'posts','max_posts'))return;const x=req.body||{};if(!x.title)return res.status(400).json({error:'Escribí un título'});const r=db.prepare('INSERT INTO posts(business_id,title,body,image_url) VALUES(?,?,?,?)').run(b.id,x.title,x.body||'',x.image_url||'');res.json({id:r.lastInsertRowid})});
app.put('/api/businesses/:id/posts/:pid',auth,(req,res)=>{const b=own(req.user.sub,req.params.id);if(!b)return res.sendStatus(403);const x=req.body||{};db.prepare('UPDATE posts SET title=?,body=?,image_url=?,active=? WHERE id=? AND business_id=?').run(x.title,x.body||'',x.image_url||'',x.active===false?0:1,req.params.pid,b.id);res.json({ok:true})});
app.delete('/api/businesses/:id/posts/:pid',auth,(req,res)=>{const b=own(req.user.sub,req.params.id);if(!b)return res.sendStatus(403);db.prepare('DELETE FROM posts WHERE id=? AND business_id=?').run(req.params.pid,b.id);res.json({ok:true})});

app.get('/api/businesses/:id/faqs',auth,(req,res)=>{const b=own(req.user.sub,req.params.id);if(!b)return res.sendStatus(403);res.json(db.prepare('SELECT * FROM faqs WHERE business_id=? ORDER BY display_order,id').all(b.id))});
app.post('/api/businesses/:id/faqs',auth,(req,res)=>{const b=own(req.user.sub,req.params.id);if(!b)return res.sendStatus(403);const x=req.body||{},question=String(x.question||'').trim(),answer=String(x.answer||'').trim();if(!question||!answer)return res.status(400).json({error:'Completá la pregunta y la respuesta'});const next=Number(db.prepare('SELECT COALESCE(MAX(display_order),-1)+1 n FROM faqs WHERE business_id=?').get(b.id).n||0);const r=db.prepare('INSERT INTO faqs(business_id,question,answer,active,display_order) VALUES(?,?,?,?,?)').run(b.id,question,answer,1,next);res.json({id:r.lastInsertRowid})});
app.put('/api/businesses/:id/faqs/:fid',auth,(req,res)=>{const b=own(req.user.sub,req.params.id);if(!b)return res.sendStatus(403);const current=db.prepare('SELECT * FROM faqs WHERE id=? AND business_id=?').get(req.params.fid,b.id);if(!current)return res.sendStatus(404);const x=req.body||{};db.prepare('UPDATE faqs SET question=?,answer=?,active=?,display_order=? WHERE id=? AND business_id=?').run(String(x.question??current.question).trim(),String(x.answer??current.answer).trim(),x.active===undefined?current.active:(x.active?1:0),Number(x.display_order??current.display_order),current.id,b.id);res.json({ok:true})});
app.delete('/api/businesses/:id/faqs/:fid',auth,(req,res)=>{const b=own(req.user.sub,req.params.id);if(!b)return res.sendStatus(403);db.prepare('DELETE FROM faqs WHERE id=? AND business_id=?').run(req.params.fid,b.id);res.json({ok:true})});

app.post('/api/businesses/:id/upload',auth,(req,res,next)=>upload.single('image')(req,res,err=>err?res.status(400).json({error:err.message}):next()),(req,res)=>{
  const b=own(req.user.sub,req.params.id);if(!b){if(req.file)fs.unlink(req.file.path,()=>{});return res.sendStatus(403)}
  if(!req.file)return res.status(400).json({error:'Elegí una imagen'});
  res.json({url:`/uploads/${req.file.filename}`});
});

app.get('/api/businesses/:id/bookings',auth,(req,res)=>{
  const b=own(req.user.sub,req.params.id);if(!b)return res.sendStatus(403);cleanupExpiredHolds(b.id);
  const rows=db.prepare(`SELECT bk.*,c.name client,c.phone,c.email,s.name staff_name FROM bookings bk JOIN clients c ON c.id=bk.client_id LEFT JOIN staff s ON s.id=bk.staff_id WHERE bk.business_id=? ORDER BY bk.date DESC,bk.start_time DESC`).all(b.id).map(x=>({...x,participants:participantsFor(x.id),items:db.prepare('SELECT service_id,service_name,price_cents,duration_min,quantity,line_subtotal_cents,line_discount_cents FROM booking_items WHERE booking_id=?').all(x.id)}));
  res.json(rows.map(decoratePayment));
});
app.patch('/api/businesses/:id/bookings/:bid',auth,(req,res)=>{
  const b=own(req.user.sub,req.params.id);if(!b)return res.sendStatus(403);
  cleanupExpiredHolds(b.id);const current=db.prepare('SELECT * FROM bookings WHERE id=? AND business_id=?').get(req.params.bid,b.id);if(!current)return res.sendStatus(404);
  const x=req.body||{};
  const allowedStatuses=['confirmed','completed','cancelled','no_show','pending_payment'];
  const status=x.status===undefined?current.status:String(x.status);if(!allowedStatuses.includes(status))return res.status(400).json({error:'Estado inválido'});
  if(status==='pending_payment'&&current.status!=='pending_payment')return res.status(409).json({error:'Creá una nueva reserva para iniciar un nuevo plazo de pago'});
  if(current.status==='pending_payment'&&!['pending_payment','cancelled'].includes(status))return res.status(409).json({error:'El turno se confirma cuando se acredita el pago. Podés cancelarlo mientras esté pendiente.'});
  if(current.status==='cancelled'&&current.payment_status==='expired'&&status!=='cancelled')return res.status(409).json({error:'El plazo de pago venció. Creá una nueva reserva para verificar la disponibilidad.'});
  if(current.status==='cancelled'&&status!=='cancelled'&&(db.prepare('SELECT 1 FROM pack_uses WHERE booking_id=?').get(current.id)||current.loyalty_discount_cents>0))return res.status(409).json({error:'Este turno devolvió un beneficio al cancelarse. Creá una nueva reserva para aplicar el beneficio disponible.'});
  const date=String(x.date||current.date),startTime=String(x.start_time||current.start_time);
  const items=db.prepare(`SELECT s.* FROM booking_items bi JOIN services s ON s.id=bi.service_id WHERE bi.booking_id=? ORDER BY bi.id`).all(current.id);
  if(!items.length)return res.status(409).json({error:'El turno no tiene servicios válidos para calcular su duración'});
  let group;try{group=shiftedGroup(current,date,startTime)}catch(e){return res.status(400).json({error:e.message})}
  if(date!==current.date||startTime!==current.start_time||(!['confirmed','pending_payment'].includes(current.status)&&['confirmed','pending_payment'].includes(status))){
    if(group){try{validateGroupAvailability(group,{business:b,date,services:items,excludeBookingId:current.id,staffId:current.staff_id||null,manual:current.booking_source==='manual',overrideSchedule:!!current.manual_override},availabilityFor)}catch(e){return res.status(409).json({error:e.message})}}
    const slots=availabilityFor({business:b,date,services:items,partySize:group?1:current.party_size,excludeBookingId:current.id,staffId:current.staff_id||null,manual:current.booking_source==='manual',overrideSchedule:!!current.manual_override});
    if(!slots.includes(startTime))return res.status(409).json({error:'Ese horario no está disponible para la duración completa del turno'});
  }
  const duration=items.reduce((sum,z)=>sum+Number(z.duration_min||0),0)*Math.max(1,Number(current.party_size||1));
  const endTime=group?.end||fromMinutes(toMinutes(startTime)+duration);
  const client=db.prepare('SELECT * FROM clients WHERE id=? AND business_id=?').get(current.client_id,b.id);
  const email=String(x.email??client?.email??'').trim().toLowerCase();if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return res.status(400).json({error:'Revisá el email del cliente'});
  const tx=db.transaction(()=>{
    moveParticipants(current.id,group);
    db.prepare('UPDATE bookings SET date=?,start_time=?,end_time=?,status=?,notes=? WHERE id=? AND business_id=?').run(date,startTime,endTime,status,String(x.notes??current.notes??''),current.id,b.id);
    if(client)db.prepare('UPDATE clients SET name=?,phone=?,email=? WHERE id=? AND business_id=?').run(String(x.client_name??client.name??'').trim(),String(x.phone??client.phone??'').trim(),email||null,client.id,b.id);
  });
  try{tx()}catch(e){return res.status(409).json({error:'No se pudo actualizar el turno. Revisá que el email no pertenezca a otro cliente.'})}
  reconcileBenefits();res.json({ok:true,booking:bookingDetails(current.id)});
});

// ---------- Equipo (planes con múltiples agendas) ----------
app.get('/api/businesses/:id/staff',auth,(req,res)=>{
  const b=own(req.user.sub,req.params.id);if(!b)return res.sendStatus(403);const plan=getBusinessPlan(b);
  if(Number(plan.max_staff||1)<=1)return res.json({enabled:false,max_staff:1,staff:[],services:[]});
  const rows=db.prepare('SELECT * FROM staff WHERE business_id=? ORDER BY active DESC,display_order,id').all(b.id).map(x=>({...x,service_ids:staffServices(x.id),schedule:staffSchedule(x.id)}));
  res.json({enabled:true,max_staff:Number(plan.max_staff||1),staff:rows,services:db.prepare('SELECT id,name FROM services WHERE business_id=? AND active=1 ORDER BY display_order,id').all(b.id)});
});
app.post('/api/businesses/:id/staff',auth,(req,res)=>{
  const b=own(req.user.sub,req.params.id);if(!b)return res.sendStatus(403);const plan=getBusinessPlan(b),max=Math.max(1,Number(plan.max_staff||1));if(max<=1)return res.status(403).json({error:'Tu plan actual es para una soel profesional'});
  const count=Number(db.prepare('SELECT count(*) n FROM staff WHERE business_id=? AND active=1').get(b.id).n||0);if(count>=max)return res.status(403).json({error:`Tu plan permite hasta ${max} integrantes`});
  const x=req.body||{},name=String(x.name||'').trim();if(!name)return res.status(400).json({error:'Escribí el nombre del profesional'});
  const tx=db.transaction(()=>{const r=db.prepare('INSERT INTO staff(business_id,name,title,image_url,active) VALUES(?,?,?,?,1)').run(b.id,name,String(x.title||'').trim(),String(x.image_url||''));const sid=Number(r.lastInsertRowid);const base=businessSchedule(b.id);for(let d=0;d<7;d++){const row=base.find(z=>Number(z.weekday)===d);db.prepare('INSERT INTO staff_schedules(staff_id,weekday,start_time,end_time,active) VALUES(?,?,?,?,?)').run(sid,d,row?.start_time||'09:00',row?.end_time||'18:00',row?.active?1:0)}const ids=Array.isArray(x.service_ids)?x.service_ids.map(Number).filter(Boolean):[];for(const serviceId of ids)db.prepare('INSERT OR IGNORE INTO staff_services(staff_id,service_id) SELECT ?,id FROM services WHERE id=? AND business_id=?').run(sid,serviceId,b.id);return sid});res.json({id:tx()});
});
app.put('/api/businesses/:id/staff/:sid',auth,(req,res)=>{
  const b=own(req.user.sub,req.params.id);if(!b)return res.sendStatus(403);const person=db.prepare('SELECT * FROM staff WHERE id=? AND business_id=?').get(req.params.sid,b.id);if(!person)return res.sendStatus(404);const x=req.body||{};
  db.prepare('UPDATE staff SET name=?,title=?,image_url=?,active=? WHERE id=? AND business_id=?').run(String(x.name??person.name).trim(),String(x.title??person.title).trim(),String(x.image_url??person.image_url),x.active===undefined?person.active:(x.active?1:0),person.id,b.id);
  if(Array.isArray(x.service_ids)){const tx=db.transaction(()=>{db.prepare('DELETE FROM staff_services WHERE staff_id=?').run(person.id);for(const serviceId of x.service_ids.map(Number).filter(Boolean))db.prepare('INSERT OR IGNORE INTO staff_services(staff_id,service_id) SELECT ?,id FROM services WHERE id=? AND business_id=?').run(person.id,serviceId,b.id)});tx()}
  res.json({ok:true});
});
app.put('/api/businesses/:id/staff/:sid/schedule',auth,(req,res)=>{
  const b=own(req.user.sub,req.params.id);if(!b)return res.sendStatus(403);const person=db.prepare('SELECT * FROM staff WHERE id=? AND business_id=?').get(req.params.sid,b.id);if(!person)return res.sendStatus(404);const rows=Array.isArray(req.body?.schedule)?req.body.schedule:[];
  const tx=db.transaction(()=>{for(const row of rows){if(Number(row.weekday)<0||Number(row.weekday)>6)continue;db.prepare(`INSERT INTO staff_schedules(staff_id,weekday,start_time,end_time,active) VALUES(?,?,?,?,?) ON CONFLICT(staff_id,weekday) DO UPDATE SET start_time=excluded.start_time,end_time=excluded.end_time,active=excluded.active`).run(person.id,Number(row.weekday),row.start_time||'09:00',row.end_time||'18:00',row.active?1:0)}});tx();markSetup(b.id,'schedule',{staff:true});res.json({ok:true});
});
app.delete('/api/businesses/:id/staff/:sid',auth,(req,res)=>{const b=own(req.user.sub,req.params.id);if(!b)return res.sendStatus(403);db.prepare('UPDATE staff SET active=0 WHERE id=? AND business_id=?').run(req.params.sid,b.id);res.json({ok:true})});

app.get('/api/businesses/:id/schedule',auth,(req,res)=>{
  const b=own(req.user.sub,req.params.id);if(!b)return res.sendStatus(403);res.json({schedule:businessSchedule(b.id),blocks:db.prepare('SELECT * FROM blocks WHERE business_id=? AND date>=? ORDER BY date,start_time').all(b.id,dateOnly(new Date())),slot_interval_min:b.slot_interval_min,booking_horizon_days:b.booking_horizon_days});
});
app.put('/api/businesses/:id/schedule',auth,(req,res)=>{
  const b=own(req.user.sub,req.params.id);if(!b)return res.sendStatus(403);const rows=Array.isArray(req.body?.schedule)?req.body.schedule:[];
  let interval;try{interval=validateSlotInterval(req.body?.slot_interval_min,b.slot_interval_min)}catch(e){return res.status(400).json({error:e.message})}
  const tx=db.transaction(()=>{for(const row of rows){if(Number(row.weekday)<0||Number(row.weekday)>6)continue;db.prepare(`INSERT INTO schedules(business_id,weekday,start_time,end_time,active) VALUES(?,?,?,?,?) ON CONFLICT(business_id,weekday) DO UPDATE SET start_time=excluded.start_time,end_time=excluded.end_time,active=excluded.active`).run(b.id,Number(row.weekday),row.start_time||'09:00',row.end_time||'18:00',row.active?1:0)}db.prepare('UPDATE businesses SET slot_interval_min=?,booking_horizon_days=? WHERE id=?').run(interval,Math.max(7,Math.min(365,Number(req.body?.booking_horizon_days||90))),b.id);db.prepare('UPDATE services SET duration_min=? WHERE business_id=? AND duration_auto=1').run(interval,b.id)});tx();markSetup(b.id,'schedule');res.json({ok:true})
});
app.post('/api/businesses/:id/blocks',auth,(req,res)=>{const b=own(req.user.sub,req.params.id);if(!b)return res.sendStatus(403);const x=req.body||{};if(!validDate(x.date))return res.status(400).json({error:'Elegí una fecha válida'});if(!x.all_day&&(!validTime(x.start_time)||!validTime(x.end_time)||x.start_time>=x.end_time))return res.status(400).json({error:'El horario hasta debe ser posterior al horario desde'});const r=db.prepare('INSERT INTO blocks(business_id,date,start_time,end_time,all_day,reason) VALUES(?,?,?,?,?,?)').run(b.id,x.date,x.all_day?null:x.start_time||null,x.all_day?null:x.end_time||null,x.all_day?1:0,x.reason||'');res.json({id:r.lastInsertRowid})});
app.delete('/api/businesses/:id/blocks/:bid',auth,(req,res)=>{const b=own(req.user.sub,req.params.id);if(!b)return res.sendStatus(403);db.prepare('DELETE FROM blocks WHERE id=? AND business_id=?').run(req.params.bid,b.id);res.json({ok:true})});

app.get('/api/businesses/:id/page-settings',auth,(req,res)=>{const b=own(req.user.sub,req.params.id);if(!b)return res.sendStatus(403);res.json({business:businessGallery(b),templates:TEMPLATES,plan:publicPlan(getBusinessPlan(b))})});
app.put('/api/businesses/:id/page-settings',auth,(req,res)=>{
  const b=own(req.user.sub,req.params.id);if(!b)return res.sendStatus(403);const x=req.body||{},plan=getBusinessPlan(b),tpl=TEMPLATES.find(t=>t.id===(x.template_id||b.template_id));if(!tpl)return res.status(400).json({error:'Plantilla inválida'});if(tpl.level>Number(plan.template_level))return res.status(403).json({error:'Esa plantilla está disponible en un plan superior'});
  let images,sectionOrder,showDuration;try{showDuration=durationVisibility(x.show_service_duration,b.show_service_duration);sectionOrder=x.section_order===undefined?readSections(b.section_order_json):validateSections(x.section_order);if(x.hero_image_fit!==undefined&&!['contain','cover'].includes(x.hero_image_fit))throw new Error('Elegí cómo mostrar la imagen de portada.');images=galleryFromRequest(x,'hero_images','hero_image',b)}catch(e){return res.status(400).json({error:e.message})}
  const categoryLabel=x.category_label===undefined?b.category_label:x.category_label;if(typeof categoryLabel!=='string'||categoryLabel.length>100)return res.status(400).json({error:'El texto sobre la portada debe tener hasta 100 caracteres.'});
  const allowed=(v,list,fallback)=>list.includes(v)?v:fallback;
  db.prepare(`UPDATE businesses SET name=?,category=?,phone=?,instagram=?,address=?,description=?,hero_title=?,hero_text=?,hero_image=?,logo_image=?,template_id=?,primary_color=?,accent_color=?,background_color=?,heading_font=?,body_font=?,hero_layout=?,hero_height=?,hero_align=?,header_style=?,service_card_style=?,button_style=?,image_ratio=?,content_width=?,footer_style=?,show_promotions=?,show_posts=?,show_description=?,show_footer_contact=?,show_faqs=?,show_services=?,show_booking=?,hero_images_json=?,show_category=?,category_label=?,section_order_json=?,hero_image_fit=?,show_service_duration=? WHERE id=?`).run(
    x.name||b.name,x.category||'',x.phone||'',x.instagram||'',x.address||'',x.description||'',x.hero_title||'',x.hero_text||'',images[0]||'',x.logo_image||'',tpl.id,x.primary_color||tpl.colors.primary,x.accent_color||tpl.colors.accent,x.background_color||tpl.colors.background,
    allowed(x.heading_font,fontOptions.headings.map(x=>x.id),b.heading_font||tpl.defaults.heading_font),allowed(x.body_font,fontOptions.bodies.map(x=>x.id),b.body_font||tpl.defaults.body_font),allowed(x.hero_layout,['overlay','split','centered','cinematic','arch','offset'],b.hero_layout||tpl.defaults.hero_layout),allowed(x.hero_height,['compact','medium','large','xl'],b.hero_height||tpl.defaults.hero_height),allowed(x.hero_align,['left','center','right'],b.hero_align||tpl.defaults.hero_align),allowed(x.header_style,['classic','minimal','centered','dark','floating'],b.header_style||tpl.defaults.header_style),allowed(x.service_card_style,['image-top','editorial','soft','minimal','horizontal','luxury','offset'],b.service_card_style||tpl.defaults.service_card_style),allowed(x.button_style,['pill','soft','square'],b.button_style||tpl.defaults.button_style),allowed(x.image_ratio,['landscape','square','portrait'],b.image_ratio||tpl.defaults.image_ratio),allowed(x.content_width,['wide','narrow'],b.content_width||tpl.defaults.content_width),allowed(x.footer_style,['dark','light','soft','champagne'],b.footer_style||tpl.defaults.footer_style),x.show_promotions===undefined?b.show_promotions:(x.show_promotions?1:0),x.show_posts===undefined?b.show_posts:(x.show_posts?1:0),x.show_description===undefined?b.show_description:(x.show_description?1:0),x.show_footer_contact===undefined?b.show_footer_contact:(x.show_footer_contact?1:0),x.show_faqs===undefined?b.show_faqs:(x.show_faqs?1:0),x.show_services===undefined?b.show_services:(x.show_services?1:0),x.show_booking===undefined?b.show_booking:(x.show_booking?1:0),JSON.stringify(images),x.show_category===undefined?b.show_category:(x.show_category?1:0),categoryLabel.trim(),JSON.stringify(sectionOrder),x.hero_image_fit??b.hero_image_fit??'contain',showDuration,b.id
  );res.json({ok:true});
});

app.get('/api/businesses/:id/settings',auth,(req,res)=>{
  const b=own(req.user.sub,req.params.id);if(!b)return res.sendStatus(403);
  res.json({business:b,public_url:`${FRONTEND_URL}/reservar/${b.slug}`});
});
app.put('/api/businesses/:id/settings',auth,(req,res)=>{
  const b=own(req.user.sub,req.params.id);if(!b)return res.sendStatus(403);const x=req.body||{};
  const publicEmail=String(x.public_email||'').trim(),notificationEmail=String(x.notification_email||'').trim();
  const emailOk=v=>!v||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  if(!emailOk(publicEmail)||!emailOk(notificationEmail))return res.status(400).json({error:'Revisá el formato de los emails'});
  let interval,showDuration;try{interval=validateSlotInterval(x.slot_interval_min,b.slot_interval_min);showDuration=durationVisibility(x.show_service_duration,b.show_service_duration)}catch(e){return res.status(400).json({error:e.message})}
  db.prepare(`UPDATE businesses SET name=?,category=?,phone=?,instagram=?,tiktok=?,website=?,address=?,public_email=?,notification_email=?,show_whatsapp_float=?,whatsapp_message=?,booking_horizon_days=?,slot_interval_min=?,booking_notice_min=?,cancellation_hours=?,allow_group_bookings=?,max_party_size=?,require_email=?,show_address=?,seo_title=?,seo_description=?,cancellation_policy=?,confirmation_message=?,show_services=?,show_promotions=?,show_posts=?,show_faqs=?,show_footer_contact=?,show_booking=?,show_service_duration=? WHERE id=?`).run(
    String(x.name||b.name).trim(),String(x.category||b.category).trim(),String(x.phone||'').trim(),String(x.instagram||'').trim(),String(x.tiktok||'').trim(),String(x.website||'').trim(),String(x.address||'').trim(),publicEmail,notificationEmail,x.show_whatsapp_float===false?0:1,String(x.whatsapp_message||'Hola, quiero consultar por un turno').slice(0,300),
    Math.max(7,Math.min(365,Number(x.booking_horizon_days??b.booking_horizon_days??90))),interval,Math.max(0,Math.min(10080,Number(x.booking_notice_min??b.booking_notice_min??120))),Math.max(0,Math.min(720,Number(x.cancellation_hours??b.cancellation_hours??24))),x.allow_group_bookings===false?0:1,Math.max(1,Math.min(10,Number(x.max_party_size??b.max_party_size??6))),x.require_email?1:0,x.show_address===false?0:1,String(x.seo_title||'').slice(0,70),String(x.seo_description||'').slice(0,180),String(x.cancellation_policy||'').slice(0,1200),String(x.confirmation_message||'').slice(0,600),x.show_services===false?0:1,x.show_promotions===false?0:1,x.show_posts===false?0:1,x.show_faqs===false?0:1,x.show_footer_contact===false?0:1,x.show_booking===false?0:1,showDuration,b.id
  );db.prepare('UPDATE services SET duration_min=? WHERE business_id=? AND duration_auto=1').run(interval,b.id);res.json({ok:true});
});

app.get('/api/businesses/:id/payment-settings',auth,(req,res)=>{
  const b=own(req.user.sub,req.params.id);if(!b)return res.sendStatus(403);
  res.json({mercadopago_enabled:mercadoPagoAllowed(b),payment_methods:paymentMethods(b),bank_alias:b.bank_alias,bank_account:b.bank_account,bank_holder:b.bank_holder,bank_name:b.bank_name,bank_instructions:b.bank_instructions,payment_mode:b.payment_mode,deposit_type:b.deposit_type,deposit_value:b.deposit_value,payment_hold_minutes:b.payment_hold_minutes,mp_connected:Boolean(b.mp_access_token_enc),mp_user_id:b.mp_user_id,mp_connected_at:b.mp_connected_at,oauth_configured:oauthConfigured(),demo_payments:DEMO_PAYMENTS});
});
app.put('/api/businesses/:id/payment-settings',auth,(req,res)=>{
 const b=own(req.user.sub,req.params.id);if(!b)return res.sendStatus(403);const x=req.body||{};
 try{if(!['none','deposit','total'].includes(x.payment_mode))throw new Error('Modalidad de cobro inválida');if(!['fixed','percent'].includes(x.deposit_type||'fixed'))throw new Error('Tipo de seña inválido');let value=Number(x.deposit_value||0);if(!Number.isFinite(value)||value<0||(x.deposit_type==='percent'&&value>100))throw new Error('Revisá el importe de seña');value=x.deposit_type==='percent'?Math.round(value):cents(value);const holdMinutes=Number(x.payment_hold_minutes??b.payment_hold_minutes);if(!Number.isInteger(holdMinutes)||holdMinutes<5||holdMinutes>1440)throw new Error('Elegí un plazo de pago entre 5 y 1440 minutos (24 horas)');const m=validatePaymentSettings(b,x);db.prepare('UPDATE businesses SET payment_mode=?,deposit_type=?,deposit_value=?,payment_hold_minutes=?,payment_methods_json=?,bank_alias=?,bank_account=?,bank_holder=?,bank_name=?,bank_instructions=? WHERE id=?').run(x.payment_mode,x.deposit_type||'fixed',value,holdMinutes,JSON.stringify(m.methods),m.alias,m.account,m.holder,m.bank,m.instructions,b.id);markSetup(b.id,'payment');res.json({ok:true})}catch(e){res.status(400).json({error:e.message})}
});
app.get('/api/businesses/:id/mercadopago/connect',auth,(req,res)=>{const b=own(req.user.sub,req.params.id);if(!b)return res.sendStatus(403);if(!mercadoPagoAllowed(b))return res.status(403).json({error:'Adara Inicial incluye pagos por transferencia.'});if(!oauthConfigured())return res.status(503).json({error:'Mercado Pago OAuth todavía no está configurado en .env'});res.json({url:authorizationUrl(stateToken(b.id,Number(req.user.sub)))})});
app.delete('/api/businesses/:id/mercadopago',auth,(req,res)=>{const b=own(req.user.sub,req.params.id);if(!b)return res.sendStatus(403);db.prepare('UPDATE businesses SET mp_access_token_enc=NULL,mp_refresh_token_enc=NULL,mp_token_expires_at=NULL,mp_user_id=NULL,mp_connected_at=NULL WHERE id=?').run(b.id);res.json({ok:true})});

app.get('/api/businesses/:id/plan',auth,(req,res)=>{const b=own(req.user.sub,req.params.id);if(!b)return res.sendStatus(403);res.json({business:b,plan:publicPlan(getBusinessPlan(b)),plans:db.prepare('SELECT * FROM plans WHERE active=1 AND (public_enabled=1 OR slug=?) ORDER BY display_order').all(b.plan_slug).map(publicPlan),billing:billingSummary(b.id)})});

// ---------- OAuth Mercado Pago ----------
app.get('/api/integrations/mercadopago/callback',async(req,res)=>{
  try{
    const payload=jwt.verify(String(req.query.state||''),SECRET);if(payload.purpose!=='mp_oauth')throw new Error('state inválido');
    const b=db.prepare('SELECT * FROM businesses WHERE id=? AND owner_id=?').get(Number(payload.businessId),Number(payload.userId));if(!b)throw new Error('Negocio inválido');if(!mercadoPagoAllowed(b))throw new Error('Mercado Pago no está incluido en este plan');
    const data=await exchangeCode(String(req.query.code||''));
    const expires=new Date(Date.now()+Number(data.expires_in||15552000)*1000).toISOString();
    db.prepare(`UPDATE businesses SET mp_access_token_enc=?,mp_refresh_token_enc=?,mp_token_expires_at=?,mp_user_id=?,mp_connected_at=CURRENT_TIMESTAMP WHERE id=?`).run(encryptSecret(data.access_token),encryptSecret(data.refresh_token||''),expires,String(data.user_id||''),b.id);
    res.redirect(`${FRONTEND_URL}/admin?tab=Pagos&mp=connected`);
  }catch(e){res.redirect(`${FRONTEND_URL}/admin?tab=Pagos&mp=error`)}
});

// ---------- Página pública ----------
app.get('/api/public/:slug',(req,res)=>{
  const b=db.prepare(`SELECT b.*,p.name plan_name FROM businesses b JOIN plans p ON p.slug=b.plan_slug WHERE b.slug=? AND b.status='active'`).get(req.params.slug);if(!b)return res.status(404).json({error:'Negocio no encontrado'});
  const today=dateOnly(new Date());
  const promotions=db.prepare(`SELECT * FROM promotions WHERE business_id=? AND active=1 AND (start_date IS NULL OR start_date<=?) AND (end_date IS NULL OR end_date>=?) ORDER BY id DESC`).all(b.id,today,today).map(publicPromotion);
  refreshBillingState(b.id);const plan=getBusinessPlan(b);const publicBusiness={...b,payment_methods_json:JSON.stringify(paymentMethods(b)),mercadopago_enabled:mercadoPagoAllowed(b),...(plan.basic_only?{show_promotions:0,show_posts:0,loyalty_enabled:0,waitlist_enabled:0}:{}),show_booking:b.show_booking&&billingAccess(db.prepare('SELECT * FROM businesses WHERE id=?').get(b.id))?1:0};for(const key of Object.keys(publicBusiness)){if(key.endsWith('_enc')||['owner_id','notification_email','admin_notes','custom_monthly_price_cents','custom_annual_price_cents','mp_user_id','bank_alias','bank_account','bank_holder','bank_name','bank_instructions','subscription_paid_until','subscription_managed','subscription_status','trial_ends_at'].includes(key))delete publicBusiness[key];}const staff=Number(plan.max_staff||1)>1?db.prepare('SELECT * FROM staff WHERE business_id=? AND active=1 ORDER BY display_order,id').all(b.id).map(x=>({...x,service_ids:staffServices(x.id),schedule:staffSchedule(x.id)})):[];res.json({packs_available:!plan.basic_only&&Boolean(db.prepare('SELECT 1 FROM packs WHERE business_id=? AND active=1').get(b.id)),exceptions:db.prepare('SELECT date,staff_id,closed,start_time,end_time FROM calendar_exceptions WHERE business_id=?').all(b.id),business:{...businessGallery(publicBusiness),max_staff:Number(plan.max_staff||1),basic_only:Number(plan.basic_only||0),team_enabled:Number(plan.team_enabled||0)},services:db.prepare('SELECT * FROM services WHERE business_id=? AND active=1 ORDER BY display_order,id').all(b.id).map(serviceGallery),promotions:plan.basic_only?[]:promotions,posts:plan.basic_only?[]:db.prepare('SELECT * FROM posts WHERE business_id=? AND active=1 ORDER BY id DESC').all(b.id),faqs:db.prepare('SELECT * FROM faqs WHERE business_id=? AND active=1 ORDER BY display_order,id').all(b.id),schedule:businessSchedule(b.id),staff});
});
app.get('/api/public/:slug/availability',(req,res)=>{
  const b=db.prepare(`SELECT * FROM businesses WHERE slug=? AND status='active' AND show_booking=1`).get(req.params.slug);if(!b)return res.sendStatus(404);
  const ids=String(req.query.serviceIds||'').split(',').map(Number).filter(Boolean);if(!ids.length)return res.json({slots:[],duration:0});
  const marks=ids.map(()=>'?').join(',');const services=db.prepare(`SELECT * FROM services WHERE business_id=? AND active=1 AND id IN (${marks})`).all(b.id,...ids);if(services.length!==new Set(ids).size)return res.status(400).json({error:'Uno de los servicios ya no está disponible'});
  try{resolvePromotion(b,services,req.query.promotionId,String(req.query.date||''))}catch(e){return res.status(400).json({error:e.message})}
  const partySize=b.allow_group_bookings?Math.max(1,Math.min(Math.max(1,Number(b.max_party_size||6)),Number(req.query.partySize||1))):1;const staffId=req.query.staffId?Number(req.query.staffId):null;const slots=availabilityFor({business:b,date:String(req.query.date||''),services,partySize,staffId});res.json({slots,duration:services.reduce((sum,x)=>sum+Number(x.duration_min||0),0)*partySize,partySize});
});

app.post('/api/public/:slug/quote',(req,res)=>{
  const b=db.prepare(`SELECT * FROM businesses WHERE slug=? AND status='active' AND show_booking=1`).get(req.params.slug);if(!b)return res.status(404).json({error:'Negocio no encontrado'});
  const x=req.body||{},ids=Array.isArray(x.serviceIds)?[...new Set(x.serviceIds.map(Number).filter(Boolean))]:[];if(!ids.length)return res.status(400).json({error:'Elegí al menos un servicio'});
  const marks=ids.map(()=>'?').join(',');const services=db.prepare(`SELECT * FROM services WHERE business_id=? AND active=1 AND id IN (${marks})`).all(b.id,...ids);if(services.length!==ids.length)return res.status(400).json({error:'Uno de los servicios ya no está disponible'});
  try{const quote=computeQuote({business:b,services,partySize:x.partySize,couponCode:x.couponCode,promotionId:x.promotionId,date:x.date,packCode:x.packCode,rewardCode:x.rewardCode});const benefits=applyBenefits(b,x,quote,services);quote.require_full_payment=benefits.fullPayment;quote.waive_advance=benefits.waiveAdvance;const payment=benefits.waiveAdvance?{mode:'none',due:0}:benefits.fullPayment?{mode:'total',due:quote.total_cents}:calculatePayment(b,quote.total_cents);quote.amount_due_cents=payment.due;quote.payment_mode=payment.mode;return res.json(quote)}catch(e){return res.status(400).json({error:e.message||'No se pudo calcular el descuento'})}
});

app.post('/api/public/:slug/bookings',async(req,res)=>{
  const b=db.prepare(`SELECT * FROM businesses WHERE slug=? AND status='active' AND show_booking=1`).get(req.params.slug);if(!b)return res.status(404).json({error:'Negocio no encontrado'});
  const x=req.body||{},ids=Array.isArray(x.serviceIds)?[...new Set(x.serviceIds.map(Number).filter(Boolean))]:[];if(!ids.length)return res.status(400).json({error:'Elegí al menos un servicio'});
  const marks=ids.map(()=>'?').join(',');const services=db.prepare(`SELECT * FROM services WHERE business_id=? AND active=1 AND id IN (${marks})`).all(b.id,...ids);if(services.length!==ids.length)return res.status(400).json({error:'Uno de los servicios ya no está disponible'});
  let quote,benefits,group;try{quote=computeQuote({business:b,services,partySize:x.partySize,couponCode:x.couponCode,promotionId:x.promotionId,date:x.date,packCode:x.packCode,rewardCode:x.rewardCode});group=groupSelection(b,x,quote,services);if(group){const lead=group.people[0];x.clientName=lead.name;x.phone=lead.phone;x.email=lead.email;if(x.packCode||x.rewardCode||x.clientAccess)throw new Error('Los beneficios privados se usan en reservas individuales.')}benefits=applyBenefits(b,x,quote,services);if(group){benefits.waiveAdvance=false;for(const person of group.people){const checked=applyBenefits(b,{phone:person.phone,email:person.email},quote,services);if(checked.fullPayment)benefits.fullPayment=true}}if(b.terms_required&&!x.acceptTerms)throw new Error('Aceptá los términos para reservar')}catch(e){return res.status(400).json({error:e.message||'No se pudo aplicar el descuento'})}
  const plan=getBusinessPlan(b),activeStaff=Number(plan.max_staff||1)>1?db.prepare('SELECT * FROM staff WHERE business_id=? AND active=1 ORDER BY display_order,id').all(b.id):[];let staffId=x.staffId?Number(x.staffId):null,staff=null;if(Number(plan.max_staff||1)<=1)staffId=null;if(activeStaff.length){if(!staffId)return res.status(400).json({error:'Elegí con qué profesional querés reservar'});staff=activeStaff.find(z=>Number(z.id)===staffId);if(!staff||!staffCanDoServices(staff.id,ids))return res.status(400).json({error:'Esa profesional no realiza todos los servicios seleccionados'})}
  refreshBillingState(b.id);if(!billingAccess(db.prepare('SELECT * FROM businesses WHERE id=?').get(b.id)))return res.status(402).json({error:'Este negocio no está recibiendo nuevas reservas online. Contactá al profesional.'});
  if(group){try{validateGroupAvailability(group,{business:b,date:x.date,services,staffId},availabilityFor)}catch(e){return res.status(409).json({error:e.message})}x.time=group.start}else{const available=availabilityFor({business:b,date:x.date,services,partySize:quote.party_size,staffId});if(!available.includes(x.time))return res.status(409).json({error:'Ese horario ya no está disponible. Elegí otro.'})}
  if(!x.clientName||!x.phone)return res.status(400).json({error:'Completá tu nombre y WhatsApp'});
  if(b.require_email&&!String(x.email||'').trim())return res.status(400).json({error:'Completá tu email para reservar'});
  const start=toMinutes(x.time),end=group?.end||fromMinutes(start+quote.duration_min),payment=benefits.waiveAdvance?{mode:'none',due:0}:benefits.fullPayment?{mode:'total',due:quote.total_cents}:calculatePayment(b,quote.total_cents);
  const allowedMethods=paymentMethods(b),method=payment.due>0?String(x.paymentMethod||allowedMethods[0]||''):'none';if(payment.due>0&&!allowedMethods.includes(method))return res.status(400).json({error:'Elegí un medio de pago habilitado por el profesional'});
  if(payment.due>0&&method==='bank_transfer'&&(!(b.bank_alias||b.bank_account)||!b.bank_holder))return res.status(503).json({error:'El profesional todavía debe completar su cuenta para recibir transferencias.'});
  if(payment.due>0&&method==='mercadopago'&&!b.mp_access_token_enc&&!DEMO_PAYMENTS)return res.status(503).json({error:'Esta profesional todavía no conectó Mercado Pago para recibir pagos online'});
  if(x.repeatDays&&(b.payment_mode!=='none'||x.packCode||x.rewardCode||x.couponCode||x.promotionId||benefits.fullPayment))return res.status(400).json({error:'La repetición automática desde la web requiere reservas sin pago online ni beneficios. Coordiná la serie con el profesional.'});
  const email=String(x.email||'').trim().toLowerCase();
  const tx=db.transaction(()=>{
    let client=benefits.client||findClient(b,email,x.phone);
    if(!client){const r=db.prepare('INSERT INTO clients(business_id,name,email,phone) VALUES(?,?,?,?)').run(b.id,String(x.clientName).trim(),email||null,String(x.phone).trim());client={id:r.lastInsertRowid}}
    else db.prepare('UPDATE clients SET name=?,phone=? WHERE id=?').run(String(x.clientName).trim(),String(x.phone).trim(),client.id);
    db.prepare('UPDATE clients SET phone_normalized=? WHERE id=?').run(normalizePhone(x.phone),client.id);
    cleanupExpiredHolds(b.id);
    if(group)validateGroupAvailability(group,{business:b,date:x.date,services,staffId},availabilityFor);else if(!availabilityFor({business:b,date:x.date,services,partySize:quote.party_size,staffId}).includes(x.time))throw new Error('slot_taken');
    const status=payment.due>0?'pending_payment':'confirmed',payStatus=payment.due>0?'pending':'not_required',hold=payment.due>0?new Date(Math.min(Date.now()+b.payment_hold_minutes*60*1000,Date.parse(`${x.date}T${x.time}:00-03:00`))).toISOString():null;
    const names=(quote.promotion?quote.promotion.title+' · ':'')+services.map(s=>s.name).join(' + '),summary=(quote.party_size>1?`${names} · ${quote.party_size} personas`:names)+(group?' · '+group.people.map(p=>p.time).join(' / '):''),manageToken=crypto.randomBytes(24).toString('hex');
    const r=db.prepare(`INSERT INTO bookings(business_id,client_id,date,start_time,end_time,status,payment_status,payment_mode,party_size,subtotal_cents,group_discount_cents,coupon_discount_cents,coupon_id,coupon_code,total_cents,amount_due_cents,selection_summary,notes,hold_expires_at,manage_token,staff_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(b.id,client.id,x.date,x.time,end,status,payStatus,payment.mode,quote.party_size,quote.subtotal_cents,quote.group_discount_cents,quote.coupon_discount_cents,quote.coupon?.id||null,quote.coupon?.code||null,quote.total_cents,payment.due,summary,x.notes||'',hold,manageToken,staffId);
    for(const item of quote.items)db.prepare('INSERT INTO booking_items(booking_id,service_id,service_name,price_cents,duration_min,quantity,line_subtotal_cents,line_discount_cents) VALUES(?,?,?,?,?,?,?,?)').run(r.lastInsertRowid,item.id,item.name,item.price_cents,item.duration_min,item.quantity,item.line_subtotal_cents,item.line_discount_cents);
    db.prepare('UPDATE bookings SET payment_method=?,payment_details_json=?,payment_waived=? WHERE id=?').run(method,method==='bank_transfer'?JSON.stringify(bankDetails(b)):null,benefits.waiveAdvance?1:0,Number(r.lastInsertRowid));
    if(quote.promotion){db.prepare('UPDATE bookings SET promotion_id=?,promotion_title=?,promotion_discount_cents=?,promotion_before_cents=? WHERE id=?').run(quote.promotion.id,quote.promotion.title,quote.promotion_discount_cents,quote.promotion.price_before_cents,Number(r.lastInsertRowid));for(const item of quote.items)db.prepare('UPDATE booking_items SET line_promotion_discount_cents=? WHERE booking_id=? AND service_id=?').run(item.line_promotion_discount_cents||0,Number(r.lastInsertRowid),item.id)}
    storeParticipants(Number(r.lastInsertRowid),b,group,findClient);
    storeBenefits(Number(r.lastInsertRowid),b,x,benefits,quote);
    db.prepare("INSERT INTO analytics_events(business_id,event) VALUES(?,'booking_created')").run(b.id);
    const recurring=x.repeatDays?reserveSeries({b,original:db.prepare('SELECT * FROM bookings WHERE id=?').get(r.lastInsertRowid),options:{interval_days:x.repeatDays,count:x.repeatCount||1},availabilityFor}):[];
    return {bookingId:Number(r.lastInsertRowid),clientId:Number(client.id),recurring};
  });
  let created;try{created=tx()}catch(e){return res.status(409).json({error:e.message==='slot_taken'?'Ese horario ya fue reservado. Elegí otro.':e.message||'No se pudo guardar la reserva. Probá otro horario.'})}
  let booking=bookingDetails(created.bookingId);
  await emailProfessional(booking,'new');
  if(payment.due<=0){await emailBooking(booking);for(const id of created.recurring)await emailBooking(bookingDetails(id));return res.json({ok:true,booking,recurring:created.recurring.map(bookingDetails),payment:{required:false,status:'confirmed'}})}
  if(method==='bank_transfer'){await emailBooking(booking);return res.json({ok:true,booking,payment:{required:true,method:'bank_transfer',demo:false,amount_cents:payment.due}})}
  if(b.mp_access_token_enc){
    try{
      const pref=await createPreference({business:b,booking,items:booking.items,client:{name:booking.client_name,email:booking.client_email,phone:booking.client_phone}});
      db.prepare('UPDATE bookings SET mp_preference_id=? WHERE id=?').run(String(pref.id||''),booking.id);booking=bookingDetails(booking.id);await emailBooking(booking);
      return res.json({ok:true,booking,payment:{required:true,demo:false,init_point:pref.init_point||pref.sandbox_init_point}});
    }catch(e){db.prepare(`UPDATE bookings SET status='cancelled',payment_status='error' WHERE id=?`).run(booking.id);return res.status(502).json({error:e.message||'No se pudo iniciar Mercado Pago'})}
  }
  await emailBooking(booking);
  res.json({ok:true,booking,payment:{required:true,demo:true,amount_cents:payment.due}});
});
app.get('/api/public/:slug/bookings/:id/status',(req,res)=>{
  const b=db.prepare('SELECT * FROM businesses WHERE slug=?').get(req.params.slug);if(!b)return res.sendStatus(404);cleanupExpiredHolds(b.id);const bk=db.prepare('SELECT id,status,payment_mode,payment_method,payment_details_json,payment_waived,payment_status,party_size,subtotal_cents,group_discount_cents,coupon_discount_cents,coupon_code,promotion_id,promotion_title,promotion_discount_cents,promotion_before_cents,total_cents,amount_due_cents,amount_paid_cents,selection_summary,date,start_time,end_time,manage_token,hold_expires_at,payment_review_required FROM bookings WHERE id=? AND business_id=?').get(req.params.id,b.id);if(!bk||req.query.token!==bk.manage_token)return res.status(404).json({error:'Reserva no encontrada'});res.json({...decoratePayment(bk),participants:participantsFor(bk.id),manage_url:bk.manage_token?`${FRONTEND_URL}/mi-reserva/${bk.manage_token}`:''});
});
app.post('/api/public/:slug/bookings/:id/demo-approve',async(req,res)=>{
  if(!DEMO_PAYMENTS)return res.sendStatus(404);const b=db.prepare('SELECT * FROM businesses WHERE slug=?').get(req.params.slug);if(!b)return res.sendStatus(404);cleanupExpiredHolds(b.id);const bk=db.prepare(`SELECT * FROM bookings WHERE id=? AND business_id=? AND status='pending_payment'`).get(req.params.id,b.id);if(!bk||bk.payment_method==='bank_transfer'||req.body?.token!==bk.manage_token||Date.parse(bk.hold_expires_at)<=Date.now())return res.status(409).json({error:'La reserva no está pendiente de pago'});db.prepare(`UPDATE bookings SET status='confirmed',payment_status='approved',amount_paid_cents=amount_due_cents,hold_expires_at=NULL WHERE id=?`).run(bk.id);const booking=bookingDetails(bk.id);await emailBooking(booking);await emailProfessional(booking,'paid');res.json({ok:true,booking});
});


// ---------- Gestión de reserva por el cliente ----------
app.get('/api/public/manage-booking/:token',(req,res)=>{
  const held=db.prepare('SELECT business_id FROM bookings WHERE manage_token=?').get(req.params.token);if(held)cleanupExpiredHolds(held.business_id);
  const booking=db.prepare(`SELECT bk.*,c.name client_name,c.email client_email,c.phone client_phone,b.name business_name,b.slug business_slug,b.cancellation_hours,b.cancellation_policy,b.phone business_phone,s.name staff_name FROM bookings bk JOIN clients c ON c.id=bk.client_id JOIN businesses b ON b.id=bk.business_id LEFT JOIN staff s ON s.id=bk.staff_id WHERE bk.manage_token=?`).get(req.params.token);
  if(!booking)return res.status(404).json({error:'No encontramos esa reserva'});
  const items=db.prepare('SELECT service_id,service_name,price_cents,duration_min,quantity FROM booking_items WHERE booking_id=? ORDER BY id').all(booking.id);
  const series=booking.series_id?db.prepare('SELECT date,start_time,status,manage_token FROM bookings WHERE series_id=? AND client_id=? AND business_id=? ORDER BY date').all(booking.series_id,booking.client_id,booking.business_id).map(x=>({...x,manage_url:`${FRONTEND_URL}/mi-reserva/${x.manage_token}`})):[];res.json({...decoratePayment(booking),participants:participantsFor(booking.id),items,series,can_change:bookingCanChange(booking),manage_url:`${FRONTEND_URL}/mi-reserva/${booking.manage_token}`});
});
app.get('/api/public/manage-booking/:token/availability',(req,res)=>{
  const found=db.prepare('SELECT id FROM bookings WHERE manage_token=?').get(req.params.token),booking=found?bookingDetails(found.id):null;
  if(!booking)return res.status(404).json({error:'No encontramos esa reserva'});
  if(!bookingCanChange(booking))return res.status(409).json({error:'Esta reserva ya no puede reprogramarse online'});
  const business=db.prepare('SELECT * FROM businesses WHERE id=?').get(booking.business_id);
  const ids=[...new Set(booking.items.map(x=>Number(x.service_id)).filter(Boolean))];
  const marks=ids.map(()=>'?').join(',');const services=ids.length?db.prepare(`SELECT * FROM services WHERE business_id=? AND id IN (${marks})`).all(booking.business_id,...ids):[];
  if(services.length!==ids.length)return res.status(409).json({error:'Uno de los servicios ya no está disponible'});
  const group=participantsFor(booking.id).length>0;let slots=availabilityFor({business,date:String(req.query.date||''),services,partySize:group?1:booking.party_size,excludeBookingId:booking.id,staffId:booking.staff_id||null});if(group)slots=slots.filter(time=>{try{validateGroupAvailability(shiftedGroup(booking,String(req.query.date||''),time),{business,date:String(req.query.date||''),services,excludeBookingId:booking.id,staffId:booking.staff_id||null},availabilityFor);return true}catch{return false}});
  res.json({slots});
});
app.post('/api/public/manage-booking/:token/cancel',async(req,res)=>{
  const booking=bookingDetails(db.prepare('SELECT id FROM bookings WHERE manage_token=?').get(req.params.token)?.id);
  if(!booking)return res.status(404).json({error:'No encontramos esa reserva'});
  if(!bookingCanChange(booking))return res.status(409).json({error:`La cancelación online requiere al menos ${booking.cancellation_hours||0} horas de anticipación`});
  db.prepare(`UPDATE bookings SET status='cancelled',hold_expires_at=NULL WHERE id=?`).run(booking.id);
  reconcileBenefits();const updated=bookingDetails(booking.id);await emailBooking(updated);await emailProfessional(updated,'cancelled');
  res.json({ok:true,booking:{...updated,can_change:false},refund_note:booking.amount_paid_cents>0?'La cancelación no genera automáticamente un reintegro. Coordiná la devolución con el profesional.':''});
});
app.post('/api/public/manage-booking/:token/reschedule',async(req,res)=>{
  const found=db.prepare('SELECT id FROM bookings WHERE manage_token=?').get(req.params.token),booking=found?bookingDetails(found.id):null;
  if(!booking)return res.status(404).json({error:'No encontramos esa reserva'});
  if(!bookingCanChange(booking))return res.status(409).json({error:`La reprogramación online requiere al menos ${booking.cancellation_hours||0} horas de anticipación`});
  const date=String(req.body?.date||''),time=String(req.body?.time||'');if(!date||!time)return res.status(400).json({error:'Elegí una nueva fecha y horario'});
  const business=db.prepare('SELECT * FROM businesses WHERE id=?').get(booking.business_id),ids=[...new Set(booking.items.map(x=>Number(x.service_id)).filter(Boolean))];
  const marks=ids.map(()=>'?').join(',');const services=ids.length?db.prepare(`SELECT * FROM services WHERE business_id=? AND id IN (${marks})`).all(booking.business_id,...ids):[];
  if(services.length!==ids.length)return res.status(409).json({error:'Uno de los servicios ya no está disponible'});
  let group;try{group=shiftedGroup(booking,date,time);if(group)validateGroupAvailability(group,{business,date,services,excludeBookingId:booking.id,staffId:booking.staff_id||null},availabilityFor)}catch(e){return res.status(409).json({error:e.message})}const slots=availabilityFor({business,date,services,partySize:group?1:booking.party_size,excludeBookingId:booking.id,staffId:booking.staff_id||null});if(!slots.includes(time))return res.status(409).json({error:'Ese horario ya no está disponible'});
  const duration=services.reduce((sum,x)=>sum+Number(x.duration_min||0),0)*Math.max(1,Number(booking.party_size||1)),end=group?.end||fromMinutes(toMinutes(time)+duration);
  db.transaction(()=>{moveParticipants(booking.id,group);
  db.prepare('UPDATE bookings SET date=?,start_time=?,end_time=?,attendance_confirmed_at=NULL WHERE id=?').run(date,time,end,booking.id)})();
  const updated=bookingDetails(booking.id);await emailBooking(updated);await emailProfessional(updated,'rescheduled');res.json({ok:true,booking:{...updated,can_change:bookingCanChange(updated)}});
});

// ---------- Webhook Mercado Pago ----------
app.post('/api/webhooks/mercadopago',async(req,res)=>{
  res.status(200).json({ok:true});
  try{
    const businessId=Number(req.query.business||req.body?.data?.metadata?.business_id||0);if(!businessId)return;
    const business=db.prepare('SELECT * FROM businesses WHERE id=?').get(businessId);if(!business?.mp_access_token_enc)return;
    const paymentId=String(req.body?.data?.id||req.query['data.id']||req.query.id||'');if(!paymentId)return;
    const payment=await fetchPayment(business,paymentId);const bookingId=Number(payment.external_reference||payment.metadata?.booking_id||0);if(!bookingId)return;
    cleanupExpiredHolds(business.id);
    const booking=db.prepare('SELECT * FROM bookings WHERE id=? AND business_id=?').get(bookingId,business.id);if(!booking||booking.payment_method==='bank_transfer')return;
    if(payment.status==='approved'){
      const paid=Math.round(Number(payment.transaction_amount||0)*100);
      const review=booking.status==='cancelled'||paid<booking.amount_due_cents||(payment.currency_id&&payment.currency_id!=='ARS');
      if(review){
        db.prepare("UPDATE bookings SET status='cancelled',payment_status='approved',amount_paid_cents=?,mp_payment_id=?,payment_review_required=1 WHERE id=?").run(paid,paymentId,booking.id);
        reconcileBenefits();if(!booking.payment_review_required)await emailProfessional(bookingDetails(booking.id),'payment_review');
      }else{
        // Repeated webhooks preserve completed/no-show states and send one confirmation.
        const newlyPaid=booking.payment_status!=='approved';
        db.prepare("UPDATE bookings SET status=CASE WHEN status='pending_payment' THEN 'confirmed' ELSE status END,payment_status='approved',amount_paid_cents=?,mp_payment_id=?,hold_expires_at=NULL WHERE id=?").run(paid,paymentId,booking.id);
        if(newlyPaid){const updated=bookingDetails(booking.id);await emailBooking(updated);await emailProfessional(updated,'paid')}
      }
    }else if(['refunded','charged_back'].includes(payment.status)||(['rejected','cancelled'].includes(payment.status)&&booking.payment_status!=='approved')){
      db.prepare("UPDATE bookings SET status='cancelled',payment_status=?,mp_payment_id=?,hold_expires_at=NULL,payment_review_required=0 WHERE id=?").run(payment.status,paymentId,booking.id);reconcileBenefits();
    }else if(booking.payment_status!=='approved'&&booking.status==='pending_payment')db.prepare('UPDATE bookings SET payment_status=?,mp_payment_id=? WHERE id=?').run(payment.status||'pending',paymentId,booking.id);
  }catch(e){console.error('Webhook Mercado Pago:',e.message)}
});

// ---------- Super Admin ----------
app.get('/api/admin/overview',auth,superOnly,(_req,res)=>{
  for(const b of db.prepare('SELECT id FROM businesses').all())refreshBillingState(b.id);
  const users=db.prepare(`SELECT count(*) n FROM users WHERE role='owner'`).get().n,businesses=db.prepare('SELECT count(*) n FROM businesses').get().n,active=db.prepare(`SELECT count(*) n FROM businesses WHERE status='active'`).get().n,verified=db.prepare(`SELECT count(*) n FROM users WHERE role='owner' AND email_verified=1`).get().n,trialing=db.prepare(`SELECT count(*) n FROM businesses WHERE subscription_status='trialing'`).get().n,paid=db.prepare(`SELECT count(*) n FROM businesses WHERE subscription_status='active'`).get().n;
  const mrrRow=db.prepare(`SELECT COALESCE(SUM(CASE WHEN b.subscription_managed=1 THEN CASE WHEN s.status='authorized' AND s.provider='mercadopago' THEN s.amount_cents/CASE WHEN s.billing_cycle='annual' THEN 12 ELSE 1 END ELSE 0 END WHEN b.billing_cycle='monthly' THEN COALESCE(b.custom_monthly_price_cents,p.monthly_price_cents) WHEN b.billing_cycle='annual' THEN COALESCE(b.custom_annual_price_cents,p.annual_price_cents)/12 ELSE 0 END),0) cents FROM businesses b JOIN plans p ON p.slug=b.plan_slug LEFT JOIN platform_subscriptions s ON s.id=(SELECT id FROM platform_subscriptions WHERE business_id=b.id ORDER BY created_at DESC,rowid DESC LIMIT 1) WHERE b.status='active' AND b.subscription_status='active'`).get();
  const stores=db.prepare(`SELECT b.*,u.name owner_name,u.email owner_email,u.email_verified,p.name plan_name,p.monthly_price_cents,p.annual_price_cents,p.max_staff,p.team_enabled FROM businesses b JOIN users u ON u.id=b.owner_id JOIN plans p ON p.slug=b.plan_slug ORDER BY b.id DESC LIMIT 12`).all();
  res.json({users,businesses,active,verified,trialing,paid,mrr_cents:Number(mrrRow?.cents||0),stores});
});
app.get('/api/admin/businesses',auth,superOnly,(_req,res)=>res.json(db.prepare(`SELECT b.*,u.name owner_name,u.email owner_email,u.email_verified,p.name plan_name,p.monthly_price_cents,p.annual_price_cents,p.max_staff,p.team_enabled,(SELECT count(*) FROM platform_subscriptions WHERE business_id=b.id AND status IN ('creating','pending','authorized','paused')) recurring_active FROM businesses b JOIN users u ON u.id=b.owner_id JOIN plans p ON p.slug=b.plan_slug ORDER BY b.id DESC`).all()));
app.patch('/api/admin/businesses/:id',auth,superOnly,(req,res)=>{
  const current=db.prepare('SELECT * FROM businesses WHERE id=?').get(req.params.id);if(!current)return res.sendStatus(404);const x=req.body||{},plan=x.plan_slug?db.prepare('SELECT * FROM plans WHERE slug=?').get(x.plan_slug):null;
  const recurring=db.prepare("SELECT * FROM platform_subscriptions WHERE business_id=? AND status IN ('creating','pending','authorized','paused')").get(current.id);if(recurring&&x.trial_ends_at!==undefined&&x.trial_ends_at!==current.trial_ends_at)return res.status(409).json({error:'Primero cancelá la renovación programada para modificar la fecha de prueba.'});if(recurring&&x.subscription_status&&x.subscription_status!==current.subscription_status)return res.status(409).json({error:'La suscripción se actualiza con sus pagos. Para detener renovaciones, usá Suscripciones.'});if(recurring&&((x.plan_slug&&x.plan_slug!==current.plan_slug)||(x.billing_cycle&&x.billing_cycle!==current.billing_cycle)))return res.status(409).json({error:'Primero cancelá la renovación desde Suscripciones. Cambiar el plan no modifica el contrato de Mercado Pago.'});
  for(const value of [x.custom_monthly_price,x.custom_annual_price])if(value!==undefined&&value!==null&&value!==''&&(!Number.isFinite(Number(value))||Number(value)<0))return res.status(400).json({error:'El precio especial debe ser un importe válido y no negativo'});
  const customMonthly=x.custom_monthly_price===undefined?current.custom_monthly_price_cents:(x.custom_monthly_price===null||x.custom_monthly_price===''?null:cents(x.custom_monthly_price));const customAnnual=x.custom_annual_price===undefined?current.custom_annual_price_cents:(x.custom_annual_price===null||x.custom_annual_price===''?null:cents(x.custom_annual_price));db.prepare(`UPDATE businesses SET status=?,plan_slug=?,billing_cycle=?,subscription_status=?,trial_ends_at=?,custom_monthly_price_cents=?,custom_annual_price_cents=?,admin_notes=? WHERE id=?`).run(x.status||current.status,plan?.slug||current.plan_slug,['monthly','annual'].includes(x.billing_cycle)?x.billing_cycle:current.billing_cycle,x.subscription_status||current.subscription_status,x.trial_ends_at||current.trial_ends_at,customMonthly,customAnnual,x.admin_notes===undefined?current.admin_notes:String(x.admin_notes||'').slice(0,2000),current.id);if(!recurring&&x.subscription_status)db.prepare('UPDATE businesses SET subscription_managed=0 WHERE id=?').run(current.id);res.json({ok:true});
});
app.patch('/api/admin/users/:id',auth,superOnly,(req,res)=>{const u=db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id);if(!u)return res.sendStatus(404);if(req.body?.email_verified!==undefined)db.prepare('UPDATE users SET email_verified=? WHERE id=?').run(req.body.email_verified?1:0,u.id);res.json({ok:true})});
app.get('/api/admin/plans',auth,superOnly,(_req,res)=>res.json(db.prepare('SELECT * FROM plans ORDER BY display_order,id').all().map(publicPlan)));
app.post('/api/admin/plans',auth,superOnly,(req,res)=>{
  const x=req.body||{},name=String(x.name||'').trim(),slugBase=slugify(x.slug||name);if(!name)return res.status(400).json({error:'Escribí el nombre del plan'});
  let slug=slugBase,i=1;while(db.prepare('SELECT 1 FROM plans WHERE slug=?').get(slug))slug=`${slugBase}-${++i}`;
  const order=Number(db.prepare('SELECT COALESCE(MAX(display_order),0)+1 n FROM plans').get().n||1);
  db.prepare(`INSERT INTO plans(slug,name,description,monthly_price_cents,annual_price_cents,max_services,max_promotions,max_posts,max_coupons,analytics_enabled,template_level,features_json,active,public_enabled,highlighted,display_order,max_staff,team_enabled) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(slug,name,x.description||'',cents(x.monthly_price||0),cents(x.annual_price||0),Math.max(1,Number(x.max_services||100)),Math.max(0,Number(x.max_promotions||30)),Math.max(0,Number(x.max_posts||100)),Math.max(0,Number(x.max_coupons||50)),x.analytics_enabled===false?0:1,Math.max(1,Math.min(3,Number(x.template_level||3))),JSON.stringify(Array.isArray(x.features)?x.features:[]),x.active===false?0:1,x.public_enabled?1:0,x.highlighted?1:0,order,Math.max(1,Number(x.max_staff||1)),Number(x.max_staff||1)>1?1:0);res.json({ok:true,slug});
});
app.put('/api/admin/plans/:slug',auth,superOnly,(req,res)=>{
  const p=db.prepare('SELECT * FROM plans WHERE slug=?').get(req.params.slug);if(!p)return res.sendStatus(404);const x=req.body||{};
  const nextPublic=x.public_enabled===undefined?p.public_enabled:(x.public_enabled?1:0),nextActive=x.active===undefined?p.active:(x.active?1:0);
  if((!nextPublic||!nextActive)&&p.public_enabled&&p.active){const others=db.prepare('SELECT count(*) n FROM plans WHERE slug!=? AND active=1 AND public_enabled=1').get(p.slug).n;if(!others)return res.status(400).json({error:'Debe quedar al menos un plan público y activo'})}
  db.prepare(`UPDATE plans SET name=?,description=?,monthly_price_cents=?,annual_price_cents=?,max_services=?,max_promotions=?,max_posts=?,max_coupons=?,analytics_enabled=?,template_level=?,features_json=?,active=?,public_enabled=?,highlighted=?,display_order=?,max_staff=?,team_enabled=? WHERE slug=?`).run(x.name||p.name,x.description??p.description,cents(x.monthly_price??p.monthly_price_cents/100),cents(x.annual_price??p.annual_price_cents/100),Math.max(1,Number(x.max_services??p.max_services)),Math.max(0,Number(x.max_promotions??p.max_promotions)),Math.max(0,Number(x.max_posts??p.max_posts)),Math.max(0,Number(x.max_coupons??p.max_coupons)),x.analytics_enabled===undefined?p.analytics_enabled:(x.analytics_enabled?1:0),Math.max(1,Math.min(3,Number(x.template_level??p.template_level))),JSON.stringify(Array.isArray(x.features)?x.features:publicPlan(p).features),nextActive,nextPublic,x.highlighted===undefined?p.highlighted:(x.highlighted?1:0),Number(x.display_order??p.display_order),Math.max(1,Number(x.max_staff??p.max_staff??1)),Math.max(1,Number(x.max_staff??p.max_staff??1))>1?1:0,p.slug);if(x.basic_only!==undefined)db.prepare('UPDATE plans SET basic_only=? WHERE slug=?').run(x.basic_only?1:0,p.slug);res.json({ok:true});
});
app.delete('/api/admin/plans/:slug',auth,superOnly,(req,res)=>{const p=db.prepare('SELECT * FROM plans WHERE slug=?').get(req.params.slug);if(!p)return res.sendStatus(404);const used=db.prepare('SELECT count(*) n FROM businesses WHERE plan_slug=?').get(p.slug).n;const contracted=db.prepare('SELECT 1 FROM platform_subscriptions WHERE plan_slug=? LIMIT 1').get(p.slug);if(used||contracted)return res.status(409).json({error:'No podés eliminar un plan que ya tiene cuentas. Podés ocultarlo o desactivarlo.'});const visible=db.prepare('SELECT count(*) n FROM plans WHERE slug!=? AND active=1 AND public_enabled=1').get(p.slug).n;if(p.active&&p.public_enabled&&!visible)return res.status(400).json({error:'Debe quedar al menos un plan público'});db.prepare('DELETE FROM plans WHERE slug=?').run(p.slug);res.json({ok:true})});
app.get('/api/admin/settings',auth,superOnly,(_req,res)=>res.json({trial_days:Number(getSetting('trial_days','15')),...homeContact(),billing:billingConfiguration(),demo_payments:DEMO_PAYMENTS,mp_oauth_configured:oauthConfigured(),email_configured:Boolean(process.env.RESEND_API_KEY)}));
app.put('/api/admin/settings',auth,superOnly,(req,res)=>{try{savePlatformSettings(req.body||{});res.json({ok:true})}catch(e){res.status(400).json({error:e.message})}});

registerManualPayments(app,{auth,own,bookingDetails,cleanupExpiredHolds,emailBooking,emailProfessional});
registerManualBookings(app,{auth,own,availabilityFor,bookingDetails,getBusinessPlan,staffCanDoServices,computeQuote});
registerPlatformSupport(app,{auth,superOnly});
export const featureWorker=registerFeatures(app,{auth,own,availabilityFor,bookingDetails,staffCanDoServices});

registerMarketingPages(app,{distDir,frontendUrl:FRONTEND_URL,enabled:PRODUCTION});
app.use('/api',(_req,res)=>res.status(404).json({error:'Ruta no encontrada'}));
if(PRODUCTION){
  app.use(express.static(distDir,{index:false,dotfiles:'deny',setHeaders:(res,file)=>res.set('Cache-Control',file.includes(`${path.sep}assets${path.sep}`)?'public, max-age=31536000, immutable':'no-cache')}));
  app.get('/{*route}',(req,res)=>{
    if(path.extname(req.path)||req.path.split('/').some(part=>part.startsWith('.')))return res.sendStatus(404);
    res.set('Cache-Control','no-store').sendFile(path.join(distDir,'index.html'));
  });
}
app.use((err,req,res,next)=>{console.error(err);if(res.headersSent)return next(err);res.status(500).json({error:'Ocurrió un error en el servidor'})});
export {app};
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  const server=app.listen(PORT,'0.0.0.0',()=>console.log(`Adara Web escuchando en el puerto ${PORT}`));
  const shutdown=()=>{server.close(()=>{db.close();process.exit(0)});setTimeout(()=>process.exit(1),10000).unref()};
  process.once('SIGTERM',shutdown);process.once('SIGINT',shutdown);
}
