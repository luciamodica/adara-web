const argentinaDate=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Argentina/Buenos_Aires',year:'numeric',month:'2-digit',day:'2-digit'});
export const bookingToday=(now=Date.now())=>argentinaDate.format(new Date(now));

export function publicBookingEnd(business,today=bookingToday()){
 if(business.booking_available_until)return business.booking_available_until;
 const date=new Date(today+'T12:00:00Z');
 date.setUTCDate(date.getUTCDate()+Number(business.booking_horizon_days||90));
 return date.toISOString().slice(0,10);
}

export const bookingFilters=[['upcoming','Próximos'],['pending','Pendientes'],['cancelled','Cancelados'],['past','Ya realizados']];

export function bookingSection(booking,now=Date.now()){
 if(booking.status==='cancelled')return 'cancelled';
 if(booking.status==='pending_payment')return 'pending';
 if(['completed','no_show'].includes(booking.status))return 'past';
 const end=Date.parse(booking.date+'T'+(booking.end_time||booking.start_time)+':00-03:00');
 return end<=now?'past':'upcoming';
}
