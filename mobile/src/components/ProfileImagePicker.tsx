import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { uploadImage, type UploadType } from '../api/upload';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';

import { getInitials } from '../utils/format';
import { promptImageSource } from '../utils/pickImage';

type Props = {
  label: string;
  value: string;
  onChange: (url: string) => void;
  onError?: (message: string) => void;
  uploadType: UploadType;
  fallbackName?: string;
  shape?: 'circle' | 'rounded';
  size?: number;
  style?: ViewStyle;
  disabled?: boolean;
};

export default function ProfileImagePicker({
  label,
  value,
  onChange,
  onError,
  uploadType,
  fallbackName = '',
  shape = 'circle',
  size = 64,
  style,
  disabled,
}: Props) {
  const { t } = useTranslation();
  const [uploading, setUploading] = useState(false);
  const [previewUri, setPreviewUri] = useState('');
  const aspect: [number, number] = shape === 'circle' ? [1, 1] : [4, 3];

  const displayUri = previewUri || value;
  const radius = shape === 'circle' ? size / 2 : 10;

  const handleUpload = async (localUri: string) => {
    setPreviewUri(localUri);
    setUploading(true);
    onError?.('');
    try {
      const url = await uploadImage(localUri, uploadType);
      onChange(url);
      setPreviewUri('');
    } catch (err) {
      setPreviewUri('');
      onError?.(err instanceof Error ? err.message : t('upload.uploadFailed'));
    } finally {
      setUploading(false);
    }
  };

  const chooseSource = () => {
    if (disabled || uploading) return;

    promptImageSource({
      title: label,
      aspect,
      onPicked: handleUpload,
      onError: (message) => onError?.(message),
    });
  };

  const clearImage = () => {
    if (disabled || uploading) return;
    onChange('');
    setPreviewUri('');
  };

  return (
    <View style={[pipStyles.pipWrap, style]}>
      <Text style={pipStyles.pipLabel}>{label}</Text>
      <View style={pipStyles.pipRow}>
        <Pressable
          onPress={chooseSource}
          disabled={disabled || uploading}
          style={({ pressed }) => [pressed && pipStyles.pipPressed]}
        >
          <View
            style={[
              pipStyles.pipImageBox,
              {
                width: size,
                height: size,
                borderRadius: radius,
              },
            ]}
          >
            {displayUri ? (
              <Image source={{ uri: displayUri }} style={[pipStyles.pipImage, { borderRadius: radius }]} />
            ) : (
              <View style={[pipStyles.pipPlaceholder, { borderRadius: radius }]}>
                <Text style={pipStyles.pipInitials}>{getInitials(fallbackName || label)}</Text>
              </View>
            )}
            {uploading ? (
              <View style={[pipStyles.pipOverlay, { borderRadius: radius }]}>
                <ActivityIndicator color="#FFFFFF" />
              </View>
            ) : null}
          </View>
        </Pressable>

        <View style={pipStyles.pipActions}>
          <Pressable
            onPress={chooseSource}
            disabled={disabled || uploading}
            style={[pipStyles.pipActionBtn, (disabled || uploading) && pipStyles.pipActionBtnDisabled]}
          >
            <Text style={pipStyles.pipActionBtnText}>{uploading ? t('upload.uploading') : t('upload.changePhoto')}</Text>
          </Pressable>
          {value ? (
            <Pressable onPress={clearImage} disabled={disabled || uploading}>
              <Text style={pipStyles.pipRemoveText}>{t('upload.remove')}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const pipStyles = StyleSheet.create({
  pipWrap: { marginBottom: spacing.md },
  pipLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 10,
  },
  pipRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  pipImageBox: {
    overflow: 'hidden',
    backgroundColor: colors.border,
  },
  pipImage: {
    width: '100%',
    height: '100%',
  },
  pipPlaceholder: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pipInitials: { color: '#FFFFFF', fontWeight: '800', fontSize: 24 },
  pipOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pipActions: { flex: 1, gap: 8 },
  pipActionBtn: {
    backgroundColor: '#F3F7EC',
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  pipActionBtnDisabled: { opacity: 0.6 },
  pipActionBtnText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  pipRemoveText: { color: colors.danger, fontWeight: '600', fontSize: 13 },
  pipPressed: { opacity: 0.85 },
});
