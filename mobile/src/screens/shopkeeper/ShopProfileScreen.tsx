import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Svg, { Circle, Path } from 'react-native-svg';
import { updateProfile } from '../../api/auth';
import { uploadImage, type UploadType } from '../../api/upload';
import ProfileImagePicker from '../../components/ProfileImagePicker';
import EmailVerificationBanner from '../../components/EmailVerificationBanner';
import { useAuth } from '../../contexts/AuthContext';
import { Button, ErrorText, Input } from '../../components/ui';
import { colors } from '../../theme/colors';
import { radius } from '../../theme/radius';
import { spacing } from '../../theme/spacing';
import { typography as ty } from '../../theme/typography';
import { getInitials } from '../../utils/format';
import { promptImageSource } from '../../utils/pickImage';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ShopProfile'>;

function statusLabel(status: string | undefined, verified: boolean | undefined, t: (key: string) => string) {
  if (status === 'verified' || verified) return { text: t('shopProfile.verified'), color: colors.primary, bg: '#DCFCE7' };
  if (status === 'pending') return { text: t('shopProfile.pendingReview'), color: colors.warning, bg: '#FEF3C7' };
  if (status === 'rejected') return { text: t('shopProfile.needsUpdate'), color: colors.danger, bg: '#FEE2E2' };
  return { text: t('shopProfile.notSetUp'), color: colors.textMuted, bg: '#F3F4F6' };
}

