import {db} from './db.js';
import {readGallery} from './image-gallery.js';

export function registerPublicSites(app){
 app.get('/api/public/home/sites',(_req,res)=>{
  // Only fields already displayed by the active public page are sent to the home.
  const rows=db.prepare(`SELECT b.name,b.slug,b.category,b.hero_title,b.hero_text,b.hero_image,b.hero_images_json,b.logo_image,b.primary_color,b.accent_color,b.background_color FROM businesses b JOIN users u ON u.id=b.owner_id WHERE b.status='active' AND u.email_verified=1 AND EXISTS(SELECT 1 FROM services s WHERE s.business_id=b.id AND s.active=1) ORDER BY EXISTS(SELECT 1 FROM growth_milestones m WHERE m.business_id=b.id AND m.stage='page_shared') DESC,b.id LIMIT 8`).all();
  const asset=value=>typeof value==='string'&&/^(https?:\/\/[^\s]+|\/(uploads|images)\/[^\s]+)$/.test(value)?value:'';
  res.set('Cache-Control','no-store').json(rows.map(({slug,hero_image,hero_images_json,logo_image,...row})=>({...row,path:'/reservar/'+encodeURIComponent(slug),image:asset(readGallery(hero_images_json,hero_image)[0]),logo_image:asset(logo_image)})));
 });
}
