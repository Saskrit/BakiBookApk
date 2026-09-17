# APK download page — download.bakibook.run.place

Serve a modern “download started / retry” page and host the latest BakiBook APK on your existing VPS (same server as [bakibook.run.place](https://bakibook.run.place/)).

## Deploy with your usual script (recommended)

From repo root:

```powershell
# 1. Build APK (once per release)
npm run build:apk:local

# 2. Deploy everything (API + web + download page + APK)
.\deploy\vps\deploy.ps1
```

`deploy.ps1` automatically:

- Uploads `deploy/download/index.html`
- Uploads `mobile/dist/BakiBook.apk` → `/var/www/bakibook/download/apk/bakibook-latest.apk`
- Updates nginx + SSL for `download.bakibook.run.place`

Custom APK path:

```powershell
.\deploy\vps\deploy.ps1 -ApkPath "C:\path\to\BakiBook.apk"
```

If no APK exists locally, deploy still works (download page only; you'll see a warning).

---

## What you get

| URL | Behavior |
|-----|----------|
| `http://download.bakibook.run.place/` | Landing page + auto-starts APK download |
| `https://download.bakibook.run.place/` | Same, with HTTPS (recommended) |
| `…/apk/bakibook-latest.apk` | Direct APK file |

The page shows **“Download started”** with a **Download APK** retry button if the browser blocks auto-download (common on Chrome).

---

## 1. DNS

At your domain provider (run.place), add:

| Host | Type | Value |
|------|------|-------|
| `download` | A | Your VPS IP (same as `bakibook.run.place`, e.g. `130.210.30.18`) |

Wait a few minutes for propagation. `deploy.ps1` checks this DNS record after deploy.

---

## Manual upload (optional)

If you only need to refresh the APK without a full deploy:

```bash
sudo cp BakiBook-release.apk /var/www/bakibook/download/apk/bakibook-latest.apk
```

---

## SSL

Included automatically when you run `.\deploy\vps\deploy.ps1` (via `setup-ssl.sh`).

Manual expand only if needed:

```bash
sudo certbot certonly --webroot -w /var/www/certbot \
  -d bakibook.run.place -d www.bakibook.run.place \
  -d api.bakibook.run.place -d download.bakibook.run.place \
  --expand
sudo nginx -t && sudo systemctl reload nginx
```

---

## Update APK after each release

```powershell
npm run build:apk:local
.\deploy\vps\deploy.ps1
```

Or on the VPS only:

```bash
sudo cp BakiBook-release.apk /var/www/bakibook/download/apk/bakibook-latest.apk
```

Optional: keep versioned files too:

```bash
sudo cp BakiBook-1.2.0.apk /var/www/bakibook/download/apk/bakibook-1.2.0.apk
ln -sf bakibook-1.2.0.apk /var/www/bakibook/download/apk/bakibook-latest.apk
```

---

## Notes

- **Auto-download:** Browsers may block silent downloads; the page always shows a manual **Download APK** button as fallback.
- **HTTP vs HTTPS:** Both work. Prefer sharing `https://download.bakibook.run.place/` publicly.
- **Play Store:** For wide distribution, Play Store is still best; this subdomain is ideal for direct APK links (QR codes, WhatsApp, flyers).
- **File size:** `client_max_body_size` is set to 100m for large APKs.

## Test

```bash
curl -I http://download.bakibook.run.place/health
curl -I http://download.bakibook.run.place/apk/bakibook-latest.apk
```

You should see `200` and `Content-Disposition: attachment` on the APK URL.
