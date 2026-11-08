// Keep this launch display in sync with the protected database fee policy.
export const VENDOR_COMMISSION_RATE=0
export const VENDOR_LAUNCH_OFFER='Launch offer: 0% vendor commission for a limited time.'
export function recordedVendorPayout(item:{subtotal?:number|string|null;payout_amount?:number|string|null;vendor_commission_rate?:number|string|null}){
 if(item.payout_amount!=null)return Number(item.payout_amount)
 const gross=Math.round(Number(item.subtotal??0)*100),basisPoints=Math.round(Number(item.vendor_commission_rate??0.05)*10000)
 return (gross-Math.round(gross*basisPoints/10000))/100
}
