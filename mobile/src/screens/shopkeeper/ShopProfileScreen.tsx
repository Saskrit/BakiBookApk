import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { updateProfile } from '../../api/auth';
import { uploadImage } from '../../api/upload';
import {
  inviteShopTeamMember,
  listShopTeam,
  revokeShopTeamMember,
  type ShopTeamMember,
  type TeamRole,
} from '../../api/shopTeam';
import { useAuth } from '../../contexts/AuthContext';
import { appAlert } from '../../contexts/DialogContext';
import AppBackButton from '../../components/AppBackButton';
import UserAvatar from '../../components/UserAvatar';
import { Button, ErrorText, Input } from '../../components/ui';
import { colors } from '../../theme/colors';
import { radius } from '../../theme/radius';
import { spacing } from '../../theme/spacing';
import { typography as ty } from '../../theme/typography';
import { getInitials } from '../../utils/format';
import { promptImageSource } from '../../utils/pickImage';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ShopProfile'>;

function statusLabel(
  status: string | undefined,
  verified: boolean | undefined,
  t: (key: string) => string
) {
  if (status === 'verified' || verified)
    return { text: t('shopProfile.verified'), color: colors.primary, bg: '#DCFCE7' };
  if (status === 'pending')
    return { text: t('shopProfile.pendingReview'), color: colors.warning, bg: '#FEF3C7' };
  if (status === 'rejected')
    return { text: t('shopProfile.needsUpdate'), color: colors.danger, bg: '#FEE2E2' };
  return { text: t('shopProfile.notSetUp'), color: colors.textMuted, bg: '#F3F4F6' };
}

