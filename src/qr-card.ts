import {WHATSAPP_PATH} from "./whatsapp-mark";
type Design={font?:string;layout?:string;background_image?:string;overlay?:number;logo_size?:number;show_logo_in_code?:boolean};
type Brand={design?:Design;name:string;slug:string;template:string;logo:string;tagline:string;phone:string;instagram:string;tiktok:string;address:string;email?:string;primary:string;accent:string;background:string;foreground:string;qrInk:string};
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
 }else ctx.fillStyle=kind==='whatsapp'?'#25d366':kind==='tiktok'?'#19141b':primary;
 ctx.beginPath();ctx.arc(12,12,12,0,Math.PI*2);ctx.fill();
 ctx.strokeStyle='#ffffff';ctx.fillStyle='#ffffff';ctx.lineWidth=1.35;ctx.lineCap='round';ctx.lineJoin='round';
 if(kind==='instagram'){
  ctx.beginPath();ctx.roundRect(5.5,5.5,13,13,4);ctx.stroke();ctx.beginPath();ctx.arc(12,12,3.25,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.arc(16.25,7.75,.9,0,Math.PI*2);ctx.fill();
 }else if(kind==='whatsapp'){
  ctx.translate(4,4);ctx.fill(new Path2D(WHATSAPP_PATH));
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
 const b=qr.brand,d=b.design||{},base=await picture(qr.dataUrl),family=d.font==='editorial'?'Georgia':d.font==='friendly'?'Trebuchet MS':'Arial';let logo:HTMLImageElement|undefined,bg:HTMLImageElement|undefined;
 if(b.logo)try{logo=await picture(b.logo)}catch{throw new Error('No pudimos cargar tu logo. Volvé a subirlo desde Mi página.')}
 if(d.background_image)try{bg=await picture(d.background_image)}catch{throw new Error('No pudimos cargar el fondo. Volvé a subir la imagen.')}
 const code=document.createElement('canvas');code.width=720;code.height=720;const qc=code.getContext('2d')!;qc.drawImage(base,0,0,720,720);
 if(logo&&d.show_logo_in_code!==false){qc.fillStyle='#ffffff';rounded(qc,306,306,108,108,10);fit(qc,logo,320,320,80,80)}
 const contacts:{kind:ContactKind;value:string}[]=[{kind:'whatsapp',value:b.phone},{kind:'instagram',value:b.instagram?social(b.instagram):''},{kind:'tiktok',value:b.tiktok?social(b.tiktok):''},{kind:'location',value:b.address},{kind:'email',value:b.email||''}];
 const card=document.createElement('canvas'),measure=card.getContext('2d')!;measure.font='28px '+family;const taglineLines=b.tagline?.trim()?lines(measure,b.tagline,970):[];measure.font='bold 54px '+family;const nameLines=lines(measure,b.name,970);measure.font='30px '+family;const contactLines=contacts.filter(c=>c.value?.trim()).map(c=>({...c,lines:lines(measure,c.value,805)}));
 const size=logo?(d.logo_size||160):0,nameY=110+size+(logo?70:0),tagY=nameY+(nameLines.length-1)*66+52,qrY=tagY+taglineLines.length*38+55,contactY=qrY+830;
 card.width=1200;card.height=Math.max(1500,contactY+contactLines.reduce((n,c)=>n+Math.max(106,42+c.lines.length*38)+18,0)+100);
 const ctx=card.getContext('2d')!;ctx.fillStyle=b.background;ctx.fillRect(0,0,1200,card.height);
 if(bg){const k=Math.max(1200/bg.naturalWidth,card.height/bg.naturalHeight);ctx.drawImage(bg,(1200-bg.naturalWidth*k)/2,(card.height-bg.naturalHeight*k)/2,bg.naturalWidth*k,bg.naturalHeight*k);ctx.fillStyle=b.background;ctx.globalAlpha=(d.overlay||85)/100;ctx.fillRect(0,0,1200,card.height);ctx.globalAlpha=1;}
 if(d.layout==='frame'){ctx.strokeStyle=b.accent;ctx.lineWidth=4;ctx.strokeRect(38,38,1124,card.height-76)}
 if(d.layout==='bold'){ctx.fillStyle=b.primary;ctx.fillRect(0,0,1200,25);ctx.fillRect(0,card.height-25,1200,25);ctx.fillStyle=b.accent;ctx.fillRect(100,64,1000,8)}
 // Solid surfaces keep text legible over every photograph.
 if(bg){ctx.fillStyle=b.background;rounded(ctx,85,70,1030,qrY-95,30)}
 if(logo)fit(ctx,logo,(1200-size)/2,100,size,size);
 ctx.textAlign='center';ctx.fillStyle=b.foreground;ctx.font='bold 54px '+family;nameLines.forEach((v,i)=>ctx.fillText(v,600,nameY+i*66));
 ctx.font='28px '+family;taglineLines.forEach((v,i)=>ctx.fillText(v,600,tagY+i*38));
 ctx.fillStyle='#ffffff';rounded(ctx,210,qrY,780,780,d.layout==='bold'?8:30);ctx.drawImage(code,240,qrY+30,720,720);
 let y=contactY;ctx.textAlign='left';
 contactLines.forEach(c=>{const height=Math.max(106,42+c.lines.length*38);ctx.fillStyle=b.background;rounded(ctx,125,y,950,height,24);ctx.strokeStyle=b.accent;ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(125,y,950,height,24);ctx.stroke();contactIcon(ctx,c.kind,145,y+(height-72)/2,72,b.qrInk);ctx.fillStyle=b.foreground;ctx.font='30px '+family;c.lines.forEach((v,i)=>ctx.fillText(v,240,y+height/2-(c.lines.length-1)*19+10+i*38));y+=height+18;});
 try{return {...qr,codeUrl:code.toDataURL('image/png'),cardUrl:card.toDataURL('image/png')}}catch{throw new Error('No pudimos descargar la tarjeta. Subí las imágenes como archivos y volvé a intentar.')}
}
export function downloadPng(url:string,name:string){const a=document.createElement('a');a.href=url;a.download=name;a.click()}
