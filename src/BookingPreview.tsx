import {useEffect,useMemo,useRef,useState} from 'react';
import {ArrowRight,CalendarDays,Check,CheckCircle2,Clock3,RotateCcw} from 'lucide-react';
import './booking-preview.css';

const services=[
  {id:'corte',name:'Corte y peinado',duration:45},
  {id:'manicura',name:'Manicura clásica',duration:60},
  {id:'cejas',name:'Diseño de cejas',duration:30}
];
const times=['09:00','10:30','12:00','14:00','15:30','17:00'];

/** A self-contained example: it never calls the booking or payment APIs. */
export default function BookingPreview(){
  const [serviceId,setServiceId]=useState(services[0].id);
  const [dayIndex,setDayIndex]=useState(0);
  const [time,setTime]=useState('');
  const [booked,setBooked]=useState(false);
  const result=useRef<HTMLDivElement>(null);
  const days=useMemo(()=>Array.from({length:3},(_,index)=>{
    const date=new Date(Date.now()+(index+1)*86400000);
    const options={timeZone:'America/Argentina/Buenos_Aires'};
    return {
      weekday:index===0?'Mañana':new Intl.DateTimeFormat('es-AR',{...options,weekday:'short'}).format(date),
      short:new Intl.DateTimeFormat('es-AR',{...options,day:'numeric',month:'short'}).format(date),
      full:new Intl.DateTimeFormat('es-AR',{...options,weekday:'long',day:'numeric',month:'long'}).format(date)
    };
  }),[]);
  const service=services.find(item=>item.id===serviceId)!;
  useEffect(()=>{if(booked)result.current?.focus()},[booked]);

  function restart(){setBooked(false);setTime('')}

  return <div className="productStage bookingStage" id="demo-reserva" aria-label="Demostración de una reserva">
    <div className="bookingDemoIntro"><span className="bookingDemoEyebrow"><i/>DEMO INTERACTIVA</span><span>Probala sin registrarte</span></div>
    <div className="bookingDemoCard">
      <div className="bookingDemoBrand"><span aria-hidden="true">AS</span><div><b>Aura Studio</b><small>Negocio de ejemplo</small></div><CalendarDays size={23} aria-hidden="true"/></div>
      {booked?<div className="bookingDemoConfirmation" ref={result} tabIndex={-1}>
        <span className="bookingDemoSuccessIcon"><Check size={26} aria-hidden="true"/></span>
        <h2>¡Así de simple!</h2><p>Tu cliente ve su reserva confirmada.</p>
        <div className="bookingDemoReceipt"><b>{service.name}</b><span>{days[dayIndex].full} · {time} h</span><span><Clock3 size={14} aria-hidden="true"/>{service.duration} minutos</span></div>
        <div className="bookingDemoAgenda"><span>ASÍ LO VES EN TU AGENDA</span><div><b>{time}</b><div><strong>Cliente de ejemplo</strong><small>{service.name}</small></div><span><CheckCircle2 size={14} aria-hidden="true"/>Confirmado</span></div></div>
        <button type="button" className="bookingDemoRestart" onClick={restart}><RotateCcw size={15} aria-hidden="true"/>Volver a probar</button>
      </div>:<div className="bookingDemoForm">
        <h2>Elegí tu próximo turno</h2><p>Tu cliente elige. Tu agenda se organiza.</p>
        <label className="bookingDemoService" htmlFor="demo-service">1. Elegí un servicio<select id="demo-service" value={serviceId} onChange={event=>{setServiceId(event.target.value);setTime('')}}>{services.map(item=><option value={item.id} key={item.id}>{item.name} · {item.duration} min</option>)}</select></label>
        <fieldset className="bookingDemoDates"><legend>2. Encontrá tu momento</legend><div>{days.map((day,index)=><label key={index} className={dayIndex===index?'selected':''}><input type="radio" name="demo-day" checked={dayIndex===index} onChange={()=>{setDayIndex(index);setTime('')}} aria-label={day.full}/><span>{day.weekday}</span><b>{day.short}</b></label>)}</div></fieldset>
        <fieldset className="bookingDemoTimes"><legend>Horarios de ejemplo</legend><div>{times.map(value=><label key={value} className={time===value?'selected':''}><input type="radio" name="demo-time" checked={time===value} onChange={()=>setTime(value)}/><span>{value}</span>{time===value&&<Check size={13} aria-hidden="true"/>}</label>)}</div></fieldset>
        <button type="button" className="platformButton bookingDemoSubmit" disabled={!time} onClick={()=>setBooked(true)}>Probar reserva <ArrowRight size={16} aria-hidden="true"/></button>
      </div>}
    </div>
    <p className="bookingDemoDisclaimer">Demo con datos de ejemplo. No crea turnos ni realiza cobros.</p>
  </div>;
}
