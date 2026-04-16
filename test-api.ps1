$baseUrl = "http://localhost:3000/api/v1"
$storeId = "3693de79-5ad2-4e50-aad3-f0ceb87780ef"

Write-Host ""
Write-Host "=============================" -ForegroundColor Cyan
Write-Host "  Anaqat Al-Iraq API Test" -ForegroundColor Cyan
Write-Host "=============================" -ForegroundColor Cyan

# --- Test 1: Login ---
Write-Host "`n--- REQUEST 1: POST /auth/login ---" -ForegroundColor Yellow
$loginBody = @{ username = "owner"; password = "demo123" } | ConvertTo-Json
try {
    $login = Invoke-WebRequest -Uri "$baseUrl/auth/login?storeId=$storeId" `
        -Method POST -ContentType "application/json" -Body $loginBody
    Write-Host "Status: $($login.StatusCode)" -ForegroundColor Green
    $loginJson = $login.Content | ConvertFrom-Json
    Write-Host "Response:" -ForegroundColor White
    $login.Content | ConvertFrom-Json | ConvertTo-Json -Depth 3
    $token = $loginJson.access_token
    Write-Host "`nToken saved!" -ForegroundColor Green
} catch {
    Write-Host "FAILED: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# --- Test 2: Get Inventory ---
Write-Host "`n--- REQUEST 2: GET /inventory/items ---" -ForegroundColor Yellow
$headers = @{ Authorization = "Bearer $token" }
try {
    $items = Invoke-WebRequest -Uri "$baseUrl/inventory/items" -Method GET -Headers $headers
    Write-Host "Status: $($items.StatusCode)" -ForegroundColor Green
    Write-Host "Response:" -ForegroundColor White
    $items.Content | ConvertFrom-Json | ConvertTo-Json -Depth 5
} catch {
    Write-Host "FAILED: $($_.Exception.Message)" -ForegroundColor Red
}

# --- Test 3: Sales Report ---
Write-Host "`n--- REQUEST 3: GET /sales/report/summary ---" -ForegroundColor Yellow
try {
    $report = Invoke-WebRequest -Uri "$baseUrl/sales/report/summary" -Method GET -Headers $headers
    Write-Host "Status: $($report.StatusCode)" -ForegroundColor Green
    Write-Host "Response:" -ForegroundColor White
    $report.Content | ConvertFrom-Json | ConvertTo-Json -Depth 3
} catch {
    Write-Host "FAILED: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=============================" -ForegroundColor Cyan
Write-Host "  Done!" -ForegroundColor Green
Write-Host "=============================" -ForegroundColor Cyan
