import {getSetting} from './db.js';
export async function sendVerificationEmail({email,name,verifyUrl}) {
  if (!process.env.RESEND_API_KEY) return {sent:false, dev:true};
  const response = await fetch('https://api.resend.com/emails', {
    method:'POST',
    headers:{'Authorization':`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json'},
    body:JSON.stringify({
      from:process.env.EMAIL_FROM || 'Adara Web <onboarding@resend.dev>',
      to:[email],
      subject:'Verificá tu cuenta de Adara Web',
      html:`<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:32px"><h2>Hola ${escapeHtml(name)}</h2><p>Confirmá tu email para activar tu espacio en Adara Web.</p><p><a href="${verifyUrl}" style="display:inline-block;background:#2d2723;color:white;padding:13px 20px;border-radius:999px;text-decoration:none">Verificar mi email</a></p><p>Este enlace vence en 24 horas.</p></div>`
    })
  });
  if (!response.ok) throw new Error('No se pudo enviar el email de verificación');
  return {sent:true, dev:false};
}

export async function sendBookingEmail({email,clientName,businessName,summary,date,time,totalCents,status,holdExpiresAt,paymentMethod,manageUrl}) {
  if (!email) return {sent:false, skipped:true};
  if (!process.env.RESEND_API_KEY) return {sent:false, dev:true};
  const confirmed=status==='confirmed';
  const cancelled=status==='cancelled';
  const subject=cancelled?`Tu turno en ${businessName} fue cancelado`:confirmed?`Tu turno en ${businessName} está confirmado`:`Tu reserva en ${businessName} está pendiente de pago`;
  const response=await fetch('https://api.resend.com/emails',{
    method:'POST',
    headers:{'Authorization':`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json'},
    body:JSON.stringify({
      from:process.env.EMAIL_FROM || 'Adara Web <onboarding@resend.dev>',
      to:[email],
      subject,
      html:`<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:32px;color:#2d2723">
        <h2>Hola ${escapeHtml(clientName)}</h2>
        <p>${cancelled?'Tu turno fue cancelado.':confirmed?'Tu turno quedó confirmado.':'Guardamos temporalmente tu horario mientras completás el pago.'}</p>
        ${!confirmed&&!cancelled&&paymentMethod==='bank_transfer'?'<p>Desde el enlace de tu reserva podés consultar el alias y enviar el comprobante. El profesional verifica el ingreso antes de confirmar el turno. Enviar el comprobante no extiende el plazo.</p>':''}
        ${!confirmed&&!cancelled&&holdExpiresAt?`<p>Completá el pago antes del ${escapeHtml(new Date(holdExpiresAt).toLocaleString('es-AR',{timeZone:'America/Argentina/Buenos_Aires'}))}. Al vencer el plazo, el horario se libera automáticamente.</p>`:''}
        <div style="background:#f7f2ee;border-radius:14px;padding:18px;margin:20px 0">
          <p><b>${escapeHtml(businessName)}</b></p>
          <p>${escapeHtml(summary)}</p>
          <p>${escapeHtml(date)} · ${escapeHtml(time)}</p>
          <p>Total: <b>$${Math.round(Number(totalCents||0)/100).toLocaleString('es-AR')}</b></p>
        </div>
        <p>Desde el siguiente enlace podés revisar, reprogramar o cancelar tu turno según la política del negocio.</p>
        <p><a href="${manageUrl}" style="display:inline-block;background:#2d2723;color:white;padding:13px 20px;border-radius:999px;text-decoration:none">Gestionar mi reserva</a></p>
      </div>`
    })
  });
  if(!response.ok) throw new Error('No se pudo enviar el email de la reserva');
  return {sent:true,dev:false};
}

function escapeHtml(value='') {
  return String(value).replace(/[&<>'"]/g, c=>({
    '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'
  }[c]));
}

export async function sendProfessionalNotification({email,businessName,clientName,summary,date,time,status,event='booking'}) {
  if (!email) return {sent:false, skipped:true};
  if (!process.env.RESEND_API_KEY) return {sent:false, dev:true};
  const labels={transfer_receipt:'Comprobante recibido: verificar transferencia',confirmed_without_advance:'Turno confirmado sin pago anticipado',new:'Nueva reserva',rescheduled:'Turno reprogramado',cancelled:'Turno cancelado',paid:'Pago confirmado',payment_review:'Pago recibido: requiere revisión, el turno sigue cancelado'};
  const title=labels[event]||'Actualización de turno';
  const response=await fetch('https://api.resend.com/emails',{
    method:'POST',
    headers:{'Authorization':`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json'},
    body:JSON.stringify({
      from:process.env.EMAIL_FROM || 'Adara Web <onboarding@resend.dev>',
      to:[email],
      subject:`${title} · ${businessName}`,
      html:`<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:32px;color:#2d2723">
        <h2>${escapeHtml(title)}</h2>
        <p><b>${escapeHtml(clientName)}</b> · ${escapeHtml(summary)}</p>
        <p>${escapeHtml(date)} · ${escapeHtml(time)}</p>
        <p>Estado: ${escapeHtml(status)}</p>
        <p>Podés revisar el turno desde tu panel de Adara Web.</p>
      </div>`
    })
  });
  if(!response.ok) throw new Error('No se pudo enviar el aviso al profesional');
  return {sent:true,dev:false};
}


export async function sendPasswordResetEmail({email,name,resetUrl}) {
 if(!process.env.RESEND_API_KEY)return {sent:false,dev:true};
 const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json'},signal:AbortSignal.timeout(15000),body:JSON.stringify({from:process.env.EMAIL_FROM||'Adara Web <onboarding@resend.dev>',to:[email],subject:'Restablecé tu contraseña de Adara Web',html:`<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:32px;color:#10243a"><h2>Hola ${escapeHtml(name)}</h2><p>Recibimos una solicitud para restablecer tu contraseña.</p><p><a href="${escapeHtml(resetUrl)}" style="display:inline-block;background:#0758df;color:white;padding:14px 20px;border-radius:12px;text-decoration:none">Restablecer contraseña</a></p><p>Este enlace vence en 30 minutos y se puede usar una sola vez.</p><p>Si no solicitaste el cambio, podés ignorar este correo. Tu contraseña no cambió.</p></div>`})});
 if(!r.ok)throw new Error('No se pudo enviar el correo de recuperación');return {sent:true};
}
export async function sendPasswordChangedEmail({email,name,supportUrl}) {
 if(!process.env.RESEND_API_KEY)return {sent:false,dev:true};
 const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json'},signal:AbortSignal.timeout(15000),body:JSON.stringify({from:process.env.EMAIL_FROM||'Adara Web <onboarding@resend.dev>',to:[email],subject:'Tu contraseña de Adara Web fue cambiada',html:`<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:32px;color:#10243a"><h2>Hola ${escapeHtml(name)}</h2><p>La contraseña de tu cuenta de Adara Web fue cambiada. Cerramos las sesiones anteriores.</p><p>Si no realizaste este cambio, recuperá tu contraseña y <a href="${escapeHtml(supportUrl)}">contactá a soporte</a>.</p></div>`})});
 if(!r.ok)throw new Error('No se pudo enviar el aviso de seguridad');return {sent:true};
}

export async function sendSupportEmail({name,email,message,id}) {
 if(!process.env.RESEND_API_KEY)return {sent:false};
 const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':`adara-support-${id}`},signal:AbortSignal.timeout(15000),body:JSON.stringify({from:process.env.EMAIL_FROM||'Adara Web <onboarding@resend.dev>',to:[getSetting('support_email','adaraweb23@gmail.com')],reply_to:email,subject:`Consulta de soporte #${id} · Adara Web`,html:`<div style="font-family:Arial;padding:24px"><h2>Consulta desde el Home</h2><p><b>${escapeHtml(name)}</b> · ${escapeHtml(email)}</p><p style="white-space:pre-wrap">${escapeHtml(message)}</p><p>También disponible en Super Admin → Soporte.</p></div>`})});
 if(!r.ok)throw Error('No se pudo enviar el aviso de soporte.');return {sent:true};
}
