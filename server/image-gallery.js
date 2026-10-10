export function readGallery(json,fallback='') {
 let images=[];try{images=JSON.parse(json||'[]')}catch{}
 return Array.isArray(images)&&images.length?images.filter(x=>typeof x==='string'):fallback?[fallback]:[];
}

export function validateGallery(value) {
 if(!Array.isArray(value)||value.length>8)throw new Error('Elegí hasta 8 imágenes.');
 if(value.some(url=>typeof url!=='string'||url.length>2048||! /^(https?:\/\/[^\s]+|\/(uploads|images)\/[^\s]+)$/.test(url)))throw new Error('Revisá las imágenes seleccionadas.');
 return [...new Set(value)];
}

export function galleryFromRequest(input,key,legacyKey,current={}) {
 if(input[key]!==undefined)return validateGallery(input[key]);
 if(input[legacyKey]!==undefined)return validateGallery(input[legacyKey]?[input[legacyKey]]:[]);
 return readGallery(current[key==='hero_images'?'hero_images_json':'images_json'],current[legacyKey]);
}

export const serviceGallery=s=>({...s,images:readGallery(s.images_json,s.image_url)});
export const businessGallery=b=>({...b,hero_images:readGallery(b.hero_images_json,b.hero_image)});
