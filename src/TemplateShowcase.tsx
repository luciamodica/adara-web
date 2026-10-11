import {ArrowRight,Globe,Scissors,Leaf} from 'lucide-react';
export const designs=[
{"id": "atlas", "name": "Atlas Studio", "business": "Distrito Barber", "category": "BARBERÍA & ESTILO", "title": "Tu estilo empieza acá.", "description": "Azul nítido, portada dividida y tipografía moderna.", "color": "#0758df", "accent": "#35c9ed", "bg": "#f6faff"},
{"id": "clear", "name": "Clear Space", "business": "Punto Studio", "category": "PELUQUERÍA & CUIDADO", "title": "Un espacio para cuidarte.", "description": "Blanco luminoso, líneas simples y una composición centrada.", "color": "#1b4965", "accent": "#a8dce7", "bg": "#fafcfd"},
{"id": "forest", "name": "Forest Ritual", "business": "Espacio Bosque", "category": "MASAJES & BIENESTAR", "title": "Una pausa para vos.", "description": "Verde profundo, equilibrio natural y bloques asimétricos.", "color": "#245347", "accent": "#98b8a5", "bg": "#f4f8f5"},
{"id": "carbon", "name": "Carbon Studio", "business": "Carbon Barber", "category": "CORTE & BARBA", "title": "Carácter en cada detalle.", "description": "Grafito, contraste y una portada con presencia.", "color": "#14202c", "accent": "#8eacbf", "bg": "#f5f7fa"},
 {id:'silk',name:'Silk Editorial',business:'Atelier Nude',category:'MANICURA & NAIL ART',title:'Los detalles hacen la diferencia.',description:'Editorial, cálida y natural.',color:'#8d665b',accent:'#d9b8aa',bg:'#fbf8f4'},
 {id:'rose',name:'Rose Atelier',business:'Alma Studio',category:'PESTAÑAS & CEJAS',title:'Tu belleza, en su mejor versión.',description:'Suave, romántica y delicada.',color:'#8d5e62',accent:'#e8c9c8',bg:'#fff9f7'},
 {id:'sage',name:'Sage Ritual',business:'Casa Lume',category:'COSMETOLOGÍA & BIENESTAR',title:'Un momento para volver a vos.',description:'Calma, equilibrio y espacio.',color:'#5f6d63',accent:'#cbd4cc',bg:'#f7f8f3'},
 {id:'noir',name:'Noir Studio',business:'Noir Hair',category:'PELUQUERÍA DE AUTOR',title:'Tu estilo. Tu propia esencia.',description:'Contraste y carácter contemporáneo.',color:'#1f1b19',accent:'#b89473',bg:'#f4efe9'},
 {id:'pearl',name:'Pearl Maison',business:'Maison Beauty',category:'BELLEZA & CUIDADO PERSONAL',title:'El lujo de dedicarte tiempo.',description:'Luminosa, elegante y refinada.',color:'#6c5d54',accent:'#d8c3a8',bg:'#fffdf9'},
 {id:'muse',name:'Muse Modern',business:'Musa',category:'MAQUILLAJE & ESTILO',title:'Belleza con una mirada propia.',description:'Composición de autor y personalidad.',color:'#5b3e48',accent:'#caa6ad',bg:'#faf6f2'}
];
export function WebsiteExample({design:d}:any){return <article className="websiteExample" style={{'--demo-primary':d.color,'--demo-accent':d.accent,'--demo-bg':d.bg} as any}>
 <div className="exampleWindow" aria-label={`Vista de escritorio de ${d.name}`}><div className="exampleBrowser"><span><i/><i/><i/></span><small>adaraweb.com.ar / {d.business.toLowerCase().replace(/ /g,'-')}</small><Globe size={11}/></div><div className={`exampleWebsite example-${d.id}`}>
  <div className="exampleNav"><b>{d.business}</b><span>Servicios &nbsp; · &nbsp; Sobre mí</span><span className="exampleCta">Reservar</span></div>
  <div className="exampleHero"><div className="exampleCopy"><small>{d.category}</small><h3>{d.title}</h3><p>Cuidado experto. Una experiencia pensada para vos.</p><span className="exampleCta">Elegí tu próximo turno <ArrowRight size={10}/></span></div><div className="examplePhoto">{['atlas','clear','forest','carbon'].includes(d.id)&&(d.id==='forest'?<Leaf/>:<Scissors/>)}</div></div>
  <div className="exampleServices"><b>Encontrá tu próximo momento</b><span>01 &nbsp; Cuidado esencial</span><span>02 &nbsp; Experiencia premium</span><ArrowRight size={14}/></div>
 </div></div><div className="exampleCaption"><div><h3>{d.name}</h3><p>{d.description}</p></div><div className="exampleSwatches" aria-label="Colores de la plantilla"><i style={{background:d.color}}/><i style={{background:d.accent}}/><i style={{background:d.bg}}/></div></div>
 </article>}

