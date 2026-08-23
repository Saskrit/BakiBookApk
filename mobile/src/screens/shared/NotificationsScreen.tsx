import { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { customerColors as cc } from '../../theme/customerColors';
import { colors } from '../../theme/colors';
import { typeScale } from '../../theme/typography';
import { spacing } from '../../theme/spacing';
import { radius } from '../../theme/radius';

import { formatRs } from '../../utils/format';
import type { AppNotification } from '../../types/notification';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Notifications'>;
type Category = 'all' | 'payments' | 'stores' | 'account' | 'offers';
type ListRow =
  | { kind: 'header'; id: string; label: string }
  | { kind: 'item'; id: string; item: AppNotification };

function mapNotificationTitleKey(title: string): string | null {
  const map: Record<string, string> = {
    'Credit added': 'notifications.keys.creditAdded',
    'New credit added': 'notifications.keys.creditNew',
    'Payment received': 'notifications.keys.paymentReceived',
    'Payment recorded': 'notifications.keys.paymentRecorded',
    'Shop invitation': 'notifications.keys.shopInvitation',
    'Customer linked': 'notifications.keys.customerLinked',
    'Shop linked': 'notifications.keys.shopLinked',
    'Shop verified': 'notifications.keys.shopVerified',
    'Shop verification declined': 'notifications.keys.shopDeclined',
    'Due reminder sent': 'notifications.keys.reminderSent',
    'Payment reminder': 'notifications.keys.reminderPayment',
    'Payment accepted': 'notifications.keys.paymentAccepted',
    'Payment rejected': 'notifications.keys.paymentRejected',
    'Payment reported': 'notifications.keys.paymentReported',
    'Payment submitted': 'notifications.keys.paymentSubmitted',
  };
  return map[title] || null;
}

function categorize(item: AppNotification): Category {
  const hay = `${item.title} ${item.body} ${item.linkPath || ''}`.toLowerCase();
  if (
    hay.includes('payment') ||
    hay.includes('credit') ||
    hay.includes('due') ||
    hay.includes('reminder') ||
    hay.includes('rs.') ||
    hay.includes('npr')
  ) {
    return 'payments';
  }
  if (
    hay.includes('shop') ||
    hay.includes('invitation') ||
    hay.includes('link') ||
    hay.includes('store') ||
    hay.includes('customer linked')
  ) {
    return 'stores';
  }
  if (hay.includes('offer') || hay.includes('cashback') || hay.includes('promo')) {
    return 'offers';
  }
  return 'account';
}

function extractAmount(body: string): number | null {
  const match = body.match(/(?:Rs\.?|NPR)\s*([\d,]+(?:\.\d+)?)/i);
  if (!match) return null;
  const n = Number(match[1].replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

function dayBucket(item: AppNotification, t: (k: string) => string): string {
  const raw = item.createdAt ? new Date(item.createdAt) : null;
  if (!raw || Number.isNaN(raw.getTime())) return t('notifications.thisWeek');
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startYesterday = startToday - 86400000;
  const ts = raw.getTime();
  if (ts >= startToday) return t('common.today');
  if (ts >= startYesterday) return t('common.yesterday');
  return t('notifications.thisWeek');
}

function typeAccent(type: string, customerMode: boolean) {
  if (customerMode) {
    if (type === 'success') return '#16A34A';
    if (type === 'warning') return '#EA580C';
    return '#2563EB';
  }
  if (type === 'success') return colors.primary;
  if (type === 'warning') return colors.warning;
  return colors.accent;
}

function categoryIcon(cat: Category, color: string) {
  if (cat === 'payments') {
    return (
      <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
        <Rect x={3} y={6} width={18} height={12} rx={2} stroke={color} strokeWidth={2} />
        <Path d="M3 10 H21" stroke={color} strokeWidth={2} />
      </Svg>
    );
  }
  if (cat === 'stores') {
    return (
      <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
        <Path
          d="M4 9 L5 4 H19 L20 9 M5 9 V19 H19 V9"
          stroke={color}
          strokeWidth={2}
        />
      </Svg>
    );
  }
  if (cat === 'offers') {
    return (
      <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
        <Path
          d="M4 12 L12 4 H18 V10 L10 18 Z"
          stroke={color}
          strokeWidth={2}
        />
        <Circle cx={15} cy={7} r={1.2} fill={color} />
      </Svg>
    );
  }
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={8} r={3.5} stroke={color} strokeWidth={2} />
      <Path
        d="M5 19 C5 15.5 8 13.5 12 13.5 C16 13.5 19 15.5 19 19"
        stroke={color}
        strokeWidth={2}
      />
    </Svg>
  );
}

export default function NotificationsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { t } = useTranslation();
  const {
    notifications,
    unreadCount,
    loading,
    connected,
    refresh,
    markRead,
    markAllRead,
    archive,
  } = useNotifications();
  const [category, setCategory] = useState<Category>('all');

  const customerMode = user?.role === 'customer';
  const palette = customerMode
    ? {
        bg: '#F7F8FC',
        header: ['#FFF', '#FFF'] as const,
        card: cc.white,
        text: '#1E293B',
        muted: '#64748B',
        accent: '#F97316',
        unreadBg: '#FFF7ED',
        border: '#E2E8F0',
      }
    : {
        bg: colors.background,
        header: [colors.primaryDark, colors.primary] as const,
        card: colors.surface,
        text: colors.text,
        muted: colors.textMuted,
        accent: colors.primary,
        unreadBg: '#ECFDF5',
        border: colors.border,
      };

  const filtered = useMemo(() => {
    if (!customerMode || category === 'all') return notifications;
    return notifications.filter((n) => categorize(n) === category);
  }, [notifications, category, customerMode]);

  const rows: ListRow[] = useMemo(() => {
    if (!customerMode) {
      return filtered.map((item) => ({ kind: 'item' as const, id: item.id, item }));
    }
    const out: ListRow[] = [];
    let last = '';
    for (const item of filtered) {
      const label = dayBucket(item, t);
      if (label !== last) {
        last = label;
        out.push({ kind: 'header', id: `h-${label}`, label });
      }
      out.push({ kind: 'item', id: item.id, item });
    }
    return out;
  }, [filtered, customerMode, t]);

  const onPressItem = useCallback(
    async (item: AppNotification) => {
      if (!item.read) await markRead(item.id);
      const hay = `${item.title} ${item.body} ${item.linkPath || ''}`.toLowerCase();

      if (customerMode) {
        if (/link|invitation/i.test(hay)) {
          navigation.navigate('LinkShops');
          return;
        }
        if (/payment|screenshot|verified|rejected|reported|accepted/i.test(hay)) {
          navigation.navigate('Customer', { screen: 'Payments' });
          return;
        }
        if (item.customerId && /shop|due|credit|store/i.test(hay)) {
          navigation.navigate('ShopDetail', { customerId: item.customerId });
          return;
        }
        if (/profile|account/i.test(hay)) {
          navigation.navigate('Customer', { screen: 'Profile' });
          return;
        }
        if (/shop/i.test(hay)) {
          navigation.navigate('Customer', { screen: 'Shops' });
        }
        return;
      }

      if (item.customerId) {
        navigation.navigate('CustomerProfile', { customerId: item.customerId });
        return;
      }
      if (item.linkPath?.includes('/shop/settings')) {
        navigation.navigate('ShopProfile');
      }
    },
    [customerMode, markRead, navigation]
  );

  const actionFor = (item: AppNotification) => {
    const cat = categorize(item);
    const amount = extractAmount(item.body || '');
    const hay = `${item.title} ${item.body}`.toLowerCase();

    if (amount != null && (/verified|accepted|received|recorded|paid/i.test(hay))) {
      return { kind: 'amount' as const, text: `+ ${formatRs(amount)}`, color: '#16A34A' };
    }
    if (/under review|reported|pending/i.test(hay) || item.type === 'warning') {
      if (/payment/i.test(hay)) {
        return {
          kind: 'badge' as const,
          text: t('customer.underReview'),
          color: '#C2410C',
          bg: '#FFEDD5',
        };
      }
    }
    if (cat === 'payments' && /due|reminder/i.test(hay)) {
      return {
        kind: 'button' as const,
        text: t('customer.viewDetails'),
        color: '#2563EB',
      };
    }
    if (cat === 'stores' && /invitation|link/i.test(hay)) {
      return {
        kind: 'button' as const,
        text: t('customer.reviewLinks'),
        color: '#2563EB',
      };
    }
    if (cat === 'account' && /statement/i.test(hay)) {
      return {
        kind: 'button' as const,
        text: t('customer.viewStatement'),
        color: '#2563EB',
      };
    }
    return null;
  };

  const categories: Array<{ key: Category; label: string; color: string }> = [
    { key: 'all', label: t('notifications.filterAll'), color: '#F97316' },
    { key: 'payments', label: t('notifications.filterPayments'), color: '#16A34A' },
    { key: 'stores', label: t('notifications.filterStores'), color: '#2563EB' },
    { key: 'account', label: t('notifications.filterAccount'), color: '#7C3AED' },
    // Offers hidden until the backend emits promo/offer notifications.
  ];

  return (
    <View style={[ntStyles.ntScreen, { backgroundColor: palette.bg }]}>
      {customerMode ? (
        <View style={[ntStyles.ntCustomerHeader, { paddingTop: insets.top + 10 }]}>
          <View style={ntStyles.ntCustomerHeaderRow}>
            <Pressable
              onPress={() => navigation.goBack()}
              hitSlop={8}
              style={ntStyles.ntSettingsBtn}
            >
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M15 6 L9 12 L15 18"
                  stroke="#64748B"
                  strokeWidth={2.4}
                  strokeLinecap="round"
                />
              </Svg>
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={[ntStyles.ntCustomerTitle, { color: palette.text }]}>
                {t('notifications.title')}
              </Text>
              <Text style={[ntStyles.ntCustomerSubtitle, { color: palette.muted }]}>
                {t('notifications.customerSubtitle')}
              </Text>
            </View>
            <Pressable
              style={ntStyles.ntSettingsBtn}
              onPress={() => navigation.navigate('Customer', { screen: 'Profile' })}
            >
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Circle cx={12} cy={12} r={3} stroke="#64748B" strokeWidth={2} />
                <Path
                  d="M12 3 V5 M12 19 V21 M3 12 H5 M19 12 H21 M5.6 5.6 L7 7 M17 17 L18.4 18.4 M5.6 18.4 L7 17 M17 7 L18.4 5.6"
                  stroke="#64748B"
                  strokeWidth={2}
                  strokeLinecap="round"
                />
              </Svg>
            </Pressable>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={ntStyles.ntCatRow}
          >
            {categories.map((cat) => {
              const active = category === cat.key;
              return (
                <Pressable
                  key={cat.key}
                  style={[
                    ntStyles.ntCatChip,
                    active && { borderColor: cat.color, backgroundColor: '#FFF7ED' },
                  ]}
                  onPress={() => setCategory(cat.key)}
                >
                  {categoryIcon(cat.key === 'all' ? 'account' : cat.key, active ? cat.color : '#64748B')}
                  <Text
                    style={[
                      ntStyles.ntCatChipText,
                      { color: active ? cat.color : '#334155' },
                    ]}
                  >
                    {cat.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {unreadCount > 0 ? (
            <Pressable onPress={() => markAllRead()} style={ntStyles.ntMarkAllRow}>
              <Text style={ntStyles.ntMarkAllLink}>{t('notifications.markAllRead')}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <LinearGradient
          colors={[...palette.header]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[ntStyles.ntHeader, { paddingTop: insets.top + 10 }]}
        >
          <View style={ntStyles.ntHeaderRow}>
            <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
              <Text style={ntStyles.ntBack}>{t('common.back')}</Text>
            </Pressable>
            {unreadCount > 0 ? (
              <Pressable onPress={() => markAllRead()}>
                <Text style={ntStyles.ntMarkAll}>{t('notifications.markAllRead')}</Text>
              </Pressable>
            ) : (
              <View style={ntStyles.ntLivePill}>
                <View
                  style={[
                    ntStyles.ntLiveDot,
                    { backgroundColor: connected ? '#DCFCE7' : '#FEE2E2' },
                  ]}
                />
                <Text style={ntStyles.ntLiveText}>
                  {connected ? t('common.live') : t('common.offline')}
                </Text>
              </View>
            )}
          </View>
          <Text style={ntStyles.ntTitle}>{t('notifications.title')}</Text>
          <Text style={ntStyles.ntSubtitle}>
            {unreadCount > 0
              ? t('notifications.unreadLive', { count: unreadCount })
              : t('notifications.upToDate')}
          </Text>
        </LinearGradient>
      )}

      <FlatList
        data={rows}
        keyExtractor={(row) => row.id}
        contentContainerStyle={[ntStyles.ntList, { paddingBottom: insets.bottom + 24 }]}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={palette.accent} />
        }
        ListEmptyComponent={
          <View
            style={[
              ntStyles.ntEmptyCard,
              { backgroundColor: palette.card, borderColor: palette.border },
            ]}
          >
            <Text style={[ntStyles.ntEmptyTitle, { color: palette.text }]}>
              {t('notifications.emptyTitle')}
            </Text>
            <Text style={[ntStyles.ntEmptyBody, { color: palette.muted }]}>
              {t('notifications.emptyBody')}
            </Text>
          </View>
        }
        ListFooterComponent={
          customerMode ? (
            <View style={ntStyles.ntEnableCard}>
              <View style={ntStyles.ntEnableIcon}>
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M6 16 H18 L16.5 9.5 C16 7 14.2 5.5 12 5.5 C9.8 5.5 8 7 7.5 9.5 Z"
                    stroke="#CA8A04"
                    strokeWidth={2}
                  />
                  <Path
                    d="M10 18 C10 19.1 10.9 20 12 20 C13.1 20 14 19.1 14 18"
                    stroke="#CA8A04"
                    strokeWidth={2}
                  />
                </Svg>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={ntStyles.ntEnableTitle}>{t('notifications.liveUpdatesTitle')}</Text>
                <Text style={ntStyles.ntEnableBody}>{t('notifications.liveUpdatesBody')}</Text>
              </View>
              <View style={ntStyles.ntLiveStatus}>
                <View
                  style={[
                    ntStyles.ntLiveDot,
                    { backgroundColor: connected ? '#16A34A' : '#EF4444' },
                  ]}
                />
                <Text style={ntStyles.ntLiveStatusText}>
                  {connected ? t('common.live') : t('common.offline')}
                </Text>
              </View>
            </View>
          ) : null
        }
        renderItem={({ item: row }) => {
          if (row.kind === 'header') {
            return <Text style={ntStyles.ntSectionHeader}>{row.label}</Text>;
          }
          const item = row.item;
          const accent = typeAccent(item.type, customerMode);
          const titleKey = mapNotificationTitleKey(item.title);
          const displayTitle = titleKey ? t(titleKey) : item.title;
          const cat = categorize(item);
          const action = customerMode ? actionFor(item) : null;

          return (
            <Pressable
              onPress={() => onPressItem(item)}
              onLongPress={() => archive(item.id)}
              style={[
                ntStyles.ntCard,
                {
                  backgroundColor: item.read ? palette.card : palette.unreadBg,
                  borderColor: palette.border,
                },
              ]}
            >
              <View
                style={[
                  ntStyles.ntIconBubble,
                  {
                    backgroundColor:
                      cat === 'payments'
                        ? item.type === 'success'
                          ? '#DCFCE7'
                          : '#FFEDD5'
                        : cat === 'stores'
                          ? '#DBEAFE'
                          : cat === 'offers'
                            ? '#FEF3C7'
                            : '#EDE9FE',
                  },
                ]}
              >
                {categoryIcon(cat, accent)}
              </View>
              <View style={ntStyles.ntCardBody}>
                <Text style={[ntStyles.ntCardTitle, { color: palette.text }]}>{displayTitle}</Text>
                <Text style={[ntStyles.ntCardBodyText, { color: palette.muted }]}>{item.body}</Text>
                {!customerMode ? (
                  <Text style={[ntStyles.ntCardMeta, { color: palette.muted }]}>
                    {item.date || item.time || ''}
                    {!item.read ? ` · ${t('notifications.new')}` : ''}
                  </Text>
                ) : null}
              </View>
              {action ? (
                action.kind === 'amount' ? (
                  <Text style={[ntStyles.ntActionAmount, { color: action.color }]}>
                    {action.text}
                  </Text>
                ) : action.kind === 'badge' ? (
                  <View style={[ntStyles.ntActionBadge, { backgroundColor: action.bg }]}>
                    <Text style={[ntStyles.ntActionBadgeText, { color: action.color }]}>
                      {action.text}
                    </Text>
                  </View>
                ) : (
                  <View style={[ntStyles.ntActionBtn, { borderColor: action.color }]}>
                    <Text style={[ntStyles.ntActionBtnText, { color: action.color }]}>
                      {action.text}
                    </Text>
                  </View>
                )
              ) : (
                <Text style={ntStyles.ntChevron}>›</Text>
              )}
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const ntStyles = StyleSheet.create({
  ntScreen: { flex: 1 },
  ntCustomerHeader: {
    paddingHorizontal: spacing.md,
    paddingBottom: 8,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
  },
  ntCustomerHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  ntCustomerTitle: {
    fontSize: typeScale.h1.fontSize,
    lineHeight: typeScale.h1.lineHeight,
    fontFamily: typeScale.h1.fontFamily,
    fontWeight: '700',
  },
  ntCustomerSubtitle: { marginTop: 4, fontSize: 13, fontWeight: '600' },
  ntSettingsBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ntCatRow: { gap: 8, paddingVertical: spacing.sm },
  ntCatChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFF',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  ntCatChipText: { fontWeight: '800', fontSize: 12 },
  ntMarkAllRow: { alignSelf: 'flex-end', marginBottom: 4 },
  ntMarkAllLink: { color: '#F97316', fontWeight: '800', fontSize: 12 },
  ntHeader: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 20,
    borderBottomLeftRadius: radius.container,
    borderBottomRightRadius: radius.container,
  },
  ntHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  ntBack: { color: '#FFF', fontSize: 17, fontWeight: '600' },
  ntMarkAll: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  ntLivePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  ntLiveDot: { width: 8, height: 8, borderRadius: 4 },
  ntLiveText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  ntTitle: {
    color: '#FFF',
    fontSize: typeScale.h1.fontSize,
    lineHeight: typeScale.h1.lineHeight,
    fontFamily: typeScale.h1.fontFamily,
    fontWeight: '700',
  },
  ntSubtitle: { color: 'rgba(255,255,255,0.9)', marginTop: 4, fontSize: 14 },
  ntList: { padding: spacing.md, gap: 10 },
  ntSectionHeader: {
    marginTop: 8,
    marginBottom: 4,
    fontSize: 14,
    fontWeight: '800',
    color: '#64748B',
  },
  ntEmptyCard: {
    marginTop: 24,
    borderRadius: radius.container,
    borderWidth: 1,
    padding: 20,
  },
  ntEmptyTitle: { fontSize: 17, fontWeight: '700', marginBottom: 6 },
  ntEmptyBody: { fontSize: 14, lineHeight: 20 },
  ntCard: {
    flexDirection: 'row',
    borderRadius: radius.card,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: 10,
    alignItems: 'center',
    gap: 10,
  },
  ntIconBubble: {
    width: 40,
    height: 40,
    borderRadius: radius.container,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ntCardBody: { flex: 1 },
  ntCardTitle: { fontSize: 14, fontWeight: '800' },
  ntCardBodyText: { marginTop: 4, fontSize: 13, lineHeight: 18 },
  ntCardMeta: { marginTop: 8, fontSize: 12, fontWeight: '600' },
  ntActionAmount: { fontWeight: '800', fontSize: 13 },
  ntActionBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  ntActionBadgeText: { fontSize: 10, fontWeight: '800' },
  ntActionBtn: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  ntActionBtnText: { fontSize: 10, fontWeight: '800' },
  ntChevron: { fontSize: 18, color: '#CBD5E1' },
  ntEnableCard: {
    marginTop: 8,
    backgroundColor: '#FEFCE8',
    borderRadius: radius.card,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  ntEnableIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#FEF08A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ntEnableTitle: { fontWeight: '800', color: '#1E293B', fontSize: 13 },
  ntEnableBody: { marginTop: 2, color: '#92400E', fontSize: 11, fontWeight: '600', lineHeight: 15 },
  ntLiveStatus: { alignItems: 'center', gap: 4 },
  ntLiveStatusText: { fontSize: 10, fontWeight: '800', color: '#64748B' },
});
