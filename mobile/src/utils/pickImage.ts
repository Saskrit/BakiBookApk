import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { appAlert } from '../contexts/DialogContext';
import i18n from '../i18n';

export type ImageSource = 'library' | 'camera';

function pickerOptions(aspect?: [number, number]): ImagePicker.ImagePickerOptions {
  return {
    mediaTypes: ['images'],
    // Android crop UI often returns canceled immediately.
    allowsEditing: Platform.OS !== 'android',
    quality: 0.8,
    base64: true,
    ...(aspect && Platform.OS !== 'android' ? { aspect } : {}),
  };
}

async function writeBase64Jpeg(base64: string): Promise<string> {
  const dest = `${FileSystem.cacheDirectory}bakibook-upload-${Date.now()}.jpg`;
  await FileSystem.writeAsStringAsync(dest, base64, {
    encoding: 'base64',
  });
  return dest;
}

/** Copy content:// / ph:// URIs to a real jpeg so FormData upload works on Android. */
export async function prepareUploadUri(
  uri: string,
  base64?: string | null
): Promise<string> {
  if (uri.startsWith('file://') && /\.(jpe?g|png|webp|gif)$/i.test(uri)) {
    return uri;
  }

  try {
    const dest = `${FileSystem.cacheDirectory}bakibook-upload-${Date.now()}.jpg`;
    await FileSystem.copyAsync({ from: uri, to: dest });
    return dest;
  } catch {
    if (base64) {
      return writeBase64Jpeg(base64);
    }
    throw new Error(i18n.t('upload.pickFailed'));
  }
}

export async function pickImage(
  source: ImageSource,
  aspect?: [number, number]
): Promise<string | null> {
  const options = pickerOptions(aspect);

  if (source === 'library') {
    // Android 13+ system photo picker works without media-library permission.
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted && Platform.OS !== 'android') {
      throw new Error(i18n.t('upload.photoLibraryRequired'));
    }

    const result = await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled || !result.assets[0]?.uri) return null;
    return prepareUploadUri(result.assets[0].uri, result.assets[0].base64);
  }

  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    throw new Error(i18n.t('upload.cameraRequired'));
  }

  const result = await ImagePicker.launchCameraAsync(options);
  if (result.canceled || !result.assets[0]?.uri) return null;
  return prepareUploadUri(result.assets[0].uri, result.assets[0].base64);
}

export function promptImageSource(options: {
  title: string;
  message?: string;
  aspect?: [number, number];
  onPicked: (uri: string) => void | Promise<void>;
  onError?: (message: string) => void;
}) {
  const report = (err: unknown, fallback: string) => {
    const message = err instanceof Error ? err.message : fallback;
    if (options.onError) options.onError(message);
    else appAlert(i18n.t('common.error'), message);
  };

  appAlert(options.title, options.message ?? i18n.t('upload.choosePhotoSource'), [
    {
      text: i18n.t('upload.photoLibrary'),
      onPress: async () => {
        try {
          const uri = await pickImage('library', options.aspect);
          if (uri) await options.onPicked(uri);
        } catch (err) {
          report(err, i18n.t('upload.pickFailed'));
        }
      },
    },
    {
      text: i18n.t('upload.camera'),
      onPress: async () => {
        try {
          const uri = await pickImage('camera', options.aspect);
          if (uri) await options.onPicked(uri);
        } catch (err) {
          report(err, i18n.t('upload.cameraFailed'));
        }
      },
    },
    { text: i18n.t('common.cancel'), style: 'cancel' },
  ]);
}
