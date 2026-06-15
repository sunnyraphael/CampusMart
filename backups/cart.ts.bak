// Zustand cart store
import { create } from "zustand"
import { persist } from "zustand/middleware"

// ─── Our own simple cart item shape ───────────────────────────────────────────
// This lives here instead of importing from Supabase types, because the cart
// is a client-side feature — it doesn't need to match any database table exactly.
export interface CartStoreItem {
  id: string           // product id
  title: string
  price: number
  quantity: number
  image_url: string | null
  vendor_name: string | null
}

// ─── Store shape ──────────────────────────────────────────────────────────────
interface CartState {
  items: CartStoreItem[]
  addItem: (item: CartStoreItem) => void
  removeItem: (id: string) => void
  updateQuantity: (id: string, quantity: number) => void
  clearCart: () => void
  getTotalItems: () => number
  getTotalPrice: () => number
}

// ─── Store implementation ─────────────────────────────────────────────────────
export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (item) => {
        const existing = get().items.find((i) => i.id === item.id)
        if (existing) {
          set((state) => ({
            items: state.items.map((i) =>
              i.id === item.id
                ? { ...i, quantity: i.quantity + item.quantity }
                : i
            ),
          }))
        } else {
          set((state) => ({ items: [...state.items, item] }))
        }
      },

      removeItem: (id) => {
        set((state) => ({
          items: state.items.filter((i) => i.id !== id),
        }))
      },

      updateQuantity: (id, quantity) => {
        if (quantity <= 0) {
          get().removeItem(id)
          return
        }
        set((state) => ({
          items: state.items.map((i) =>
            i.id === id ? { ...i, quantity } : i
          ),
        }))
      },

      clearCart: () => set({ items: [] }),

      getTotalItems: () => get().items.reduce((sum, i) => sum + i.quantity, 0),

      getTotalPrice: () => get().items.reduce((sum, i) => sum + i.quantity * i.price, 0),
    }),
    { name: "campusmart-cart" }
  )
)