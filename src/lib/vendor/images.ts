// Only remove this project's public product images inside the authenticated vendor's folder.
export function ownedProductImagePath(imageUrl:string,projectUrl:string,vendorId:string):string|null {
  try {
    const url=new URL(imageUrl)
    const project=new URL(projectUrl)
    if(url.origin!==project.origin||url.search||url.hash)return null
    const prefix='/storage/v1/object/public/product-images/'
    if(!url.pathname.startsWith(prefix))return null
    const path=decodeURIComponent(url.pathname.slice(prefix.length))
    if(!path.startsWith(`${vendorId}/`)||path.includes('\\')||path.split('/').some((part)=>!part||part==='.'||part==='..'))return null
    return path
  } catch {return null}
}
