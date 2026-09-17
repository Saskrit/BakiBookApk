# Google Sign-In (Android + Web + Render)

## Rule

Use **one Google Cloud project** (`bakibook-236a6`) for:

1. **Web** OAuth client → app `webClientId` + server `GOOGLE_CLIENT_ID` + web `VITE_GOOGLE_CLIENT_ID`
2. **Android** OAuth client → package + SHA-1 only (never put this ID in app code)

## Your IDs

| Type | Client ID | Where it goes |
|------|-----------|----------------|
| **Web** | `129286948746-c38ufv6he052pbr9c9l9a0upvr58e5fr.apps.googleusercontent.com` | `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, Render `GOOGLE_CLIENT_ID`, `VITE_GOOGLE_CLIENT_ID` |
| **Android** | `129286948746-su2032aap4d8ls0inok569aiv0t76dbp.apps.googleusercontent.com` | Google Cloud Console only |

Package: `com.bakibook.app`

### Required SHA-1 Fingerprints in Firebase / Google Cloud Console

Add **all** applicable SHA-1 fingerprints under Firebase Console → Project Settings → Android App (`com.bakibook.app`):

1. **Local APK / Debug Keystore** (used by `build-apk-local.ps1` & dev builds):
   - SHA-1: `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`
   - SHA-256: `FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C`

2. **Release Keystore** (used by `build-aab-local.ps1` / `credentials/bakibook-release.keystore`):
   - SHA-1: `BB:CC:9E:70:18:6B:BD:B2:DA:ED:D2:AA:99:97:48:0B:07:E8:D3:31`
   - SHA-256: `36:80:EC:6E:6F:9F:02:02:C2:6D:6E:C9:35:F6:56:99:CF:B9:B2:49:90:29:03:64:52:EC:6A:E4:68:19:50:2A`

3. **Google Play App Signing** (from Google Play Console → Setup → App integrity):
   - Keep your Google Play App Signing SHA-1 (e.g. `76:41:53:00:D6:CC:C0:3B:66:47:B6:A0:C3:6E:06:FB:79:2C:2F:14`)

## Render

```
GOOGLE_CLIENT_ID=129286948746-c38ufv6he052pbr9c9l9a0upvr58e5fr.apps.googleusercontent.com
VITE_GOOGLE_CLIENT_ID=129286948746-c38ufv6he052pbr9c9l9a0upvr58e5fr.apps.googleusercontent.com
SERVER_URL=https://bakibookapp.onrender.com
CLIENT_URL=https://bakibookapp.onrender.com
```

After changing `VITE_*`, redeploy so the web client rebuilds.

Never commit OAuth **client secrets** to git. Rotate the secret if it was shared.
