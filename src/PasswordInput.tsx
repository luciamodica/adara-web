import {useState,type InputHTMLAttributes} from 'react';
import {Eye,EyeOff} from 'lucide-react';
export default function PasswordInput(props:InputHTMLAttributes<HTMLInputElement>){
 const [visible,setVisible]=useState(false);
 return <span className="passwordControl"><input {...props} type={visible?'text':'password'}/><button type="button" className="passwordEye" aria-label={visible?'Ocultar contraseña':'Mostrar contraseña'} aria-pressed={visible} onClick={()=>setVisible(value=>!value)}>{visible?<EyeOff size={19}/>:<Eye size={19}/>}</button></span>;
}
