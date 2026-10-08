import {db} from './db.js';
import {decryptSecret, encryptSecret} from './crypto.js';

const apiBase = 'https://api.mercadopago.com';

export function oauthConfigured(){
  return Boolean(process.env.MP_PLATFORM_CLIENT_ID && process.env.MP_PLATFORM_CLIENT_SECRET && process.env.MP_OAUTH_REDIRECT_URI);
}

export function authorizationUrl(state){
  const q = new URLSearchParams({
    client_id:process.env.MP_PLATFORM_CLIENT_ID || '',
    response_type:'code',
    platform_id:'mp',
    redirect_uri:process.env.MP_OAUTH_REDIRECT_URI || '',
    state
  });
  return `https://auth.mercadopago.com.ar/authorization?${q.toString()}`;
}

async function tokenRequest(body){
  const r = await fetch(`${apiBase}/oauth/token`,{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify(body)
  });
  const data = await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(data.message || 'Mercado Pago no pudo autorizar la cuenta');
  return data;
}

export async function exchangeCode(code){
  return tokenRequest({
    client_secret:process.env.MP_PLATFORM_CLIENT_SECRET,
    client_id:process.env.MP_PLATFORM_CLIENT_ID,
    grant_type:'authorization_code',
    code,
    redirect_uri:process.env.MP_OAUTH_REDIRECT_URI
  });
}

async function refreshBusinessToken(business){
  const refresh = decryptSecret(business.mp_refresh_token_enc);
  if(!refresh) throw new Error('La conexión con Mercado Pago necesita renovarse');
  const data = await tokenRequest({
    client_secret:process.env.MP_PLATFORM_CLIENT_SECRET,
    client_id:process.env.MP_PLATFORM_CLIENT_ID,
    grant_type:'refresh_token',
    refresh_token:refresh
  });
  const expires = new Date(Date.now() + Number(data.expires_in || 15552000)*1000).toISOString();
  db.prepare(`UPDATE businesses SET mp_access_token_enc=?,mp_refresh_token_enc=?,mp_token_expires_at=?,mp_user_id=?,mp_connected_at=COALESCE(mp_connected_at,CURRENT_TIMESTAMP) WHERE id=?`).run(
    encryptSecret(data.access_token), encryptSecret(data.refresh_token || refresh), expires, String(data.user_id || business.mp_user_id || ''), business.id
  );
  return data.access_token;
}

export async function getBusinessAccessToken(business){
  if(!business.mp_access_token_enc) return null;
  const expiresAt = business.mp_token_expires_at ? new Date(business.mp_token_expires_at).getTime() : Infinity;
  if(expiresAt < Date.now()+5*60*1000 && business.mp_refresh_token_enc && oauthConfigured()) return refreshBusinessToken(business);
  return decryptSecret(business.mp_access_token_enc);
}

export async function createPreference({business,booking,items,client}){
  const accessToken = await getBusinessAccessToken(business);
  if(!accessToken) throw new Error('Mercado Pago no está conectado');
  const frontend = process.env.FRONTEND_URL || 'http://localhost:5173';
  const publicApi = process.env.PUBLIC_API_URL || 'http://localhost:3001';
  const amount = booking.amount_due_cents / 100;
  const payload = {
    items:[{id:String(booking.id),title:`Reserva ${business.name} · ${booking.selection_summary}`,quantity:1,currency_id:'ARS',unit_price:amount}],
    payer:{name:client.name,email:client.email || undefined,phone:client.phone ? {number:client.phone} : undefined},
    external_reference:String(booking.id),
    notification_url:`${publicApi}/api/webhooks/mercadopago?business=${business.id}`,
    back_urls:{
      success:`${frontend}/reservar/${business.slug}?payment=success&booking=${booking.id}&token=${booking.manage_token}`,
      pending:`${frontend}/reservar/${business.slug}?payment=pending&booking=${booking.id}&token=${booking.manage_token}`,
      failure:`${frontend}/reservar/${business.slug}?payment=failure&booking=${booking.id}&token=${booking.manage_token}`
    },
    auto_return:'approved',
    expires:true,expiration_date_from:new Date().toISOString(),expiration_date_to:booking.hold_expires_at,
    statement_descriptor:'ADARA RESERVA',
    metadata:{business_id:business.id,booking_id:booking.id}
  };
  const r = await fetch(`${apiBase}/checkout/preferences`,{
    method:'POST',headers:{Authorization:`Bearer ${accessToken}`,'Content-Type':'application/json'},body:JSON.stringify(payload)
  });
  const data = await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(data.message || 'No se pudo iniciar el pago con Mercado Pago');
  return data;
}

export async function fetchPayment(business,paymentId){
  const accessToken = await getBusinessAccessToken(business);
  if(!accessToken) throw new Error('Mercado Pago no está conectado');
  const r = await fetch(`${apiBase}/v1/payments/${paymentId}`,{headers:{Authorization:`Bearer ${accessToken}`}});
  const data = await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(data.message || 'No se pudo consultar el pago');
  return data;
}
