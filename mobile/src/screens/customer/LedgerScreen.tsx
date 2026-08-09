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
  RouteProp,
  useFocusEffect,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { fetchPortalDashboard, fetchPortalLedger } from '../../api/portal';
import { CustomerLoading } from '../../components/customer/CustomerUi';
import { appAlert } from '../../contexts/DialogContext';
import { customerColors as c } from '../../theme/customerColors';
import { formatDate, formatRs } from '../../utils/format';
import type { CustomerTabParamList } from '../../navigation/types';

type TabKey = 'all' | 'credits' | 'payments';
type DateFilter = 'all' | '30' | '90';

type LedgerEntry = Record<string, unknown>;

type ListRow =
  | { kind: 'header'; id: string; label: string }
  | { kind: 'entry'; id: string; item: LedgerEntry };

function isCredit(item: LedgerEntry) {
  const type = String(item.type || '').toLowerCase();
  if (type === 'payment') return false;
  if (type === 'paid') return false;
  if (type === 'credit') return true;
  if (item.paymentAmount != null && item.creditAmount == null) return false;
  if (item.creditAmount != null) return true;
  return false;
}

function entryAmount(item: LedgerEntry) {
  if (isCredit(item)) return Number(item.creditAmount ?? 0);
  return Number(item.paymentAmount ?? 0);
}

