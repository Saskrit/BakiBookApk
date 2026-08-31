import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { uploadImage, type UploadType } from '../api/upload';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { getInitials } from '../utils/format';
import { promptImageSource } from '../utils/pickImage';

type Props = {
  label: string;
  value: string;
  savedUrl?: string;
  onChange: (url: string) => void;
  onSavePhoto: (url: string) => void | Promise<void>;
  onError?: (message: string) => void;
  uploadType: UploadType;
  fallbackName?: string;
  shape?: 'circle' | 'rounded';
  size?: number;
  style?: ViewStyle;
  disabled?: boolean;
  savingPhoto?: boolean;
  savePhotoLabel?: string;
};

function isRemoteUrl(url: string) {
  return /^https?:\/\//i.test(url.trim());
}

/**
 * Pick + upload for preview, then a dedicated Save photo button.
 * Profile name/phone save is a separate control on the parent screen.
 */
export default function ProfileImagePicker({
  label,
  value,
  savedUrl = '',
  onChange,
  onSavePhoto,
  onError,
  uploadType,
  fallbackName = '',
  shape = 'circle',
  size = 64,
  style,
  disabled,
  savingPhoto,
  savePhotoLabel,
}: Props) {
  const { t } = useTranslation();
  const [uploading, setUploading] = useState(false);
  const [previewUri, setPreviewUri] = useState('');
  const aspect: [number, number] = shape === 'circle' ? [1, 1] : [4, 3];
  const displayUri = value || previewUri;
  const radius = shape === 'circle' ? size / 2 : 10;
  const busy = disabled || uploading || savingPhoto;
  const canSavePhoto =
    isRemoteUrl(value) && value.trim() !== savedUrl.trim() && !uploading;

  const handleFile = async (localUri: string) => {
    onError?.('');
    setUploading(true);
    setPreviewUri(localUri);
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
    if (busy) return;
    promptImageSource({
      title: label,
      aspect,
      onPicked: handleFile,
      onError: (message) => onError?.(message),
    });
  };

  const clearImage = () => {
    if (busy) return;
    onChange('');
    setPreviewUri('');
  };

  const savePhoto = async () => {
    if (!canSavePhoto || busy) return;
    await onSavePhoto(value.trim());
  };

  return (
    <View style={[pipStyles.pipWrap, style]}>
      <Text style={pipStyles.pipLabel}>{label}</Text>
      <View style={pipStyles.pipRow}>
        <Pressable
          onPress={chooseSource}
          disabled={busy}
          style={({ pressed }) => [pressed && pipStyles.pipPressed]}
        >
          <View style={{ width: size, height: size }}>
            {displayUri ? (
              <Image
                source={{ uri: displayUri }}
                contentFit="cover"
                cachePolicy="memory-disk"
                recyclingKey={displayUri}
                style={{ width: size, height: size, borderRadius: radius }}
              />
            ) : (
              <View
                style={[
                  pipStyles.pipPlaceholder,
                  { width: size, height: size, borderRadius: radius },
                ]}
              >
                {uploading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={pipStyles.pipInitials}>{getInitials(fallbackName || label)}</Text>
                )}
              </View>
            )}
            {uploading && displayUri ? (
              <View
                style={[
                  pipStyles.pipOverlay,
                  { width: size, height: size, borderRadius: radius },
                ]}
              >
                <ActivityIndicator color="#FFFFFF" />
              </View>
            ) : null}
          </View>
        </Pressable>

        <View style={pipStyles.pipActions}>
          <Pressable
            onPress={chooseSource}
            disabled={busy}
            style={[pipStyles.pipChangeBtn, busy && pipStyles.pipActionBtnDisabled]}
          >
            <Text style={pipStyles.pipChangeBtnText}>
              {uploading ? t('upload.uploading') : t('upload.changePhoto')}
            </Text>
          </Pressable>
          {canSavePhoto ? (
            <Pressable
              onPress={() => void savePhoto()}
              disabled={busy}
              style={[pipStyles.pipSaveBtn, busy && pipStyles.pipActionBtnDisabled]}
            >
              {savingPhoto ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={pipStyles.pipSaveBtnText}>
                  {savePhotoLabel || t('upload.savePhoto')}
                </Text>
              )}
            </Pressable>
          ) : null}
          {displayUri ? (
            <Pressable onPress={clearImage} disabled={busy}>
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
  pipPlaceholder: {
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
  pipChangeBtn: {
    backgroundColor: '#F3F7EC',
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  pipSaveBtn: {
    backgroundColor: colors.accent,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    borderRadius: 10,
    alignSelf: 'flex-start',
    minWidth: 120,
    alignItems: 'center',
  },
  pipActionBtnDisabled: { opacity: 0.6 },
  pipChangeBtnText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  pipSaveBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  pipRemoveText: { color: colors.danger, fontWeight: '600', fontSize: 13 },
  pipPressed: { opacity: 0.85 },
});
