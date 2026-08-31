# BakiBook (Android App)

**Digital credit management (baki khata) for local shops in Nepal** — Android app for shopkeepers and customers, backed by a Node.js API.

This repository is **app-only**: `mobile/` (APK) + `server/` (API). The web client is **not included** — shopkeepers and customers use the Android app.

| | |
|--|--|
| **Android package** | `com.bakibook.app` |
| **Production API** | `https://api.bakibook.run.place/api` |
| **Developer** | Saskrit Bhattarai |

---

## What you deploy

```
┌─────────────────┐         HTTPS          ┌─────────────────┐
│  BakiBook APK   │  ──────────────────►  │  server/ (API)  │
│  mobile/        │      /api, socket.io   │  MongoDB Atlas  │
└─────────────────┘                        └─────────────────┘
```

1. **Deploy `server/`** to a VPS / cloud host (HTTPS required for release APK).
2. **Build `mobile/`** → install APK or publish to Google Play.
3. Point the app at your API URL (`EXPO_PUBLIC_API_URL`).

---

## Repository structure

```
BakiBook/
├── mobile/          # Android app (React Native + Expo) → APK / Play Store
├── server/          # Node.js API (required for the app)
├── deploy/          # API deployment guides (VPS, Railway, Render)
└── package.json     # Helper scripts
```

---

## Tech stack

| Part | Stack |
|------|--------|
| **App** | React Native, Expo 56, TypeScript, Socket.IO, FCM, English + Nepali |
| **API** | Node.js, Express, MongoDB, JWT, Google OAuth, Cloudinary |

---

## Prerequisites

| Tool | Notes |
|------|--------|
| **Node.js 22.13+** | Required for `mobile/` |
| **JDK 17** | Local APK builds |
| **Android SDK** | API 34+ |
| **MongoDB Atlas** | Database for API |
| **HTTPS API** | Release APK cannot use `localhost` |

---

## Setup (local development)

```bash
git clone https://github.com/Saskrit/BakiBookApk.git
cd BakiBookApk

# Install API + app dependencies
npm run install:all

# API
cp server/.env.example server/.env
# Edit server/.env (MongoDB, JWT, email, Cloudinary, Google OAuth)

# Mobile
cp mobile/.env.example mobile/.env
cp mobile/google-services.json.example mobile/google-services.json
# Edit mobile/.env + google-services.json
```

### Run API + app together

```bash
# Terminal 1 — API
npm run dev

# Terminal 2 — Expo
npm run dev:mobile
```

Or one command:

```bash
npm run dev:app
```

### Mobile API URL (`mobile/.env`)

| Use case | `EXPO_PUBLIC_API_URL` |
|----------|------------------------|
| **Production / release APK** | `https://api.bakibook.run.place/api` |
| Android emulator | `http://10.0.2.2:5001/api` |
| Phone on same Wi‑Fi | `http://<PC_LAN_IP>:5001/api` |

---

## Deploy the API (backend)

The app **must** talk to a live HTTPS API before you ship the APK.

**Recommended:** [deploy/vps/DEPLOY_VPS.md](deploy/vps/DEPLOY_VPS.md) — Oracle / Ubuntu VPS + nginx + PM2.

Other guides:

- [deploy/railway/DEPLOY_RAILWAY.md](deploy/railway/DEPLOY_RAILWAY.md)
- [deploy/render/DEPLOY_RENDER.md](deploy/render/DEPLOY_RENDER.md)

After deploy, verify:

```http
GET https://your-api-domain/api/health
```

Set in `server/.env` on the server:

- `SERVER_URL=https://api.yourdomain.com`
- `CLIENT_URL=https://yourdomain.com` (used in email links; can be a landing page)

The API runs in **API-only mode** when no web build is present — this is normal for app-only deployment.

---

## Build the Android APK

### Local release APK (sideload / test)

```powershell
cd mobile
npm install
npm run build:apk:local
```

