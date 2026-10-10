import {BRAND} from './brand';
export default function PlatformLogo({light=false}:{light?:boolean}) {
 return <span className={'brand platformBrand'+(light?' light':'')}><img src={BRAND.logo} alt={BRAND.name}/></span>;
}
