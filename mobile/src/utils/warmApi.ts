import { API_BASE_URL } from '../config/api';
import { configureGoogleSignIn, isGoogleSignInAvailable } from './googleSignIn';

let warmed = false;

/** Wake Render / pre-configure Google Sign-In so auth feels faster. */
export function warmAuthServices() {
  if (warmed) return;
  warmed = true;

  if (isGoogleSignInAvailable()) {
    configureGoogleSignIn();
  }

  if (!API_BASE_URL) return;

  const origin = API_BASE_URL.replace(/\/api\/?$/, '');
  fetch(`${origin}/api/health`, { method: 'GET' }).catch(() => {
    warmed = false;
  });
}
