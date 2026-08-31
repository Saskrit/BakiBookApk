import { checkServerStatus, getServerStatus, warmServerDuringSplash } from './serverStatus';
import { configureGoogleSignIn, isGoogleSignInAvailable } from './googleSignIn';

let warmed = false;
let warming: Promise<void> | null = null;

/**
 * Pre-open DNS/TLS to the API and configure Google Sign-In.
 * Fire-and-forget on login/signup screens — splash does the heavy warm-up.
 */
export function warmAuthServices() {
  if (warmed || warming) return;

  warming = (async () => {
    if (isGoogleSignInAvailable()) {
      configureGoogleSignIn();
    }
    const ok = await checkServerStatus({ force: true });
    warmed = ok || getServerStatus() === 'online';
  })()
    .catch(() => {
      warmed = false;
    })
    .finally(() => {
      warming = null;
    });
}

/** Full splash warm-up: keep hitting the API for the splash duration. */
export async function warmAuthDuringSplash(durationMs = 8_000): Promise<boolean> {
  if (isGoogleSignInAvailable()) {
    configureGoogleSignIn();
  }
  const ok = await warmServerDuringSplash(durationMs);
  warmed = ok;
  return ok;
}
