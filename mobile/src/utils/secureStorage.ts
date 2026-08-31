import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const SECURE_PREFIX = 'bakibook.secure.';

function secureKey(key: string) {
  return `${SECURE_PREFIX}${key}`;
}

export async function getSecureItem(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(secureKey(key));
  } catch {
    return null;
  }
}

export async function setSecureItem(key: string, value: string): Promise<void> {
  await SecureStore.setItemAsync(secureKey(key), value, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED,
  });
}

export async function deleteSecureItem(key: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(secureKey(key));
  } catch {
    // ignore missing keys
  }
}

/** One-time migration from legacy AsyncStorage token storage. */
export async function migrateLegacyItem(
  legacyKey: string,
  secureKeyName: string
): Promise<string | null> {
  const existing = await getSecureItem(secureKeyName);
  if (existing) return existing;

  const legacy = await AsyncStorage.getItem(legacyKey);
  if (!legacy) return null;

  await setSecureItem(secureKeyName, legacy);
  await AsyncStorage.removeItem(legacyKey);
  return legacy;
}
