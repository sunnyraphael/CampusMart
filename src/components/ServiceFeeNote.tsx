import { CheckCircle2, Info } from "lucide-react"
import { SERVICE_FEE_WAIVED_FROM, amountToWaive } from "@/lib/fees"

const naira = (n: number) => "₦" + Math.round(n).toLocaleString("en-NG")

export default function ServiceFeeNote({ subtotal }: { subtotal: number }) {
  // Nothing to say about an empty cart
  if (subtotal <= 0) return null

  const waived = subtotal >= SERVICE_FEE_WAIVED_FROM
  const Icon = waived ? CheckCircle2 : Info

  return (
    <div className={`sf-note ${waived ? "is-waived" : ""}`} role="note">
      <style>{css}</style>
      <Icon size={15} aria-hidden />
      <span>
        {waived
          ? `Service fee waived. Orders of ${naira(SERVICE_FEE_WAIVED_FROM)} or more pay none.`
          : `Spend ${naira(amountToWaive(subtotal))} more to remove the service fee. It is waived on orders of ${naira(SERVICE_FEE_WAIVED_FROM)} or more.`}
      </span>
    </div>
  )
}

const css = `
.sf-note{display:flex;gap:8px;align-items:flex-start;margin:2px 0 12px;padding:10px 12px;border-radius:10px;border:1px solid #bfdbfe;background:#eff6ff;color:#1e40af;font-size:.75rem;line-height:1.45}
.sf-note svg{flex:none;margin-top:1px}
.sf-note.is-waived{border-color:#bbf7d0;background:#f0fdf4;color:#166534}
.dark .sf-note{border-color:#1e3a5f;background:#0b1530;color:#93c5fd}
.dark .sf-note.is-waived{border-color:#14532d;background:#0d2a1c;color:#7ee2a8}
`