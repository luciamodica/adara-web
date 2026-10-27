const KEY='adara-recent-bookings-v1',TTL=7*86400000;
const valid=x=>x&&typeof x.slug==='string'&&/^[a-z0-9-]{1,150}$/.test(x.slug)&&Number.isSafeInteger(x.id)&&x.id>0&&typeof x.token==='string'&&/^[a-zA-Z0-9_-]{16,128}$/.test(x.token)&&Number.isFinite(x.savedAt);
export function recentBookings(storage,slug,now=Date.now()){
 try{const rows=JSON.parse(storage.getItem(KEY)||'[]');return Array.isArray(rows)?rows.filter(x=>valid(x)&&x.savedAt<=now&&x.savedAt>now-TTL&&(!slug||x.slug===slug)).slice(0,8):[]}catch{return []}
}
export function rememberBooking(storage,slug,booking,now=Date.now()){
 const item={slug,id:Number(booking.id),token:booking.manage_token,savedAt:now};if(!valid(item))return;
 try{storage.setItem(KEY,JSON.stringify([item,...recentBookings(storage,undefined,now).filter(x=>x.token!==item.token)].slice(0,8)))}catch{}
}
export function forgetBooking(storage,token){try{storage.setItem(KEY,JSON.stringify(recentBookings(storage).filter(x=>x.token!==token)))}catch{}}
export const recoveryPath=token=>'/mi-reserva/'+encodeURIComponent(token);

export const needsBookingRecovery=(booking,now=Date.now())=>booking?.status==='pending_payment'&&booking.payment_method==='bank_transfer'&&Date.parse(booking.hold_expires_at)>now;
