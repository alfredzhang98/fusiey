# Fusiey local E2E API test — run with dev servers up (npm run dev)
$ErrorActionPreference = 'Continue'
$base = 'http://localhost:3000/api'
$pass = 0; $fail = 0
function Check($name, $cond, $detail) {
  if ($cond) { Write-Host "PASS  $name" -ForegroundColor Green; $script:pass++ }
  else { Write-Host "FAIL  $name  -- $detail" -ForegroundColor Red; $script:fail++ }
}
function TryCall($scriptblock) {
  try { & $scriptblock } catch { $_.Exception.Response.StatusCode.value__ }
}

# ── 1. Products ──────────────────────────────────────────────
$products = Invoke-RestMethod "$base/products"
Check 'products list returns items' ($products.products.Count -ge 5) "got $($products.products.Count)"
$productId = $products.products[0].id

# ── 2. Register new user ─────────────────────────────────────
$suffix = Get-Random -Maximum 99999
$email = "e2e$suffix@fusiey.com"
$reg = Invoke-RestMethod "$base/auth/register" -Method POST -ContentType 'application/json' `
  -Body (@{ email = $email; password = 'testpass123'; name = 'E2E User' } | ConvertTo-Json) `
  -SessionVariable userSession
Check 'register new user' ($reg.user.email -eq $email) ($reg | ConvertTo-Json -Compress)

# ── 3. /me with cookie ────────────────────────────────────────
$me = Invoke-RestMethod "$base/auth/me" -WebSession $userSession
Check 'GET /me returns user' ($me.user.email -eq $email) ($me | ConvertTo-Json -Compress)
Check '/me exposes hasPassword' ($me.user.hasPassword -eq $true) "hasPassword=$($me.user.hasPassword)"

# ── 4. Profile update ─────────────────────────────────────────
$upd = Invoke-RestMethod "$base/auth/me" -Method PATCH -ContentType 'application/json' `
  -Body (@{ name = 'E2E Renamed' } | ConvertTo-Json) -WebSession $userSession
Check 'PATCH /me updates name' ($upd.user.name -eq 'E2E Renamed') ($upd | ConvertTo-Json -Compress)

# ── 5. Password change + relogin ─────────────────────────────
$null = Invoke-RestMethod "$base/auth/me/password" -Method PATCH -ContentType 'application/json' `
  -Body (@{ currentPassword = 'testpass123'; newPassword = 'newpass456' } | ConvertTo-Json) -WebSession $userSession
$relogin = Invoke-RestMethod "$base/auth/login" -Method POST -ContentType 'application/json' `
  -Body (@{ email = $email; password = 'newpass456' } | ConvertTo-Json) -SessionVariable userSession2
Check 'password change + relogin' ($relogin.user.email -eq $email) ($relogin | ConvertTo-Json -Compress)
$oldLoginStatus = TryCall { Invoke-RestMethod "$base/auth/login" -Method POST -ContentType 'application/json' `
  -Body (@{ email = $email; password = 'testpass123' } | ConvertTo-Json); 200 }
Check 'old password rejected' ($oldLoginStatus -eq 401) "status=$oldLoginStatus"

# ── 6. Create order ───────────────────────────────────────────
$orderBody = @{
  items = @(@{ productId = $productId; quantity = 2 })
  shippingAddress = @{ line1 = '1 Test Street'; city = 'London'; postcode = 'SW1A 1AA'; country = 'GB' }
  paymentMethod = 'paypal'
} | ConvertTo-Json -Depth 5
$order = Invoke-RestMethod "$base/orders" -Method POST -ContentType 'application/json' -Body $orderBody -WebSession $userSession2
$orderId = $order.id
Check 'create order' ($null -ne $orderId -and $order.status -eq 'PENDING') ($order | ConvertTo-Json -Compress)

# ── 7. List + get order ───────────────────────────────────────
$orders = Invoke-RestMethod "$base/orders" -WebSession $userSession2
Check 'list own orders' ($orders.orders.Count -ge 1) "count=$($orders.orders.Count)"
$one = Invoke-RestMethod "$base/orders/$orderId" -WebSession $userSession2
Check 'get order by id' ($null -ne $orderId -and $one.id -eq $orderId) ($one | ConvertTo-Json -Compress)

# ── 8. Non-admin cannot update order status ──────────────────
$forbidden = TryCall { Invoke-RestMethod "$base/orders/$orderId" -Method PATCH -ContentType 'application/json' `
  -Body (@{ status = 'CONFIRMED' } | ConvertTo-Json) -WebSession $userSession2; 200 }
Check 'customer blocked from status update' ($forbidden -eq 403) "status=$forbidden"

# ── 9. Admin login + admin endpoints ─────────────────────────
$null = Invoke-RestMethod "$base/auth/login" -Method POST -ContentType 'application/json' `
  -Body (@{ email = 'admin@fusiey.com'; password = 'admin123' } | ConvertTo-Json) -SessionVariable adminSession
$dash = Invoke-RestMethod "$base/admin/dashboard" -WebSession $adminSession
Check 'admin dashboard' ($null -ne $dash) ($dash | ConvertTo-Json -Compress)
$inv = Invoke-RestMethod "$base/admin/inventory" -WebSession $adminSession
Check 'admin inventory' ($null -ne $inv) ($inv | ConvertTo-Json -Compress)

# ── 10. Admin updates order status ────────────────────────────
$statusUpd = Invoke-RestMethod "$base/orders/$orderId" -Method PATCH -ContentType 'application/json' `
  -Body (@{ status = 'CONFIRMED' } | ConvertTo-Json) -WebSession $adminSession
Check 'admin confirms order' ($statusUpd.success -eq $true -and $statusUpd.status -eq 'CONFIRMED') ($statusUpd | ConvertTo-Json -Compress)

# ── 11. Admin guard: anonymous blocked ────────────────────────
$anonStatus = TryCall { Invoke-RestMethod "$base/admin/dashboard"; 200 }
Check 'anonymous blocked from admin API' ($anonStatus -eq 401) "status=$anonStatus"

# ── 12. AI routes disabled ────────────────────────────────────
$aiStatus = TryCall { Invoke-RestMethod "$base/ai/stylize" -Method POST -ContentType 'application/json' -Body '{}'; 200 }
Check 'AI routes return 404' ($aiStatus -eq 404) "status=$aiStatus"

# ── 13. Frontend serving ──────────────────────────────────────
$fe = TryCall { (Invoke-WebRequest 'http://localhost:5173' -UseBasicParsing).StatusCode }
Check 'frontend serves on 5173' ($fe -eq 200) "status=$fe"

Write-Host ""
Write-Host ("RESULT: {0} passed, {1} failed" -f $pass, $fail) -ForegroundColor $(if ($fail -eq 0) { 'Green' } else { 'Red' })
if ($fail -gt 0) { exit 1 }
