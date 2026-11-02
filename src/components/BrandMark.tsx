import Image from 'next/image'
export default function BrandMark({size=42}:{size?:number}){
  return <Image src="/brand/campusmart-symbol.png" alt="" width={size} height={size} unoptimized style={{width:size,height:size,objectFit:'contain',flexShrink:0,background:'#fff',borderRadius:10}}/>
}
