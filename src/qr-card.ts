type Brand={name:string;slug:string;template:string;logo:string;tagline:string;phone:string;instagram:string;tiktok:string;address:string;email?:string;primary:string;accent:string;background:string;foreground:string;qrInk:string};
type ContactKind='whatsapp'|'instagram'|'tiktok'|'location'|'email';
type QR={url:string;dataUrl:string;brand:Brand};
const picture=async(src:string)=>{const img=new Image();img.crossOrigin='anonymous';img.src=src;await img.decode();return img};
const fit=(ctx:CanvasRenderingContext2D,img:HTMLImageElement,x:number,y:number,w:number,h:number)=>{const k=Math.min(w/img.naturalWidth,h/img.naturalHeight);ctx.drawImage(img,x+(w-img.naturalWidth*k)/2,y+(h-img.naturalHeight*k)/2,img.naturalWidth*k,img.naturalHeight*k)};
function lines(ctx:CanvasRenderingContext2D,value:string,width:number){
 const result:string[]=[];let line='';
 for(const word of value.trim().split(/\s+/)){const test=line?line+' '+word:word;if(ctx.measureText(test).width<=width){line=test;continue}if(line){result.push(line);line=''}for(const char of word){if(ctx.measureText(line+char).width>width){result.push(line);line=''}line+=char}}
 if(line)result.push(line);return result;
}
const rounded=(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,r:number)=>{ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill()};
const social=(value:string)=>{const s=value.trim().replace(/^https?:\/\/(www\.)?/i,'').replace(/\/$/,'').replace(/^(instagram\.com|tiktok\.com)\//i,'').split(/[?#]/)[0];return s.startsWith('@')?s:'@'+s};
// Vector contact marks stay sharp in the downloaded PNG and match each channel.
function contactIcon(ctx:CanvasRenderingContext2D,kind:ContactKind,x:number,y:number,size:number,primary:string){
 ctx.save();ctx.translate(x,y);ctx.scale(size/24,size/24);
 if(kind==='instagram'){
  const gradient=ctx.createLinearGradient(2,24,23,0);gradient.addColorStop(0,'#feda75');gradient.addColorStop(.3,'#fa7e1e');gradient.addColorStop(.6,'#d62976');gradient.addColorStop(1,'#7044c7');ctx.fillStyle=gradient;
 }else ctx.fillStyle=kind==='whatsapp'?'#168c52':kind==='tiktok'?'#19141b':primary;
 ctx.beginPath();ctx.arc(12,12,12,0,Math.PI*2);ctx.fill();
 ctx.strokeStyle='#ffffff';ctx.fillStyle='#ffffff';ctx.lineWidth=1.35;ctx.lineCap='round';ctx.lineJoin='round';
 if(kind==='instagram'){
  ctx.beginPath();ctx.roundRect(5.5,5.5,13,13,4);ctx.stroke();ctx.beginPath();ctx.arc(12,12,3.25,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.arc(16.25,7.75,.9,0,Math.PI*2);ctx.fill();
 }else if(kind==='whatsapp'){
  ctx.beginPath();ctx.moveTo(5.2,19);ctx.lineTo(6.2,15.8);ctx.arc(12,11.4,6.5,2.4,8.5);ctx.lineTo(5.2,19);ctx.stroke();
  ctx.fill(new Path2D('M9 7.7c-.3-.7-.7-.7-1-.7-.3 0-.8.3-1 1-.3 1 .2 2.4 1.7 4.1 1.8 2 3.6 2.8 4.8 2.8.8 0 1.4-.6 1.6-1.1.1-.3.1-.5-.1-.6l-1.8-.9c-.2-.1-.4-.1-.6.1l-.7.8c-.2.2-.4.2-.6.1-.8-.3-2-1.2-2.5-2-.2-.3-.3-.5-.1-.7l.5-.6c.1-.2.1-.4 0-.6z'));
 }else if(kind==='tiktok'){
  const note=new Path2D('M12.4 5.2h2.7c.2 1.9 1.3 3 3.2 3.3v2.6c-1.2-.1-2.3-.5-3.2-1.1v5.3a4.9 4.9 0 1 1-4.9-4.9h.8v2.8a2.2 2.2 0 1 0 1.4 2.1z');
  ctx.save();ctx.translate(-.35,.35);ctx.fillStyle='#25f4ee';ctx.fill(note);ctx.restore();ctx.save();ctx.translate(.35,-.25);ctx.fillStyle='#fe2c55';ctx.fill(note);ctx.restore();ctx.fillStyle='#ffffff';ctx.fill(note);
 }else if(kind==='location'){
  ctx.stroke(new Path2D('M12 19.3s-5-4.6-5-8.7a5 5 0 0 1 10 0c0 4.1-5 8.7-5 8.7z'));ctx.beginPath();ctx.arc(12,10.5,1.7,0,Math.PI*2);ctx.stroke();
 }else{
  ctx.beginPath();ctx.roundRect(5.2,7.2,13.6,9.6,1.2);ctx.stroke();ctx.stroke(new Path2D('M5.7 8.1 12 12.5l6.3-4.4'));
 }
 ctx.restore();
}
export async function createQrCard(qr:QR){
 const b=qr.brand,base=await picture(qr.dataUrl);let logo:HTMLImageElement|undefined;
 if(b.logo){try{logo=await picture(b.logo)}catch{throw new Error('No pudimos cargar tu logo. Volvé a subirlo desde Mi página y generá el QR nuevamente.')}}
 const code=document.createElement('canvas');code.width=720;code.height=720;const qc=code.getContext('2d')!;qc.drawImage(base,0,0,720,720);
 if(logo){qc.fillStyle='#ffffff';rounded(qc,306,306,108,108,10);fit(qc,logo,320,320,80,80)}
 const contacts:{kind:ContactKind;value:string}[]=[{kind:'whatsapp',value:b.phone},{kind:'instagram',value:b.instagram?social(b.instagram):''},{kind:'tiktok',value:b.tiktok?social(b.tiktok):''},{kind:'location',value:b.address},{kind:'email',value:b.email||''}];
 const card=document.createElement('canvas');const measure=card.getContext('2d')!;measure.font='20px Arial';const taglineLines=b.tagline?.trim()?lines(measure,b.tagline,970):[];measure.font='52px Georgia';const nameLines=lines(measure,b.name,970);measure.font='30px Arial';const contactLines=contacts.filter(c=>c.value?.trim()).map(c=>({...c,lines:lines(measure,c.value,805)}));measure.font='24px Arial';const footerLines=logo?[]:lines(measure,b.name,950);
 const logoY=taglineLines.length?110+(taglineLines.length-1)*28:80;
 const top=logo?logoY+130:taglineLines.length?logoY+20:70,nameY=top+nameLines.length*64,qrY=nameY+74,contactY=qrY+805;
 const footerHeight=logo?210:110+footerLines.length*30;
 card.width=1200;card.height=Math.max(1500,contactY+contactLines.reduce((n,c)=>n+Math.max(106,42+c.lines.length*38)+18,0)+footerHeight);
 const ctx=card.getContext('2d')!;ctx.fillStyle=b.background;ctx.fillRect(0,0,1200,card.height);
 ctx.strokeStyle=b.accent;ctx.lineWidth=2;ctx.strokeRect(40,40,1120,card.height-80);
 ctx.fillStyle=b.accent;ctx.globalAlpha=.18;
 if(b.template==='rose'||b.template==='pearl'){ctx.beginPath();ctx.arc(1080,110,230,0,Math.PI*2);ctx.fill()}else{ctx.fillRect(40,40,1120,18);ctx.fillRect(40,card.height-58,1120,18)}ctx.globalAlpha=1;
 ctx.textAlign='center';ctx.fillStyle=b.foreground;ctx.font='20px Arial';taglineLines.forEach((v,i)=>ctx.fillText(v,600,90+i*28));
 if(logo){ctx.fillStyle='#ffffff';rounded(ctx,540,logoY,120,100,b.template==='noir'?2:22);fit(ctx,logo,550,logoY+8,100,84)}
 ctx.fillStyle=b.foreground;ctx.font=(b.template==='muse'?'bold ':'')+'52px Georgia';nameLines.forEach((v,i)=>ctx.fillText(v,600,top+58+i*64));ctx.font='27px Arial';ctx.fillText('Escaneá y reservá tu turno',600,nameY+44);
 ctx.fillStyle='#ffffff';rounded(ctx,210,qrY,780,780,b.template==='noir'?2:24);ctx.drawImage(code,240,qrY+30,720,720);
 let y=contactY;ctx.textAlign='left';
 contactLines.forEach(c=>{
  const height=Math.max(106,42+c.lines.length*38);
  ctx.fillStyle='#ffffff';ctx.globalAlpha=b.foreground==='#ffffff'?.08:.65;rounded(ctx,125,y,950,height,28);ctx.globalAlpha=1;
  ctx.strokeStyle=b.accent;ctx.lineWidth=2;ctx.globalAlpha=.6;ctx.beginPath();ctx.roundRect(125,y,950,height,28);ctx.stroke();ctx.globalAlpha=1;
  contactIcon(ctx,c.kind,145,y+(height-72)/2,72,b.qrInk);ctx.fillStyle=b.foreground;ctx.font='30px Arial';
  c.lines.forEach((v,i)=>ctx.fillText(v,240,y+height/2-(c.lines.length-1)*19+10+i*38));y+=height+18;
 });
 // The destination stays encoded in the QR; the footer belongs to the business.
 if(logo){ctx.fillStyle='#ffffff';rounded(ctx,510,y+40,180,120,b.template==='noir'?2:22);fit(ctx,logo,520,y+50,160,100)}
 else{ctx.textAlign='center';ctx.fillStyle=b.foreground;ctx.font='24px Arial';footerLines.forEach((v,i)=>ctx.fillText(v,600,y+75+i*30))}
 try{return {...qr,codeUrl:code.toDataURL('image/png'),cardUrl:card.toDataURL('image/png')}}catch{throw new Error('Ese logo no permite descargar la tarjeta. Subilo como archivo desde Mi página y volvé a generar el QR.')}
}
export function downloadPng(url:string,name:string){const a=document.createElement('a');a.href=url;a.download=name;a.click()}
