// Display-only copy of the fee rules. The real fee is calculated inside the
// create_order database function. If you change a number here, change it there too.
export const SERVICE_FEE_RATE = 0.02
export const SERVICE_FEE_WAIVED_FROM = 20000

export function calcServiceFee(subtotal: number): number {
  if (subtotal >= SERVICE_FEE_WAIVED_FROM) return 0
  return Math.round(subtotal * SERVICE_FEE_RATE)
}

// How much more the buyer must add to reach the waiver. Never negative.
export function amountToWaive(subtotal: number): number {
  return Math.max(0, SERVICE_FEE_WAIVED_FROM - subtotal)
}