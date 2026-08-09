import { useCallback, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  CompositeNavigationProp,
  useFocusEffect,
  useNavigation,
} from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Svg, { Circle, Path } from 'react-native-svg';
import { fetchPortalDashboard } from '../../api/portal';
import { updateProfile } from '../../api/auth';
import { uploadImage } from '../../api/upload';
import EmailVerificationBanner from '../../components/EmailVerificationBanner';
import LanguageSwitcher from '../../components/LanguageSwitcher';
import { CustomerLoading } from '../../components/customer/CustomerUi';
import { useAuth } from '../../contexts/AuthContext';
import { appAlert } from '../../contexts/DialogContext';
import { customerColors as c } from '../../theme/customerColors';
import { formatRs, getInitials } from '../../utils/format';
import { exportCustomerStatement } from '../../utils/customerStatement';
import type { CustomerTabParamList, RootStackParamList } from '../../navigation/types';
import * as ImagePicker from 'expo-image-picker';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<CustomerTabParamList, 'Profile'>,
  NativeStackNavigationProp<RootStackParamList>
>;

type RowIcon = 'user' | 'shield' | 'bell' | 'doc' | 'help' | 'info';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { user, logout, applyUser } = useAuth();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [due, setDue] = useState(0);
  const [shopCount, setShopCount] = useState(0);
  const [paid, setPaid] = useState(0);

  const load = useCallback(async () => {
    const dashboard = await fetchPortalDashboard();
    setDue(dashboard.summary?.currentDue || 0);
    setPaid(dashboard.summary?.totalPaid || 0);
    setShopCount(dashboard.summary?.totalShops ?? dashboard.shops?.length ?? 0);
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load()
        .catch(() => {})
        .finally(() => setLoading(false));
    }, [load])
  );

  const emailVerified = !!(user?.isEmailVerified || user?.authProvider === 'google');

  const handleLogout = () => {
    appAlert(t('settings.signOutConfirmTitle'), t('settings.signOutConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.signOut'), style: 'destructive', onPress: () => logout() },
    ]);
  };

  const savePhoto = async (url: string) => {
    const res = await updateProfile({ profileImage: url });
    await applyUser(res.user);
  };

  const uploadPickedPhoto = async (localUri: string) => {
    setUploadingPhoto(true);
    try {
      const url = await uploadImage(localUri, 'profile');
      await savePhoto(url);
    } catch (err) {
      appAlert(
        t('common.error'),
        err instanceof Error ? err.message : t('upload.uploadFailed')
      );
    } finally {
      setUploadingPhoto(false);
    }
  };

  const changeProfilePhoto = () => {
    if (uploadingPhoto) return;
    appAlert(t('customer.profileTitle'), t('upload.choosePhotoSource'), [
      {
        text: t('upload.photoLibrary'),
        onPress: async () => {
          try {
            const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!permission.granted) {
              appAlert(t('common.error'), t('upload.photoLibraryRequired'));
              return;
            }
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.85,
            });
            if (!result.canceled && result.assets[0]?.uri) {
              await uploadPickedPhoto(result.assets[0].uri);
            }
          } catch (err) {
            appAlert(
              t('common.error'),
              err instanceof Error ? err.message : t('upload.pickFailed')
            );
          }
        },
      },
      {
        text: t('upload.camera'),
        onPress: async () => {
          try {
            const permission = await ImagePicker.requestCameraPermissionsAsync();
            if (!permission.granted) {
              appAlert(t('common.error'), t('upload.cameraRequired'));
              return;
            }
            const result = await ImagePicker.launchCameraAsync({
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.85,
            });
            if (!result.canceled && result.assets[0]?.uri) {
              await uploadPickedPhoto(result.assets[0].uri);
            }
          } catch (err) {
            appAlert(
              t('common.error'),
              err instanceof Error ? err.message : t('upload.cameraFailed')
            );
          }
        },
      },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  const downloadStatement = async () => {
    setExporting(true);
    try {
      await exportCustomerStatement({
        fullName: user?.fullName,
        email: user?.email,
      });
    } catch (err) {
      appAlert(
        t('common.error'),
        err instanceof Error ? err.message : t('customer.statementFailed')
      );
    } finally {
      setExporting(false);
    }
  };

  if (loading) return <CustomerLoading />;

  return (
    <View style={[cpStyles.cpScreen, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={[cpStyles.cpScroll, { paddingBottom: insets.bottom + 32 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load().catch(() => {});
              setRefreshing(false);
            }}
            tintColor={c.peachDark}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={cpStyles.cpTopBar}>
          <View style={cpStyles.cpTopBarText}>
            <Text style={cpStyles.cpTitle}>{t('customer.profileTitle')}</Text>
            <Text style={cpStyles.cpSubtitle}>{t('customer.profileSubtitle')}</Text>
          </View>
          <Pressable
            style={cpStyles.cpIconBtn}
            onPress={() => navigation.navigate('Security')}
            hitSlop={8}
          >
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path
                d="M12 3 L20 7 V12 C20 16 16.5 19.5 12 21 C7.5 19.5 4 16 4 12 V7 Z"
                stroke={c.textMuted}
                strokeWidth={2}
              />
            </Svg>
          </Pressable>
        </View>

        <EmailVerificationBanner user={user} />

        <LinearGradient
          colors={['#FFE8D2', '#FFD7B0', '#FFC794']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={cpStyles.cpHero}
        >
          <View style={cpStyles.cpHeroGlow} />
          <View style={cpStyles.cpHeroMain}>
            <View style={cpStyles.cpAvatarRing}>
              <Pressable
                onPress={changeProfilePhoto}
                style={cpStyles.cpAvatarPress}
                disabled={uploadingPhoto}
              >
                {user?.profileImage ? (
                  <Image source={{ uri: user.profileImage }} style={cpStyles.cpAvatarImg} />
                ) : (
                  <View style={cpStyles.cpAvatarFallback}>
                    <Text style={cpStyles.cpAvatarText}>
                      {getInitials(user?.fullName || 'C')}
                    </Text>
                  </View>
                )}
                <View style={cpStyles.cpCameraBadge}>
                  {uploadingPhoto ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
                      <Path
                        d="M4 8 H8 L10 5 H14 L16 8 H20 V19 H4 Z"
                        stroke="#FFF"
                        strokeWidth={2}
                      />
                      <Circle cx={12} cy={13} r={3.5} stroke="#FFF" strokeWidth={2} />
                    </Svg>
                  )}
                </View>
              </Pressable>
            </View>

            <Text style={cpStyles.cpName} numberOfLines={2}>
              {user?.fullName || '—'}
            </Text>

            <View style={cpStyles.cpBadgeRow}>
              <View style={cpStyles.cpRolePill}>
                <Text style={cpStyles.cpRolePillText}>{t('customer.roleCustomer')}</Text>
              </View>
              <View
                style={[
                  cpStyles.cpStatusPill,
                  emailVerified ? cpStyles.cpStatusOk : cpStyles.cpStatusWarn,
                ]}
              >
                <Text
                  style={[
                    cpStyles.cpStatusPillText,
                    emailVerified ? cpStyles.cpStatusOkText : cpStyles.cpStatusWarnText,
                  ]}
                >
                  {emailVerified ? t('customer.verified') : t('customer.notVerified')}
                </Text>
              </View>
            </View>

            <View style={cpStyles.cpContactBlock}>
              {!!user?.phone && (
                <Text style={cpStyles.cpContactLine} numberOfLines={1}>
                  {user.phone}
                </Text>
              )}
              <Text style={cpStyles.cpContactLine} numberOfLines={1}>
                {user?.email || '—'}
              </Text>
            </View>

            <Pressable
              style={cpStyles.cpEditBtn}
              onPress={() => navigation.navigate('QRScanner', { initialTab: 'myqr' })}
            >
              <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
                <Path d="M4 4 H10 V10 H4 Z" stroke={c.text} strokeWidth={2} />
                <Path d="M14 4 H20 V10 H14 Z" stroke={c.text} strokeWidth={2} />
                <Path d="M4 14 H10 V20 H4 Z" stroke={c.text} strokeWidth={2} />
                <Path d="M14 14 H17 V17 H14 Z M17 17 H20 V20 H14 V17" stroke={c.text} strokeWidth={2} />
              </Svg>
              <Text style={cpStyles.cpEditBtnText}>{t('qr.myQrTab')}</Text>
            </Pressable>
          </View>
        </LinearGradient>

        <View style={cpStyles.cpStatsRow}>
          <StatTile
            label={t('customer.currentDue')}
            value={formatRs(due)}
            valueColor={due > 0 ? c.danger : c.success}
            onPress={() => navigation.navigate('Shops')}
          />
          <StatTile
            label={t('customer.linkedShops')}
            value={String(shopCount)}
            valueColor={c.text}
            onPress={() => navigation.navigate('Shops')}
          />
          <StatTile
            label={t('customer.totalPaid')}
            value={formatRs(paid)}
            valueColor={c.success}
            onPress={() => navigation.navigate('Payments')}
          />
        </View>

        <Text style={cpStyles.cpSectionLabel}>{t('customer.accountSettings')}</Text>
        <View style={cpStyles.cpMenuCard}>
          <SettingsRow
            title={t('customer.personalInfo')}
            subtitle={t('customer.personalInfoBody')}
            icon="user"
            onPress={() => navigation.navigate('PersonalInfo')}
          />
          <SettingsRow
            title={t('nav.security')}
            subtitle={t('customer.securityBody')}
            icon="shield"
            onPress={() => navigation.navigate('Security')}
          />
          <SettingsRow
            title={t('nav.notifications')}
            subtitle={t('customer.notificationsBody')}
            icon="bell"
            onPress={() => navigation.navigate('Notifications')}
            last
          />
        </View>

        <Text style={cpStyles.cpSectionLabel}>{t('customer.statementsReports')}</Text>
        <View style={cpStyles.cpMenuCard}>
          <SettingsRow
            title={t('customer.downloadStatement')}
            subtitle={t('customer.downloadStatementBody')}
            icon="doc"
            onPress={() => void downloadStatement()}
            trailing={
              exporting ? (
                <ActivityIndicator size="small" color={c.peachDark} />
              ) : undefined
            }
            last
          />
        </View>

        <Text style={cpStyles.cpSectionLabel}>{t('common.language')}</Text>
        <View style={cpStyles.cpLangCard}>
          <LanguageSwitcher
            accent={c.peachDark}
            textColor={c.text}
            mutedColor={c.textMuted}
            backgroundColor="#FFF7ED"
          />
        </View>

        <Text style={cpStyles.cpSectionLabel}>{t('nav.helpSupport')}</Text>
        <View style={cpStyles.cpMenuCard}>
          <SettingsRow
            title={t('nav.helpSupport')}
            subtitle={t('customer.helpBody')}
            icon="help"
            onPress={() => navigation.navigate('HelpSupport')}
          />
          <SettingsRow
            title={t('customer.aboutBakibook')}
            subtitle={t('customer.aboutBody')}
            icon="info"
            onPress={() => appAlert(t('customer.aboutBakibook'), t('customer.aboutDetail'))}
            last
          />
        </View>

        <Pressable style={cpStyles.cpLogoutBtn} onPress={handleLogout}>
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            <Path
              d="M10 4 H6 C5 4 4 5 4 6 V18 C4 19 5 20 6 20 H10 M14 8 L18 12 L14 16 M8 12 H18"
              stroke={c.danger}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
          <Text style={cpStyles.cpLogoutText}>{t('customer.logout')}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function StatTile({
  label,
  value,
  valueColor,
  onPress,
}: {
  label: string;
  value: string;
  valueColor: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={cpStyles.cpStatTile} onPress={onPress}>
      <Text style={cpStyles.cpStatLabel} numberOfLines={1}>
        {label}
      </Text>
      <Text
        style={[cpStyles.cpStatValue, { color: valueColor }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.75}
      >
        {value}
      </Text>
    </Pressable>
  );
}

function SettingsRow({
  title,
  subtitle,
  icon,
  onPress,
  last,
  trailing,
}: {
  title: string;
  subtitle: string;
  icon: RowIcon;
  onPress: () => void;
  last?: boolean;
  trailing?: ReactNode;
}) {
  const tone = iconTone(icon);
  return (
    <Pressable
      style={[cpStyles.cpSettingsRow, last && cpStyles.cpSettingsRowLast]}
      onPress={onPress}
    >
      <View style={[cpStyles.cpSettingsIcon, { backgroundColor: tone.bg }]}>
        <RowGlyph name={icon} color={tone.fg} />
      </View>
      <View style={cpStyles.cpSettingsCopy}>
        <Text style={cpStyles.cpSettingsTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={cpStyles.cpSettingsSub} numberOfLines={2}>
          {subtitle}
        </Text>
      </View>
      {trailing || <Text style={cpStyles.cpChevron}>›</Text>}
    </Pressable>
  );
}

function iconTone(icon: RowIcon) {
  switch (icon) {
    case 'user':
      return { bg: '#FFEDD5', fg: '#EA580C' };
    case 'shield':
      return { bg: '#DBEAFE', fg: '#2563EB' };
    case 'bell':
      return { bg: '#FEF3C7', fg: '#D97706' };
    case 'doc':
      return { bg: c.sky, fg: '#2563EB' };
    case 'help':
      return { bg: '#E0F2FE', fg: '#0EA5E9' };
    default:
      return { bg: '#F1F5F9', fg: '#64748B' };
  }
}

function RowGlyph({ name, color }: { name: RowIcon; color: string }) {
  if (name === 'user') {
    return (
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
        <Circle cx={12} cy={8} r={3.5} stroke={color} strokeWidth={2} />
        <Path
          d="M5 19 C5 15.5 8 13.5 12 13.5 C16 13.5 19 15.5 19 19"
          stroke={color}
          strokeWidth={2}
        />
      </Svg>
    );
  }
  if (name === 'shield') {
    return (
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
        <Path
          d="M12 3 L20 7 V12 C20 16 16.5 19.5 12 21 C7.5 19.5 4 16 4 12 V7 Z"
          stroke={color}
          strokeWidth={2}
        />
      </Svg>
    );
  }
  if (name === 'bell') {
    return (
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
        <Path
          d="M12 4 C8 4 5 7 5 10 C5 16 3 17 3 17 H21 C21 17 19 16 19 10 C19 7 16 4 12 4 Z"
          stroke={color}
          strokeWidth={2}
        />
      </Svg>
    );
  }
  if (name === 'doc') {
    return (
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
        <Path d="M7 3 H14 L19 8 V21 H7 Z" stroke={color} strokeWidth={2} />
        <Path d="M14 3 V8 H19" stroke={color} strokeWidth={2} />
      </Svg>
    );
  }
  if (name === 'help') {
    return (
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
        <Circle cx={12} cy={12} r={8} stroke={color} strokeWidth={2} />
        <Path
          d="M9.5 9.5 C9.5 8 10.5 7 12 7 C13.5 7 14.5 8 14.5 9.5 C14.5 11 12 11.5 12 13"
          stroke={color}
          strokeWidth={2}
        />
        <Circle cx={12} cy={16.5} r={1} fill={color} />
      </Svg>
    );
  }
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={8} stroke={color} strokeWidth={2} />
      <Path d="M12 11 V16 M12 8 V8.5" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

const cpStyles = StyleSheet.create({
  cpScreen: {
    flex: 1,
    backgroundColor: c.cream,
  },
  cpScroll: {
    paddingHorizontal: 16,
    gap: 14,
  },
  cpTopBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingTop: 8,
  },
  cpTopBarText: {
    flex: 1,
    minWidth: 0,
  },
  cpTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: c.text,
    letterSpacing: -0.5,
  },
  cpSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: c.textMuted,
    lineHeight: 18,
  },
  cpIconBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: c.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: c.border,
  },

  cpHero: {
    borderRadius: 24,
    padding: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(232, 154, 106, 0.35)',
  },
  cpHeroGlow: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.35)',
    top: -40,
    right: -30,
  },
  cpHeroMain: {
    alignItems: 'center',
    gap: 10,
  },
  cpAvatarRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFF',
  },
  cpAvatarPress: {
    width: 88,
    height: 88,
  },
  cpAvatarImg: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#FFF',
  },
  cpAvatarFallback: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cpAvatarText: {
    fontSize: 28,
    fontWeight: '800',
    color: c.peachDark,
  },
  cpCameraBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: c.peachDark,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  cpName: {
    fontSize: 22,
    fontWeight: '800',
    color: c.text,
    textAlign: 'center',
    lineHeight: 28,
  },
  cpBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  cpRolePill: {
    backgroundColor: 'rgba(255,255,255,0.75)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  cpRolePillText: {
    fontSize: 11,
    fontWeight: '800',
    color: c.text,
  },
  cpStatusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  cpStatusOk: { backgroundColor: '#DCFCE7' },
  cpStatusWarn: { backgroundColor: '#FEF3C7' },
  cpStatusPillText: { fontSize: 11, fontWeight: '800' },
  cpStatusOkText: { color: '#166534' },
  cpStatusWarnText: { color: '#92400E' },
  cpContactBlock: {
    alignItems: 'center',
    gap: 2,
    marginTop: 2,
  },
  cpContactLine: {
    fontSize: 13,
    fontWeight: '600',
    color: c.textMuted,
  },
  cpEditBtn: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(232, 154, 106, 0.45)',
  },
  cpEditBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: c.text,
  },

  cpStatsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  cpStatTile: {
    flex: 1,
    minWidth: 0,
    backgroundColor: c.white,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: c.border,
    gap: 4,
  },
  cpStatLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: c.textMuted,
  },
  cpStatValue: {
    fontSize: 15,
    fontWeight: '800',
  },

  cpSectionLabel: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '800',
    color: c.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  cpMenuCard: {
    backgroundColor: c.white,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: c.border,
  },
  cpSettingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 190, 145, 0.28)',
  },
  cpSettingsRowLast: {
    borderBottomWidth: 0,
  },
  cpSettingsIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cpSettingsCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  cpSettingsTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: c.text,
  },
  cpSettingsSub: {
    fontSize: 12,
    color: c.textMuted,
    lineHeight: 16,
  },
  cpChevron: {
    fontSize: 22,
    color: c.textMuted,
    fontWeight: '300',
    flexShrink: 0,
  },
  cpLangCard: {
    backgroundColor: c.white,
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: c.border,
  },
  cpLogoutBtn: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFF5F5',
    borderRadius: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(196, 92, 92, 0.25)',
  },
  cpLogoutText: {
    fontSize: 14,
    fontWeight: '800',
    color: c.danger,
  },
});
