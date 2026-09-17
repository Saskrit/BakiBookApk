import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import {
  confirmEmailChange,
  requestEmailChange,
  updateProfile,
} from '../../api/auth';
import ProfileImagePicker from '../../components/ProfileImagePicker';
import ScreenHeader from '../../components/ScreenHeader';
import { useAuth } from '../../contexts/AuthContext';
import { appAlert } from '../../contexts/DialogContext';
import { Button, ErrorText } from '../../components/ui';
import { colors } from '../../theme/colors';
import { typography as ty } from '../../theme/typography';
import { spacing } from '../../theme/spacing';
import { radius } from '../../theme/radius';

import type { RootStackParamList } from '../../navigation/types';

export default function PersonalInfoScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const { user, applyUser } = useAuth();

  const [fullName, setFullName] = useState(user?.fullName || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [profileImage, setProfileImage] = useState(user?.profileImage || '');
  const [photoError, setPhotoError] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [savingPhoto, setSavingPhoto] = useState(false);
  const photoDirtyRef = useRef(false);
  const [newEmail, setNewEmail] = useState('');
  const [pendingEmail, setPendingEmail] = useState('');
  const [confirmationCode, setConfirmationCode] = useState('');
  const [emailError, setEmailError] = useState('');
  const [sendingCode, setSendingCode] = useState(false);
  const [confirmingEmail, setConfirmingEmail] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [emailChangePassword, setEmailChangePassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    setFullName(user?.fullName || '');
    setPhone(user?.phone || '');
  }, [user?.id, user?.fullName, user?.phone]);

  useEffect(() => {
    if (photoDirtyRef.current) return;
    if (user?.profileImage) setProfileImage(user.profileImage);
  }, [user?.id, user?.profileImage]);

  const handleSavePhoto = async (url: string) => {
    setPhotoError('');
    setSuccess('');
    setSavingPhoto(true);
    try {
      const res = await updateProfile({ profileImage: url });
      const savedImage = res.user.profileImage || url;
      await applyUser({ ...res.user, profileImage: savedImage });
      photoDirtyRef.current = false;
      setProfileImage(savedImage);
      setSuccess(t('personalProfile.photoSaved'));
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : t('upload.uploadFailed'));
    } finally {
      setSavingPhoto(false);
    }
  };

  const handleSave = async () => {
    setError('');
    setSuccess('');
    setPhotoError('');
    const name = fullName.trim();
    if (!name) {
      setError(t('auth.fullName'));
      return;
    }

    setSaving(true);
    try {
      const res = await updateProfile({
        fullName: name,
        phone: phone.trim(),
      });
      await applyUser({
        ...res.user,
        profileImage: res.user.profileImage || user?.profileImage || profileImage,
      });
      setSuccess(t('customer.personalInfoUpdated'));
      appAlert(t('customer.personalInfo'), t('customer.personalInfoUpdated'));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t('customer.personalInfoUpdateFailed')
      );
    } finally {
      setSaving(false);
    }
  };

  const handleCancelPersonalInfo = () => {
    setFullName(user?.fullName || '');
    setPhone(user?.phone || '');
    setProfileImage(user?.profileImage || '');
    setError('');
    setPhotoError('');
    setSuccess('');
    navigation.goBack();
  };

  const closePasswordModal = () => {
    if (sendingCode) return;
    setPasswordModalOpen(false);
    setEmailChangePassword('');
    setPasswordError('');
  };

  const openPasswordConfirmation = () => {
    setEmailError('');
    const email = newEmail.trim().toLowerCase();
    if (!email) {
      setEmailError(t('customer.enterNewEmail'));
      return;
    }
    setPasswordError('');
    setEmailChangePassword('');
    setPasswordModalOpen(true);
  };

  const handleRequestEmailChange = async () => {
    if (!emailChangePassword) {
      setPasswordError(t('customer.enterPasswordToContinue'));
      return;
    }

    const email = newEmail.trim().toLowerCase();
    setSendingCode(true);
    setPasswordError('');
    try {
      const res = await requestEmailChange(email, emailChangePassword);
      setPendingEmail(res.pendingEmail);
      setConfirmationCode('');
      setPasswordModalOpen(false);
      setEmailChangePassword('');
      appAlert(t('customer.confirmNewEmail'), res.message);
    } catch (err) {
      setPasswordError(
        err instanceof Error ? err.message : t('customer.emailChangeRequestFailed')
      );
    } finally {
      setSendingCode(false);
    }
  };

  const handleConfirmEmailChange = async () => {
    setEmailError('');
    if (!/^\d{6}$/.test(confirmationCode.trim())) {
      setEmailError(t('customer.enterSixDigitCode'));
      return;
    }

    setConfirmingEmail(true);
    try {
      const res = await confirmEmailChange(confirmationCode.trim());
      await applyUser(res.user);
      setNewEmail('');
      setPendingEmail('');
      setConfirmationCode('');
      appAlert(t('customer.emailChanged'), res.message);
    } catch (err) {
      setEmailError(
        err instanceof Error ? err.message : t('customer.emailChangeConfirmFailed')
      );
    } finally {
      setConfirmingEmail(false);
    }
  };

  return (
    <View style={piStyles.piScreen}>
      <LinearGradient
        colors={[colors.primaryDark, colors.primary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={piStyles.piHeader}
      >
        <ScreenHeader
          title={t('customer.personalInfo')}
          subtitle={t('customer.personalInfoBody')}
          onBack={() => navigation.goBack()}
          variant="onDark"
          style={piStyles.piHeaderInner}
        />
      </LinearGradient>

      <KeyboardAvoidingView
        style={piStyles.piFlex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[piStyles.piContent, { paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={piStyles.piCard}>
            <Text style={piStyles.piCardTitle}>{t('customer.editPersonalInfo')}</Text>
            {error ? <ErrorText message={error} /> : null}
            {success ? <Text style={piStyles.piSuccess}>{success}</Text> : null}

            <ProfileImagePicker
              label={t('customer.profilePhoto')}
              value={profileImage}
              savedUrl={user?.profileImage || ''}
              onChange={(url) => {
                photoDirtyRef.current = url !== (user?.profileImage || '');
                setProfileImage(url);
              }}
              onSavePhoto={handleSavePhoto}
              savingPhoto={savingPhoto}
              savePhotoLabel={t('customer.saveProfilePhoto')}
              onError={setPhotoError}
              uploadType="profile"
              fallbackName={fullName || user?.fullName || 'C'}
              size={80}
              disabled={saving}
            />
            {photoError ? <ErrorText message={photoError} /> : null}
            <Text style={piStyles.piHint}>{t('customer.profilePhotoHint')}</Text>

            <View style={piStyles.piFieldWrap}>
              <Text style={piStyles.piFieldLabel}>{t('auth.fullName')}</Text>
              <TextInput
                value={fullName}
                onChangeText={setFullName}
                autoCapitalize="words"
                placeholder={t('auth.fullName')}
                placeholderTextColor={colors.textMuted}
                style={piStyles.piInput}
              />
            </View>

            <View style={piStyles.piFieldWrap}>
              <Text style={piStyles.piFieldLabel}>{t('customer.phone')}</Text>
              <TextInput
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                placeholder={t('customer.phone')}
                placeholderTextColor={colors.textMuted}
                style={piStyles.piInput}
              />
            </View>

            <View style={piStyles.piActionRow}>
              <View style={piStyles.piActionHalf}>
                <Button
                  title={t('common.cancel')}
                  variant="outline"
                  onPress={handleCancelPersonalInfo}
                  disabled={saving}
                />
              </View>
              <View style={piStyles.piActionHalf}>
                <Button
                  title={saving ? t('common.updating') : t('customer.savePersonalInfo')}
                  onPress={handleSave}
                  loading={saving}
                />
              </View>
            </View>
          </View>

          <View style={piStyles.piCard}>
            <Text style={piStyles.piCardTitle}>{t('customer.changeEmail')}</Text>
            <Text style={piStyles.piHint}>{t('customer.changeEmailHint')}</Text>

            <View style={piStyles.piReadonly}>
              <Text style={piStyles.piFieldLabel}>{t('customer.currentEmail')}</Text>
              <Text style={piStyles.piReadonlyValue} numberOfLines={1}>
                {user?.email || '—'}
              </Text>
            </View>

            {emailError ? <ErrorText message={emailError} /> : null}

            {!pendingEmail ? (
              <>
                <View style={piStyles.piFieldWrap}>
                  <Text style={piStyles.piFieldLabel}>{t('customer.newEmail')}</Text>
                  <TextInput
                    value={newEmail}
                    onChangeText={setNewEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholder={t('customer.newEmailPlaceholder')}
                    placeholderTextColor={colors.textMuted}
                    style={piStyles.piInput}
                  />
                </View>
                <Button
                  title={
                    sendingCode ? t('common.sending') : t('customer.sendConfirmationCode')
                  }
                  onPress={openPasswordConfirmation}
                  loading={sendingCode}
                />
              </>
            ) : (
              <>
                <Text style={piStyles.piHint}>
                  {t('customer.codeSentTo', { email: pendingEmail })}
                </Text>
                <View style={piStyles.piFieldWrap}>
                  <Text style={piStyles.piFieldLabel}>
                    {t('customer.confirmationCode')}
                  </Text>
                  <TextInput
                    value={confirmationCode}
                    onChangeText={(value) =>
                      setConfirmationCode(value.replace(/\D/g, '').slice(0, 6))
                    }
                    keyboardType="number-pad"
                    maxLength={6}
                    placeholder="000000"
                    placeholderTextColor={colors.textMuted}
                    style={[piStyles.piInput, piStyles.piCodeInput]}
                  />
                </View>
                <Button
                  title={
                    confirmingEmail ? t('common.updating') : t('customer.confirmEmailChange')
                  }
                  onPress={handleConfirmEmailChange}
                  loading={confirmingEmail}
                />
                <Pressable
                  onPress={openPasswordConfirmation}
                  disabled={sendingCode}
                  style={piStyles.piTextButton}
                >
                  <Text style={piStyles.piTextButtonLabel}>
                    {sendingCode ? t('common.sending') : t('customer.resendCode')}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setPendingEmail('');
                    setConfirmationCode('');
                    setEmailError('');
                  }}
                  style={piStyles.piTextButton}
                >
                  <Text style={piStyles.piTextButtonLabel}>
                    {t('customer.useDifferentEmail')}
                  </Text>
                </Pressable>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={passwordModalOpen}
        transparent
        animationType="fade"
        onRequestClose={closePasswordModal}
      >
        <KeyboardAvoidingView
          style={piStyles.piModalRoot}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={piStyles.piModalBackdrop} onPress={closePasswordModal} />
          <View style={piStyles.piModalCard}>
            <Text style={piStyles.piModalTitle}>{t('customer.confirmPassword')}</Text>
            <Text style={piStyles.piHint}>{t('customer.confirmPasswordHint')}</Text>
            {passwordError ? <ErrorText message={passwordError} /> : null}
            <TextInput
              value={emailChangePassword}
              onChangeText={setEmailChangePassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              placeholder={t('auth.password')}
              placeholderTextColor={colors.textMuted}
              style={piStyles.piInput}
              onSubmitEditing={handleRequestEmailChange}
            />
            <View style={piStyles.piModalActions}>
              <Pressable
                onPress={closePasswordModal}
                disabled={sendingCode}
                style={piStyles.piCancelButton}
              >
                <Text style={piStyles.piCancelButtonLabel}>{t('common.cancel')}</Text>
              </Pressable>
              <View style={piStyles.piModalPrimary}>
                <Button
                  title={
                    sendingCode ? t('common.sending') : t('customer.sendConfirmationCode')
                  }
                  onPress={handleRequestEmailChange}
                  loading={sendingCode}
                />
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const piStyles = StyleSheet.create({
  piScreen: { flex: 1, backgroundColor: '#F4F5F7' },
  piFlex: { flex: 1 },
  piHeader: {
    paddingHorizontal: spacing.md,
    paddingBottom: 18,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
  },
  piHeaderInner: { paddingHorizontal: 0, paddingBottom: 0 },
  piBack: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: ty.bodyLg,
    fontWeight: '600',
    marginBottom: 6,
  },
  piHeaderTitle: { color: '#FFF', fontSize: ty.h1, fontWeight: '800' },
  piHeaderSubtitle: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: ty.body,
    marginTop: 4,
  },
  piContent: { padding: spacing.md, paddingTop: spacing.md, gap: spacing.sm },
  piCard: {
    backgroundColor: '#FFF',
    borderRadius: radius.card,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#ECEEF2',
    gap: 10,
  },
  piCardTitle: {
    fontSize: ty.md,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 4,
  },
  piFieldWrap: { marginTop: 4 },
  piFieldLabel: {
    fontSize: ty.body,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 6,
  },
  piInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: ty.md,
    color: colors.text,
  },
  piReadonly: {
    marginTop: 4,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  piReadonlyValue: {
    marginTop: 2,
    fontSize: ty.md,
    fontWeight: '700',
    color: colors.text,
  },
  piSuccess: { fontSize: ty.body, color: colors.primary, fontWeight: '600' },
  piHint: { fontSize: ty.body, color: colors.textMuted, lineHeight: 19 },
  piActionRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  piActionHalf: { flex: 1 },
  piCodeInput: {
    textAlign: 'center',
    letterSpacing: 8,
    fontSize: 22,
    fontWeight: '700',
  },
  piTextButton: { alignItems: 'center', paddingVertical: 6 },
  piTextButtonLabel: { color: colors.primary, fontWeight: '700', fontSize: ty.body },
  piModalRoot: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  piModalBackdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  piModalCard: {
    backgroundColor: '#FFF',
    borderRadius: radius.container,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  piModalTitle: { fontSize: ty.lg, fontWeight: '800', color: colors.text },
  piModalActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  piModalPrimary: { flex: 1.4 },
  piCancelButton: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
  },
  piCancelButtonLabel: { color: colors.textMuted, fontWeight: '700' },
});
