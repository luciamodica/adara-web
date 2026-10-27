import {useEffect,useState} from 'react';
import {recentBookings,forgetBooking,recoveryPath,needsBookingRecovery} from '../shared/booking-recovery.js';
export default function BookingRecovery({slug}:any){
 const[rows,setRows]=useState<any[]>([]);
 useEffect(()=>{
  let active=true,request=0;
  const refresh=async()=>{
   const current=++request;
   let saved:any[]=[];try{saved=recentBookings(localStorage,slug).slice(0,3)}catch{}
   const checked=await Promise.all(saved.map(async row=>{
    try{
     const response=await fetch('/api/public/manage-booking/'+encodeURIComponent(row.token));
     if(response.status===404||response.status===410){try{forgetBooking(localStorage,row.token)}catch{}return null}
     if(!response.ok)return row;
     const booking=await response.json();
     if(needsBookingRecovery(booking))return row;
     try{forgetBooking(localStorage,row.token)}catch{}return null;
    }catch{return row}
   }));
   if(active&&current===request)setRows(checked.filter(Boolean));
  };
  const resume=()=>{if(!document.hidden)refresh()};
  refresh();window.addEventListener('focus',resume);document.addEventListener('visibilitychange',resume);
  return()=>{active=false;window.removeEventListener('focus',resume);document.removeEventListener('visibilitychange',resume)};
 },[slug]);
 if(!rows.length)return null;
 return <div className="bookingRecovery compactRecovery" role="region" aria-label="Retomar reserva">{rows.map((row:any,i:number)=><div key={row.token}><a className="outline" href={recoveryPath(row.token)}>Retomar {rows.length>1?'reserva '+(i+1):'mi reserva'}</a><button type="button" className="link" aria-label={'Ocultar reserva '+(i+1)+' en este dispositivo'} onClick={()=>{try{forgetBooking(localStorage,row.token)}catch{}setRows(rows.filter((x:any)=>x.token!==row.token))}}>Ocultar</button></div>)}</div>;
}
