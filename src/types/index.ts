// Shared app types
import type { Database } from "./database"

// ─── Row types (what comes back from Supabase) ───
export type User = Database["public"]["Tables"]["users"]["Row"]
export type Seller = Database["public"]["Tables"]["sellers"]["Row"]
export type Category = Database["public"]["Tables"]["categories"]["Row"]
export type Product = Database["public"]["Tables"]["products"]["Row"]
export type Order = Database["public"]["Tables"]["orders"]["Row"]
export type OrderItem = Database["public"]["Tables"]["order_items"]["Row"]
export type Review = Database["public"]["Tables"]["reviews"]["Row"]
export type CartItem = Database["public"]["Tables"]["cart_items"]["Row"]
export type WishlistItem = Database["public"]["Tables"]["wishlist"]["Row"]
export type Notification = Database["public"]["Tables"]["notifications"]["Row"]

// ─── Insert types (what you send TO Supabase) ───
export type NewUser = Database["public"]["Tables"]["users"]["Insert"]
export type NewProduct = Database["public"]["Tables"]["products"]["Insert"]
export type NewOrder = Database["public"]["Tables"]["orders"]["Insert"]
export type NewOrderItem = Database["public"]["Tables"]["order_items"]["Insert"]
export type NewReview = Database["public"]["Tables"]["reviews"]["Insert"]
export type NewCartItem = Database["public"]["Tables"]["cart_items"]["Insert"]

// ─── Enums ───
export type UserRole = "buyer" | "seller" | "admin"
export type OrderStatus = "pending" | "confirmed" | "processing" | "shipped" | "delivered" | "cancelled"
export type PaymentStatus = "unpaid" | "paid" | "refunded"
export type ProductStatus = "active" | "inactive" | "sold_out"
export type NotificationType = "order_placed" | "order_confirmed" | "order_shipped" | "order_delivered" | "order_cancelled"

// ─── Extended types (with joined data) ───
export type ProductWithSeller = Product & {
  sellers: Pick<Seller, "store_name" | "logo_url" | "is_verified">
}

export type ProductWithCategory = Product & {
  categories: Pick<Category, "name" | "slug">
}

export type ProductFull = Product & {
  sellers: Pick<Seller, "store_name" | "logo_url" | "is_verified">
  categories: Pick<Category, "name" | "slug">
}

export type CartItemWithProduct = CartItem & {
  products: ProductFull
}

export type OrderWithItems = Order & {
  order_items: (OrderItem & {
    products: Pick<Product, "title" | "images" | "price">
  })[]
}