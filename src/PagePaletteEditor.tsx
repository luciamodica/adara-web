import {useId} from 'react';
import {isHexColor,paletteIssues,resolvePagePalettes,paletteTokens} from '../shared/page-palettes.js';
import './page-palettes.css';
export type PaletteMode='light'|'dark';
export function pagePaletteStyle(b:any){
 const palettes=resolvePagePalettes(b),style:Record<string,string>={};
 for(const mode of ['light','dark'] as const)for(const[key,value]of Object.entries(paletteTokens(palettes[mode])))style[`--page-${mode}-${key}`]=String(value);
 return style;
}
export const hasPagePalettes=(b:any)=>Boolean(b.color_palettes?.light||b.color_palettes?.dark);
export default function PagePaletteEditor({form,onChange,mode,onModeChange}:any){
 const id=useId(),palettes=resolvePagePalettes(form),palette={...palettes[mode as PaletteMode],...form.color_palettes?.[mode],...(mode==='light'?{primary:form.primary_color||palettes.light.primary,accent:form.accent_color||palettes.light.accent,background:form.background_color||palettes.light.background}:{})},label=mode==='light'?'claro':'oscuro',issues=paletteIssues(palette);
 const update=(key:string,value:string)=>{
  const next={...palettes,[mode]:{...palette,[key]:value}},legacy=mode==='light'?{primary_color:next.light.primary,accent_color:next.light.accent,background_color:next.light.background}:{};
  onChange({...form,...legacy,color_palettes:next});
 };
 const suggested=()=>{const next=resolvePagePalettes({...form,color_palettes:{}});onChange({...form,color_palettes:{...palettes,[mode]:next[mode as PaletteMode]}})};
 return <section className="pagePaletteEditor" aria-labelledby={id+'-title'}><h3 id={id+'-title'}>Colores para cada modo</h3><p>Diseñá una versión clara y otra oscura de tu página. Cada visitante elige cómo verla.</p><div className="paletteModeTabs" role="group" aria-label="Paleta y vista previa"><button type="button" aria-pressed={mode==='light'} onClick={()=>onModeChange('light')}>Modo claro</button><button type="button" aria-pressed={mode==='dark'} onClick={()=>onModeChange('dark')}>Modo oscuro</button></div><div className="paletteColorGrid">{[['primary','Color principal'],['accent','Color secundario'],['background','Fondo de página'],['surface','Fondo de tarjetas'],['text','Texto']].map(([key,title])=><div className="paletteColorField" key={key}><label htmlFor={id+'-'+key}>{title}</label><div><input id={id+'-'+key} type="color" aria-label={`${title} (modo ${label})`} value={isHexColor(palette[key])?palette[key]:'#000000'} onChange={e=>update(key,e.target.value)}/><input type="text" aria-label={`Código de ${title.toLowerCase()} (modo ${label})`} value={palette[key]} maxLength={7} pattern="#[0-9a-fA-F]{6}" required spellCheck={false} onChange={e=>update(key,e.target.value)}/></div></div>)}</div><p className="paletteContrastHint">El texto debe leerse sobre el fondo y las tarjetas. Las letras de botones y enlaces se ajustan automáticamente.</p>{issues.length>0&&<div className="error" role="alert">{issues.join(' ')} Cambiá el color del texto o del fondo antes de publicar.</div>}<button className="outline" type="button" onClick={suggested}>Usar colores sugeridos para este modo</button><small>La vista previa muestra el modo {label}. Los cambios se publican al guardar el diseño.</small></section>;
}
