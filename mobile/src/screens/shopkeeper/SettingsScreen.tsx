import type { ReactNode } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CompositeNavigationProp, useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useAuth } from '../../contexts/AuthContext';
import { appAlert } from '../../contexts/DialogContext';
import { useNotifications } from '../../contexts/NotificationContext';
import EmailVerificationBanner from '../../components/EmailVerificationBanner';
import LanguageSwitcher from '../../components/LanguageSwitcher';
import { getTutorialStats } from '../../features/tutorial/catalog';
import { colors } from '../../theme/colors';
import { typography as t } from '../../theme/typography';
import { getInitials } from '../../utils/format';
import type { RootStackParamList, ShopkeeperTabParamList } from '../../navigation/types';

type SettingsNav = CompositeNavigationProp<
  BottomTabNavigationProp<ShopkeeperTabParamList, 'Settings'>,
  NativeStackNavigationProp<RootStackParamList>
>;

type MenuItem = {
  label: string;
  subtitle?: string;
  color: string;
  icon: ReactNode;
  onPress: () => void;
  danger?: boolean;
  badge?: number;
};

type MenuSection = {
  title: string;
  items: MenuItem[];
};

function comingSoon(label: string, title: string, body: string) {
  appAlert(title, body.replace('{{label}}', label));
}

function RowIcon({ children, bg }: { children: ReactNode; bg: string }) {
  return <View style={[stStyles.stRowIcon, { backgroundColor: bg }]}>{children}</View>;
}

function MenuRow({ item }: { item: MenuItem }) {
  return (
    <Pressable
      onPress={item.onPress}
      style={({ pressed }) => [stStyles.stMenuRow, pressed && stStyles.stMenuRowPressed]}
    >
      <RowIcon bg={`${item.color}14`}>{item.icon}</RowIcon>
      <View style={stStyles.stMenuRowBody}>
        <Text style={[stStyles.stMenuRowLabel, item.danger && stStyles.stMenuRowDanger]}>{item.label}</Text>
        {item.subtitle ? <Text style={stStyles.stMenuRowSub}>{item.subtitle}</Text> : null}
      </View>
      {item.badge ? (
        <View style={stStyles.stMenuBadge}>
          <Text style={stStyles.stMenuBadgeText}>{item.badge > 99 ? '99+' : item.badge}</Text>
        </View>
      ) : null}
      <Text style={stStyles.stMenuRowChevron}>›</Text>
    </Pressable>
  );
}

