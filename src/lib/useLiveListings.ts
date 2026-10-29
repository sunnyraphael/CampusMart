"use client"

import { useCallback, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { ListingFields } from "@/lib/listing-display"

// The live database row for a listing that is sitting in the cart.
export type LiveListing = ListingFields & { id: string; status: string }

// The cart remembers the price from the moment an item was added. Prices, stock
// and promos can change after that, so this hook asks the database what is true
// right now. Cart and checkout both use it, so they can never disagree.
export function useLiveListings(ids: string[]) {
  // One stable string for the id list. Without it, a new array on every render
  // would make the effect below run again and again.
  const key = [...ids].sort().join(",")

  const [live, setLive] = useState<Record<string, LiveListing>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!key) {
      setLive({})
      setError(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    createClient()
      .from("products")
      .select(
        "id, price, stock_quantity, status, compare_at_price, sale_ends_at, condition, availability, delivery_days"
      )
      .in("id", key.split(","))
      .then(({ data, error: dbError }) => {
        if (cancelled) return
        if (dbError) {
          // Never hide a database error: the page shows this message.
          setError(dbError.message)
        } else {
          setError(null)
          const rows = (data ?? []) as unknown as LiveListing[]
          setLive(Object.fromEntries(rows.map((r) => [r.id, r])))
        }
        setLoading(false)
      })

    // If the id list changes mid-request, ignore the old answer.
    return () => {
      cancelled = true
    }
  }, [key, attempt])

  const retry = useCallback(() => setAttempt((a) => a + 1), [])

  return { live, loading, error, retry }
}