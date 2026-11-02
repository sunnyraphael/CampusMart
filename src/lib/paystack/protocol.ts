import { createHmac, timingSafeEqual } from 'node:crypto'

export type PaymentMode='test'|'live'
export class ProviderRequestError extends Error{
  readonly status:number
  readonly rejected:boolean
  constructor(status:number,rejected:boolean){super('Payment provider request could not be confirmed');this.status=status;this.rejected=rejected}
}
export type VerifiedCharge={reference:string;status:string;amount:number;currency:string;domain:PaymentMode;id:number;fees?:number|null;customer:{email:string}}
export function validSignature(body:string,signature:string|null,secret:string){
  if(!signature||!/^[a-f0-9]{128}$/i.test(signature))return false
  return timingSafeEqual(createHmac('sha512',secret).update(body).digest(),Buffer.from(signature,'hex'))
}
export function safeCheckoutUrl(value:unknown){
  if(typeof value!=='string')throw new Error('Invalid checkout response')
  const url=new URL(value)
  if(url.protocol!=='https:'||url.hostname!=='checkout.paystack.com'||url.username||url.password||url.port)throw new Error('Invalid checkout response')
  return url.href
}
export function matchesCharge(charge:VerifiedCharge,payment:{reference:string;amount_kobo:number;mode:PaymentMode;email:string}){
  return charge.status==='success'&&charge.reference===payment.reference&&Number.isSafeInteger(charge.amount)&&charge.amount===Number(payment.amount_kobo)&&charge.currency==='NGN'&&charge.domain===payment.mode&&charge.customer?.email?.toLowerCase()===payment.email.toLowerCase()&&Number.isSafeInteger(charge.id)&&charge.id>0&&(charge.fees==null||(Number.isSafeInteger(charge.fees)&&charge.fees>=0&&charge.fees<=charge.amount))
}
export function makePaystackClient(secret:string,fetcher:typeof fetch=fetch){
  async function page<T>(path:string,body?:unknown):Promise<{data:T;meta?:{next?:string|null}}>{
    if(!path.startsWith('/')||path.startsWith('//'))throw new Error('Invalid provider path')
    const result=await fetcher(`https://api.paystack.co${path}`,{method:body===undefined?'GET':'POST',headers:{Authorization:`Bearer ${secret}`,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)}),cache:'no-store',signal:AbortSignal.timeout(10000)})
    const response=await result.json() as {status?:boolean;data?:T;meta?:{next?:string|null}}
    if(!result.ok||response.status!==true||response.data===undefined)throw new ProviderRequestError(result.status,result.status>=400&&result.status<500&&![408,429].includes(result.status)&&response.status===false&&!response.data)
    return response as {data:T;meta?:{next?:string|null}}
  }
  async function request<T>(path:string,body?:unknown):Promise<T>{return (await page<T>(path,body)).data}
  return Object.assign(request,{page})
}
