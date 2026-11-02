type Line={id:string;subtotal:number}
export function refundPreview(payment:{amount_kobo:number;provider_fee_kobo:number|null},items:Line[],refunds:{amount_kobo:number;processing_fee_retained_kobo:number}[],itemId:string,deduct:boolean){
  const sorted=[...items].sort((a,b)=>a.id.localeCompare(b.id)),total=items.reduce((n,i)=>n+BigInt(Math.round(Number(i.subtotal)*100)),BigInt(0)),item=items.find(i=>i.id===itemId)
  const share=(amount:number,line:Line)=>total>BigInt(0)?Number(BigInt(Math.round(amount))*BigInt(Math.round(Number(line.subtotal)*100))/total):0
  const allocate=(amount:number)=>!item?amount:item.id===sorted.at(-1)?.id?amount-sorted.slice(0,-1).reduce((n,i)=>n+share(amount,i),0):share(amount,item)
  const previousFee=refunds.reduce((n,r)=>n+Number(r.processing_fee_retained_kobo),0)
  const gross=item?allocate(Number(payment.amount_kobo)):Number(payment.amount_kobo)-refunds.reduce((n,r)=>n+Number(r.amount_kobo),0)-(deduct?previousFee:0)
  const fee=deduct?(item?allocate(Number(payment.provider_fee_kobo??0)):Math.max(0,Number(payment.provider_fee_kobo??0)-previousFee)):0
  return {amount:Math.max(0,gross-fee),retained:fee}
}
