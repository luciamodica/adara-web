import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {fork,spawnSync} from 'node:child_process';
import Database from 'better-sqlite3';

const project=fileURLToPath(new URL('../',import.meta.url));
if(process.argv.includes('--child')) {
  const nativeFetch=global.fetch;
  let mailMode='off';
  global.fetch=async(url,options)=>{
    if(String(url)==='https://api.resend.com/emails')return new Response('{}',{status:mailMode==='fail'?503:200});
    return nativeFetch(url,options);
  };
  const {app}=await import('../server/index.js');
  const {db}=await import('../server/db.js');
  const server=app.listen(0,'127.0.0.1',()=>process.send({port:server.address().port}));
  process.on('message',message=>{
    if(message.mail){mailMode=message.mail;process.env.RESEND_API_KEY=message.mail==='off'?'':'fixture-only';process.send({changed:true});}
    if(message.stop)server.close(()=>{db.close();process.exit(0)});
  });
} else {
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'adara-deploy-'));
  const data=path.join(temp,'persistent'),work=path.join(temp,'work');fs.mkdirSync(work);
  const baseEnv={...process.env,NODE_ENV:'production',JWT_SECRET:'fixture-session-secret-'.repeat(3),TOKEN_ENCRYPTION_KEY:'fixture-encryption-secret-'.repeat(3),DATA_DIR:data,UPLOADS_DIR:path.join(data,'uploads'),FRONTEND_URL:'',PUBLIC_API_URL:'',RENDER_EXTERNAL_URL:'https://adara-fixture.onrender.com',SUPERADMIN_EMAIL:'super@example.test',SUPERADMIN_PASSWORD:'Strong-fixture-password-42!',RESEND_API_KEY:'',EMAIL_FROM:'Adara <no-reply@example.test>',DISABLE_FEATURE_WORKER:'true',DEMO_PAYMENTS:'true',DEMO_SUBSCRIPTIONS:'true',MP_BILLING_ACCESS_TOKEN:'',MP_BILLING_WEBHOOK_SECRET:''};
  let checks=0,child,base,logs='';
  const check=fn=>{fn();checks++};
  const startupFailure=(overrides,expected)=>{
    const result=spawnSync(process.execPath,[path.join(project,'server/index.js')],{cwd:work,env:{...baseEnv,...overrides},encoding:'utf8',timeout:5000});
    check(()=>assert.notEqual(result.status,0));check(()=>assert.match(result.stderr,expected));
  };
  async function start(overrides={}) {
    logs='';child=fork(fileURLToPath(import.meta.url),['--child'],{cwd:work,env:{...baseEnv,...overrides},silent:true});
    child.stdout.on('data',value=>{logs+=value});child.stderr.on('data',value=>{logs+=value});
    const port=await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(Error('El servidor de prueba no inició: '+logs)),10000);
      child.once('exit',code=>{clearTimeout(timer);reject(Error('Inicio fallido '+code+': '+logs))});
      child.once('message',message=>{clearTimeout(timer);resolve(message.port)});
    });base=`http://127.0.0.1:${port}`;
  }
  async function stop() {
    if(!child||child.exitCode!==null)return;
    const exited=new Promise(resolve=>child.once('exit',resolve));child.send({stop:true});await exited;child=null;
  }
  async function setMail(mode){const changed=new Promise(resolve=>child.once('message',resolve));child.send({mail:mode});await changed;}
  async function request(route,method='GET',body,cookie='',status=200) {
    const response=await fetch(base+route,{method,headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)});
    const result=await response.json();check(()=>assert.equal(response.status,status,JSON.stringify(result)));return {response,data:result,cookie:response.headers.get('set-cookie')?.split(';')[0]};
  }
  function row(query,...args){const db=new Database(path.join(data,'app.db'),{readonly:true});try{return db.prepare(query).get(...args)}finally{db.close()}}
  try {
    startupFailure({JWT_SECRET:'cambia-esta-clave'},/JWT_SECRET/);
    check(()=>assert.ok(!fs.existsSync(path.join(data,'app.db'))));
    startupFailure({TOKEN_ENCRYPTION_KEY:'bad'},/TOKEN_ENCRYPTION_KEY/);
    startupFailure({RENDER_EXTERNAL_URL:'http://localhost:5173'},/FRONTEND_URL/);
    startupFailure({DATA_DIR:'data'},/DATA_DIR/);
    startupFailure({UPLOADS_DIR:path.join(temp,'ephemeral')},/UPLOADS_DIR/);
    startupFailure({UPLOADS_DIR:data},/UPLOADS_DIR/);
    startupFailure({SUPERADMIN_PASSWORD:'short'},/SUPERADMIN/);
    await start();
    check(()=>assert.ok(!logs.includes(baseEnv.SUPERADMIN_PASSWORD)));
    check(()=>assert.ok(!fs.existsSync(path.join(work,'data'))));
    check(()=>assert.ok(!fs.existsSync(path.join(work,'server/uploads'))));
    await request('/api/health');
    const home=await fetch(base+'/');check(()=>assert.equal(home.status,200));check(()=>assert.match(home.headers.get('content-type'),/text\/html/));
    const html=await home.text();const script=html.match(/src="([^"]+\.js)"/)[1];
    const asset=await fetch(base+script);check(()=>assert.equal(asset.status,200));check(()=>assert.match(asset.headers.get('cache-control'),/immutable/));
    const deep=await fetch(base+'/reservar/estudio');const deepHtml=await deep.text();check(()=>assert.equal(deep.status,200));check(()=>assert.equal(deepHtml,html));
    await request('/api/missing', 'GET',undefined,'',404);
    for(const route of ['/uploads/missing.png','/app.db','/.env','/assets/missing.js']){const response=await fetch(base+route);check(()=>assert.equal(response.status,404));}
    await request('/api/auth/login','POST',{email:baseEnv.SUPERADMIN_EMAIL,password:'admin1234'},'',401);
    const admin=await request('/api/auth/login','POST',{email:baseEnv.SUPERADMIN_EMAIL,password:baseEnv.SUPERADMIN_PASSWORD});
    check(()=>assert.match(admin.response.headers.get('set-cookie'),/Secure/));check(()=>assert.match(admin.response.headers.get('set-cookie'),/HttpOnly/));
    check(()=>assert.equal(admin.data.role,'superadmin'));
    const settings=await request('/api/admin/settings','GET',undefined,admin.cookie);
    check(()=>assert.equal(settings.data.demo_payments,false));check(()=>assert.equal(settings.data.billing.demo,false));
    const body={name:'Profesional',email:'owner@example.test',password:'Strong-owner-password-42!',businessName:'Estudio',plan:'adara'};
    await request('/api/auth/register','POST',body,'',503);
    check(()=>assert.equal(row("SELECT COUNT(*) n FROM users WHERE role='owner'").n,0));
    await request('/api/auth/resend-verification','POST',{email:body.email},'',503);
    await setMail('fail');
    const registered=await request('/api/auth/register','POST',body);
    check(()=>assert.equal(registered.data.emailError,true));check(()=>assert.equal(registered.data.devVerifyUrl,null));
    const user=row('SELECT * FROM users WHERE email=?',body.email);
    check(()=>assert.ok(!JSON.stringify(registered.data).includes(user.verify_token)));
    await request('/api/auth/login','POST',{email:body.email,password:body.password},'',403);
    const failedResend=await request('/api/auth/resend-verification','POST',{email:body.email});
    check(()=>assert.equal(failedResend.data.devVerifyUrl,null));
    await setMail('ok');
    const sent=await request('/api/auth/resend-verification','POST',{email:body.email});
    check(()=>assert.equal(sent.data.emailSent,true));check(()=>assert.equal(sent.data.devVerifyUrl,null));
    const verified=await request('/api/auth/verify?token='+row('SELECT verify_token FROM users WHERE email=?',body.email).verify_token);
    const owner=await request('/api/me','GET',undefined,verified.cookie),business=owner.data.businesses[0];
    check(()=>assert.equal(business.name,'Estudio'));
    const info=await request(`/api/businesses/${business.id}/settings`,'GET',undefined,verified.cookie);
    check(()=>assert.equal(info.data.public_url,baseEnv.RENDER_EXTERNAL_URL+'/reservar/'+business.slug));
    const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a8m8AAAAASUVORK5CYII=','base64');
    const form=new FormData();form.append('image',new Blob([png],{type:'image/png'}),'logo.png');
    const uploaded=await fetch(base+`/api/businesses/${business.id}/upload`,{method:'POST',headers:{Cookie:verified.cookie},body:form});
    check(()=>assert.equal(uploaded.status,200));const image=(await uploaded.json()).url;
    const imageBytes=Buffer.from(await (await fetch(base+image)).arrayBuffer());check(()=>assert.deepEqual(imageBytes,png));
    check(()=>assert.ok(fs.existsSync(path.join(data,image))));
    fs.writeFileSync(path.join(data,'transfer-receipts','private-fixture'),'%PDF- private fixture');
    const hidden=await fetch(base+'/uploads/transfer-receipts/private-fixture');check(()=>assert.equal(hidden.status,404));
    const privatePage=await fetch(base+'/transfer-receipts/private-fixture'),privateHtml=await privatePage.text();check(()=>assert.equal(privatePage.status,200)); // SPA only, never the receipt bytes.
    check(()=>assert.equal(privateHtml,html));
    const backup=spawnSync(process.execPath,[path.join(project,'server/backup.js')],{cwd:work,env:baseEnv,encoding:'utf8'});
    check(()=>assert.equal(backup.status,0,backup.stderr));
    const backups=fs.readdirSync(path.join(data,'backups'));check(()=>assert.equal(backups.length,1));
    const folder=path.join(data,'backups',backups[0]);
    check(()=>assert.ok(fs.existsSync(path.join(folder,image))));check(()=>assert.equal(fs.readFileSync(path.join(folder,'transfer-receipts/private-fixture'),'utf8'),'%PDF- private fixture'));
    const backupDb=new Database(path.join(folder,'app.db'),{readonly:true});check(()=>assert.equal(backupDb.prepare('SELECT count(*) n FROM businesses').get().n,1));backupDb.close();
    check(()=>assert.ok(!fs.existsSync(path.join(folder,'.env'))));
    await stop();
    const oldHash=row("SELECT password_hash FROM users WHERE role='superadmin'").password_hash;
    await start({SUPERADMIN_EMAIL:'',SUPERADMIN_PASSWORD:''});
    check(()=>assert.equal(row("SELECT password_hash FROM users WHERE role='superadmin'").password_hash,oldHash));
    check(()=>assert.equal(row('SELECT count(*) n FROM businesses').n,1));
    const persistedBytes=Buffer.from(await (await fetch(base+image)).arrayBuffer());check(()=>assert.deepEqual(persistedBytes,png));
    await request('/api/auth/login','POST',{email:baseEnv.SUPERADMIN_EMAIL,password:baseEnv.SUPERADMIN_PASSWORD});
    await stop();
    const legacyDir=path.join(temp,'legacy');
    const seeded=spawnSync(process.execPath,['--input-type=module','-e',`await import(${JSON.stringify(new URL('../server/seed.js',import.meta.url).href)})`],{cwd:work,env:{...baseEnv,NODE_ENV:'development',DATA_DIR:legacyDir,UPLOADS_DIR:path.join(legacyDir,'uploads')},encoding:'utf8'});
    check(()=>assert.equal(seeded.status,0));
    startupFailure({DATA_DIR:legacyDir,UPLOADS_DIR:path.join(legacyDir,'uploads')},/contraseña local/);
    const reset=spawnSync(process.execPath,[path.join(project,'server/admin-password.js')],{cwd:work,env:{...baseEnv,DATA_DIR:legacyDir,UPLOADS_DIR:path.join(legacyDir,'uploads'),SUPERADMIN_EMAIL:'admin@adaraweb.local'},encoding:'utf8'});
    check(()=>assert.equal(reset.status,0,reset.stderr));check(()=>assert.ok(!reset.stdout.includes(baseEnv.SUPERADMIN_PASSWORD)));
    const productionSeed=spawnSync(process.execPath,[path.join(project,'server/seed.js')],{cwd:work,env:baseEnv,encoding:'utf8'});
    check(()=>assert.notEqual(productionSeed.status,0));check(()=>assert.match(productionSeed.stderr,/sólo para desarrollo/));
    console.log(`OK: ${checks} comprobaciones de despliegue, reinicio, archivos privados y acceso de producción.`);
  } finally {
    await stop();fs.rmSync(temp,{recursive:true,force:true});
  }
}