function entryDate(item: LedgerEntry) {
  if (item.sortAt) {
    const d = new Date(String(item.sortAt));
    if (!Number.isNaN(d.getTime())) return d;
  }
  const raw = String(item.date || item.createdAt || '');
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatEntryWhen(item: LedgerEntry) {
  const d = entryDate(item);
  const dateLabel = d
    ? formatDate(d.toISOString())
    : item.date
      ? formatDate(String(item.date))
      : '';
  const timeLabel = item.time ? String(item.time) : '';
  return [dateLabel, timeLabel].filter(Boolean).join(' · ');
}

function monthLabel(date: Date) {
  return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

export default function LedgerScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const navigation = useNavigation<BottomTabNavigationProp<CustomerTabParamList, 'Ledger'>>();
  const route = useRoute<RouteProp<CustomerTabParamList, 'Ledger'>>();
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [outstanding, setOutstanding] = useState(0);
  const [shopCount, setShopCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<TabKey>('all');
  const [query, setQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [shopFilterId, setShopFilterId] = useState<string | undefined>();
  const [shopFilterName, setShopFilterName] = useState<string | undefined>();

  const load = useCallback(async (scopedCustomerId?: string) => {
    const [ledgerRes, dashboard] = await Promise.all([
      fetchPortalLedger(),
      fetchPortalDashboard().catch(() => null),
    ]);
    setEntries(ledgerRes.ledger || []);
    if (dashboard) {
      if (scopedCustomerId) {
        const shop = (dashboard.shops || []).find(
          (s) => String(s.id || '') === String(scopedCustomerId)
        );
        setOutstanding(Number(shop?.balance || 0));
        setShopCount(shop ? 1 : 0);
      } else {
        setOutstanding(dashboard.summary?.currentDue || 0);
        setShopCount(dashboard.summary?.totalShops ?? dashboard.shops?.length ?? 0);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      const scopedId = route.params?.customerId
        ? String(route.params.customerId)
        : undefined;
      setShopFilterId(scopedId);
      setShopFilterName(route.params?.shopName);
      setLoading(true);
      load(scopedId)
        .catch(() => setEntries([]))
        .finally(() => setLoading(false));
    }, [load, route.params?.customerId, route.params?.shopName])
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const cutoff =
      dateFilter === '30'
        ? Date.now() - 30 * 86400000
        : dateFilter === '90'
          ? Date.now() - 90 * 86400000
          : 0;

    return entries.filter((item) => {
      if (
        shopFilterId &&
        String(item.customerId || item.customer || '') !== String(shopFilterId)
      ) {
        return false;
      }

      const credit = isCredit(item);
      if (tab === 'credits' && !credit) return false;
      if (tab === 'payments' && credit) return false;

      const d = entryDate(item);
      if (cutoff && d && d.getTime() < cutoff) return false;

      if (!q) return true;
      const hay = [
        item.label,
        item.type,
        item.title,
        item.desc,
        item.shopName,
        item.shop,
        item.note,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [entries, tab, query, dateFilter, shopFilterId]);

  const totals = useMemo(() => {
    let credits = 0;
    let payments = 0;
    for (const item of filtered) {
      const amount = entryAmount(item);
      if (isCredit(item)) credits += amount;
      else payments += amount;
    }
    return { credits, payments, count: filtered.length };
  }, [filtered]);

  const rows: ListRow[] = useMemo(() => {
    const sorted = [...filtered].sort((a, b) => {
      const da = entryDate(a)?.getTime() || 0;
      const db = entryDate(b)?.getTime() || 0;
      return db - da;
    });

    const out: ListRow[] = [];
    let lastMonth = '';
    sorted.forEach((item, index) => {
      const d = entryDate(item);
      const label = d ? monthLabel(d) : t('customer.unknownDate');
      if (label !== lastMonth) {
        lastMonth = label;
        out.push({ kind: 'header', id: `h-${label}`, label });
      }
      out.push({
        kind: 'entry',
        id: String(item.id || `${label}-${index}`),
        item,
      });
    });
    return out;
  }, [filtered, t]);

  const openDateFilter = () => {
    appAlert(t('customer.dateRange'), t('customer.dateRangeBody'), [
      { text: t('customer.dateAll'), onPress: () => setDateFilter('all') },
      { text: t('customer.date30'), onPress: () => setDateFilter('30') },
      { text: t('customer.date90'), onPress: () => setDateFilter('90') },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  const openFilter = () => {
    appAlert(t('customer.filterLedger'), t('customer.filterLedgerBody'), [
      { text: t('customer.tabAll'), onPress: () => setTab('all') },
      { text: t('customer.tabCredits'), onPress: () => setTab('credits') },
      { text: t('customer.tabPayments'), onPress: () => setTab('payments') },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  const dateFilterLabel =
    dateFilter === '30'
      ? t('customer.date30')
      : dateFilter === '90'
        ? t('customer.date90')
        : t('customer.dateAll');

  if (loading) return <CustomerLoading />;

  return (
    <View style={[clStyles.clScreen, { paddingTop: insets.top }]}>
      <FlatList
        data={rows}
        keyExtractor={(row) => row.id}
        contentContainerStyle={{ paddingBottom: insets.bottom + 88 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load(shopFilterId);
              setRefreshing(false);
            }}
            tintColor={c.peachDark}
          />
        }
        ListHeaderComponent={
          <View style={clStyles.clHeaderWrap}>
            <View style={clStyles.clTopBar}>
              <View style={{ flex: 1 }}>
                <Text style={clStyles.clTitle}>{t('customer.myLedger')}</Text>
                <Text style={clStyles.clSubtitle}>{t('customer.myLedgerSubtitle')}</Text>
              </View>
              <Pressable style={clStyles.clFilterTopBtn} onPress={openFilter}>
                <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M4 6 H20 M7 12 H17 M10 18 H14"
                    stroke="#F97316"
                    strokeWidth={2}
                    strokeLinecap="round"
                  />
                </Svg>
                <Text style={clStyles.clFilterTopText}>{t('customer.filter')}</Text>
              </Pressable>
            </View>

            {shopFilterId ? (
              <View style={clStyles.clShopFilterBanner}>
                <Text style={clStyles.clShopFilterText}>
                  {t('customer.filteredByShop', { shop: shopFilterName || 'Shop' })}
                </Text>
                <Pressable
                  onPress={() => {
                    setShopFilterId(undefined);
                    setShopFilterName(undefined);
                    navigation.setParams({ customerId: undefined, shopName: undefined });
                    void load(undefined);
                  }}
                >
                  <Text style={clStyles.clShopFilterClear}>{t('customer.clearShopFilter')}</Text>
                </Pressable>
              </View>
            ) : null}

            <LinearGradient
              colors={['#FFE8D2', '#FFD7B0', '#FFC794']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={clStyles.clSummaryCard}
            >
              <View style={{ flex: 1 }}>
                <Text style={clStyles.clSummaryLabel}>{t('customer.currentOutstanding')}</Text>
                <Text style={clStyles.clSummaryAmount}>{formatRs(outstanding)}</Text>
                <Text style={clStyles.clSummaryMeta}>
                  {shopFilterId
                    ? t('customer.filteredByShop', { shop: shopFilterName || 'Shop' })
                    : t('customer.acrossShops', { count: shopCount })}
                </Text>
                <Pressable
                  style={clStyles.clSummaryBtn}
                  onPress={() =>
                    appAlert(
                      t('customer.ledgerSummaryTitle'),
                      t('customer.ledgerSummaryBody', {
                        due: formatRs(outstanding),
                        credits: formatRs(totals.credits),
                        payments: formatRs(totals.payments),
                        count: totals.count,
                      })
                    )
                  }
                >
                  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                    <Rect x={4} y={5} width={16} height={15} rx={2} stroke="#FFF" strokeWidth={2} />
                    <Path d="M8 3 V7 M16 3 V7 M4 10 H20" stroke="#FFF" strokeWidth={2} />
                  </Svg>
                  <Text style={clStyles.clSummaryBtnText}>{t('customer.viewSummary')}</Text>
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
              <View style={clStyles.clWalletArt}>
                <Svg width={88} height={88} viewBox="0 0 96 96" fill="none">
                  <Rect x={18} y={28} width={58} height={42} rx={10} fill="#F4A261" />
                  <Rect x={18} y={28} width={58} height={14} rx={6} fill="#E76F3C" />
                  <Circle cx={62} cy={52} r={8} fill="#FFD166" />
                  <Rect x={28} y={18} width={36} height={14} rx={4} fill="#2A9D8F" />
                </Svg>
              </View>
            </LinearGradient>

            <View style={clStyles.clTabs}>
              {(
                [
                  ['all', t('customer.tabAll')],
                  ['credits', t('customer.tabCredits')],
                  ['payments', t('customer.tabPayments')],
                ] as const
              ).map(([key, label]) => {
                const active = tab === key;
                return (
                  <Pressable
                    key={key}
                    style={[clStyles.clTab, active && clStyles.clTabActive]}
                    onPress={() => setTab(key)}
                  >
                    <Text
                      style={[
                        clStyles.clTabText,
                        active && clStyles.clTabTextActive,
                        key === 'credits' && !active && { color: '#2563EB' },
                        key === 'payments' && !active && { color: '#16A34A' },
                      ]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={clStyles.clSearchRow}>
              <View style={clStyles.clSearchBox}>
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                  <Circle cx={11} cy={11} r={6} stroke="#94A3B8" strokeWidth={2} />
                  <Path d="M16 16 L20 20" stroke="#94A3B8" strokeWidth={2} strokeLinecap="round" />
                </Svg>
                <TextInput
                  style={clStyles.clSearchInput}
                  placeholder={t('customer.searchLedger')}
                  placeholderTextColor="#94A3B8"
                  value={query}
                  onChangeText={setQuery}
                />
              </View>
              <Pressable style={clStyles.clDateBtn} onPress={openDateFilter}>
                <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                  <Rect x={4} y={5} width={16} height={15} rx={2} stroke="#F97316" strokeWidth={2} />
                  <Path d="M8 3 V7 M16 3 V7 M4 10 H20" stroke="#F97316" strokeWidth={2} />
                </Svg>
                <Text style={clStyles.clDateBtnText} numberOfLines={1}>
                  {dateFilterLabel}
                </Text>
              </Pressable>
            </View>
          </View>
        }
        ListEmptyComponent={
          <Text style={clStyles.clEmpty}>{t('customer.noLedger')}</Text>
        }
        renderItem={({ item: row }) => {
          if (row.kind === 'header') {
            return <Text style={clStyles.clMonthHeader}>{row.label}</Text>;
          }

          const item = row.item;
          const credit = isCredit(item);
          const amount = entryAmount(item);
          const title = String(
            item.label ||
              item.desc ||
              item.title ||
              (credit ? t('customer.badgeCredit') : t('customer.paymentReceived'))
          );
          const shop = String(item.shopName || item.shop || '');
          const when = formatEntryWhen(item);
          const balance =
            item.runningBalance != null
              ? Number(item.runningBalance)
              : typeof item.balance === 'number'
                ? Number(item.balance)
                : null;

          return (
            <Pressable
              style={clStyles.clTxCard}
              onPress={() =>
                appAlert(
                  title,
                  [
                    shop,
                    when,
                    credit
                      ? `${t('customer.badgeCredit')}: ${formatRs(amount)}`
                      : `${t('customer.badgePayment')}: ${formatRs(amount)}`,
                    balance != null
                      ? `${t('customer.balance')}: ${formatRs(balance)}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join('\n')
                )
              }
            >
              <View
                style={[
                  clStyles.clTxIcon,
                  { backgroundColor: credit ? '#FFEDD5' : '#DCFCE7' },
                ]}
              >
                {credit ? (
                  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                    <Path
                      d="M6 8 H18 L17 20 H7 Z M9 8 V6 C9 4.5 10 3.5 12 3.5 C14 3.5 15 4.5 15 6 V8"
                      stroke="#EA580C"
                      strokeWidth={2}
                    />
                  </Svg>
                ) : (
                  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                    <Path
                      d="M12 4 V16 M7 11 L12 16 L17 11"
                      stroke="#16A34A"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </Svg>
                )}
              </View>

              <View style={clStyles.clTxMid}>
                <Text style={clStyles.clTxTitle} numberOfLines={1}>
                  {title}
                </Text>
                {shop ? <Text style={clStyles.clTxShop}>{shop}</Text> : null}
                {when ? <Text style={clStyles.clTxWhen}>{when}</Text> : null}
              </View>

              <View style={clStyles.clTxRight}>
                <View
                  style={[
                    clStyles.clBadge,
                    { backgroundColor: credit ? '#FFEDD5' : '#DCFCE7' },
                  ]}
                >
                  <Text
                    style={[
                      clStyles.clBadgeText,
                      { color: credit ? '#EA580C' : '#16A34A' },
                    ]}
                  >
                    {credit ? t('customer.badgeCredit') : t('customer.badgePayment')}
                  </Text>
                </View>
                <Text style={[clStyles.clTxAmount, !credit && clStyles.clTxAmountPay]}>
                  {credit ? formatRs(amount) : `-${formatRs(amount)}`}
                </Text>
                {balance != null ? (
                  <Text style={clStyles.clTxBalance}>
                    {t('customer.balance')}: {formatRs(balance)}
                  </Text>
                ) : null}
              </View>
              <Text style={clStyles.clChevron}>›</Text>
            </Pressable>
          );
        }}
      />

      <View style={[clStyles.clBottomBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        <View style={clStyles.clBottomIcon}>
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            <Rect x={5} y={3} width={14} height={18} rx={2} stroke="#2563EB" strokeWidth={2} />
            <Path d="M8 8 H16 M8 12 H14" stroke="#2563EB" strokeWidth={2} />
          </Svg>
        </View>
        <View style={clStyles.clBottomStat}>
          <Text style={clStyles.clBottomLabel}>{t('customer.totalCredits')}</Text>
          <Text style={[clStyles.clBottomValue, { color: '#EA580C' }]}>
            {formatRs(totals.credits)}
          </Text>
        </View>
        <View style={clStyles.clBottomStat}>
          <Text style={clStyles.clBottomLabel}>{t('customer.totalPaymentsShort')}</Text>
          <Text style={[clStyles.clBottomValue, { color: '#16A34A' }]}>
            {formatRs(totals.payments)}
          </Text>
        </View>
        <View style={clStyles.clBottomStat}>
          <Text style={clStyles.clBottomLabel}>{t('customer.totalTx')}</Text>
          <Text style={[clStyles.clBottomValue, { color: '#2563EB' }]}>{totals.count}</Text>
        </View>
      </View>
    </View>
  );
}

const clStyles = StyleSheet.create({
  clScreen: { flex: 1, backgroundColor: '#F7F8FC' },
  clHeaderWrap: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 4 },
  clShopFilterBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  clShopFilterText: { flex: 1, fontSize: 12, fontWeight: '700', color: '#1D4ED8' },
  clShopFilterClear: { fontSize: 12, fontWeight: '800', color: '#2563EB' },
  clTopBar: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  clTitle: { fontSize: 26, fontWeight: '800', color: '#1E293B', letterSpacing: -0.3 },
  clSubtitle: { marginTop: 3, fontSize: 12, color: '#64748B' },
  clFilterTopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#FDBA74',
    backgroundColor: '#FFF',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  clFilterTopText: { color: '#F97316', fontWeight: '800', fontSize: 12 },
  clSummaryCard: {
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  clSummaryLabel: { fontSize: 12, fontWeight: '700', color: '#6B5344' },
  clSummaryAmount: {
    marginTop: 4,
    fontSize: 28,
    fontWeight: '800',
    color: '#EA580C',
    letterSpacing: -0.4,
  },
  clSummaryMeta: { marginTop: 2, fontSize: 12, color: '#8A6F5C', fontWeight: '600' },
  clSummaryBtn: {
    marginTop: 12,
    alignSelf: 'flex-start',
    backgroundColor: '#F97316',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  clSummaryBtnText: { color: '#FFF', fontWeight: '800', fontSize: 12 },
  clWalletArt: { opacity: 0.95 },
  clTabs: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 4,
    gap: 4,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#EEF2F7',
  },
  clTab: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: 'center',
  },
  clTabActive: { backgroundColor: '#FFEDD5' },
  clTabText: { fontSize: 11, fontWeight: '800', color: '#64748B' },
  clTabTextActive: { color: '#EA580C' },
  clSearchRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  clSearchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF',
    borderRadius: 12,
    paddingHorizontal: 10,
    height: 42,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  clSearchInput: { flex: 1, fontSize: 13, color: '#1E293B', paddingVertical: 0 },
  clDateBtn: {
    maxWidth: 120,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF',
    borderRadius: 12,
    paddingHorizontal: 10,
    height: 42,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  clDateBtnText: { flex: 1, fontSize: 11, fontWeight: '700', color: '#F97316' },
  clMonthHeader: {
    marginTop: 10,
    marginBottom: 6,
    marginHorizontal: 16,
    fontSize: 13,
    fontWeight: '800',
    color: '#64748B',
  },
  clEmpty: { textAlign: 'center', color: '#94A3B8', marginTop: 40, paddingHorizontal: 24 },
  clTxCard: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  clTxIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clTxMid: { flex: 1 },
  clTxTitle: { fontSize: 14, fontWeight: '800', color: '#1E293B' },
  clTxShop: { marginTop: 2, fontSize: 12, color: '#64748B', fontWeight: '600' },
  clTxWhen: { marginTop: 1, fontSize: 11, color: '#94A3B8' },
  clTxRight: { alignItems: 'flex-end', maxWidth: 120 },
  clBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    marginBottom: 3,
  },
  clBadgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.3 },
  clTxAmount: { fontSize: 13, fontWeight: '800', color: '#1E293B' },
  clTxAmountPay: { color: '#16A34A' },
  clTxBalance: { marginTop: 2, fontSize: 10, color: '#94A3B8', fontWeight: '600' },
  clChevron: { fontSize: 18, color: '#CBD5E1', fontWeight: '300' },
  clBottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#EAF2FF',
    borderTopWidth: 1,
    borderTopColor: '#DBEAFE',
    paddingTop: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  clBottomIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clBottomStat: { flex: 1 },
  clBottomLabel: { fontSize: 9, fontWeight: '700', color: '#64748B' },
  clBottomValue: { marginTop: 2, fontSize: 12, fontWeight: '800' },
});
