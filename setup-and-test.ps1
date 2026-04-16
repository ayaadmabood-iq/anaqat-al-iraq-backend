# ============================================================
# Anaqat Al-Iraq — Backend Setup & Test Script
# ============================================================
# Prerequisites:
#   - Node.js installed
#   - PostgreSQL running with database 'anaqat_iraq'
#   - .env configured (DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD, DB_DATABASE)
# ============================================================

$ErrorActionPreference = "Continue"
$backendPath = "C:\Users\HP\Desktop\Inaqet Iraq\anaqat-al-iraq\backend"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Anaqat Al-Iraq Backend Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ----------------------------------------------------------
# Step 1: Install dependencies (including @types/uuid)
# ----------------------------------------------------------
Write-Host "[1/5] Installing dependencies..." -ForegroundColor Yellow
Set-Location $backendPath
npm install 2>&1 | Out-Null
npm install --save-dev @types/uuid 2>&1 | Out-Null
Write-Host "      Done." -ForegroundColor Green

# ----------------------------------------------------------
# Step 2: Seed the database
# ----------------------------------------------------------
Write-Host "[2/5] Seeding database..." -ForegroundColor Yellow
npm run seed 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "      ERROR: Seed failed. Check your PostgreSQL connection." -ForegroundColor Red
    Write-Host "      Make sure .env has correct DB credentials and the database exists." -ForegroundColor Red
    Write-Host ""
    Write-Host "      To create the database manually:" -ForegroundColor Gray
    Write-Host "        psql -U postgres -c `"CREATE DATABASE anaqat_iraq;`"" -ForegroundColor Gray
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host "      Done." -ForegroundColor Green

# ----------------------------------------------------------
# Step 3: Start the backend (in a new window)
# ----------------------------------------------------------
Write-Host "[3/5] Starting backend server..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$backendPath'; npm run start:dev"
Write-Host "      Server starting in a new window. Waiting 8 seconds..." -ForegroundColor Gray
Start-Sleep -Seconds 8
Write-Host "      Done." -ForegroundColor Green

# ----------------------------------------------------------
# Step 4: Get Store ID
# ----------------------------------------------------------
Write-Host "[4/5] Fetching store ID..." -ForegroundColor Yellow
$baseUrl = "http://localhost:3000/api/v1"

try {
    $storesResponse = Invoke-RestMethod -Uri "$baseUrl/stores" -Method GET
    $storeId = $storesResponse[0].id
    $storeName = $storesResponse[0].name
    Write-Host "      Store: $storeName" -ForegroundColor Green
    Write-Host "      ID:    $storeId" -ForegroundColor Green
} catch {
    Write-Host "      ERROR: Could not reach the server at $baseUrl" -ForegroundColor Red
    Write-Host "      The server may still be starting. Try running the tests manually." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# ----------------------------------------------------------
# Step 5: Run API tests
# ----------------------------------------------------------
Write-Host "[5/5] Testing API endpoints..." -ForegroundColor Yellow
Write-Host ""

# Test 1: Login
Write-Host "--- TEST 1: POST /auth/login ---" -ForegroundColor Cyan
$loginBody = @{ username = "owner"; password = "demo123" } | ConvertTo-Json
$loginResponse = Invoke-RestMethod -Uri "$baseUrl/auth/login?storeId=$storeId" `
    -Method POST `
    -ContentType "application/json" `
    -Body $loginBody

$token = $loginResponse.access_token
$userName = $loginResponse.user.fullName
$userRole = $loginResponse.user.role

Write-Host "  Status:  OK" -ForegroundColor Green
Write-Host "  User:    $userName ($userRole)" -ForegroundColor White
Write-Host "  Token:   $($token.Substring(0, 30))..." -ForegroundColor Gray
Write-Host ""

# Test 2: Get Inventory Items
Write-Host "--- TEST 2: GET /inventory/items ---" -ForegroundColor Cyan
$headers = @{ Authorization = "Bearer $token" }
$itemsResponse = Invoke-RestMethod -Uri "$baseUrl/inventory/items" -Method GET -Headers $headers

Write-Host "  Status:  OK" -ForegroundColor Green
Write-Host "  Items:   $($itemsResponse.Count) items found" -ForegroundColor White
foreach ($item in $itemsResponse) {
    Write-Host "    - $($item.primaryColor) | $($item.styleTag) | Sizes: $($item.sizes.Count)" -ForegroundColor Gray
}
Write-Host ""

# Test 3: Sales Report
Write-Host "--- TEST 3: GET /sales/report/summary ---" -ForegroundColor Cyan
$reportResponse = Invoke-RestMethod -Uri "$baseUrl/sales/report/summary" -Method GET -Headers $headers

Write-Host "  Status:  OK" -ForegroundColor Green
Write-Host "  Report:" -ForegroundColor White
$reportResponse | ConvertTo-Json -Depth 3 | Write-Host -ForegroundColor Gray
Write-Host ""

# ----------------------------------------------------------
# Summary
# ----------------------------------------------------------
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  All tests completed!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Server running at: $baseUrl" -ForegroundColor White
Write-Host "  Store ID:          $storeId" -ForegroundColor White
Write-Host "  Token (owner):     $($token.Substring(0, 30))..." -ForegroundColor White
Write-Host ""
Write-Host "  Postman Collection: $backendPath\Anaqat-Al-Iraq.postman_collection.json" -ForegroundColor White
Write-Host "  Import it in Postman: File > Import > select the file above" -ForegroundColor Gray
Write-Host ""
