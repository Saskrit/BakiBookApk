import { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  CompositeNavigationProp,
  useFocusEffect,
  useNavigation,
} from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { fetchPortalDashboard, fetchPendingLinks } from '../../api/portal';
import { CustomerLoading } from '../../components/customer/CustomerUi';
import { appAlert } from '../../contexts/DialogContext';
import { customerColors as c } from '../../theme/customerColors';
import { typeScale } from '../../theme/typography';
import { spacing } from '../../theme/spacing';
import { radius } from '../../theme/radius';

import { formatRs } from '../../utils/format';
import type { CustomerTabParamList, RootStackParamList } from '../../navigation/types';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<CustomerTabParamList, 'Shops'>,
  NativeStackNavigationProp<RootStackParamList>
>;

type ShopRow = {
  id?: string;
  shopName: string;
  shopkeeper?: string;
  phone?: string;
  location?: string;
  balance: number;
  creditScore?: string;
  transactionCount?: number;
  lastTransaction?: string | null;
  badge?: string;
};

type FilterKey = 'all' | 'due' | 'cleared';

const ACCENTS = [
  { bg: '#FFEDD5', fg: '#EA580C', amount: '#EA580C', btn: '#F97316' },
  { bg: '#DBEAFE', fg: '#2563EB', amount: '#2563EB', btn: '#3B82F6' },
  { bg: '#EDE9FE', fg: '#7C3AED', amount: '#7C3AED', btn: '#8B5CF6' },
  { bg: '#DCFCE7', fg: '#16A34A', amount: '#16A34A', btn: '#22C55E' },
];

