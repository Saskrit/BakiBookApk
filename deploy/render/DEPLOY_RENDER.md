# Deploy BakiBook (API + Web) to Render + rebuild Android APK

This deploys **one Render web service** that serves:
- API at `https://bakibookapp.onrender.com/api/...`
- Web app at `https://bakibookapp.onrender.com`
- Admin login at `https://bakibookapp.onrender.com/admin/login`

Then you rebuild the Android APK to use that API URL.

---

## Prerequisites

- GitHub repo with this project pushed
- [Render account](https://dashboard.render.com)
- [MongoDB Atlas](https://www.mongodb.com/atlas) (keep your existing cluster)
- Same secrets you used on Railway (email, Google, Cloudinary, admin)

---

## Step 1 — MongoDB Atlas

Render uses dynamic IPs. In Atlas → **Network Access**:

1. Add `0.0.0.0/0` (Allow from anywhere), or
2. Keep your existing open rule if Railway already used it

---

## Step 2 — Create the Render service

### Option A — Blueprint (recommended)

1. Push this repo to GitHub (includes `render.yaml`)
2. Render → **New** → **Blueprint**
3. Connect the repo
4. Render reads `render.yaml` and creates service `bakibook`
5. Fill in the env vars marked “sync: false” (see Step 3)

### Option B — Manual Web Service

1. Render → **New** → **Web Service**
2. Connect GitHub repo `BakiBookApp`
3. Settings:

| Field | Value |
|-------|--------|
| **Language** | Node |
| **Root Directory** | leave empty (repo root) |
| **Build Command** | `npm run build:render` |
| **Start Command** | `NODE_ENV=production npm start --prefix server` |
| **Instance type** | **Starter** (always-on). Free spins down and breaks mobile/Socket.io. |

4. Add env vars (Step 3) → **Create Web Service**

---

## Step 3 — Environment variables

In Render → your service → **Environment**:

| Variable | Value |
|----------|--------|
| `NODE_ENV` | `production` |
| `MONGODB_URI` | Your Atlas connection string |
| `JWT_SECRET` | Long random string |
| `SERVER_URL` | `https://YOUR-APP.onrender.com` (set after first deploy) |
| `CLIENT_URL` | Same as `SERVER_URL` |
| `GOOGLE_CLIENT_ID` | Web client: `129286948746-c38ufv6he052pbr9c9l9a0upvr58e5fr...` |
| `VITE_GOOGLE_CLIENT_ID` | Same Web client ID (needed so web Google login rebuilds) |
| `CLOUDINARY_URL` | Your Cloudinary URL |
| `EMAIL_USER` | Gmail address |
| `EMAIL_APP_PASSWORD` | Gmail app password |
| `EMAIL_FROM` | `BakiBook <you@gmail.com>` |
| `ADMIN_EMAIL` | Your admin email |
| `ADMIN_PASSWORD` | Your admin password |
| `ADMIN_EMAILS` | Optional comma-separated extras |

Do **not** set `PORT` — Render sets it automatically.

After the first deploy, copy the public URL (e.g. `https://bakibook.onrender.com`), set `SERVER_URL` and `CLIENT_URL`, then **Manual Deploy** again.

---

## Step 4 — Verify

Open:

- Health: `https://YOUR-APP.onrender.com/api/health`
- Web: `https://YOUR-APP.onrender.com`
- Admin: `https://YOUR-APP.onrender.com/admin/login`

---

## Step 5 — Point mobile APK at Render

### 5a — Update build config

In `mobile/eas.json`, set both `preview` and `production`:

```json
"EXPO_PUBLIC_API_URL": "https://YOUR-APP.onrender.com/api"
```

Also for a local release rebuild, temporarily set `mobile/.env`:

```env
EXPO_PUBLIC_API_URL=https://YOUR-APP.onrender.com/api
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=129286948746-c38ufv6he052pbr9c9l9a0upvr58e5fr.apps.googleusercontent.com
```

### 5b — Rebuild APK

From `mobile/`:

```powershell
npm run build:apk:local
```

Or use the short-path release flow that produced:

`mobile/dist/BakiBook.apk`

Install the new APK on your phone (old APK still points at Railway).

---

## Step 6 — Google Sign-In (after Render is live)

See [mobile/GOOGLE_SIGNIN.md](../../mobile/GOOGLE_SIGNIN.md).

On Render set:

```
GOOGLE_CLIENT_ID=129286948746-c38ufv6he052pbr9c9l9a0upvr58e5fr.apps.googleusercontent.com
VITE_GOOGLE_CLIENT_ID=129286948746-c38ufv6he052pbr9c9l9a0upvr58e5fr.apps.googleusercontent.com
```

Android OAuth client (same project `bakibook-236a6`):

- Client ID stays in Google Console only: `129286948746-su2032aap4d8ls0inok569aiv0t76dbp...`
- Package: `com.bakibook.app`
- SHA-1: `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`

Do **not** put the Android Client ID in the app.

---

## Plans note

| Plan | Behavior |
|------|----------|
| **Free** | Sleeps after idle → slow first open, Socket.io flaky |
| **Starter** | Always on — **recommended for mobile APK** |

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Build fails `vite: not found` | Use `npm run build:render` (installs client with `--include=dev`) |
| Site shows only “Backend is connected” | `client/dist` missing — build must run `npm run build --prefix client` |
| App can’t reach API | APK still has old Railway URL — rebuild APK |
| Mongo connection error | Atlas Network Access allows `0.0.0.0/0` |
| Google login fails | Server `GOOGLE_CLIENT_ID` = Web client ID; Android SHA-1 registered |

---

## Checklist

- [ ] Render web service deployed
- [ ] `/api/health` returns ok
- [ ] Website loads at root URL
- [ ] `/admin/login` works
- [ ] `SERVER_URL` / `CLIENT_URL` set to Render URL
- [ ] `eas.json` + rebuild APK with new `/api` URL
- [ ] Test login on phone with new APK
