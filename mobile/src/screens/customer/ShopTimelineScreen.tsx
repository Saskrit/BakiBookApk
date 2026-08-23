import { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Svg, { Path } from 'react-native-svg';
import { fetchPortalShopDetail } from '../../api/portal';
import { CustomerLoading } from '../../components/customer/CustomerUi';
import { appAlert } from '../../contexts/DialogContext';
import { customerColors as c } from '../../theme/customerColors';
import { spacing } from '../../theme/spacing';
import { radius } from '../../theme/radius';

import { formatRs } from '../../utils/format';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ShopTimeline'>;
type TimelineFilter = 'all' | 'credits' | 'payments';

type LedgerEntry = {
  id?: string;
  type?: string;
  label?: string;
  desc?: string;
  items?: string;
  products?: string;
  date?: string;
  time?: string;
  creditAmount?: number;
  paymentAmount?: number;
  runningBalance?: number;
  sortAt?: string;
};

function isCreditEntry(entry: LedgerEntry) {
  const type = String(entry.type || '').toLowerCase();
  if (type === 'payment' || type === 'paid') return false;
  if (type === 'credit') return true;
  if (entry.paymentAmount != null && entry.creditAmount == null) return false;
  return entry.creditAmount != null;
}

function entryAmount(entry: LedgerEntry) {
  return isCreditEntry(entry)
    ? Number(entry.creditAmount ?? 0)
    : Number(entry.paymentAmount ?? 0);
}

export default function ShopTimelineScreen({ route, navigation }: Props) {
  const { customerId, shopName: shopNameParam } = route.params;
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<TimelineFilter>('all');
  const [shopName, setShopName] = useState(shopNameParam || 'Shop');
  const [currentDue, setCurrentDue] = useState(0);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);

  const load = useCallback(async () => {
    const data = await fetchPortalShopDetail(customerId);
    setShopName(data.shop?.shopName || shopNameParam || 'Shop');
    setCurrentDue(Number(data.summary?.currentDue || data.shop?.balance || 0));
    setLedger((data.ledger || []) as LedgerEntry[]);
  }, [customerId, shopNameParam]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load()
        .catch(() => {
          setLedger([]);
          appAlert(t('common.error'), t('customer.shopDetailLoadFailed'));
        })
        .finally(() => setLoading(false));
    }, [load, t])
  );

  const timeline = useMemo(() => {
    const sorted = [...ledger].sort((a, b) => {
      const da = a.sortAt ? new Date(a.sortAt).getTime() : 0;
      const db = b.sortAt ? new Date(b.sortAt).getTime() : 0;
      return db - da;
    });
    return sorted.filter((entry) => {
      const credit = isCreditEntry(entry);
      if (filter === 'credits' && !credit) return false;
      if (filter === 'payments' && credit) return false;
      return true;
    });
  }, [ledger, filter]);

  const openFilter = () => {
    appAlert(t('customer.filterTimeline'), t('customer.filterTimelineBody'), [
      { text: t('customer.tabAll'), onPress: () => setFilter('all') },
      { text: t('customer.tabCredits'), onPress: () => setFilter('credits') },
      { text: t('customer.tabPayments'), onPress: () => setFilter('payments') },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  if (loading) return <CustomerLoading />;

  return (
    <View style={[stStyles.stScreen, { paddingTop: insets.top }]}>
      <View style={stStyles.stTopBar}>
        <Pressable style={stStyles.stIconBtn} onPress={() => navigation.goBack()} hitSlop={8}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Path
              d="M15 6 L9 12 L15 18"
              stroke="#1E293B"
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </Pressable>
        <View style={stStyles.stTitleWrap}>
          <Text style={stStyles.stTitle} numberOfLines={1}>
            {t('customer.transactionTimeline')}
          </Text>
          <Text style={stStyles.stSubtitle} numberOfLines={1}>
            {shopName}
          </Text>
        </View>
        <Pressable style={stStyles.stFilterBtn} onPress={openFilter}>
          <Text style={stStyles.stFilterText}>{t('customer.filter')}</Text>
        </Pressable>
      </View>

      <View style={stStyles.stDueCard}>
        <Text style={stStyles.stDueLabel}>{t('customer.currentDue')}</Text>
        <Text style={stStyles.stDueValue}>{formatRs(currentDue)}</Text>
        <Text style={stStyles.stDueMeta}>
          {t('customer.filteredByShop', { shop: shopName })}
        </Text>
      </View>

      <FlatList
        data={timeline}
        keyExtractor={(item, index) => String(item.id || index)}
        contentContainerStyle={[stStyles.stList, { paddingBottom: insets.bottom + 24 }]}
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
        ListEmptyComponent={
          <Text style={stStyles.stEmpty}>{t('customer.noLedger')}</Text>
        }
        renderItem={({ item, index }) => {
          const credit = isCreditEntry(item);
          const amount = entryAmount(item);
          const title =
            item.desc ||
            item.items ||
            item.products ||
            (credit ? t('common.credit') : t('customer.paymentReceived'));
          const balance =
            item.runningBalance != null ? Number(item.runningBalance) : null;

          return (
            <View style={stStyles.stRow}>
              <View style={stStyles.stRail}>
                <View
                  style={[
                    stStyles.stDot,
                    { backgroundColor: credit ? '#FFEDD5' : '#DCFCE7' },
                  ]}
                >
                  {credit ? (
                    <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
                      <Path
                        d="M6 8 H18 L17 20 H7 Z M9 8 V6 C9 4.5 10 3.5 12 3.5 C14 3.5 15 4.5 15 6 V8"
                        stroke="#EA580C"
                        strokeWidth={2}
                      />
                    </Svg>
                  ) : (
                    <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
                      <Path
                        d="M12 4 V16 M8 12 L12 16 L16 12"
                        stroke="#16A34A"
                        strokeWidth={2}
                        strokeLinecap="round"
                      />
                    </Svg>
                  )}
                </View>
                {index < timeline.length - 1 ? <View style={stStyles.stLine} /> : null}
              </View>
              <View style={stStyles.stBody}>
                <View style={stStyles.stTop}>
                  <Text style={stStyles.stEntryTitle} numberOfLines={2}>
                    {title}
                  </Text>
                  <Text
                    style={[
                      stStyles.stAmount,
                      { color: credit ? '#EA580C' : '#16A34A' },
                    ]}
                    numberOfLines={1}
                  >
                    {credit ? `+ ${formatRs(amount)}` : `- ${formatRs(amount)}`}
                  </Text>
                </View>
                <Text style={stStyles.stSub} numberOfLines={1}>
                  {credit ? t('customer.addedToCredit') : t('customer.paymentReceived')}
                </Text>
                <View style={stStyles.stMetaRow}>
                  <View
                    style={[
                      stStyles.stBadge,
                      { backgroundColor: credit ? '#FFEDD5' : '#DCFCE7' },
                    ]}
                  >
                    <Text
                      style={[
                        stStyles.stBadgeText,
                        { color: credit ? '#C2410C' : '#15803D' },
                      ]}
                    >
                      {credit ? t('customer.badgeCredit') : t('customer.badgePayment')}
                    </Text>
                  </View>
                  <Text style={stStyles.stDate}>
                    {item.date || '—'}
                    {item.time ? ` · ${item.time}` : ''}
                  </Text>
                </View>
                {balance != null ? (
                  <Text style={stStyles.stBalance}>
                    {t('customer.balance')}: {formatRs(balance)}
                  </Text>
                ) : null}
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const stStyles = StyleSheet.create({
  stScreen: { flex: 1, backgroundColor: c.cream },
  stTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  stIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: c.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: c.border,
  },
  stTitleWrap: { flex: 1, minWidth: 0 },
  stTitle: { fontSize: 16, fontWeight: '800', color: c.text },
  stSubtitle: { marginTop: 2, fontSize: 12, color: c.textMuted, fontWeight: '600' },
  stFilterBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#FFEDD5',
  },
  stFilterText: { color: '#C2410C', fontWeight: '700', fontSize: 12 },
  stDueCard: {
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: c.white,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: c.border,
    padding: spacing.md,
  },
  stDueLabel: { fontSize: 12, color: c.textMuted, fontWeight: '700' },
  stDueValue: { marginTop: 4, fontSize: 22, fontWeight: '800', color: '#EA580C' },
  stDueMeta: { marginTop: 4, fontSize: 12, color: c.textMuted },
  stList: { paddingHorizontal: spacing.md, gap: 0 },
  stEmpty: {
    textAlign: 'center',
    color: c.textMuted,
    marginTop: 40,
    fontSize: 13,
  },
  stRow: { flexDirection: 'row', gap: spacing.sm, minHeight: 88 },
  stRail: { width: 28, alignItems: 'center' },
  stDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#E8D5C4',
    marginTop: 4,
    marginBottom: 4,
  },
  stBody: {
    flex: 1,
    backgroundColor: c.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: c.border,
    padding: 12,
    marginBottom: 10,
  },
  stTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  stEntryTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: c.text },
  stAmount: { fontSize: 13, fontWeight: '800' },
  stSub: { marginTop: 4, fontSize: 12, color: c.textMuted },
  stMetaRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  stBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  stBadgeText: { fontSize: 10, fontWeight: '800' },
  stDate: { fontSize: 11, color: c.textMuted, flexShrink: 1 },
  stBalance: { marginTop: 6, fontSize: 12, fontWeight: '700', color: c.text },
});
