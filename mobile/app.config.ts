import type { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() ?? '';

  return {
    ...config,
    name: 'BakiBook',
    slug: 'bakibook',
    scheme: 'bakibook',
    version: '2.1.1',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    // Android-only — no iOS builds or prebuild output
    platforms: ['android'],
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#FAFAFA',
    },
    android: {
      package: 'com.bakibook.app',
      versionCode: 8,
      allowBackup: false,
      usesCleartextTraffic: false,
      googleServicesFile: './google-services.json',
      adaptiveIcon: {
        backgroundColor: '#FAFAFA',
        foregroundImage: './assets/android-icon-foreground.png',
        monochromeImage: './assets/android-icon-monochrome.png',
        backgroundImage: './assets/android-icon-background.png',
      },
      permissions: [
        'CAMERA',
        'READ_MEDIA_IMAGES',
        'READ_MEDIA_VISUAL_USER_SELECTED',
        'READ_EXTERNAL_STORAGE',
        'POST_NOTIFICATIONS',
        'VIBRATE',
      ],
      predictiveBackGestureEnabled: false,
    },
    web: {
      favicon: './assets/favicon.png',
    },
    plugins: [
      'expo-font',
      'expo-image',
      'expo-secure-store',
      './plugins/withBakiBookSecurity.js',
      './plugins/withBakiBookAndroid.js',
      './plugins/withBakiBookFirebase.js',
      [
        'expo-notifications',
        {
          icon: './assets/icon.png',
          color: '#4C5C2D',
          defaultChannel: 'BakiBook alerts',
        },
      ],
      [
        'expo-camera',
        {
          cameraPermission:
            'Allow BakiBook to access your camera to scan QR codes and take photos. / BakiBook लाई QR स्क्यान र फोटो खिच्न क्यामेरा प्रयोग गर्न अनुमति दिनुहोस्।',
        },
      ],
      [
        'expo-image-picker',
        {
          photosPermission:
            'Allow BakiBook to access your photos to update profile and shop images. / प्रोफाइल र पसलका तस्बिर अपडेट गर्न BakiBook लाई फोटो पहुँच दिनुहोस्।',
          cameraPermission:
            'Allow BakiBook to use your camera to take profile and shop photos. / प्रोफाइल र पसलका फोटो खिच्न BakiBook लाई क्यामेरा प्रयोग गर्न अनुमति दिनुहोस्।',
        },
      ],
    ],
    extra: {
      // Always bake a reachable production API; override with EXPO_PUBLIC_API_URL for local backend.
      apiUrl: process.env.EXPO_PUBLIC_API_URL?.trim() || 'https://api.bakibook.run.place/api',
      googleWebClientId: googleWebClientId || undefined,
      developer: 'Saskrit Bhattarai',
      eas: {
        projectId: '2a61e05a-bb22-4d04-9f06-2d7a4bfc5871',
      },
    },
    owner: 'saskreet',
  } as ExpoConfig;
};
