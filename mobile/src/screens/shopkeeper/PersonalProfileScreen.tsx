import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { updateProfile } from '../../api/auth';
import ScreenHeader from '../../components/ScreenHeader';
import ProfileImagePicker from '../../components/ProfileImagePicker';
import { useAuth } from '../../contexts/AuthContext';
import { Button, ErrorText, Input } from '../../components/ui';
import { colors } from '../../theme/colors';
import { radius } from '../../theme/radius';
import { spacing } from '../../theme/spacing';
import { typography as ty } from '../../theme/typography';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'PersonalProfile'>;

export default function PersonalProfileScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { user, applyUser, refreshUser } = useAuth();
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [profileImage, setProfileImage] = useState(user?.profileImage || '');
  const [loading, setLoading] = useState(false);
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const photoDirtyRef = useRef(false);

  useEffect(() => {
    setFullName(user?.fullName || '');
    setPhone(user?.phone || '');
  }, [user?.id, user?.fullName, user?.phone]);

  useEffect(() => {
    if (photoDirtyRef.current) return;
    setProfileImage(user?.profileImage || '');
  }, [user?.id, user?.profileImage]);

  const handleSavePhoto = async (url: string) => {
    setSavingPhoto(true);
    setError('');
    setMessage('');
    try {
      const data = await updateProfile({ profileImage: url });
      if (data.user) {
        const saved = data.user.profileImage || url;
        await applyUser({ ...data.user, profileImage: saved });
        photoDirtyRef.current = false;
        setProfileImage(saved);
      } else {
        await refreshUser();
      }
      setMessage(t('personalProfile.photoSaved'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('upload.uploadFailed'));
    } finally {
      setSavingPhoto(false);
    }
  };

  const handleSave = async () => {
    if (!fullName.trim()) {
      setError(t('personalProfile.nameRequired'));
      return;
    }
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const data = await updateProfile({
        fullName: fullName.trim(),
        phone: phone.trim(),
      });
      if (data.user) {
        await applyUser({
          ...data.user,
          profileImage: data.user.profileImage || user?.profileImage || profileImage,
        });
      } else {
        await refreshUser();
      }
      setMessage(data.message || t('personalProfile.saved'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('personalProfile.saveFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title={t('personalProfile.title')}
        subtitle={t('personalProfile.subtitle')}
        onBack={() => navigation.goBack()}
        style={{ paddingBottom: 0 }}
      />
      <ScrollView
        contentContainerStyle={{
          paddingBottom: insets.bottom + spacing.xl,
          paddingHorizontal: spacing.md,
        }}
      >

        <ProfileImagePicker
          label={t('personalProfile.yourPhoto')}
          value={profileImage}
          savedUrl={user?.profileImage || ''}
          onChange={(url) => {
            photoDirtyRef.current = url !== (user?.profileImage || '');
            setProfileImage(url);
          }}
          onSavePhoto={handleSavePhoto}
          savingPhoto={savingPhoto}
          savePhotoLabel={t('personalProfile.savePhoto')}
          onError={setError}
          uploadType="profile"
          fallbackName={fullName || user?.fullName || 'U'}
          size={96}
          disabled={loading}
        />

        <Text style={styles.label}>{t('auth.email')}</Text>
        <Text style={styles.readonly}>{user?.email}</Text>

        <Input label={t('personalProfile.fullName')} value={fullName} onChangeText={setFullName} />
        <Input
          label={t('personalProfile.phone')}
          value={phone}
          onChangeText={setPhone}
          placeholder={t('personalProfile.phonePlaceholder')}
          keyboardType="phone-pad"
        />

        {error ? <ErrorText message={error} /> : null}
        {message ? <Text style={styles.success}>{message}</Text> : null}

        <View style={{ marginTop: spacing.lg }}>
          <Button title={t('common.save')} onPress={handleSave} loading={loading} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  back: { fontSize: ty.body, color: colors.primary, fontWeight: '600', marginBottom: spacing.sm },
  title: { fontSize: ty.h2, color: colors.text, marginBottom: 4, fontWeight: '700' },
  subtitle: { fontSize: ty.caption, color: colors.textMuted, marginBottom: spacing.lg },
  label: {
    fontSize: ty.caption,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 6,
    marginTop: spacing.sm,
  },
  readonly: {
    fontSize: ty.body,
    color: colors.textMuted,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#F3F4F6',
    borderRadius: radius.input,
  },
  success: {
    fontSize: ty.caption,
    color: colors.success,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
});
