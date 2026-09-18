import Constants from 'expo-constants';
import { NativeModules, Platform } from 'react-native';
import i18n from '../i18n';

type GoogleSigninModule = typeof import('@react-native-google-signin/google-signin');

function resolveGoogleWebClientId(): string {
  const fromEnv = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() ?? '';
  if (fromEnv) return fromEnv;

  const fromExtra = Constants.expoConfig?.extra?.googleWebClientId;
  return typeof fromExtra === 'string' ? fromExtra.trim() : '';
}

let configured = false;
let googleModule: GoogleSigninModule | null | undefined;

export function loadGoogleModule(): GoogleSigninModule | null {
  if (googleModule !== undefined) return googleModule;

  // Expo Go / missing native binary — avoid hard crash on import
  if (!NativeModules.RNGoogleSignin) {
    googleModule = null;
    return null;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    googleModule = require('@react-native-google-signin/google-signin') as GoogleSigninModule;
  } catch {
    googleModule = null;
  }
  return googleModule;
}

export function getGoogleWebClientId(): string {
  return resolveGoogleWebClientId();
}

export function isGoogleSignInAvailable(): boolean {
  return Boolean(resolveGoogleWebClientId() && loadGoogleModule());
}

export function isGoogleSignInConfigured(): boolean {
  return isGoogleSignInAvailable();
}

export function configureGoogleSignIn() {
  const mod = loadGoogleModule();
  const clientId = resolveGoogleWebClientId();
  if (!clientId || !mod || configured) return;
  mod.GoogleSignin.configure({
    webClientId: clientId,
    offlineAccess: false,
  });
  configured = true;
}

/** Clears the Google SDK session so the next sign-in shows the account picker. Does not log out of BakiBook. */
export async function signOutGoogleSdk(): Promise<void> {
  const mod = loadGoogleModule();
  if (!mod) return;
  try {
    await mod.GoogleSignin.signOut();
  } catch {
    // Already signed out or native module unavailable.
  }
}

export async function getGoogleIdToken(): Promise<string> {
  const mod = loadGoogleModule();
  const clientId = resolveGoogleWebClientId();
  if (!clientId || !mod) {
    throw new Error(i18n.t('auth.googleNativeBuild'));
  }

  configureGoogleSignIn();

  if (Platform.OS === 'android') {
    await mod.GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  }

  const response = await mod.GoogleSignin.signIn();
  if (response.type === 'cancelled') {
    throw new Error(i18n.t('auth.googleCancelled'));
  }

  const idToken = response.data.idToken ?? (await mod.GoogleSignin.getTokens()).idToken;
  if (!idToken) {
    throw new Error(i18n.t('auth.googleNoToken'));
  }

  return idToken;
}

export function getGoogleSignInErrorMessage(error: unknown): string {
  const mod = loadGoogleModule();
  const codes = mod?.statusCodes;

  if (codes && typeof error === 'object' && error && 'code' in error) {
    const code = String((error as { code: string }).code);
    if (code === codes.SIGN_IN_CANCELLED) return i18n.t('auth.googleCancelled');
    if (code === codes.IN_PROGRESS) return i18n.t('auth.googleInProgress');
    if (code === codes.PLAY_SERVICES_NOT_AVAILABLE) {
      return i18n.t('auth.googlePlayServicesUnavailable');
    }
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return i18n.t('auth.googleTryAgain');
}