export default function SettingsScreen() {
  const navigation = useNavigation<SettingsNav>();
  const { user, logout } = useAuth();
  const { unreadCount, connected } = useNotifications();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const tutorialStats = getTutorialStats(user?.tutorialProgress?.completedStepIds || []);

  const openShopProfile = () => navigation.getParent()?.navigate('ShopProfile');

  const handleLogout = () => {
    appAlert(t('settings.signOutConfirmTitle'), t('settings.signOutConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.signOut'), style: 'destructive', onPress: () => logout() },
    ]);
  };

  const notifSubtitle = connected
    ? unreadCount > 0
      ? t('settings.notificationsUnread', { count: unreadCount })
      : t('settings.notificationsCaughtUp')
    : unreadCount > 0
      ? t('settings.notificationsOffline', { count: unreadCount })
      : t('settings.notificationsHistory');

  const sections: MenuSection[] = [
    {
      title: t('settings.business'),
      items: [
        {
          label: t('settings.reportsAnalytics'),
          subtitle: t('settings.reportsSubtitle'),
          color: colors.primary,
          icon: (
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Path d="M6 19 V11 M12 19 V5 M18 19 V14" stroke={colors.primary} strokeWidth={2} strokeLinecap="round" />
            </Svg>
          ),
          onPress: () => navigation.navigate('Reports'),
        },
        {
          label: t('nav.products'),
          subtitle: t('settings.productsSubtitle'),
          color: '#EA580C',
          icon: (
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Rect x={4} y={6} width={16} height={14} rx={2} stroke="#EA580C" strokeWidth={2} />
            </Svg>
          ),
          onPress: () => navigation.getParent()?.navigate('Products'),
        },
        {
          label: t('settings.expenses'),
          color: '#2563EB',
          icon: (
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Rect x={5} y={4} width={14} height={16} rx={2} stroke="#2563EB" strokeWidth={2} />
              <Path d="M9 10 H15 M9 14 H13" stroke="#2563EB" strokeWidth={2} />
            </Svg>
          ),
          onPress: () => navigation.getParent()?.navigate('Expenses'),
        },
      ],
    },
    {
      title: t('settings.customersCredit'),
      items: [
        {
          label: t('nav.customers'),
          subtitle: t('settings.customersSubtitle'),
          color: colors.primary,
          icon: (
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Circle cx={12} cy={8} r={3} stroke={colors.primary} strokeWidth={2} />
              <Path d="M5 20 C5 16 8 14 12 14 C16 14 19 16 19 20" stroke={colors.primary} strokeWidth={2} />
            </Svg>
          ),
          onPress: () => navigation.navigate('Customers'),
        },
        {
          label: t('settings.addCredit'),
          color: '#EA580C',
          icon: (
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Circle cx={12} cy={12} r={8} stroke="#EA580C" strokeWidth={2} />
              <Path d="M12 8 V16 M8 12 H16" stroke="#EA580C" strokeWidth={2} />
            </Svg>
          ),
          onPress: () => navigation.getParent()?.navigate('AddCredit'),
        },
        {
          label: t('settings.scanQr'),
          color: '#DB2777',
          icon: (
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Rect x={4} y={4} width={7} height={7} stroke="#DB2777" strokeWidth={2} />
              <Rect x={13} y={13} width={7} height={7} stroke="#DB2777" strokeWidth={2} />
            </Svg>
          ),
          onPress: () => navigation.getParent()?.navigate('QRScanner'),
        },
        {
          label: t('settings.dueReminders'),
          color: '#2563EB',
          icon: (
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Rect x={4} y={5} width={16} height={15} rx={2} stroke="#2563EB" strokeWidth={2} />
              <Path d="M4 10 H20" stroke="#2563EB" strokeWidth={2} />
            </Svg>
          ),
          onPress: () =>
            comingSoon(t('settings.dueReminders'), t('common.comingSoon'), t('settings.comingSoonBody')),
        },
      ],
    },
    {
      title: t('settings.account'),
      items: [
        {
          label: t('settings.shopProfile'),
          subtitle: t('settings.shopProfileSubtitle'),
          color: '#2563EB',
          icon: (
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Path d="M4 10 L12 4 L20 10 V19 C20 19.55 19.55 20 19 20 H5 C4.45 20 4 19.55 4 19 Z" stroke="#2563EB" strokeWidth={2} />
            </Svg>
          ),
          onPress: openShopProfile,
        },
        {
          label: t('settings.notifications'),
          subtitle: notifSubtitle,
          badge: unreadCount,
          color: '#7C3AED',
          icon: (
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Path d="M12 4 C8 4 5 7 5 10 C5 16 3 17 3 17 H21 C21 17 19 16 19 10 C19 7 16 4 12 4 Z" stroke="#7C3AED" strokeWidth={2} />
            </Svg>
          ),
          onPress: () => navigation.getParent()?.navigate('Notifications'),
        },
        {
          label: t('settings.tutorial'),
          subtitle: `${t('settings.tutorialSubtitle')} · ${t('common.percentComplete', {
            percent: tutorialStats.percent,
          })}`,
          color: '#0F766E',
          icon: (
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Path d="M4 6 H20 V18 H4 Z" stroke="#0F766E" strokeWidth={2} />
              <Path d="M8 10 H16 M8 14 H13" stroke="#0F766E" strokeWidth={2} />
            </Svg>
          ),
          onPress: () => navigation.getParent()?.navigate('Tutorial'),
        },
        {
          label: t('settings.security'),
          color: '#7C3AED',
          icon: (
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Path d="M12 3 L20 7 V12 C20 17 16.5 20.5 12 21 C7.5 20.5 4 17 4 12 V7 Z" stroke="#7C3AED" strokeWidth={2} />
            </Svg>
          ),
          onPress: () => navigation.getParent()?.navigate('Security'),
        },
        {
          label: t('settings.helpSupport'),
          color: '#6B7280',
          icon: (
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Circle cx={12} cy={12} r={9} stroke="#6B7280" strokeWidth={2} />
              <Path d="M10 10 C10 8 14 8 14 10 C14 12 12 12 12 14" stroke="#6B7280" strokeWidth={2} />
            </Svg>
          ),
          onPress: () => navigation.getParent()?.navigate('HelpSupport'),
        },
      ],
    },
    {
      title: t('settings.other'),
      items: [
        {
          label: t('settings.backupRestore'),
          color: '#2563EB',
          icon: (
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Path d="M7 18 H17 C19 18 21 16 21 14 C21 11 18 9 15 9 C14 5 11 3 7 3 C4 3 2 5 2 8 C2 11 4 13 7 13" stroke="#2563EB" strokeWidth={2} />
            </Svg>
          ),
          onPress: () =>
            comingSoon(t('settings.backupRestore'), t('common.comingSoon'), t('settings.comingSoonBody')),
        },
        {
          label: t('common.signOut'),
          color: colors.danger,
          danger: true,
          icon: (
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Path d="M10 5 H5 V19 H10 M15 12 H8 M18 8 L21 12 L18 16" stroke={colors.danger} strokeWidth={2} strokeLinecap="round" />
            </Svg>
          ),
          onPress: handleLogout,
        },
      ],
    },
  ];

  const hasShop = Boolean(user?.shopName?.trim());
  const shopName = hasShop ? user!.shopName! : t('settings.registerYourShop');
  const profileUri = user?.profileImage;
  const shopUri = user?.shopImage;
  const verified = user?.isShopVerified || user?.shopVerificationStatus === 'verified';

  return (
    <View style={stStyles.stScreen}>
      <LinearGradient
        colors={[colors.primaryDark, colors.primary]}
        style={[stStyles.stHero, { paddingTop: insets.top + 16 }]}
      >
        <Text style={stStyles.stHeroTitle}>{t('settings.profile')}</Text>

        <Pressable style={stStyles.stProfileCard} onPress={openShopProfile}>
          <View style={stStyles.stAvatarWrap}>
            {profileUri ? (
              <Image source={{ uri: profileUri }} style={stStyles.stAvatar} />
            ) : (
              <View style={stStyles.stAvatarPlaceholder}>
                <Text style={stStyles.stAvatarText}>{getInitials(user?.fullName || shopName)}</Text>
              </View>
            )}
            {shopUri ? (
              <Image source={{ uri: shopUri }} style={stStyles.stShopBadge} />
            ) : (
              <View style={stStyles.stShopBadgePlaceholder}>
                <Text style={stStyles.stShopBadgeText}>{getInitials(shopName).slice(0, 1)}</Text>
              </View>
            )}
          </View>

          <View style={stStyles.stProfileInfo}>
            <Text style={stStyles.stProfileName} numberOfLines={1}>
              {user?.fullName || 'Shopkeeper'}
            </Text>
            <Text style={stStyles.stProfileShop} numberOfLines={1}>
              {shopName}
            </Text>
            <Text style={stStyles.stProfileEmail} numberOfLines={1}>
              {user?.email}
            </Text>
            <View style={stStyles.stBadgeRow}>
              <View style={[stStyles.stBadge, verified ? stStyles.stBadgeVerified : stStyles.stBadgePending]}>
                <Text style={[stStyles.stBadgeText, verified ? stStyles.stBadgeTextVerified : stStyles.stBadgeTextPending]}>
                  {verified ? t('settings.verifiedShop') : t('settings.shopProfileBadge')}
                </Text>
              </View>
              {user?.authProvider !== 'google' ? (
                <View
                  style={[
                    stStyles.stBadge,
                    user?.isEmailVerified ? stStyles.stBadgeVerified : stStyles.stBadgeEmailPending,
                  ]}
                >
                  <Text
                    style={[
                      stStyles.stBadgeText,
                      user?.isEmailVerified ? stStyles.stBadgeTextVerified : stStyles.stBadgeTextEmailPending,
                    ]}
                  >
                    {user?.isEmailVerified ? t('settings.emailVerified') : t('settings.emailNotVerified')}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          <Text style={stStyles.stEditHint}>{t('settings.editHint')}</Text>
        </Pressable>
      </LinearGradient>

      <ScrollView
        style={stStyles.stScroll}
        contentContainerStyle={[stStyles.stContent, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <EmailVerificationBanner compact />
        <View style={stStyles.stLanguageCard}>
          <LanguageSwitcher />
        </View>
        {sections.map((section) => (
          <View key={section.title} style={stStyles.stSection}>
            <Text style={stStyles.stSectionTitle}>{section.title}</Text>
            <View style={stStyles.stSectionCard}>
              {section.items.map((item, index) => (
                <View key={item.label}>
                  <MenuRow item={item} />
                  {index < section.items.length - 1 ? <View style={stStyles.stDivider} /> : null}
                </View>
              ))}
            </View>
          </View>
        ))}

        <View style={stStyles.stSecurityBanner}>
          <View style={stStyles.stSecurityIcon}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path
                d="M12 3 L20 7 V12 C20 17 16.5 20.5 12 21 C7.5 20.5 4 17 4 12 V7 Z"
                stroke={colors.primary}
                strokeWidth={2}
              />
              <Path d="M9 12 L11 14 L15 10" stroke={colors.primary} strokeWidth={2} />
            </Svg>
          </View>
          <Text style={stStyles.stSecurityText}>{t('settings.securityBanner')}</Text>
        </View>

        <Text style={stStyles.stVersion}>{t('settings.version')}</Text>
      </ScrollView>
    </View>
  );
}

const stStyles = StyleSheet.create({
  stScreen: { flex: 1, backgroundColor: '#F4F5F7' },
  stHero: {
    paddingHorizontal: 16,
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  stHeroTitle: {
    color: '#FFFFFF',
    fontSize: t.h1,
    fontWeight: '800',
    marginBottom: 14,
  },
  stProfileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  stAvatarWrap: { position: 'relative' },
  stAvatar: { width: 52, height: 52, borderRadius: 26 },
  stAvatarPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stAvatarText: { color: '#FFF', fontWeight: '800', fontSize: t.lg },
  stShopBadge: {
    position: 'absolute',
    bottom: -2,
    right: -4,
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  stShopBadgePlaceholder: {
    position: 'absolute',
    bottom: -2,
    right: -4,
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: colors.primaryDark,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stShopBadgeText: { color: '#FFF', fontSize: t.xs, fontWeight: '800' },
  stProfileInfo: { flex: 1, minWidth: 0 },
  stProfileName: { fontSize: t.lg, fontWeight: '800', color: colors.text },
  stProfileShop: { fontSize: t.body, color: colors.primary, fontWeight: '600', marginTop: 2 },
  stProfileEmail: { fontSize: t.caption, color: colors.textMuted, marginTop: 3 },
  stBadgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  stBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  stBadgeVerified: { backgroundColor: '#DCFCE7' },
  stBadgePending: { backgroundColor: '#F3F4F6' },
  stBadgeEmailPending: { backgroundColor: '#FEF3C7' },
  stBadgeText: { fontSize: t.sm, fontWeight: '700' },
  stBadgeTextVerified: { color: colors.primary },
  stBadgeTextPending: { color: colors.textMuted },
  stBadgeTextEmailPending: { color: colors.warning },
  stEditHint: { fontSize: t.bodyLg, fontWeight: '700', color: colors.primary },
  stScroll: { flex: 1, marginTop: -4 },
  stContent: { paddingHorizontal: 16, paddingTop: 16 },
  stLanguageCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#ECEEF2',
  },
  stSection: { marginBottom: 14 },
  stSectionTitle: {
    fontSize: t.caption,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
    marginLeft: 4,
  },
  stSectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#ECEEF2',
  },
  stMenuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
  },
  stMenuRowPressed: { backgroundColor: '#F9FAFB' },
  stRowIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stMenuRowBody: { flex: 1 },
  stMenuRowLabel: { fontSize: t.bodyLg, fontWeight: '600', color: colors.text },
  stMenuRowSub: { fontSize: t.caption, color: colors.textMuted, marginTop: 2 },
  stMenuRowDanger: { color: colors.danger },
  stMenuBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stMenuBadgeText: { color: '#FFFFFF', fontSize: t.xs, fontWeight: '800' },
  stMenuRowChevron: { fontSize: t.xxl, color: '#C4C9D4', fontWeight: '300' },
  stDivider: { height: 1, backgroundColor: '#F0F2F5', marginLeft: 66 },
  stSecurityBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderRadius: 14,
    padding: 12,
    gap: 10,
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  stSecurityIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stSecurityText: {
    flex: 1,
    fontSize: t.body,
    color: colors.text,
    lineHeight: 17,
  },
  stVersion: {
    textAlign: 'center',
    fontSize: t.caption,
    color: colors.textMuted,
    marginTop: 16,
  },
});
