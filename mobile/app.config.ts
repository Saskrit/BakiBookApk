import type { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() ?? '';

  return {
    ...config,
    name: 'BakiBook',
    slug: 'bakibook',
    scheme: 'bakibook',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    // Android-only — no iOS builds or prebuild output
    platforms: ['android'],
    splash: {
      image: './assets/icon.png',
      resizeMode: 'contain',
      backgroundColor: '#4C5C2D',
    },
    android: {
      package: 'com.bakibook.app',
      adaptiveIcon: {
        backgroundColor: '#4C5C2D',
        foregroundImage: './assets/icon.png',
        monochromeImage: './assets/android-icon-monochrome.png',
      },
      permissions: ['CAMERA'],
      predictiveBackGestureEnabled: false,
    },
    web: {
      favicon: './assets/favicon.png',
    },
    plugins: [
      './plugins/withBakiBookAndroid.js',
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
      apiUrl: process.env.EXPO_PUBLIC_API_URL,
      googleWebClientId: googleWebClientId || undefined,
      eas: {
        projectId: '2a61e05a-bb22-4d04-9f06-2d7a4bfc5871',
      },
    },
    owner: 'saskreet',
  } as ExpoConfig;
};
