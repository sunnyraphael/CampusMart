# CampusMart - Full Folder Structure Setup
# Run this in your campusmart project root in VS Code terminal

$folders = @(
    # App routes
    "src/app/(auth)/login",
    "src/app/(auth)/register",
    "src/app/(auth)/forgot-password",
    "src/app/(store)",
    "src/app/(store)/products",
    "src/app/(store)/products/[id]",
    "src/app/(store)/categories/[slug]",
    "src/app/(store)/cart",
    "src/app/(store)/checkout",
    "src/app/(store)/orders",
    "src/app/(store)/orders/[id]",
    "src/app/(store)/wishlist",
    "src/app/(store)/search",
    "src/app/(store)/account",
    "src/app/(seller)/seller/dashboard",
    "src/app/(seller)/seller/products",
    "src/app/(seller)/seller/orders",
    "src/app/(seller)/seller/analytics",
    "src/app/(seller)/seller/settings",
    "src/app/(seller)/seller/onboarding",
    "src/app/(admin)/admin/dashboard",
    "src/app/(admin)/admin/users",
    "src/app/(admin)/admin/products",
    "src/app/(admin)/admin/orders",
    "src/app/(admin)/admin/sellers",
    "src/app/(admin)/admin/analytics",
    "src/app/(admin)/admin/settings",
    "src/app/api/auth",
    "src/app/api/products",
    "src/app/api/orders",
    "src/app/api/payments",
    "src/app/api/notifications",
    "src/app/api/upload",

    # Components
    "src/components/ui",
    "src/components/layout",
    "src/components/store",
    "src/components/seller",
    "src/components/admin",
    "src/components/shared",
    "src/components/forms",
    "src/components/charts",

    # Lib / utilities
    "src/lib",
    "src/lib/supabase",
    "src/lib/paystack",
    "src/lib/whatsapp",
    "src/lib/validations",
    "src/lib/utils",

    # Hooks
    "src/hooks",

    # Store (Zustand)
    "src/store",

    # Types
    "src/types",

    # Config
    "src/config",

    # Styles
    "src/styles",

    # Public assets
    "public/images",
    "public/icons"
)

foreach ($folder in $folders) {
    New-Item -ItemType Directory -Path $folder -Force | Out-Null
    Write-Host "✅ Created: $folder"
}

# Create key placeholder files
$files = @{
    "src/lib/supabase/client.ts"        = "// Supabase browser client"
    "src/lib/supabase/server.ts"        = "// Supabase server client"
    "src/lib/supabase/middleware.ts"    = "// Supabase middleware helper"
    "src/lib/paystack/index.ts"         = "// Paystack integration"
    "src/lib/whatsapp/index.ts"         = "// WhatsApp notification service"
    "src/lib/validations/auth.ts"       = "// Auth form validation schemas"
    "src/lib/validations/product.ts"    = "// Product form validation schemas"
    "src/lib/validations/order.ts"      = "// Order validation schemas"
    "src/lib/utils/cn.ts"               = "// Class name utility"
    "src/lib/utils/format.ts"           = "// Currency, date formatters"
    "src/types/database.ts"             = "// Supabase database types"
    "src/types/index.ts"                = "// Shared app types"
    "src/store/cart.ts"                 = "// Zustand cart store"
    "src/store/auth.ts"                 = "// Zustand auth store"
    "src/store/ui.ts"                   = "// Zustand UI store"
    "src/hooks/useCart.ts"              = "// Cart hook"
    "src/hooks/useAuth.ts"              = "// Auth hook"
    "src/hooks/useProducts.ts"          = "// Products hook"
    "src/config/site.ts"                = "// Site config (name, url, etc)"
    "src/config/navigation.ts"          = "// Nav links config"
    "src/styles/globals.css"            = "/* Global styles */"
}

foreach ($file in $files.GetEnumerator()) {
    if (-not (Test-Path $file.Key)) {
        New-Item -ItemType File -Path $file.Key -Force | Out-Null
        Set-Content -Path $file.Key -Value $file.Value
        Write-Host "📄 Created file: $($file.Key)"
    }
}

Write-Host ""
Write-Host "🎉 CampusMart folder structure ready!"
