# Deploy BakiBook API + web frontend to Oracle VPS (Windows)
# Usage from repo root:
#   .\deploy\vps\deploy.ps1

param(
  [string]$KeyPath = "C:\Users\Saskrit\Downloads\bakibookkeys\ssh-key-2026-08-23.key",
  [string]$Remote = "ubuntu@130.210.30.18",
  [string]$RemoteDir = "/var/www/bakibook/server",
  [string]$ClientRemoteDir = "/var/www/bakibook/client/dist"
)

$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$serverDir = Join-Path $repoRoot "server"
$clientDir = Join-Path $repoRoot "client"
$zip = Join-Path $env:TEMP "bakibook-server.zip"
$clientZip = Join-Path $env:TEMP "bakibook-client-dist.zip"
$remoteScript = Join-Path $env:TEMP "bakibook-deploy-remote.sh"

$prodClientUrl = "https://bakibook.run.place"
$prodServerUrl = "https://api.bakibook.run.place"
$prodApi = "$prodServerUrl/api"
$prodGoogleWeb = "129286948746-c38ufv6he052pbr9c9l9a0upvr58e5fr.apps.googleusercontent.com"
$prodInvitePassword = if ($env:INVITE_DEFAULT_PASSWORD) {
  $env:INVITE_DEFAULT_PASSWORD.Trim()
} else {
  $mobileEnv = Join-Path $repoRoot "mobile\.env"
  $fromFile = $null
  if (Test-Path $mobileEnv) {
    $fromFile = (Get-Content $mobileEnv | Where-Object { $_ -match '^\s*INVITE_DEFAULT_PASSWORD=(.+)$' } |
      ForEach-Object { $Matches[1].Trim() } | Select-Object -First 1)
  }
  if ($fromFile) { $fromFile } else { "BakiBookBySaskrit" }
}

if (-not (Test-Path $KeyPath)) { throw "SSH key not found: $KeyPath" }
if (-not (Test-Path $serverDir)) { throw "server/ not found" }
if (-not (Test-Path $clientDir)) { throw "client/ not found" }

$sshBase = @("-i", $KeyPath, "-o", "StrictHostKeyChecking=accept-new")

Write-Host "Release env: Frontend=$prodClientUrl"
Write-Host "Release env: API=$prodApi"
Write-Host "Release env: Invite default password=$prodInvitePassword"

Write-Host "==> Building web frontend..."
Push-Location $clientDir
if (-not (Test-Path "node_modules")) {
  npm ci
}
$env:VITE_API_URL = $prodApi
$env:VITE_API_ORIGIN = $prodServerUrl
$env:VITE_GOOGLE_CLIENT_ID = $prodGoogleWeb
npm run build
if (-not (Test-Path "dist\index.html")) { throw "client build failed - dist/index.html missing" }
Pop-Location

Write-Host "==> Packaging server (no node_modules)..."
if (Test-Path $zip) { Remove-Item $zip -Force }
Push-Location $serverDir
tar -a -cf $zip --exclude=node_modules --exclude=uploads --exclude=.env *
Pop-Location

Write-Host "==> Packaging client dist..."
if (Test-Path $clientZip) { Remove-Item $clientZip -Force }
Push-Location (Join-Path $clientDir "dist")
tar -a -cf $clientZip *
Pop-Location

$inviteEscaped = $prodInvitePassword -replace "'", "'\\''"

$remoteBash = @(
  '#!/bin/bash',
  'set -euo pipefail',
  "REMOTE_DIR='$RemoteDir'",
  "CLIENT_DIR='$ClientRemoteDir'",
  "INVITE_DEFAULT_PASSWORD='$inviteEscaped'",
  "CLIENT_URL='$prodClientUrl'",
  "SERVER_URL='$prodServerUrl'",
  'sudo mkdir -p "$REMOTE_DIR" "$CLIENT_DIR" /var/www/bakibook/logs /var/www/bakibook/uploads /var/www/certbot',
  'sudo chown -R ubuntu:ubuntu /var/www/bakibook',
  'sudo find "$REMOTE_DIR" -mindepth 1 -maxdepth 1 ! -name .env -exec rm -rf {} +',
  'sudo find "$CLIENT_DIR" -mindepth 1 -maxdepth 1 -exec rm -rf {} + 2>/dev/null || true',
  'sudo chown -R ubuntu:ubuntu /var/www/bakibook',
  'cd "$REMOTE_DIR"',
  'unzip -qo /tmp/bakibook-server.zip',
  'rm -f /tmp/bakibook-server.zip',
  'unzip -qo /tmp/bakibook-client-dist.zip -d "$CLIENT_DIR"',
  'rm -f /tmp/bakibook-client-dist.zip',
  'if [ ! -f .env ]; then',
  '  echo "ERROR: missing $REMOTE_DIR/.env - create it from deploy/vps/.env.example"',
  '  exit 1',
  'fi',
  'if grep -q "^INVITE_DEFAULT_PASSWORD=" .env; then',
  '  sed -i "s|^INVITE_DEFAULT_PASSWORD=.*|INVITE_DEFAULT_PASSWORD=$INVITE_DEFAULT_PASSWORD|" .env',
  'else',
  '  echo "INVITE_DEFAULT_PASSWORD=$INVITE_DEFAULT_PASSWORD" >> .env',
  'fi',
  'if grep -q "^CLIENT_URL=" .env; then',
  '  sed -i "s|^CLIENT_URL=.*|CLIENT_URL=$CLIENT_URL|" .env',
  'else',
  '  echo "CLIENT_URL=$CLIENT_URL" >> .env',
  'fi',
  'if grep -q "^SERVER_URL=" .env; then',
  '  sed -i "s|^SERVER_URL=.*|SERVER_URL=$SERVER_URL|" .env',
  'else',
  '  echo "SERVER_URL=$SERVER_URL" >> .env',
  'fi',
  'sed -i "s/\\r$//" .env',
  'echo "Release env: Frontend=$CLIENT_URL"',
  'echo "Release env: API=$SERVER_URL/api"',
  'echo "Release env: Invite default password=$INVITE_DEFAULT_PASSWORD"',
  'npm ci --omit=dev',
  'if pm2 describe bakibook-api >/dev/null 2>&1; then',
  '  pm2 restart bakibook-api --update-env',
  'else',
  '  pm2 start /var/www/bakibook/ecosystem.config.cjs',
  'fi',
  'pm2 save',
  'for f in "$HOME/setup-ssl.sh" "$HOME/nginx-bakibook.conf" "$HOME/nginx-bakibook-http.conf" "$HOME/nginx-bakibook-api-locations.conf" "$HOME/nginx-bakibook-frontend-locations.conf"; do',
  '  if [ -f "$f" ]; then sed -i "s/\\r$//" "$f"; fi',
  'done',
  'if [ -f "$HOME/setup-ssl.sh" ]; then',
  '  bash "$HOME/setup-ssl.sh" || exit 1',
  'fi',
  'sleep 2',
  'curl -sS http://127.0.0.1:5001/api/health',
  'echo',
  'curl -sS "$SERVER_URL/api/health" || echo "WARN: API HTTPS health check failed"',
  'curl -sS -o /dev/null -w "Frontend HTTP %{http_code}\n" "$CLIENT_URL/" || echo "WARN: Frontend check failed"'
) -join "`n"
[System.IO.File]::WriteAllText($remoteScript, $remoteBash)

