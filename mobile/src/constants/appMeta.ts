import Constants from 'expo-constants';

export const APP_DEVELOPER =
  (Constants.expoConfig?.extra?.developer as string | undefined)?.trim() || 'Saskrit Bhattarai';
