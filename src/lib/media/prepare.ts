'use client'
export type PreparedImage={full:File;thumbnail:File;width:number;height:number;originalBytes:number}
export async function preparePublicImage(file:File,logo=false):Promise<PreparedImage>{
  if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Please choose a JPG, PNG or WebP photo. Convert HEIC images to JPG first.')
  if(file.size>5*1024*1024)throw new Error('Choose a photo under 5 MB.')
  let bitmap:ImageBitmap
  try{bitmap=await createImageBitmap(file)}catch{throw new Error('This photo could not be opened. Try a JPG, PNG or WebP copy.')}
  try{
    if(!bitmap.width||!bitmap.height||bitmap.width*bitmap.height>40000000)throw new Error('This photo is too large to process. Choose an image under 40 megapixels.')
    async function encode(maxDimension:number,targetBytes:number){
      const scale=Math.min(1,maxDimension/Math.max(bitmap.width,bitmap.height))
      const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale))
      const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Your browser could not prepare this photo. Try another browser.')
      ctx.drawImage(bitmap,0,0,canvas.width,canvas.height)
      let blob:Blob|null=null
      for(const quality of [.84,.76,.68,.6]){
        blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/webp',quality))
        if(!blob||blob.type!=='image/webp')throw new Error('Your browser cannot optimise this photo. Please use a current browser.')
        if(blob.size<=targetBytes)break
      }
      // Keep a quality floor rather than damaging useful product detail.
      if(!blob||blob.size>1024*1024)throw new Error('This image is still too large after optimisation. Choose a simpler or smaller photo.')
      return {file:new File([blob],'photo.webp',{type:'image/webp'}),width:canvas.width,height:canvas.height}
    }
    const full=await encode(logo?512:1600,logo?100000:300000),thumb=await encode(logo?128:640,logo?20000:90000)
    return {full:full.file,thumbnail:thumb.file,width:full.width,height:full.height,originalBytes:file.size}
  }finally{bitmap.close()}
}
