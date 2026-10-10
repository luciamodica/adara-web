type Brand={name:string;slug:string;template:string;logo:string;tagline:string;phone:string;instagram:string;tiktok:string;address:string;primary:string;accent:string;background:string;foreground:string;qrInk:string};
type QR={url:string;dataUrl:string;brand:Brand};
const picture=async(src:string)=>{const img=new Image();img.crossOrigin='anonymous';img.src=src;await img.decode();return img};
const fit=(ctx:CanvasRenderingContext2D,img:HTMLImageElement,x:number,y:number,w:number,h:number)=>{const k=Math.min(w/img.naturalWidth,h/img.naturalHeight);ctx.drawImage(img,x+(w-img.naturalWidth*k)/2,y+(h-img.naturalHeight*k)/2,img.naturalWidth*k,img.naturalHeight*k)};
function lines(ctx:CanvasRenderingContext2D,value:string,width:number){
 const result:string[]=[];let line='';
 for(const word of value.trim().split(/\s+/)){const test=line?line+' '+word:word;if(ctx.measureText(test).width<=width){line=test;continue}if(line){result.push(line);line=''}for(const char of word){if(ctx.measureText(line+char).width>width){result.push(line);line=''}line+=char}}
 if(line)result.push(line);return result;
}
const rounded=(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,r:number)=>{ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill()};
const social=(value:string)=>{const s=value.replace(/^https?:\/\/(www\.)?/i,'').replace(/\/$/,'');return s.replace(/^(instagram\.com|tiktok\.com)\//i,'')};
export async function createQrCard(qr:QR){
 const b=qr.brand,base=await picture(qr.dataUrl);let logo:HTMLImageElement|undefined;
 if(b.logo){try{logo=await picture(b.logo)}catch{throw new Error('No pudimos cargar tu logo. Volvé a subirlo desde Mi página y generá el QR nuevamente.')}}
 const code=document.createElement('canvas');code.width=720;code.height=720;const qc=code.getContext('2d')!;qc.drawImage(base,0,0,720,720);
 if(logo){qc.fillStyle='#ffffff';rounded(qc,306,306,108,108,10);fit(qc,logo,320,320,80,80)}
 const contacts=[['WHATSAPP',b.phone],['INSTAGRAM',social(b.instagram)],['TIKTOK',social(b.tiktok)],['DIRECCIÓN',b.address]].filter(([,v])=>v);
 const card=document.createElement('canvas');const measure=card.getContext('2d')!;measure.font='20px Arial';const taglineLines=b.tagline?.trim()?lines(measure,b.tagline,970):[];measure.font='52px Georgia';const nameLines=lines(measure,b.name,970);measure.font='26px Arial';const contactLines=contacts.map(([label,value])=>({label,lines:lines(measure,value,950)}));measure.font='24px Arial';const footerLines=logo?[]:lines(measure,b.name,950);
 const logoY=taglineLines.length?110+(taglineLines.length-1)*28:80;
 const top=logo?logoY+130:taglineLines.length?logoY+20:70,nameY=top+nameLines.length*64,qrY=nameY+74,contactY=qrY+805;
 const footerHeight=logo?210:110+footerLines.length*30;
 card.width=1200;card.height=Math.max(1500,contactY+contactLines.reduce((n,c)=>n+65+c.lines.length*36,0)+footerHeight);
 const ctx=card.getContext('2d')!;ctx.fillStyle=b.background;ctx.fillRect(0,0,1200,card.height);
 ctx.strokeStyle=b.accent;ctx.lineWidth=2;ctx.strokeRect(40,40,1120,card.height-80);
 ctx.fillStyle=b.accent;ctx.globalAlpha=.18;
 if(b.template==='rose'||b.template==='pearl'){ctx.beginPath();ctx.arc(1080,110,230,0,Math.PI*2);ctx.fill()}else{ctx.fillRect(40,40,1120,18);ctx.fillRect(40,card.height-58,1120,18)}ctx.globalAlpha=1;
 ctx.textAlign='center';ctx.fillStyle=b.foreground;ctx.font='20px Arial';taglineLines.forEach((v,i)=>ctx.fillText(v,600,90+i*28));
 if(logo){ctx.fillStyle='#ffffff';rounded(ctx,540,logoY,120,100,b.template==='noir'?2:22);fit(ctx,logo,550,logoY+8,100,84)}
 ctx.fillStyle=b.foreground;ctx.font=(b.template==='muse'?'bold ':'')+'52px Georgia';nameLines.forEach((v,i)=>ctx.fillText(v,600,top+58+i*64));ctx.font='27px Arial';ctx.fillText('Escaneá y reservá tu turno',600,nameY+44);
 ctx.fillStyle='#ffffff';rounded(ctx,210,qrY,780,780,b.template==='noir'?2:24);ctx.drawImage(code,240,qrY+30,720,720);
 let y=contactY;ctx.textAlign='left';
 contactLines.forEach(c=>{ctx.globalAlpha=.7;ctx.fillStyle=b.foreground;ctx.font='16px Arial';ctx.fillText(c.label,125,y+28);ctx.globalAlpha=1;ctx.font='26px Arial';c.lines.forEach((v,i)=>ctx.fillText(v,125,y+68+i*36));y+=65+c.lines.length*36;ctx.strokeStyle=b.accent;ctx.globalAlpha=.35;ctx.beginPath();ctx.moveTo(125,y+8);ctx.lineTo(1075,y+8);ctx.stroke();ctx.globalAlpha=1});
 // The destination stays encoded in the QR; the footer belongs to the business.
 if(logo){ctx.fillStyle='#ffffff';rounded(ctx,510,y+40,180,120,b.template==='noir'?2:22);fit(ctx,logo,520,y+50,160,100)}
 else{ctx.textAlign='center';ctx.fillStyle=b.foreground;ctx.font='24px Arial';footerLines.forEach((v,i)=>ctx.fillText(v,600,y+75+i*30))}
 try{return {...qr,codeUrl:code.toDataURL('image/png'),cardUrl:card.toDataURL('image/png')}}catch{throw new Error('Ese logo no permite descargar la tarjeta. Subilo como archivo desde Mi página y volvé a generar el QR.')}
}
export function downloadPng(url:string,name:string){const a=document.createElement('a');a.href=url;a.download=name;a.click()}