Output: `mobile/dist/BakiBook.apk`

```powershell
adb install -r mobile/dist/BakiBook.apk
```

### EAS cloud build (share / Play Store)

```powershell
cd mobile
npx eas login
npm run build:android:preview    # internal .apk
npm run build:android            # production .aab for Play Store
```

See [mobile/GOOGLE_PLAY.md](mobile/GOOGLE_PLAY.md) for Play Store steps.

Set in `mobile/eas.json` or EAS secrets:

- `EXPO_PUBLIC_API_URL` → your HTTPS API
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` → same as server `GOOGLE_CLIENT_ID`

---

## App features

### Shopkeeper

- Dashboard, customers, credit, payments, QR scan
- **Payment submissions** — review customer screenshots (accept / reject / report)
- Reports & PDF, expenses, backup, shop verification, team roles
- Push notifications & real-time sync

### Customer

- Link shop invitations (view shop & credit before accept/decline)
- Due balance, ledger, submit payment with screenshot
- Notifications, profile, Google sign-in

---

## Secrets (never commit)

| File | Purpose |
|------|---------|
| `server/.env` | MongoDB, JWT, email, Cloudinary |
| `mobile/.env` | API URL, Google client ID |
| `mobile/google-services.json` | Firebase (copy from `.example`) |
| `server/firebase-service-account.json` | FCM server |
| `mobile/google-play-service-account.json` | Play Store upload |

---

## Push to GitHub (app-only)

Repo: **[github.com/Saskrit/BakiBookApk](https://github.com/Saskrit/BakiBookApk)**

This project ignores the web client (`client/`) and build artifacts (`*.apk`). You push **mobile + server + deploy docs** only.

```powershell
cd C:\Users\Saskrit\Downloads\BakiBookAppOG\BakiBookApp

# Point at the NEW repo (not BakiBookApp)
git remote set-url origin https://github.com/Saskrit/BakiBookApk.git
git remote -v

# Remove web client from git (files stay on your PC)
git rm -r --cached client/

# Remove deleted AI junk if still tracked
git rm --cached mobile/CLAUDE.md mobile/AGENTS.md 2>$null

git add -A
git status
# Expect: mobile/, server/, deploy/, README.md, package.json
# NOT: client/, *.apk, google-services.json, .env

git commit -m "App-only: Android app + API backend"
git push -u origin main
```

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run install:all` | Install root + server + mobile |
| `npm run dev` | Start API only |
| `npm run dev:mobile` | Start Expo |
| `npm run dev:app` | API + Expo together |
| `npm run start` | Production API (`NODE_ENV=production`) |
| `npm run build:apk:local` | Local release APK |
| `npm run build:android` | EAS AAB (Play Store) |
| `npm run build:android:preview` | EAS preview APK |

---

## Demo accounts

```bash
npm run seed --prefix server -- --force
```

| Role | Email | Password |
|------|-------|----------|
| Shopkeeper | `shopkeeper@bakibook.demo` | `Demo@123` |
| Customer | `ram@email.com` | `Demo@123` |

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| APK network error | Use HTTPS production API in `eas.json` / `.env` |
| API works, app cannot login | Match `EXPO_PUBLIC_API_URL` to deployed API |
| Gradle / JDK error | Install JDK 17, set `JAVA_HOME` |
| Google Sign-In fails | Same Web Client ID in server + mobile + EAS |
| Screenshots not loading | Set `SERVER_URL` + Cloudinary on API |

---

## Author

**Saskrit Bhattarai** — BakiBook Digital Credit Management System

---

## More docs

- [mobile/README.md](mobile/README.md)
- [mobile/GOOGLE_PLAY.md](mobile/GOOGLE_PLAY.md)
- [mobile/GOOGLE_SIGNIN.md](mobile/GOOGLE_SIGNIN.md)
- [deploy/vps/DEPLOY_VPS.md](deploy/vps/DEPLOY_VPS.md)
