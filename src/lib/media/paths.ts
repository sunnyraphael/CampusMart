// Only our versioned upload names have a known sibling thumbnail. Legacy images
// keep their original URL until explicitly migrated; never invent a broken URL.
export function publicThumbnail(value:string){
  try{const url=new URL(value,'https://relative.invalid');if(!url.pathname.includes('/storage/v1/object/public/product-images/')||!/-full\.webp$/.test(url.pathname))return value;url.pathname=url.pathname.replace(/-full\.webp$/,'-thumb.webp');return url.href}catch{return value}
}
export function publicImageSiblings(value:string){
  const full=value.replace(/-thumb\.webp$/,'-full.webp')
  return /-full\.webp$/.test(full)?[full,full.replace(/-full\.webp$/,'-thumb.webp')]:[value]
}
