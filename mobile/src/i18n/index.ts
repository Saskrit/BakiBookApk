import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import ne from './locales/ne.json';
import type { AppLanguage } from '../types';

export const LANGUAGE_STORAGE_KEY = 'bakibook_language';

/** Uses Intl only — avoids requiring native ExpoLocalization in the JS bundle. */
export function detectDeviceLanguage(): AppLanguage {
  try {
    const tag = (Intl.DateTimeFormat().resolvedOptions().locale || 'en').toLowerCase();
    return tag.startsWith('ne') ? 'ne' : 'en';
  } catch {
    return 'en';
  }
}

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    compatibilityJSON: 'v4',
    resources: {
      en: { translation: en },
      ne: { translation: ne },
    },
    lng: detectDeviceLanguage(),
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    returnNull: false,
  });
}

export async function setAppLanguage(lang: AppLanguage) {
  if (i18n.language !== lang) {
    await i18n.changeLanguage(lang);
  }
}

export default i18n;