export default function ShopProfileScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { user, refreshUser, applyUser } = useAuth();
  const [editing, setEditing] = useState(!user?.shopName?.trim());
  const [shopName, setShopName] = useState(user?.shopName || '');
  const [shopLocation, setShopLocation] = useState(user?.shopLocation || '');
  const [shopImage, setShopImage] = useState(user?.shopImage || '');
  const [profileImage, setProfileImage] = useState(user?.profileImage || '');
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [loading, setLoading] = useState(false);
  const [uploadingHero, setUploadingHero] = useState<'profile' | 'shop' | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const badge = statusLabel(user?.shopVerificationStatus, user?.isShopVerified, t);
  const hasShop = Boolean(user?.shopName?.trim());

  useEffect(() => {
    setShopName(user?.shopName || '');
    setShopLocation(user?.shopLocation || '');
    setShopImage(user?.shopImage || '');
    setProfileImage(user?.profileImage || '');
    setFullName(user?.fullName || '');
  }, [user]);

  const resetForm = () => {
    setShopName(user?.shopName || '');
    setShopLocation(user?.shopLocation || '');
    setShopImage(user?.shopImage || '');
    setProfileImage(user?.profileImage || '');
    setFullName(user?.fullName || '');
    setError('');
    setMessage('');
  };

  const persistPhoto = async (type: UploadType, url: string) => {
    if (type === 'profile') setProfileImage(url);
    else setShopImage(url);

    setError('');
    try {
      const data = await updateProfile(type === 'profile' ? { profileImage: url } : { shopImage: url });
      if (data.user) await applyUser(data.user);
      else await refreshUser();
      setMessage(t('shopProfile.photoSaved'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('shopProfile.saveFailed'));
    }
  };

  const pickHeroPhoto = (type: 'profile' | 'shop') => {
    if (uploadingHero) return;
    promptImageSource({
      title: type === 'shop' ? t('shopProfile.shopPhoto') : t('shopProfile.yourPhoto'),
      aspect: type === 'shop' ? [4, 3] : [1, 1],
      onError: setError,
      onPicked: async (uri) => {
        setUploadingHero(type);
        setError('');
        try {
          const url = await uploadImage(uri, type);
          await persistPhoto(type, url);
        } catch (err) {
          setError(err instanceof Error ? err.message : t('upload.uploadFailed'));
        } finally {
          setUploadingHero(null);
        }
      },
    });
  };

  const handleSave = async () => {
    if (!shopName.trim()) {
      setError(t('shopProfile.shopNameRequired'));
      return;
    }
    if (!shopLocation.trim()) {
      setError(t('shopProfile.locationRequired'));
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');
    try {
      const data = await updateProfile({
        fullName: fullName.trim(),
        shopName: shopName.trim(),
        shopLocation: shopLocation.trim(),
        ...(profileImage.trim() ? { profileImage: profileImage.trim() } : {}),
        ...(shopImage.trim() ? { shopImage: shopImage.trim() } : {}),
      });
      await refreshUser();
      setMessage(data.message || t('shopProfile.saved'));
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('shopProfile.saveFailed'));
    } finally {
      setLoading(false);
    }
  };

  const displayShopImage = editing ? shopImage : user?.shopImage;
  const displayProfileImage = editing ? profileImage : user?.profileImage;

  return (
    <View style={spfStyles.spfScreen}>
      <ScrollView
        style={spfStyles.spfScroll}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={[colors.primaryDark, colors.primary]}
          style={[spfStyles.spfHero, { paddingTop: insets.top + 12 }]}
        >
          <Pressable onPress={() => navigation.goBack()} style={spfStyles.spfBackBtn} hitSlop={8}>
            <Text style={spfStyles.spfBackBtnText}>{t('common.back')}</Text>
          </Pressable>

          <View style={spfStyles.spfHeroImages}>
            <Pressable
              onPress={() => pickHeroPhoto('shop')}
              style={spfStyles.spfShopImageWrap}
              accessibilityLabel={t('shopProfile.shopPhoto')}
              disabled={!!uploadingHero}
            >
              {displayShopImage ? (
                <Image source={{ uri: displayShopImage }} style={spfStyles.spfShopHeroImage} />
              ) : (
                <View style={spfStyles.spfShopHeroPlaceholder}>
                  <Text style={spfStyles.spfShopHeroInitial}>
                    {getInitials(shopName || user?.shopName || 'Shop')}
                  </Text>
                </View>
              )}
              <HeroCameraBadge loading={uploadingHero === 'shop'} />
            </Pressable>
            <Pressable
              onPress={() => pickHeroPhoto('profile')}
              style={spfStyles.spfProfileImageWrap}
              accessibilityLabel={t('shopProfile.yourPhoto')}
              disabled={!!uploadingHero}
            >
              {displayProfileImage ? (
                <Image source={{ uri: displayProfileImage }} style={spfStyles.spfProfileHeroImage} />
              ) : (
                <View style={spfStyles.spfProfileHeroPlaceholder}>
                  <Text style={spfStyles.spfProfileHeroInitial}>
                    {getInitials(fullName || user?.fullName || 'U')}
                  </Text>
                </View>
              )}
              <HeroCameraBadge loading={uploadingHero === 'profile'} />
            </Pressable>
          </View>
          <Text style={spfStyles.spfTapHint}>{t('shopProfile.tapToChangePhoto')}</Text>

          <Text style={spfStyles.spfHeroTitle}>{hasShop ? user?.shopName : t('shopProfile.registerShop')}</Text>
          {user?.shopLocation ? (
            <View style={spfStyles.spfLocationRow}>
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M12 21 C12 21 19 14.5 19 10 C19 6.13 15.87 3 12 3 C8.13 3 5 6.13 5 10 C5 14.5 12 21 12 21 Z"
                  stroke="rgba(255,255,255,0.9)"
                  strokeWidth={2}
                />
                <Path d="M12 12 C13.1 12 14 11.1 14 10 C14 8.9 13.1 8 12 8 C10.9 8 10 8.9 10 10 C10 11.1 10.9 12 12 12 Z" fill="rgba(255,255,255,0.9)" />
              </Svg>
              <Text style={spfStyles.spfHeroLocation}>{user.shopLocation}</Text>
            </View>
          ) : null}
          <Text style={spfStyles.spfHeroOwner}>{user?.fullName}</Text>
          <View style={[spfStyles.spfStatusBadge, { backgroundColor: badge.bg }]}>
            <Text style={[spfStyles.spfStatusBadgeText, { color: badge.color }]}>{badge.text}</Text>
          </View>
        </LinearGradient>

        <View style={spfStyles.spfBody}>
          <EmailVerificationBanner user={user} />
          {message ? <Text style={spfStyles.spfSuccess}>{message}</Text> : null}
          {error ? <ErrorText message={error} /> : null}

          {editing ? (
            <View style={spfStyles.spfCard}>
              <Text style={spfStyles.spfCardTitle}>{hasShop ? t('shopProfile.editProfile') : t('shopProfile.setUpShop')}</Text>
              <Text style={spfStyles.spfCardSub}>{t('shopProfile.editSub')}</Text>

              <View style={spfStyles.spfPickerRow}>
                <ProfileImagePicker
                  label={t('shopProfile.yourPhoto')}
                  value={profileImage}
                  onChange={(url) => {
                    setProfileImage(url);
                    if (url) void persistPhoto('profile', url);
                  }}
                  onError={setError}
                  uploadType="profile"
                  fallbackName={fullName}
                  shape="circle"
                  size={72}
                />
                <ProfileImagePicker
                  label={t('shopProfile.shopPhoto')}
                  value={shopImage}
                  onChange={(url) => {
                    setShopImage(url);
                    if (url) void persistPhoto('shop', url);
                  }}
                  onError={setError}
                  uploadType="shop"
                  fallbackName={shopName}
                  shape="rounded"
                  size={72}
                />
              </View>

              <Input label={t('shopProfile.yourName')} value={fullName} onChangeText={setFullName} />
              <Input label={t('shopProfile.shopName')} value={shopName} onChangeText={setShopName} />
              <Input
                label={t('shopProfile.shopLocation')}
                value={shopLocation}
                onChangeText={setShopLocation}
                placeholder={t('shopProfile.locationPlaceholder')}
              />

              <View style={spfStyles.spfActions}>
                {hasShop ? (
                  <Button
                    title={t('common.cancel')}
                    variant="outline"
                    onPress={() => {
                      resetForm();
                      setEditing(false);
                    }}
                  />
                ) : null}
                <Button title={t('shopProfile.saveProfile')} onPress={handleSave} loading={loading} />
              </View>
            </View>
          ) : (
            <>
              <View style={spfStyles.spfCard}>
                <Text style={spfStyles.spfCardTitle}>{t('shopProfile.shopDetails')}</Text>
                <InfoRow icon="shop" label={t('shopProfile.shopNameLabel')} value={user?.shopName || '—'} />
                <InfoRow icon="pin" label={t('shopProfile.location')} value={user?.shopLocation || '—'} />
                <InfoRow icon="user" label={t('shopProfile.owner')} value={user?.fullName || '—'} />
                <InfoRow icon="mail" label={t('security.email')} value={user?.email || '—'} last />
              </View>

              <Button title={t('shopProfile.editProfilePhotos')} onPress={() => setEditing(true)} />
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function HeroCameraBadge({ loading }: { loading: boolean }) {
  return (
    <View style={spfStyles.spfCameraBadge}>
      {loading ? (
        <ActivityIndicator size="small" color="#FFF" />
      ) : (
        <Svg width={11} height={11} viewBox="0 0 24 24" fill="none">
          <Path d="M4 8 H8 L10 5 H14 L16 8 H20 V19 H4 Z" stroke="#FFF" strokeWidth={2} />
          <Circle cx={12} cy={13} r={3.5} stroke="#FFF" strokeWidth={2} />
        </Svg>
      )}
    </View>
  );
}

function InfoRow({
  icon,
  label,
  value,
  last,
}: {
  icon: 'shop' | 'pin' | 'user' | 'mail';
  label: string;
  value: string;
  last?: boolean;
}) {
  const iconColor = colors.primary;
  return (
    <View style={[spfStyles.spfInfoRow, !last && spfStyles.spfInfoRowBorder]}>
      <View style={spfStyles.spfInfoIcon}>
        {icon === 'shop' ? (
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            <Path d="M4 10 L12 4 L20 10 V19 C20 19.55 19.55 20 19 20 H5 C4.45 20 4 19.55 4 19 Z" stroke={iconColor} strokeWidth={2} />
          </Svg>
        ) : icon === 'pin' ? (
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            <Path d="M12 21 C12 21 19 14.5 19 10 C19 6.13 15.87 3 12 3 C8.13 3 5 6.13 5 10 C5 14.5 12 21 12 21 Z" stroke={iconColor} strokeWidth={2} />
          </Svg>
        ) : icon === 'user' ? (
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            <Path d="M12 12 C14.21 12 16 10.21 16 8 C16 5.79 14.21 4 12 4 C9.79 4 8 5.79 8 8 C8 10.21 9.79 12 12 12 Z" stroke={iconColor} strokeWidth={2} />
            <Path d="M4 20 C4 16.5 7.5 14 12 14 C16.5 14 20 16.5 20 20" stroke={iconColor} strokeWidth={2} />
          </Svg>
        ) : (
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            <Path d="M4 6 H20 V18 H4 Z" stroke={iconColor} strokeWidth={2} />
            <Path d="M4 7 L12 13 L20 7" stroke={iconColor} strokeWidth={2} />
          </Svg>
        )}
      </View>
      <View style={spfStyles.spfInfoBody}>
        <Text style={spfStyles.spfInfoLabel}>{label}</Text>
        <Text style={spfStyles.spfInfoValue}>{value}</Text>
      </View>
    </View>
  );
}

const spfStyles = StyleSheet.create({
  spfScreen: { flex: 1, backgroundColor: '#F4F5F7' },
  spfScroll: { flex: 1 },
  spfHero: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
    alignItems: 'center',
    borderBottomLeftRadius: radius.container,
    borderBottomRightRadius: radius.container,
  },
  spfBackBtn: { alignSelf: 'flex-start', marginBottom: 8 },
  spfBackBtnText: { color: 'rgba(255,255,255,0.95)', fontSize: ty.bodyLg, fontWeight: '600' },
  spfHeroImages: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  spfShopImageWrap: {
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  spfShopHeroImage: { width: 64, height: 64, borderRadius: radius.card, borderWidth: 2, borderColor: '#FFFFFF' },
  spfShopHeroPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: radius.card,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spfShopHeroInitial: { color: '#FFF', fontWeight: '800', fontSize: ty.xxl },
  spfProfileImageWrap: { marginBottom: -8, position: 'relative' },
  spfProfileHeroImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  spfProfileHeroPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primaryDark,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spfProfileHeroInitial: { color: '#FFF', fontWeight: '800', fontSize: ty.lg },
  spfHeroTitle: {
    fontSize: ty.h2,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 6,
  },
  spfLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  spfHeroLocation: { fontSize: ty.body, color: 'rgba(255,255,255,0.9)' },
  spfHeroOwner: { fontSize: ty.bodyLg, color: 'rgba(255,255,255,0.85)', fontWeight: '600', marginBottom: 10 },
  spfTapHint: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: ty.caption,
    textAlign: 'center',
    marginTop: -6,
    marginBottom: 8,
  },
  spfCameraBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primaryDark,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spfStatusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
  },
  spfStatusBadgeText: { fontSize: ty.caption, fontWeight: '700' },
  spfBody: { padding: spacing.md, marginTop: -8 },
  spfCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.card,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: '#ECEEF2',
  },
  spfCardTitle: { fontSize: ty.lg, fontWeight: '800', color: colors.text, marginBottom: 4 },
  spfCardSub: { fontSize: ty.body, color: colors.textMuted, marginBottom: spacing.md },
  spfPickerRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
    gap: spacing.sm,
  },
  spfInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  spfInfoRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F0F2F5',
  },
  spfInfoIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F3F7EC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spfInfoBody: { flex: 1 },
  spfInfoLabel: { fontSize: ty.caption, color: colors.textMuted, marginBottom: 2 },
  spfInfoValue: { fontSize: ty.bodyLg, fontWeight: '600', color: colors.text },
  spfSuccess: { color: colors.primary, marginBottom: 10, fontWeight: '600', fontSize: ty.bodyLg },
  spfActions: { gap: 8, marginTop: 8 },
});
