// Site config (name, url, etc)
export const siteConfig = {
  name: "CampusMart",
  description: "A marketplace for Nigerian university students",
  url: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  currency: "NGN",
  currencySymbol: "₦",
  whatsappNumber: process.env.WHATSAPP_NUMBER || "",
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "",
}