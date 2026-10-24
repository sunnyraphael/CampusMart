"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, ShieldAlert, Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

type Mode = "idle" | "confirm" | "dispute"

export default function ItemActions({
  itemId,
  status,
}: {
  itemId: string
  status: string
}) {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>("idle")
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Only these two states can still be acted on. Everything else shows nothing.
  const canReceive = status === "delivered"
  const canDispute = status === "shipped" || status === "delivered"
  if (!canReceive && !canDispute) return null

  async function submit(kind: "received" | "dispute") {
    if (kind === "dispute" && reason.trim().length < 5) {
      setError("Please describe the problem in at least 5 characters.")
      return
    }
    setBusy(true)
    setError(null)
    const supabase = createClient()

    // The database function does the real checking: is this MY order, and is the
    // item in the right state? The buttons are only a convenience.
    const { error: rpcError } =
      kind === "received"
        ? await supabase.rpc("confirm_item_received", { p_item_id: itemId })
        : await supabase.rpc("dispute_item", { p_item_id: itemId, p_reason: reason.trim() })

    if (rpcError) {
      setError(rpcError.message)
      setBusy(false)
      return
    }
    router.refresh() // re-runs the server page so the new status shows up
    setBusy(false)
    setMode("idle")
  }

  return (
    <div className="ia">
      <style>{`
        .ia { margin-top: 12px; }
        .ia-row { display: flex; gap: 8px; flex-wrap: wrap; }
        .ia-btn { display: inline-flex; align-items: center; gap: 7px; padding: 9px 16px; border-radius: 10px; font: 600 13px 'DM Sans', sans-serif; cursor: pointer; border: 1.5px solid transparent; transition: background .15s, border-color .15s; }
        .ia-btn:disabled { opacity: .6; cursor: not-allowed; }
        .ia-btn:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }
        .ia-primary { background: #2563eb; color: #fff; }
        .ia-primary:hover:not(:disabled) { background: #1d4ed8; }
        .ia-danger { background: #fff; color: #b42318; border-color: #fecaca; }
        .ia-danger:hover:not(:disabled) { background: #fef2f2; border-color: #b42318; }
        .ia-ghost { background: transparent; color: #6b7280; }
        .ia-ghost:hover:not(:disabled) { color: #111827; }
        .ia-panel { margin-top: 10px; padding: 14px; border-radius: 12px; background: #f8faff; border: 1.5px solid #e0e7ff; }
        .ia-panel p { margin: 0 0 12px; font-size: 13px; line-height: 1.5; color: #374151; }
        .ia-panel textarea { width: 100%; min-height: 84px; margin-bottom: 12px; padding: 10px 12px; border-radius: 10px; border: 1.5px solid #e2e8f0; background: #fff; color: #111827; caret-color: #111827; font: 14px 'DM Sans', sans-serif; resize: vertical; box-sizing: border-box; }
        .ia-panel textarea::placeholder { color: #9ca3af; }
        .ia-panel textarea:focus { outline: none; border-color: #2563eb; }
        .dark .ia-panel { background: #0f1a35; border-color: #1e3a5f; }
        .dark .ia-panel p { color: #cfe0ff; }
        .dark .ia-panel textarea { background: #0a1628; border-color: #1e3a5f; color: #f1f5f9; caret-color: #f1f5f9; color-scheme: dark; }
        .dark .ia-panel textarea::placeholder { color: #6f8bbf; }
        .dark .ia-ghost:hover:not(:disabled) { color: #fff; }
        .ia-err { margin: 10px 0 0; font-size: 12.5px; color: #b42318; }
        .ia-spin { animation: ia-spin .8s linear infinite; }
        @keyframes ia-spin { to { transform: rotate(360deg); } }
        @media (prefers-reduced-motion: reduce) { .ia-spin { animation: none; } }
      `}</style>

      {mode === "idle" && (
        <div className="ia-row">
          {canReceive && (
            <button className="ia-btn ia-primary" onClick={() => setMode("confirm")}>
              <CheckCircle2 size={15} aria-hidden /> I received this
            </button>
          )}
          {canDispute && (
            <button className="ia-btn ia-danger" onClick={() => setMode("dispute")}>
              <ShieldAlert size={15} aria-hidden /> Report a problem
            </button>
          )}
        </div>
      )}

      {mode === "confirm" && (
        <div className="ia-panel">
          <p>
            Only confirm if the item is in your hands and as described. This releases your payment to the
            vendor and cannot be undone.
          </p>
          <div className="ia-row">
            <button className="ia-btn ia-primary" disabled={busy} onClick={() => submit("received")}>
              {busy ? <Loader2 size={15} className="ia-spin" aria-hidden /> : <CheckCircle2 size={15} aria-hidden />}
              Yes, release payment
            </button>
            <button className="ia-btn ia-ghost" disabled={busy} onClick={() => { setMode("idle"); setError(null) }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {mode === "dispute" && (
        <div className="ia-panel">
          <p>
            Tell us what went wrong. The vendor's payment is frozen right away while we review.
          </p>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="For example: the item never arrived, or it is not what was listed"
            aria-label="Describe the problem"
          />
          <div className="ia-row">
            <button className="ia-btn ia-danger" disabled={busy} onClick={() => submit("dispute")}>
              {busy ? <Loader2 size={15} className="ia-spin" aria-hidden /> : <ShieldAlert size={15} aria-hidden />}
              Submit dispute
            </button>
            <button className="ia-btn ia-ghost" disabled={busy} onClick={() => { setMode("idle"); setError(null) }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && <p className="ia-err" role="alert">{error}</p>}
    </div>
  )
}