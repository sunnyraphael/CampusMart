import type { Metadata } from 'next'
export function siteOrigin(){
 const configured=process.env.NEXT_PUBLIC_APP_URL||'https://campusmart-pilot.netlify.app'
 const url=new URL(configured)
 if(!['https:','http:'].includes(url.protocol))throw new Error('Invalid site URL')
 return url.origin
}
export function pageMetadata(title:string,description:string,path:string,index=true):Metadata{
 return {title,description,alternates:{canonical:new URL(path,siteOrigin()).href},robots:index?{index:true,follow:true}:{index:false,follow:false},openGraph:{title,description,url:new URL(path,siteOrigin()).href,siteName:'CampusMart',type:'website'}}
}
