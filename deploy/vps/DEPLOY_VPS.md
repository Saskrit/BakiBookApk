# BakiBook API — Oracle Cloud Ubuntu VPS

Long-lived production API on your VM (`ubuntu@YOUR_IP`), with:

- **Node 20** + **PM2** (auto-restart, boot start)
- **Nginx** reverse proxy on port 80 → Node `:5001`
- **MongoDB Atlas** (same cluster; allow the VPS public IP)
- Optional later: domain + Let's Encrypt HTTPS

---

## Prerequisites

1. SSH access (your key works)
2. **Oracle Cloud Networking (required for public access)**  
   Open **ingress** on the VCN Security List / NSG attached to the instance:
   - Source: `0.0.0.0/0`
   - Protocol: TCP
   - Destination ports: **80**, **443** (and keep **22** for SSH)  
   Without this, the API works on the VM but times out from the internet.
3. MongoDB Atlas → Network Access → add VPS public IP `130.210.30.18` (or `0.0.0.0/0`)  
   **Speed tip:** Create/move the Atlas cluster to the **same region as the Oracle VM** (e.g. both Mumbai / Singapore). If Atlas is in the US while the VM is in Asia, every API call pays 100–300ms+ just for the database round-trip — that feels slow even though Oracle itself is fine.
4. **DNS** — A records → `130.210.30.18`:
   - `bakibook.run.place` (frontend)
   - `api.bakibook.run.place` (API backend)
   - `download.bakibook.run.place` (APK download page)

   **Important:** If `bakibook.run.place` still points at **Render** or **Cloudflare → Render**, visitors get an **old** web build (no admin pagination, shop review modal, ban/suspend). The API subdomain may already be correct on the VPS — only the **frontend hostname** must be fixed.

   After changing DNS, disable/delete the old **Render** static site for BakiBook.

---

## Troubleshooting: admin UI missing after deploy

Symptoms: no pagination, no ban/suspend, no shop verification modal on https://bakibook.run.place

1. Run deploy — VPS should have the latest files:
   ```powershell
   .\deploy\vps\deploy.ps1
   ```
   The script prints a **DNS check**. If `bakibook.run.place` is not `130.210.30.18`, fix DNS first.

2. Confirm what the public site serves:
   ```powershell
   curl.exe -sSI https://bakibook.run.place/ | findstr /i "server cf- x-render"
   ```
   - `x-render-origin-server: Render` → frontend still on **Render** (wrong)
   - Should hit **nginx** on the VPS after DNS fix

3. Set DNS A records (at run.place / Cloudflare):
   | Host | Type | Value |
   |------|------|-------|
   | `bakibook.run.place` | A | `130.210.30.18` |
   | `www.bakibook.run.place` | A | `130.210.30.18` |
   | `api.bakibook.run.place` | A | `130.210.30.18` |
   | `download.bakibook.run.place` | A | `130.210.30.18` |
   | `download.bakibook.run.place` | A | `130.210.30.18` |

4. Hard-refresh the browser (`Ctrl+Shift+R`) after DNS propagates.

---

## Architecture

| URL | Role |
|-----|------|
| http(s)://bakibook.run.place | React web app (frontend); also proxies `/api`, `/socket.io`, `/uploads` |
| https://api.bakibook.run.place/api | Node API (backend, primary for mobile) |
| https://download.bakibook.run.place | APK download page + `bakibook-latest.apk` |

Verification emails link to `http://bakibook.run.place/verify?token=...`

---

## One-time server setup

From your PC (PowerShell):

```powershell
cd C:\Users\Saskrit\Downloads\BakiBookAppOG\BakiBookApp

# Upload scripts
scp -i "C:\Users\Saskrit\Downloads\bakibookkeys\ssh-key-2026-08-23.key" `
  deploy/vps/setup-server.sh deploy/vps/nginx-bakibook.conf deploy/vps/ecosystem.config.cjs `
  ubuntu@130.210.30.18:~/

ssh -i "C:\Users\Saskrit\Downloads\bakibookkeys\ssh-key-2026-08-23.key" ubuntu@130.210.30.18
```

On the VPS:

```bash
chmod +x ~/setup-server.sh
./setup-server.sh
```

---

## Deploy / update (API + frontend)

From your PC (repo root):

```powershell
.\deploy\vps\deploy.ps1
```

Builds the React client, uploads `client/dist` + server code, updates nginx + SSL, restarts PM2.

---

Or manually:

```powershell
# Sync server code (excludes node_modules / .env)
rsync -avz --delete -e "ssh -i C:\Users\Saskrit\Downloads\bakibookkeys\ssh-key-2026-08-23.key" `
  --exclude node_modules --exclude .env --exclude uploads `
  ./server/ ubuntu@130.210.30.18:/var/www/bakibook/server/
```

Then on the VPS:

```bash
cd /var/www/bakibook/server
npm ci --omit=dev
pm2 restart bakibook-api
pm2 save

# After nginx config changes (e.g. /verify email links):
sudo cp ~/nginx-bakibook.conf /etc/nginx/sites-available/bakibook
sudo nginx -t && sudo systemctl reload nginx
```

First time only: create `/var/www/bakibook/server/.env` (see `.env.example`).

---

## Verify

```bash
curl http://127.0.0.1:5001/api/health
curl https://api.bakibook.run.place/api/health
curl -I https://bakibook.run.place/
```

Expect API `"status":"ok"` and frontend HTTP 200.

---

## HTTPS (Let's Encrypt)

`deploy.ps1` runs `setup-ssl.sh` automatically (covers **both** hostnames). Needs `EMAIL_USER` in VPS `.env`.

After success:
- https://bakibook.run.place — web app
- https://api.bakibook.run.place/api/health — API

---

## Point the mobile app at this API

In `mobile/.env`:

```
EXPO_PUBLIC_API_URL=https://api.bakibook.run.place/api
```

Then rebuild the APK.

---

## After API deploy (mobile)

```powershell
cd mobile
.\scripts\build-apk-local.ps1
```

Ensure `EXPO_PUBLIC_API_URL` points at `https://api.bakibook.run.place/api`.

---

## Useful PM2 commands

```bash
pm2 status
pm2 logs bakibook-api
pm2 restart bakibook-api
```