Write-Host "==> Uploading packages + deploy script..."
& scp @sshBase $zip "${Remote}:/tmp/bakibook-server.zip"
& scp @sshBase $clientZip "${Remote}:/tmp/bakibook-client-dist.zip"
& scp @sshBase (Join-Path $PSScriptRoot "ecosystem.config.cjs") "${Remote}:/var/www/bakibook/ecosystem.config.cjs"
& scp @sshBase (Join-Path $PSScriptRoot "nginx-bakibook.conf") "${Remote}:~/nginx-bakibook.conf"
& scp @sshBase (Join-Path $PSScriptRoot "nginx-bakibook-http.conf") "${Remote}:~/nginx-bakibook-http.conf"
& scp @sshBase (Join-Path $PSScriptRoot "nginx-bakibook-api-locations.conf") "${Remote}:~/nginx-bakibook-api-locations.conf"
& scp @sshBase (Join-Path $PSScriptRoot "nginx-bakibook-frontend-locations.conf") "${Remote}:~/nginx-bakibook-frontend-locations.conf"
& scp @sshBase (Join-Path $PSScriptRoot "setup-ssl.sh") "${Remote}:~/setup-ssl.sh"
& scp @sshBase $remoteScript "${Remote}:/tmp/bakibook-deploy-remote.sh"

Write-Host "==> Install + restart PM2 + SSL + frontend..."
& ssh @sshBase $Remote "chmod +x ~/setup-ssl.sh && bash /tmp/bakibook-deploy-remote.sh && rm -f /tmp/bakibook-deploy-remote.sh"

Remove-Item $zip -Force -ErrorAction SilentlyContinue
Remove-Item $clientZip -Force -ErrorAction SilentlyContinue
Remove-Item $remoteScript -Force -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "==> DNS check (frontend must point at VPS, not Render/Cloudflare origin)"
$vpsIp = ($Remote -split '@')[-1]
try {
  $dns = Resolve-DnsName "bakibook.run.place" -Type A -ErrorAction Stop
  $frontendIps = @($dns | ForEach-Object { $_.IPAddress } | Where-Object { $_ })
  $apiDns = Resolve-DnsName "api.bakibook.run.place" -Type A -ErrorAction Stop
  $apiIps = @($apiDns | ForEach-Object { $_.IPAddress } | Where-Object { $_ })
  Write-Host "    bakibook.run.place     -> $($frontendIps -join ', ')"
  Write-Host "    api.bakibook.run.place -> $($apiIps -join ', ')"
  Write-Host "    VPS IP                 -> $vpsIp"
  if ($frontendIps -notcontains $vpsIp) {
    Write-Host ""
    Write-Host "WARNING: bakibook.run.place does NOT point to the VPS." -ForegroundColor Yellow
    Write-Host "         The public site may still show an OLD Render build (no admin pagination/ban/verify UI)." -ForegroundColor Yellow
    Write-Host "         Fix DNS at your registrar (run.place / Cloudflare):" -ForegroundColor Yellow
    Write-Host "           A  bakibook.run.place      -> $vpsIp" -ForegroundColor Yellow
    Write-Host "           A  www.bakibook.run.place  -> $vpsIp" -ForegroundColor Yellow
    Write-Host "         Then remove or disable the old Render web service." -ForegroundColor Yellow
    Write-Host ""
  } else {
    Write-Host "    Frontend DNS OK." -ForegroundColor Green
  }
} catch {
  Write-Host "    Could not resolve DNS (check manually)." -ForegroundColor Yellow
}

Write-Host "==> Deploy finished."
Write-Host "    Frontend: $prodClientUrl"
Write-Host "    API:      $prodApi/health"
Write-Host "    Rebuild the mobile APK so it uses $prodApi"
Write-Host "Release env: Invite default password=$prodInvitePassword"
