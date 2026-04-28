# PowerShell script to generate required secrets for .env.local
# Usage: .\scripts\generate-secrets.ps1

Write-Host "🔐 Generating secrets for Lumigift..." -ForegroundColor Cyan
Write-Host ""

# Function to generate random base64 string
function New-RandomSecret {
    $bytes = New-Object byte[] 32
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $rng.GetBytes($bytes)
    $rng.Dispose()
    return [Convert]::ToBase64String($bytes)
}

# Generate NEXTAUTH_SECRET
$NEXTAUTH_SECRET = New-RandomSecret
Write-Host "NEXTAUTH_SECRET=$NEXTAUTH_SECRET" -ForegroundColor Green
Write-Host ""

# Generate CRON_SECRET
$CRON_SECRET = New-RandomSecret
Write-Host "CRON_SECRET=$CRON_SECRET" -ForegroundColor Green
Write-Host ""

Write-Host "✅ Secrets generated successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Copy these values to your .env.local file" -ForegroundColor Yellow
Write-Host ""
Write-Host "💡 Tip: You can also generate secrets using:" -ForegroundColor Cyan
Write-Host "   openssl rand -base64 32" -ForegroundColor Gray