export default function ShopProfileScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { user, refreshUser, applyUser } = useAuth();
  const canEditShop = user?.canEditShop !== false && (user?.teamRole || 'owner') === 'owner';
  const forceEdit = Boolean(route.params?.forceEdit);
  const needsShopDetails =
    canEditShop &&
    (forceEdit ||
      !user?.shopName?.trim() ||
      !user?.shopLocation?.trim() ||
      !user?.shopImage ||
      user?.shopVerificationStatus === 'incomplete' ||
      user?.shopVerificationStatus === 'rejected');

  const [editing, setEditing] = useState(needsShopDetails);
  const [shopName, setShopName] = useState(user?.shopName || '');
  const [shopLocation, setShopLocation] = useState(user?.shopLocation || '');
  const [shopImage, setShopImage] = useState(user?.shopImage || '');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [members, setMembers] = useState<ShopTeamMember[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<TeamRole>('staff');
  const [inviting, setInviting] = useState(false);
  const photoDirtyRef = useRef(false);

  const badge = statusLabel(user?.shopVerificationStatus, user?.isShopVerified, t);
  const hasShop = Boolean(user?.shopName?.trim());

  // Only hydrate form from server when not editing — otherwise realtime user:sync
  // / refreshUser resets shopName & shopLocation on every keystroke.
  useEffect(() => {
    if (editing) return;
    setShopName(user?.shopName || '');
    setShopLocation(user?.shopLocation || '');
    if (!photoDirtyRef.current) {
      setShopImage(user?.shopImage || '');
    }
  }, [editing, user?.shopName, user?.shopLocation, user?.shopImage]);

  const startEditing = () => {
    setShopName(user?.shopName || '');
    setShopLocation(user?.shopLocation || '');
    setShopImage(user?.shopImage || '');
    setError('');
    setMessage('');
    setEditing(true);
  };

  const loadTeam = useCallback(async () => {
    if (!canEditShop) return;
    setTeamLoading(true);
    try {
      const data = await listShopTeam();
      setMembers(data.members || []);
    } catch {
      setMembers([]);
    } finally {
      setTeamLoading(false);
    }
  }, [canEditShop]);

  useEffect(() => {
    void loadTeam();
  }, [loadTeam]);

  const pickShopPhoto = () => {
    if (!canEditShop || uploading || savingPhoto) return;
    promptImageSource({
      title: t('shopProfile.shopPhoto'),
      aspect: [4, 3],
      onError: setError,
      onPicked: async (uri) => {
        setUploading(true);
        setError('');
        try {
          const url = await uploadImage(uri, 'shop');
          photoDirtyRef.current = url !== (user?.shopImage || '');
          setShopImage(url);
        } catch (err) {
          setError(err instanceof Error ? err.message : t('upload.uploadFailed'));
        } finally {
          setUploading(false);
        }
      },
    });
  };

  const handleSaveShopPhoto = async () => {
    if (!canEditShop) return;
    const url = shopImage.trim();
    if (!/^https?:\/\//i.test(url) || url === (user?.shopImage || '')) return;
    setSavingPhoto(true);
    setError('');
    setMessage('');
    try {
      const data = await updateProfile({ shopImage: url });
      if (data.user) {
        const saved = data.user.shopImage || url;
        await applyUser({ ...data.user, shopImage: saved });
        photoDirtyRef.current = false;
        setShopImage(saved);
      } else {
        await refreshUser();
      }
      setMessage(t('shopProfile.photoSaved'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('upload.uploadFailed'));
    } finally {
      setSavingPhoto(false);
    }
  };

  const handleSave = async () => {
    if (!canEditShop) return;
    if (!shopName.trim()) {
      setError(t('shopProfile.shopNameRequired'));
      return;
    }
    if (!shopLocation.trim()) {
      setError(t('shopProfile.locationRequired'));
      return;
    }
    if (!shopImage.trim()) {
      setError(t('shopProfile.shopPhotoRequired'));
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');
    try {
      const data = await updateProfile({
        shopName: shopName.trim(),
        shopLocation: shopLocation.trim(),
        ...(shopImage.trim() ? { shopImage: shopImage.trim() } : {}),
      });
      if (data.user) {
        await applyUser({
          ...data.user,
          shopImage: data.user.shopImage || shopImage.trim(),
        });
        photoDirtyRef.current = false;
      } else await refreshUser();
      setMessage(data.message || t('shopProfile.saved'));
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('shopProfile.saveFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) {
      setError(t('shopTeam.emailRequired'));
      return;
    }
    setInviting(true);
    setError('');
    setMessage('');
    try {
      const data = await inviteShopTeamMember({
        email: inviteEmail.trim(),
        teamRole: inviteRole,
      });
      setMessage(data.message);
      setInviteEmail('');
      await loadTeam();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('shopTeam.inviteFailed'));
    } finally {
      setInviting(false);
    }
  };

  const handleRevoke = (member: ShopTeamMember) => {
    appAlert(t('shopTeam.removeTitle'), t('shopTeam.removeBody', { name: member.fullName }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('shopTeam.remove'),
        style: 'destructive',
        onPress: async () => {
          try {
            await revokeShopTeamMember(member.id);
            setMessage(t('shopTeam.removed'));
            await loadTeam();
          } catch (err) {
            setError(err instanceof Error ? err.message : t('shopTeam.removeFailed'));
          }
        },
      },
    ]);
  };

  const displayShopImage = shopImage || user?.shopImage;

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={[colors.primaryDark, colors.primary]}
          style={[styles.hero, { paddingTop: insets.top + 12 }]}
        >
          <AppBackButton onPress={() => navigation.goBack()} variant="onDark" />

          <Pressable
            onPress={pickShopPhoto}
            disabled={!canEditShop || uploading || savingPhoto}
            style={styles.shopImageWrap}
          >
            <UserAvatar
              uri={displayShopImage}
              name={shopName || user?.shopName || 'Shop'}
              size={88}
              borderRadius={radius.card}
            />
            {canEditShop ? (
              <Text style={styles.tapHint}>
                {uploading ? t('common.loading') : t('shopProfile.tapToChangePhoto')}
              </Text>
            ) : null}
          </Pressable>
          {canEditShop &&
          /^https?:\/\//i.test(shopImage.trim()) &&
          shopImage.trim() !== (user?.shopImage || '') ? (
            <Pressable
              onPress={() => void handleSaveShopPhoto()}
              disabled={uploading || savingPhoto}
              style={[styles.savePhotoBtn, (uploading || savingPhoto) && styles.savePhotoBtnDisabled]}
            >
              {savingPhoto ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.savePhotoBtnText}>{t('shopProfile.saveShopPhoto')}</Text>
              )}
            </Pressable>
          ) : null}

          <Text style={styles.heroTitle}>
            {hasShop ? user?.shopName : t('shopProfile.registerShop')}
          </Text>
          {user?.shopLocation ? (
            <Text style={styles.heroLocation}>{user.shopLocation}</Text>
          ) : null}
          <View style={[styles.badge, { backgroundColor: badge.bg }]}>
            <Text style={[styles.badgeText, { color: badge.color }]}>{badge.text}</Text>
          </View>
          {!canEditShop ? (
            <Text style={styles.viewOnly}>{t('shopTeam.viewOnlyShop')}</Text>
          ) : null}
        </LinearGradient>

        <View style={styles.body}>
          {message ? <Text style={styles.success}>{message}</Text> : null}
          {error ? <ErrorText message={error} /> : null}

          {canEditShop && editing ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                {hasShop ? t('shopProfile.editShop') : t('shopProfile.setUpShop')}
              </Text>
              <Input label={t('shopProfile.shopName')} value={shopName} onChangeText={setShopName} />
              <Input
                label={t('shopProfile.shopLocation')}
                value={shopLocation}
                onChangeText={setShopLocation}
                placeholder={t('shopProfile.locationPlaceholder')}
              />
              <View style={styles.actions}>
                {hasShop ? (
                  <Button
                    title={t('common.cancel')}
                    variant="outline"
                    onPress={() => {
                      setShopName(user?.shopName || '');
                      setShopLocation(user?.shopLocation || '');
                      setEditing(false);
                      setError('');
                    }}
                  />
                ) : null}
                <Button title={t('shopProfile.saveProfile')} onPress={handleSave} loading={loading} />
              </View>
            </View>
          ) : (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t('shopProfile.shopDetails')}</Text>
              <Text style={styles.infoLabel}>{t('shopProfile.shopNameLabel')}</Text>
              <Text style={styles.infoValue}>{user?.shopName || '—'}</Text>
              <Text style={styles.infoLabel}>{t('shopProfile.location')}</Text>
              <Text style={styles.infoValue}>{user?.shopLocation || '—'}</Text>
              {canEditShop ? (
                <Button
                  title={t('shopProfile.editShop')}
                  onPress={startEditing}
                />
              ) : null}
            </View>
          )}

          {canEditShop ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t('shopTeam.title')}</Text>
              <Text style={styles.cardSub}>{t('shopTeam.subtitle')}</Text>

              <Text style={styles.infoLabel}>{t('shopTeam.inviteEmail')}</Text>
              <TextInput
                value={inviteEmail}
                onChangeText={setInviteEmail}
                placeholder={t('shopTeam.emailPlaceholder')}
                autoCapitalize="none"
                keyboardType="email-address"
                style={styles.input}
                placeholderTextColor={colors.textMuted}
              />

              <View style={styles.roleRow}>
                {(['staff', 'partner'] as TeamRole[]).map((role) => (
                  <Pressable
                    key={role}
                    onPress={() => setInviteRole(role)}
                    style={[styles.roleChip, inviteRole === role && styles.roleChipActive]}
                  >
                    <Text
                      style={[
                        styles.roleChipText,
                        inviteRole === role && styles.roleChipTextActive,
                      ]}
                    >
                      {role === 'partner' ? t('shopTeam.partner') : t('shopTeam.staff')}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Button
                title={t('shopTeam.sendInvite')}
                onPress={handleInvite}
                loading={inviting}
              />

              <Text style={[styles.cardTitle, { marginTop: spacing.lg }]}>
                {t('shopTeam.members')}
              </Text>
              {teamLoading ? (
                <ActivityIndicator color={colors.primary} style={{ marginVertical: 12 }} />
              ) : members.length === 0 ? (
                <Text style={styles.cardSub}>{t('shopTeam.empty')}</Text>
              ) : (
                members.map((member) => (
                  <View key={member.id} style={styles.memberRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.memberName}>{member.fullName}</Text>
                      <Text style={styles.memberEmail}>{member.email}</Text>
                      <Text style={styles.memberTag}>
                        {member.teamRole === 'partner'
                          ? t('shopTeam.partner')
                          : t('shopTeam.staff')}
                      </Text>
                    </View>
                    <Pressable onPress={() => handleRevoke(member)}>
                      <Text style={styles.remove}>{t('shopTeam.remove')}</Text>
                    </Pressable>
                  </View>
                ))
              )}
            </View>
          ) : (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t('shopTeam.yourRole')}</Text>
              <Text style={styles.memberTag}>
                {user?.teamRole === 'partner' ? t('shopTeam.partner') : t('shopTeam.staff')}
              </Text>
              <Text style={styles.cardSub}>{t('shopTeam.memberHint')}</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F5F7' },
  hero: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
    alignItems: 'center',
    borderBottomLeftRadius: radius.container,
    borderBottomRightRadius: radius.container,
  },
  backBtn: { alignSelf: 'flex-start', marginBottom: 8 },
  backText: { color: 'rgba(255,255,255,0.95)', fontSize: ty.bodyLg, fontWeight: '600' },
  shopImageWrap: { alignItems: 'center', marginBottom: spacing.sm },
  savePhotoBtn: {
    marginTop: 4,
    marginBottom: 12,
    backgroundColor: colors.accent,
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
    borderRadius: 10,
    minWidth: 160,
    alignItems: 'center',
  },
  savePhotoBtnDisabled: { opacity: 0.6 },
  savePhotoBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: ty.body },
  shopImage: { width: 88, height: 88, borderRadius: radius.card, borderWidth: 2, borderColor: '#fff' },
  shopPlaceholder: {
    width: 88,
    height: 88,
    borderRadius: radius.card,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shopInitial: { color: '#fff', fontWeight: '800', fontSize: 28 },
  tapHint: { color: 'rgba(255,255,255,0.85)', marginTop: 8, fontSize: ty.caption },
  heroTitle: {
    fontSize: ty.h2,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 4,
  },
  heroLocation: { color: 'rgba(255,255,255,0.9)', marginBottom: 8 },
  badge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999 },
  badgeText: { fontSize: ty.caption, fontWeight: '700' },
  viewOnly: { color: 'rgba(255,255,255,0.9)', marginTop: 8, fontSize: ty.caption },
  body: { padding: spacing.md },
  card: {
    backgroundColor: '#fff',
    borderRadius: radius.card,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: '#ECEEF2',
  },
  cardTitle: { fontSize: ty.lg, fontWeight: '800', color: colors.text, marginBottom: 4 },
  cardSub: { fontSize: ty.body, color: colors.textMuted, marginBottom: spacing.sm },
  infoLabel: { fontSize: ty.caption, color: colors.textMuted, marginTop: 8 },
  infoValue: { fontSize: ty.bodyLg, fontWeight: '600', color: colors.text },
  success: { color: colors.primary, marginBottom: 10, fontWeight: '600' },
  actions: { gap: 8, marginTop: 8 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.input,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: ty.bodyLg,
    color: colors.text,
    backgroundColor: '#FAFAFA',
    marginBottom: spacing.sm,
  },
  roleRow: { flexDirection: 'row', gap: 8, marginBottom: spacing.sm },
  roleChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  roleChipActive: { borderColor: colors.primary, backgroundColor: '#F4F7EC' },
  roleChipText: { color: colors.textMuted, fontWeight: '600' },
  roleChipTextActive: { color: colors.primary },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F2F5',
  },
  memberName: { fontWeight: '700', color: colors.text },
  memberEmail: { color: colors.textMuted, fontSize: ty.caption },
  memberTag: {
    marginTop: 4,
    alignSelf: 'flex-start',
    backgroundColor: '#F3F7EC',
    color: colors.primary,
    fontWeight: '700',
    fontSize: ty.caption,
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: 'hidden',
    borderRadius: 999,
  },
  remove: { color: colors.danger, fontWeight: '700' },
});
