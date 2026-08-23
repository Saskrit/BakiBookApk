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
Debug SHA-1: `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`

## Render

```
GOOGLE_CLIENT_ID=129286948746-c38ufv6he052pbr9c9l9a0upvr58e5fr.apps.googleusercontent.com
VITE_GOOGLE_CLIENT_ID=129286948746-c38ufv6he052pbr9c9l9a0upvr58e5fr.apps.googleusercontent.com
SERVER_URL=https://bakibookapp.onrender.com
CLIENT_URL=https://bakibookapp.onrender.com
```

After changing `VITE_*`, redeploy so the web client rebuilds.

Never commit OAuth **client secrets** to git. Rotate the secret if it was shared.