export default function ShopsScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const [shops, setShops] = useState<ShopRow[]>([]);
  const [summary, setSummary] = useState({
    currentDue: 0,
    totalShops: 0,
    totalTransactions: 0,
  });
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');

  const load = useCallback(async () => {
    const [dashboard, pending] = await Promise.all([
      fetchPortalDashboard(),
      fetchPendingLinks(),
    ]);
    setShops((dashboard.shops || []) as ShopRow[]);
    setSummary({
      currentDue: dashboard.summary?.currentDue || 0,
      totalShops: dashboard.summary?.totalShops ?? (dashboard.shops || []).length,
      totalTransactions: dashboard.summary?.totalTransactions || 0,
    });
    setPendingCount(pending.count || 0);
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load()
        .catch(() => setShops([]))
        .finally(() => setLoading(false));
    }, [load])
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return shops.filter((shop) => {
      if (filter === 'due' && !(shop.balance > 0)) return false;
      if (filter === 'cleared' && shop.balance > 0) return false;
      if (!q) return true;
      return (
        shop.shopName.toLowerCase().includes(q) ||
        (shop.shopkeeper || '').toLowerCase().includes(q) ||
        (shop.location || '').toLowerCase().includes(q)
      );
    });
  }, [shops, query, filter]);

  const openFilter = () => {
    appAlert(t('customer.filterShops'), t('customer.filterShopsBody'), [
      {
        text: t('customer.filterAll'),
        onPress: () => setFilter('all'),
      },
      {
        text: t('customer.filterDue'),
        onPress: () => setFilter('due'),
      },
      {
        text: t('customer.filterCleared'),
        onPress: () => setFilter('cleared'),
      },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  const openShopMenu = (shop: ShopRow) => {
    appAlert(shop.shopName, undefined, [
      {
        text: t('customer.shopDetails'),
        onPress: () => {
          if (shop.id) {
            navigation.navigate('ShopDetail', {
              customerId: shop.id,
              shopName: shop.shopName,
            });
          }
        },
      },
      {
        text: t('customer.viewLedger'),
        onPress: () =>
          navigation.navigate('Ledger', {
            customerId: shop.id,
            shopName: shop.shopName,
          }),
      },
      {
        text: t('customer.viewPayments'),
        onPress: () =>
          navigation.navigate('Payments', {
            customerId: shop.id,
            shopName: shop.shopName,
          }),
      },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  const openShopDetail = (shop: ShopRow) => {
    if (!shop.id) return;
    navigation.navigate('ShopDetail', {
      customerId: shop.id,
      shopName: shop.shopName,
    });
  };

  const badgeMeta = (badge?: string) => {
    if (badge === 'preferred') {
      return { label: t('customer.badgePreferred'), bg: '#DBEAFE', fg: '#1D4ED8' };
    }
    if (badge === 'active') {
      return { label: t('customer.badgeActive'), bg: '#DCFCE7', fg: '#15803D' };
    }
    if (badge === 'cleared') {
      return { label: t('customer.badgeCleared'), bg: '#ECFDF5', fg: '#047857' };
    }
    return { label: t('customer.badgeRegular'), bg: '#FEF3C7', fg: '#B45309' };
  };

  if (loading) return <CustomerLoading />;

  return (
    <View style={[shStyles.shScreen, { paddingTop: insets.top }]}>
      <FlatList
        contentContainerStyle={[shStyles.shContent, { paddingBottom: insets.bottom + 28 }]}
        data={filtered}
        keyExtractor={(item, index) => item.id || `${item.shopName}-${index}`}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
            tintColor={c.peachDark}
          />
        }
        ListHeaderComponent={
          <View>
            <View style={shStyles.shHeaderRow}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={shStyles.shTitle}>{t('customer.myShops')}</Text>
                <Text style={shStyles.shSubtitle}>{t('customer.myShopsSubtitle')}</Text>
              </View>
              <Pressable
                style={shStyles.shAddBtn}
                onPress={() => navigation.navigate('LinkShops')}
              >
                <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                  <Path d="M12 5 V19 M5 12 H19" stroke="#F97316" strokeWidth={2.5} />
                </Svg>
                <Text style={shStyles.shAddBtnText}>{t('customer.addShop')}</Text>
              </Pressable>
            </View>

            {/* Summary */}
            <View style={shStyles.shSummaryCard}>
              <View style={shStyles.shSummaryLeft}>
                <View style={[shStyles.shSummaryIcon, { backgroundColor: '#DBEAFE' }]}>
                  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                    <Path
                      d="M4 9 L5 4 H19 L20 9 M5 9 V19 H19 V9"
                      stroke="#2563EB"
                      strokeWidth={2}
                    />
                  </Svg>
                </View>
                <Text style={shStyles.shSummaryLabel}>{t('customer.totalOutstanding')}</Text>
                <Text style={shStyles.shSummaryAmount}>{formatRs(summary.currentDue)}</Text>
                <Text style={shStyles.shSummaryMeta}>
                  {t('customer.acrossShops', { count: summary.totalShops })}
                </Text>
              </View>
              <View style={shStyles.shSummaryRight}>
                <View style={shStyles.shStatBox}>
                  <View style={[shStyles.shMiniIcon, { backgroundColor: '#DCFCE7' }]}>
                    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                      <Path
                        d="M6 8 H18 L17 20 H7 Z M9 8 V6 C9 4.5 10 3.5 12 3.5 C14 3.5 15 4.5 15 6 V8"
                        stroke="#16A34A"
                        strokeWidth={2}
                      />
                    </Svg>
                  </View>
                  <Text style={shStyles.shStatLabel}>{t('customer.totalShops')}</Text>
                  <Text style={[shStyles.shStatValue, { color: '#16A34A' }]}>
                    {summary.totalShops}
                  </Text>
                </View>
                <View style={shStyles.shStatBox}>
                  <View style={[shStyles.shMiniIcon, { backgroundColor: '#EDE9FE' }]}>
                    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                      <Rect x={5} y={3} width={14} height={18} rx={2} stroke="#7C3AED" strokeWidth={2} />
                      <Path d="M8 8 H16 M8 12 H14" stroke="#7C3AED" strokeWidth={2} />
                    </Svg>
                  </View>
                  <Text style={shStyles.shStatLabel}>{t('customer.totalTransactions')}</Text>
                  <Text style={[shStyles.shStatValue, { color: '#7C3AED' }]}>
                    {summary.totalTransactions}
                  </Text>
                </View>
              </View>
            </View>

            {pendingCount > 0 ? (
              <Pressable
                style={shStyles.shPendingBanner}
                onPress={() => navigation.navigate('LinkShops')}
              >
                <Text style={shStyles.shPendingText}>
                  {t('customer.invitationsBody', { count: pendingCount })}
                </Text>
                <Text style={shStyles.shPendingLink}>{t('customer.reviewLinks')}</Text>
              </Pressable>
            ) : null}

            {/* Search + Filter */}
            <View style={shStyles.shSearchRow}>
              <View style={shStyles.shSearchBox}>
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                  <Circle cx={11} cy={11} r={6} stroke="#94A3B8" strokeWidth={2} />
                  <Path d="M16 16 L20 20" stroke="#94A3B8" strokeWidth={2} strokeLinecap="round" />
                </Svg>
                <TextInput
                  style={shStyles.shSearchInput}
                  placeholder={t('customer.searchShops')}
                  placeholderTextColor="#94A3B8"
                  value={query}
                  onChangeText={setQuery}
                />
              </View>
              <Pressable style={shStyles.shFilterBtn} onPress={openFilter}>
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M4 6 H20 M7 12 H17 M10 18 H14"
                    stroke="#F97316"
                    strokeWidth={2}
                    strokeLinecap="round"
                  />
                </Svg>
                <Text style={shStyles.shFilterText}>{t('customer.filter')}</Text>
              </Pressable>
            </View>

            {filter !== 'all' ? (
              <Text style={shStyles.shFilterHint}>
                {filter === 'due' ? t('customer.filterDue') : t('customer.filterCleared')}
              </Text>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <View style={shStyles.shEmptyWrap}>
            <Text style={shStyles.shEmpty}>{t('customer.noShops')}</Text>
            <Pressable
              style={shStyles.shEmptyBtn}
              onPress={() => navigation.navigate('LinkShops')}
            >
              <Text style={shStyles.shEmptyBtnText}>{t('customer.addShop')}</Text>
            </Pressable>
          </View>
        }
        ListFooterComponent={
          shops.length > 0 ? (
            <View style={shStyles.shTipBanner}>
              <View style={shStyles.shTipIcon}>
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M12 3 L20 7 V12 C20 16 16.5 19.5 12 21 C7.5 19.5 4 16 4 12 V7 Z"
                    stroke="#2563EB"
                    strokeWidth={2}
                  />
                  <Path
                    d="M9 12 L11 14 L15 10"
                    stroke="#2563EB"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={shStyles.shTipText}>{t('customer.creditTip')}</Text>
              </View>
              <Pressable
                style={shStyles.shTipBtn}
                onPress={() =>
                  appAlert(t('customer.creditTipTitle'), t('customer.creditTipBody'))
                }
              >
                <Text style={shStyles.shTipBtnText}>{t('customer.learnMore')}</Text>
              </Pressable>
            </View>
          ) : null
        }
        renderItem={({ item, index }) => {
          const accent = ACCENTS[index % ACCENTS.length];
          const badge = badgeMeta(item.badge);
          return (
            <Pressable style={shStyles.shShopCard} onPress={() => openShopDetail(item)}>
              <View style={shStyles.shShopTop}>
                <View style={[shStyles.shShopIcon, { backgroundColor: accent.bg }]}>
                  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                    <Path
                      d="M6 8 H18 L17 20 H7 Z M9 8 V6 C9 4.5 10 3.5 12 3.5 C14 3.5 15 4.5 15 6 V8"
                      stroke={accent.fg}
                      strokeWidth={2}
                    />
                  </Svg>
                </View>
                <View style={shStyles.shShopInfo}>
                  <Text style={shStyles.shShopName}>{item.shopName}</Text>
                  {item.creditScore ? (
                    <View style={shStyles.shScoreRow}>
                      <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
                        <Path
                          d="M12 3 L14.5 9 H21 L16 13 L18 20 L12 16 L6 20 L8 13 L3 9 H9.5 Z"
                          fill="#F59E0B"
                        />
                      </Svg>
                      <Text style={shStyles.shScoreText}>
                        {t(`customer.scores.${String(item.creditScore).toLowerCase()}`, {
                          defaultValue: item.creditScore,
                        })}
                      </Text>
                    </View>
                  ) : null}
                  {item.location ? (
                    <View style={shStyles.shMetaRow}>
                      <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
                        <Path
                          d="M12 21 C12 21 5 14 5 10 C5 6.1 8.1 3 12 3 C15.9 3 19 6.1 19 10 C19 14 12 21 12 21 Z"
                          stroke="#94A3B8"
                          strokeWidth={2}
                        />
                        <Circle cx={12} cy={10} r={2.5} fill="#94A3B8" />
                      </Svg>
                      <Text style={shStyles.shMetaText} numberOfLines={1}>
                        {item.location}
                      </Text>
                    </View>
                  ) : null}
                  {item.phone ? (
                    <View style={shStyles.shMetaRow}>
                      <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
                        <Path
                          d="M6 4 H10 L12 9 L9.5 10.5 C10.5 12.5 12 14 14 15 L15.5 12.5 L20.5 14.5 V18.5 C20.5 19.5 19.5 20.5 18.5 20.5 C10.5 20.5 3.5 13.5 3.5 5.5 C3.5 4.5 4.5 3.5 5.5 3.5"
                          stroke="#94A3B8"
                          strokeWidth={1.8}
                        />
                      </Svg>
                      <Text style={shStyles.shMetaText}>{item.phone}</Text>
                    </View>
                  ) : null}
                  <View style={[shStyles.shBadge, { backgroundColor: badge.bg }]}>
                    <Text style={[shStyles.shBadgeText, { color: badge.fg }]}>{badge.label}</Text>
                  </View>
                </View>

                <View style={shStyles.shShopRight}>
                  <Pressable hitSlop={8} onPress={() => openShopMenu(item)}>
                    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                      <Circle cx={12} cy={6} r={1.6} fill="#94A3B8" />
                      <Circle cx={12} cy={12} r={1.6} fill="#94A3B8" />
                      <Circle cx={12} cy={18} r={1.6} fill="#94A3B8" />
                    </Svg>
                  </Pressable>
                  <Text style={shStyles.shOutstandingLabel}>{t('customer.outstanding')}</Text>
                  <Text style={[shStyles.shOutstandingAmount, { color: accent.amount }]}>
                    {formatRs(item.balance)}
                  </Text>
                  {item.lastTransaction ? (
                    <Text style={shStyles.shLastTx}>{item.lastTransaction}</Text>
                  ) : null}
                  <Pressable
                    style={[shStyles.shLedgerBtn, { backgroundColor: accent.btn }]}
                    onPress={() => openShopDetail(item)}
                  >
                    <Text style={shStyles.shLedgerBtnText}>{t('customer.viewDetails')}</Text>
                    <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
                      <Path
                        d="M9 6 L15 12 L9 18"
                        stroke="#FFF"
                        strokeWidth={2.5}
                        strokeLinecap="round"
                      />
                    </Svg>
                  </Pressable>
                </View>
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const shStyles = StyleSheet.create({
  shScreen: { flex: 1, backgroundColor: '#F7F8FC' },
  shContent: { paddingHorizontal: spacing.md, paddingTop: 8, gap: spacing.sm },
  shHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  shTitle: {
    fontSize: typeScale.h1.fontSize,
    lineHeight: typeScale.h1.lineHeight,
    fontFamily: typeScale.h1.fontFamily,
    fontWeight: '700',
    color: '#1E293B',
  },
  shSubtitle: { marginTop: 4, fontSize: 13, color: '#64748B', lineHeight: 18 },
  shAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1.5,
    borderColor: '#F97316',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFF',
  },
  shAddBtnText: { color: '#F97316', fontWeight: '800', fontSize: 12 },
  shSummaryCard: {
    backgroundColor: '#EEF2F7',
    borderRadius: radius.container,
    padding: spacing.md,
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: 4,
  },
  shSummaryLeft: { flex: 1.2 },
  shSummaryRight: { flex: 1, gap: 8 },
  shSummaryIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  shSummaryLabel: { fontSize: 12, fontWeight: '700', color: '#64748B' },
  shSummaryAmount: {
    marginTop: 4,
    fontSize: typeScale.h1.fontSize,
    lineHeight: typeScale.h1.lineHeight,
    fontFamily: typeScale.h1.fontFamily,
    fontWeight: '700',
    color: '#2563EB',
  },
  shSummaryMeta: { marginTop: 2, fontSize: 12, color: '#94A3B8', fontWeight: '600' },
  shStatBox: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 10,
  },
  shMiniIcon: {
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  shStatLabel: { fontSize: 10, fontWeight: '700', color: '#64748B' },
  shStatValue: { marginTop: 2, fontSize: 18, fontWeight: '800' },
  shPendingBanner: {
    backgroundColor: c.sky,
    borderRadius: 14,
    padding: 12,
    marginTop: 4,
  },
  shPendingText: { color: c.text, fontWeight: '600', fontSize: 13 },
  shPendingLink: { marginTop: 4, color: c.peachDark, fontWeight: '800' },
  shSearchRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  shSearchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF',
    borderRadius: 14,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    height: 46,
  },
  shSearchInput: { flex: 1, fontSize: 14, color: '#1E293B', paddingVertical: 0 },
  shFilterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF',
    borderRadius: 14,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    height: 46,
  },
  shFilterText: { color: '#F97316', fontWeight: '800', fontSize: 12 },
  shFilterHint: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '700',
    color: '#F97316',
  },
  shEmptyWrap: { alignItems: 'center', paddingVertical: 40, gap: spacing.sm },
  shEmpty: { textAlign: 'center', color: '#64748B', lineHeight: 20 },
  shEmptyBtn: {
    borderRadius: 999,
    backgroundColor: '#F97316',
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  shEmptyBtnText: { color: '#FFF', fontWeight: '800' },
  shShopCard: {
    backgroundColor: '#FFF',
    borderRadius: radius.container,
    padding: spacing.md,
    shadowColor: '#0F172A',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  shShopTop: { flexDirection: 'row', gap: 10 },
  shShopIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shShopInfo: { flex: 1, paddingRight: 4 },
  shShopName: { fontSize: 15, fontWeight: '800', color: '#1E293B' },
  shScoreRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  shScoreText: { fontSize: 12, fontWeight: '700', color: '#64748B' },
  shMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  shMetaText: { flex: 1, fontSize: 11, color: '#94A3B8', fontWeight: '600' },
  shBadge: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  shBadgeText: { fontSize: 10, fontWeight: '800' },
  shShopRight: { alignItems: 'flex-end', width: 118 },
  shOutstandingLabel: { marginTop: 8, fontSize: 10, fontWeight: '700', color: '#94A3B8' },
  shOutstandingAmount: { marginTop: 2, fontSize: 14, fontWeight: '800' },
  shLastTx: { marginTop: 2, fontSize: 10, color: '#94A3B8' },
  shLedgerBtn: {
    marginTop: 10,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  shLedgerBtnText: { color: '#FFF', fontWeight: '800', fontSize: 11 },
  shTipBanner: {
    marginTop: 6,
    backgroundColor: '#EAF2FF',
    borderRadius: radius.card,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  shTipIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.container,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shTipText: { fontSize: 12, color: '#334155', lineHeight: 17, fontWeight: '600' },
  shTipBtn: {
    borderWidth: 1,
    borderColor: '#3B82F6',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  shTipBtnText: { color: '#2563EB', fontWeight: '800', fontSize: 11 },
});
