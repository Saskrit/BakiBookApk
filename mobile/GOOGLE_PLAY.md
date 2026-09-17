# Publish BakiBook to Google Play (Android)

This guide takes you from a local Expo project to a **signed AAB** on Google Play.

## Before you start

You need these **before** building for production:

| Requirement | Why |
|-------------|-----|
| **Production API on HTTPS** | Play Store apps cannot use `localhost`. Deploy `server/` (Railway, Render, VPS, etc.) and use e.g. `https://api.bakibook.com` |
| **Google Play Developer account** | [play.google.com/console](https://play.google.com/console) — one-time **$25** fee |
| **Expo account** | Free at [expo.dev](https://expo.dev) |
| **Privacy policy URL** | Required by Google — host your terms at e.g. `https://yourdomain.com/legal/data-policy` |

Update `eas.json` → replace `https://YOUR_PRODUCTION_API_HOST/api` with your real API URL in both `preview` and `production` profiles.

---

## Step 1 — Deploy the backend

### Railway (recommended)

Full guide: **[deploy/railway/DEPLOY_RAILWAY.md](../deploy/railway/DEPLOY_RAILWAY.md)**

Quick steps:

1. [railway.app/new](https://railway.app/new) → deploy from GitHub
2. Set **Root Directory** to `server`
3. Add variables from `deploy/railway/railway.env.example`
4. **Networking** → Generate domain → e.g. `https://bakibook-production.up.railway.app`
5. Set `SERVER_URL` and `CLIENT_URL` to that URL, redeploy
6. Verify: `https://YOUR-DOMAIN.up.railway.app/api/health`

**Mobile API URL:**
```
https://YOUR-DOMAIN.up.railway.app/api
```

Other options: Render, VPS, etc. — API must be **HTTPS** for Play Store.

---

## Step 2 — One-time Expo / EAS setup

From the `mobile/` folder:

```bash
npm install
npx eas login
npx eas init
```

`eas init` links the app to Expo and writes a real `projectId` into your Expo project.

Set the production API as an EAS secret (recommended over committing URLs):

```bash
npx eas secret:create --scope project --name EXPO_PUBLIC_API_URL --value "https://api.bakibook.com/api"
```

If you use secrets, remove the `env` block from the `production` profile in `eas.json` (secrets override at build time).

---

## Step 3 — Build the Android App Bundle (AAB)

Google Play requires **AAB**, not APK, for new apps.

```bash
cd mobile
npx eas build --platform android --profile production
```

- EAS builds in the cloud (no Android Studio required on your PC).
- Signing keystore is created and stored by Expo automatically on first build.
- When finished, download the `.aab` from the link in the terminal or [expo.dev](https://expo.dev).

**Test install before Play Store (optional):**

```bash
npx eas build --platform android --profile preview
```

`preview` produces an APK you can sideload on a test device.

---

## Step 4 — Create the app in Google Play Console

1. Open [Google Play Console](https://play.google.com/console).
2. **Create app** → name: **BakiBook**
3. Package name must match: **`com.bakibook.app`** (already set in `app.config.ts`).
4. Complete **App content** sections:
   - Privacy policy URL
   - App access (login required — explain demo or production accounts)
   - Ads (No, unless you add ads)
   - Content rating questionnaire
   - Target audience
   - Data safety form (account info, financial data, etc.)

---

## Step 5 — Store listing assets

Prepare:

| Asset | Spec |
|-------|------|
| App icon | 512×512 PNG (use `assets/icon.png` as base) |
| Feature graphic | 1024×500 PNG |
| Phone screenshots | At least 2, min 320px short side |
| Short description | Max 80 characters |
| Full description | Max 4000 characters |

**Suggested short description:**
> Digital baki khata for Nepali shops — track dues, credit, and payments.

---

## Step 6 — Upload the AAB

### Option A — Manual upload

1. Play Console → **Release** → **Production** (or **Internal testing** first).
2. **Create new release** → Upload the `.aab` from EAS.
3. Add release notes → **Review release** → **Start rollout**.

Start with **Internal testing** to verify login, customers, and payments before production.

### Option B — EAS Submit (automated)

1. In Google Play Console → **Setup** → **API access** → link a Google Cloud project.
2. Create a **service account** with Play Console permissions.
3. Download JSON key → save as `mobile/google-play-service-account.json` (gitignored).
4. Run:

```bash
npx eas submit --platform android --profile production --latest
```

---

## Step 7 — Version updates

For each new release:

1. Bump `version` in `app.config.ts` (e.g. `1.0.0` → `1.0.1`).
2. `versionCode` auto-increments via EAS (`autoIncrement: true`).
3. Rebuild and submit:

```bash
npx eas build --platform android --profile production
npx eas submit --platform android --profile production --latest
```

---

## Quick command reference

| Command | Purpose |
|---------|---------|
| `npm run build:android` | Production AAB build (EAS Cloud - recommended) |
| `npm run build:aab:local` | Production AAB build (Local machine via Gradle) |
| `npm run build:android:preview` | Test APK (EAS Cloud) |
| `npm run build:apk:local` | Test APK (Local machine) |
| `npm run submit:android` | Upload latest AAB to Play Console |

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Network request failed in release build | Set `EXPO_PUBLIC_API_URL` to HTTPS production API |
| Package name already taken | Change `android.package` in `app.config.ts` (must be unique globally) |
| Build fails on Expo | Run `npx eas build --platform android --profile production --clear-cache` |
| Google rejects cleartext HTTP | Use HTTPS only for production API |
| Login works in dev, not release | API URL wrong or backend not reachable from internet |

---

## Checklist before first submission

- [ ] Backend deployed with HTTPS
- [ ] `EXPO_PUBLIC_API_URL` points to production API
- [ ] `eas.json` updated (or EAS secret set)
- [ ] `npx eas init` completed
- [ ] Production AAB built successfully
- [ ] Tested on real device (internal track)
- [ ] Privacy policy URL live
- [ ] Data safety form completed
- [ ] Store listing + screenshots uploaded
