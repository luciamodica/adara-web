import {useEffect,useId,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {api,fmtDate} from './api';
import {WhatsappIcon} from './WhatsappIcon';
import './manual-whatsapp.css';

type Prepared={phone:string;client:string;date:string;time:string;text:string};
type Props={endpoint:string;kind?:'reminder'|'waitlist';disabled?:boolean;snapshot?:string};

export function reminderAvailable(booking:any, now=Date.now()) {
  return booking.status==='confirmed' && Date.parse(`${booking.date}T${booking.start_time}:00-03:00`)>now;
}

function chatUrl(phone:string,text:string) {
  if (!/^\+?[\d\s().-]+$/.test(phone.trim())) return '';
  const number=phone.replace(/\D/g,'');
  return /^[1-9]\d{7,14}$/.test(number) && text.trim() ? `https://wa.me/${number}?text=${encodeURIComponent(text)}` : '';
}

export default function ManualWhatsapp({endpoint,kind='reminder',disabled=false,snapshot=''}:Props) {
  const[open,setOpen]=useState(false),[prepared,setPrepared]=useState<Prepared>(),[phone,setPhone]=useState(''),[text,setText]=useState(''),[error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  const trigger=useRef<HTMLButtonElement>(null),dialog=useRef<HTMLDivElement>(null),requestId=useRef(0),titleId=useId(),hintId=useId();
  const close=()=>{requestId.current++;setOpen(false);setBusy(false)};
  useEffect(()=>{close();return()=>{requestId.current++}},[endpoint,snapshot,disabled]);
  useEffect(()=>{
    if(!open)return;
    const overflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    dialog.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const keys=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){event.preventDefault();close()}
      if(event.key!=='Tab')return;
      const controls=Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input,textarea,a[href]')||[]),first=controls[0],last=controls[controls.length-1];
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}
    };
    document.addEventListener('keydown',keys);
    return()=>{document.body.style.overflow=overflow;document.removeEventListener('keydown',keys);trigger.current?.focus({preventScroll:true})};
  },[open]);
  const prepare=async()=>{
    const id=++requestId.current;
    setOpen(true);setPrepared(undefined);setError('');setMessage('');setBusy(true);
    try{const result=await api(endpoint);if(id===requestId.current){setPrepared(result);setPhone(result.phone);setText(result.text)}}
    catch(e:any){if(id===requestId.current)setError(e.message)}
    finally{if(id===requestId.current)setBusy(false)}
  };
  const copy=async()=>{setMessage('');try{await navigator.clipboard.writeText(text);setMessage('Mensaje copiado.')}catch{setMessage('Seleccioná el texto del mensaje y copialo manualmente.')}};
  const openChat=async(event:React.MouseEvent<HTMLAnchorElement>)=>{
    event.preventDefault();setMessage('');setError('');
    // Open in the user's click gesture, then verify the current appointment before
    // navigating. A cancelled/rescheduled booking never uses the stale draft.
    const tab=window.open('about:blank','_blank');
    if(tab)tab.opener=null;
    const id=++requestId.current;
    setBusy(true);
    try{
      const current=await api(endpoint);
      if(id!==requestId.current){tab?.close();return}
      if(JSON.stringify(current)!==JSON.stringify(prepared)){
        tab?.close();setPrepared(current);setPhone(current.phone);setText(current.text);
        setError('La información cambió. Revisá el nuevo mensaje antes de abrir WhatsApp.');return;
      }
      if(tab)tab.location.href=url;else window.location.assign(url);
      setMessage('Completá el envío en WhatsApp tocando Enviar. Adara no recibe una confirmación de entrega.');
    }catch(e:any){tab?.close();if(id===requestId.current){setPrepared(undefined);setError(e.message)}}
    finally{if(id===requestId.current)setBusy(false)}
  };
  const url=chatUrl(phone,text),label=kind==='reminder'?'Recordatorio por WhatsApp':'Avisar por WhatsApp';
  return <>
    <button ref={trigger} type="button" className="outline smallButton manualWhatsappTrigger" disabled={disabled} onClick={prepare}><WhatsappIcon/>{label}</button>
    {open&&createPortal(<div className="modalBackdrop manualWhatsappBackdrop" onClick={e=>{if(e.target===e.currentTarget)close()}}>
      <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={hintId} className="manualWhatsappDialog">
        <div className="panelTitle"><h2 id={titleId}>{kind==='reminder'?'Recordatorio por WhatsApp':'Aviso de lugar disponible'}</h2><button type="button" className="outline smallButton" onClick={close}>Cerrar</button></div>
        <p id={hintId}>Revisá el número y el mensaje. Abriremos WhatsApp para que vos toques <b>Enviar</b>.</p>
        {busy&&<p role="status">Preparando mensaje…</p>}{error&&<p role="alert" className="error">{error}</p>}
        {prepared&&<>
          <p className="manualWhatsappSummary"><b>{prepared.client}</b><span>{fmtDate(prepared.date)} · {prepared.time}</span></p>
          <label>WhatsApp del cliente<input aria-label="WhatsApp del cliente" type="tel" autoComplete="off" value={phone} onChange={e=>{setPhone(e.target.value);setMessage('')}} aria-describedby={hintId+'-phone'}/></label>
          <small id={hintId+'-phone'}>Incluí el código de país. Podés corregir este destinatario sin cambiar la ficha del cliente.</small>
          <label>Mensaje<textarea aria-label="Mensaje" rows={8} maxLength={4000} value={text} onChange={e=>{setText(e.target.value);setMessage('')}}/></label>
          {!url&&<p className="errorText" role="status">Ingresá un número internacional válido y un mensaje.</p>}
          <div className="manualWhatsappActions"><button type="button" className="outline" disabled={busy||!text.trim()} onClick={copy}>Copiar mensaje</button>{url&&!busy?<a className="dark manualWhatsappOpen" href={url} target="_blank" rel="noopener noreferrer" onClick={openChat}><WhatsappIcon/>Abrir WhatsApp</a>:<button className="dark" type="button" disabled>Abrir WhatsApp</button>}</div>
          <p className="manualWhatsappNote">Abrir el chat no confirma el envío ni cambia el estado del turno o la solicitud.</p>
          {message&&<p role="status" className="successBox">{message}</p>}
        </>}
      </div>
    </div>,document.body)}
  </>;
}
