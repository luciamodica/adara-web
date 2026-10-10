import {useState} from 'react';
import {ChevronLeft,ChevronRight,ImagePlus,Trash2} from 'lucide-react';
import {api} from './api';

export default function ImageGalleryEditor({b,images,onChange,label,onBusyChange}:{b:any;images:string[];onChange:(images:string[])=>void;label:string;onBusyChange?:(busy:boolean)=>void}) {
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const move=(index:number,delta:number)=>{const next=[...images];[next[index],next[index+delta]]=[next[index+delta],next[index]];onChange(next)};
 return <fieldset className="galleryEditor" disabled={busy}><legend>{label}</legend><p>Hasta 8 imágenes. La primera se muestra al abrir la página.</p>
  <div className="galleryThumbs">{images.map((url,index)=><div className="galleryThumb" key={url}><img src={url} alt={`${label} · imagen ${index+1}`}/><small>{index+1}{index===0?' · Principal':''}</small><div><button type="button" disabled={index===0} aria-label={`Mover imagen ${index+1} antes en ${label}`} onClick={()=>move(index,-1)}><ChevronLeft size={15}/></button><button type="button" disabled={index===images.length-1} aria-label={`Mover imagen ${index+1} después en ${label}`} onClick={()=>move(index,1)}><ChevronRight size={15}/></button><button type="button" aria-label={`Quitar imagen ${index+1} de ${label}`} onClick={()=>onChange(images.filter((_,i)=>i!==index))}><Trash2 size={15}/></button></div></div>)}</div>
  <label className="galleryUpload"><ImagePlus size={19}/><span>{busy?'Subiendo imágenes…':'Agregar imágenes'}</span><input type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif" aria-label={`Agregar imágenes a ${label}`} disabled={busy||images.length>=8} onChange={async e=>{
   const files=Array.from(e.target.files||[]);e.target.value='';if(!files.length)return;setError('');if(files.length+images.length>8){setError('Podés guardar hasta 8 imágenes. Seleccioná menos archivos.');return}
   setBusy(true);onBusyChange?.(true);const next=[...images];
   try{for(const file of files){const data=new FormData();data.append('image',file);const result=await api(`/businesses/${b.id}/upload`,{method:'POST',body:data});next.push(result.url)}}catch(e:any){setError(e.message)}finally{if(next.length!==images.length)onChange(next);setBusy(false);onBusyChange?.(false)}
  }}/></label>{error&&<p role="alert" className="errorText">{error}</p>}
 </fieldset>;
}
