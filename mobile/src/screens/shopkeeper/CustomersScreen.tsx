import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { CompositeNavigationProp, useFocusEffect, useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { appAlert } from '../../contexts/DialogContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { fetchCustomers, deleteCustomer } from '../../api/customers';
import { fetchDashboardStats } from '../../api/shop';
import { LoadingState } from '../../components/ui';
import { colors } from '../../theme/colors';
import { typography as ty } from '../../theme/typography';
import { spacing } from '../../theme/spacing';
import { radius } from '../../theme/radius';

import {
  avatarColor,
  formatLastTransaction,
  formatRs,
  getInitials,
  getTransactionBadge,
  isOverdueCustomer,
  sumSlice,
  trendPercent,
} from '../../utils/format';
import type { Customer } from '../../types';
import type { RootStackParamList, ShopkeeperTabParamList } from '../../navigation/types';

type CustomersNav = CompositeNavigationProp<
  BottomTabNavigationProp<ShopkeeperTabParamList, 'Customers'>,
  NativeStackNavigationProp<RootStackParamList>
>;

type TabKey = 'all' | 'outstanding' | 'clear';
type SortKey = 'name' | 'outstanding-desc' | 'outstanding-asc' | 'recent';

const SORT_KEYS: Record<SortKey, string> = {
  name: 'customers.sortName',
  'outstanding-desc': 'customers.sortOutstandingDesc',
  'outstanding-asc': 'customers.sortOutstandingAsc',
  recent: 'customers.sortRecent',
};

function StatCard({
  label,
  value,
  valueColor,
  footer,
  footerColor,
  icon,
  iconBg,
}: {
  label: string;
  value: string;
  valueColor: string;
  footer: string;
  footerColor?: string;
  icon: ReactNode;
  iconBg: string;
}) {
  return (
    <View style={cuStyles.cuStatCard}>
      <View style={[cuStyles.cuStatIconWrap, { backgroundColor: iconBg }]}>{icon}</View>
      <Text style={cuStyles.cuStatLabel}>{label}</Text>
      <Text style={[cuStyles.cuStatValue, { color: valueColor }]}>{value}</Text>
      <Text style={[cuStyles.cuStatFooter, footerColor ? { color: footerColor } : null]}>{footer}</Text>
    </View>
  );
}

function CustomerRow({
  customer,
  onPress,
  onLongPress,
}: {
  customer: Customer;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  const { t } = useTranslation();
  const badge = getTransactionBadge(
    customer.balance,
    customer.lastCreditDate,
    customer.lastPaymentDate
  );

  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} style={cuStyles.cuCustomerRow}>
      <View style={[cuStyles.cuAvatar, { backgroundColor: `${avatarColor(customer.name)}22` }]}>
        <Text style={[cuStyles.cuAvatarText, { color: avatarColor(customer.name) }]}>
          {getInitials(customer.name)}
        </Text>
      </View>

      <View style={cuStyles.cuCustomerMain}>
        <Text style={cuStyles.cuCustomerName}>{customer.name}</Text>
        <Text style={cuStyles.cuCustomerPhone}>{customer.phone || t('customers.noPhone')}</Text>
        <Text style={cuStyles.cuLastTxLabel}>{t('customers.lastTransaction')}</Text>
        <Text style={cuStyles.cuLastTxTime}>
          {formatLastTransaction(customer.lastCreditDate, customer.lastPaymentDate)}
        </Text>
        <View style={[cuStyles.cuBadge, badge.tone === 'paid' ? cuStyles.cuBadgePaid : cuStyles.cuBadgeCredit]}>
          <Text
            style={[cuStyles.cuBadgeText, badge.tone === 'paid' ? cuStyles.cuBadgeTextPaid : cuStyles.cuBadgeTextCredit]}
          >
            {badge.label}
          </Text>
        </View>
      </View>

      <View style={cuStyles.cuCustomerDue}>
        <Text style={cuStyles.cuDueLabel}>{t('customers.outstanding')}</Text>
        <Text
          style={[
            cuStyles.cuDueValue,
            customer.balance > 0 ? cuStyles.cuDueValueRed : cuStyles.cuDueValueGreen,
          ]}
        >
          {formatRs(customer.balance)}
        </Text>
        <Text style={cuStyles.cuChevron}>›</Text>
      </View>
    </Pressable>
  );
}

export default function CustomersScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<CustomersNav>();
  const insets = useSafeAreaInsets();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [tab, setTab] = useState<TabKey>('all');
  const [sort, setSort] = useState<SortKey>('recent');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [monthCollection, setMonthCollection] = useState(0);
  const [monthCredit, setMonthCredit] = useState(0);
  const [collectionTrend, setCollectionTrend] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    const [customerRes, dashboardRes] = await Promise.all([
      fetchCustomers({
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
        all: 'true',
      }),
      fetchDashboardStats(),
    ]);
    setCustomers(Array.isArray(customerRes.customers) ? customerRes.customers : []);
    const pay = dashboardRes.chart?.payment ?? [];
    const credit = dashboardRes.chart?.credit ?? [];
    setMonthCollection(sumSlice(pay, -30, pay.length));
    setMonthCredit(sumSlice(credit, -30, credit.length));
    setCollectionTrend(trendPercent(sumSlice(pay, -7, pay.length), sumSlice(pay, -14, -7)));
  }, [debouncedSearch]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      setError('');
      load()
        .catch((err) => setError(err instanceof Error ? err.message : t('customers.loadFailed')))
        .finally(() => setLoading(false));
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('customers.loadFailed'));
    } finally {
      setRefreshing(false);
    }
  };

  const stats = useMemo(() => {
    const list = Array.isArray(customers) ? customers : [];
    const outstanding = list.filter((c) => c.balance > 0);
    const totalOutstanding = outstanding.reduce((sum, c) => sum + c.balance, 0);
    const overdue = list.filter((c) =>
      isOverdueCustomer(c.balance, c.lastCreditDate)
    );
    const overdueAmount = overdue.reduce((sum, c) => sum + c.balance, 0);
    return {
      total: list.length,
      outstandingCount: outstanding.length,
      clearCount: list.length - outstanding.length,
      totalOutstanding,
      needToCollect: totalOutstanding,
      overdueCount: overdue.length,
      overdueAmount,
    };
  }, [customers]);

  const filteredCustomers = useMemo(() => {
    let list = [...(Array.isArray(customers) ? customers : [])];
    if (tab === 'outstanding') list = list.filter((c) => c.balance > 0);
    if (tab === 'clear') list = list.filter((c) => c.balance <= 0);
    if (overdueOnly) {
      list = list.filter((c) => isOverdueCustomer(c.balance, c.lastCreditDate));
    }

    list.sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (sort === 'outstanding-desc') return b.balance - a.balance;
      if (sort === 'outstanding-asc') return a.balance - b.balance;
      const aRecent = Math.max(
        a.lastCreditDate ? new Date(a.lastCreditDate).getTime() : 0,
        a.lastPaymentDate ? new Date(a.lastPaymentDate).getTime() : 0
      );
      const bRecent = Math.max(
        b.lastCreditDate ? new Date(b.lastCreditDate).getTime() : 0,
        b.lastPaymentDate ? new Date(b.lastPaymentDate).getTime() : 0
      );
      return bRecent - aRecent;
    });

    return list;
  }, [customers, tab, sort, overdueOnly]);

  const openSort = () => {
    appAlert(t('customers.sortBy'), undefined, [
      ...(Object.keys(SORT_KEYS) as SortKey[]).map((key) => ({
        text: t(SORT_KEYS[key]),
        onPress: () => setSort(key),
      })),
      { text: t('common.cancel'), style: 'cancel' as const },
    ]);
  };

  const openCustomer = (customer: Customer) => {
    navigation.navigate('CustomerProfile', { customerId: customer.id });
  };

  const openCustomerActions = (customer: Customer) => {
    appAlert(customer.name, t('customers.chooseAction'), [
      { text: t('customers.viewProfile'), onPress: () => openCustomer(customer) },
      { text: t('common.edit'), onPress: () => navigation.navigate('EditCustomer', { customerId: customer.id }) },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          appAlert(t('customers.deleteTitle'), t('customers.deleteConfirm', { name: customer.name }), [
            { text: t('common.cancel'), style: 'cancel' },
            {
              text: t('common.delete'),
              style: 'destructive',
              onPress: async () => {
                try {
                  await deleteCustomer(customer.id);
                  await load();
                } catch (err) {
                  appAlert(t('common.error'), err instanceof Error ? err.message : t('common.failedToDelete'));
                }
              },
            },
          ]);
        },
      },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  if (loading) return <LoadingState />;

  const listHeader = (
    <View>
      <View style={[cuStyles.cuHeader, { paddingTop: insets.top + 12 }]}>
        <View style={cuStyles.cuHeaderTop}>
          <Pressable style={cuStyles.cuHeaderIconBtn} onPress={() => navigation.navigate('Settings')}>
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
              <Path d="M4 7 H20 M4 12 H20 M4 17 H20" stroke="#FFFFFF" strokeWidth={2.5} strokeLinecap="round" />
            </Svg>
          </Pressable>
          <View style={cuStyles.cuHeaderTitles}>
            <Text style={cuStyles.cuHeaderTitle}>{t('customers.title')}</Text>
            <Text style={cuStyles.cuHeaderSubtitle}>{t('customers.subtitle')}</Text>
          </View>
          <View style={cuStyles.cuHeaderActions}>
            <Pressable style={cuStyles.cuHeaderIconBtn} onPress={openSort}>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Path d="M4 6 H20 M7 12 H17 M10 18 H14" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" />
              </Svg>
            </Pressable>
            <Pressable
              style={cuStyles.cuHeaderIconBtn}
              onPress={() => navigation.navigate('AddCustomer')}
            >
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Circle cx={12} cy={12} r={9} stroke="#FFFFFF" strokeWidth={2} />
                <Path d="M12 8 V16 M8 12 H16" stroke="#FFFFFF" strokeWidth={2} />
              </Svg>
            </Pressable>
          </View>
        </View>
      </View>

      <View style={cuStyles.cuBody}>
        {error ? <Text style={cuStyles.cuError}>{error}</Text> : null}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={cuStyles.cuStatsScroll}>
          <StatCard
            label={t('customers.totalCustomers')}
            value={String(stats.total)}
            valueColor={colors.primary}
            footer={t('customers.activeList')}
            footerColor={colors.primary}
            iconBg="#DCFCE7"
            icon={
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Circle cx={9} cy={8} r={3} stroke={colors.primary} strokeWidth={2} />
                <Path d="M3 19 C3 15 6 13 9 13" stroke={colors.primary} strokeWidth={2} />
              </Svg>
            }
          />
          <StatCard
            label={t('customers.totalOutstanding')}
            value={formatRs(stats.totalOutstanding)}
            valueColor="#EA580C"
            footer={t('customers.viewAllOutstandingLink')}
            footerColor="#EA580C"
            iconBg="#FFEDD5"
            icon={
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Rect x={4} y={6} width={16} height={12} rx={2} stroke="#EA580C" strokeWidth={2} />
              </Svg>
            }
          />
          <StatCard
            label={t('customers.totalPaidMonth')}
            value={formatRs(monthCollection)}
            valueColor={colors.primary}
            footer={t('dashboard.vsLastWeek', { percent: Math.abs(collectionTrend) })}
            footerColor={colors.primary}
            iconBg="#DBEAFE"
            icon={
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Circle cx={12} cy={12} r={8} stroke="#2563EB" strokeWidth={2} />
              </Svg>
            }
          />
          <StatCard
            label={t('customers.totalCredit')}
            value={formatRs(monthCredit)}
            valueColor="#7C3AED"
            footer={t('customers.thisMonth')}
            footerColor="#7C3AED"
            iconBg="#EDE9FE"
            icon={
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Rect x={5} y={4} width={14} height={16} rx={2} stroke="#7C3AED" strokeWidth={2} />
              </Svg>
            }
          />
        </ScrollView>

        <View style={cuStyles.cuSearchRow}>
          <View style={cuStyles.cuSearchBox}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Circle cx={11} cy={11} r={7} stroke={colors.textMuted} strokeWidth={2} />
              <Path d="M20 20 L16.5 16.5" stroke={colors.textMuted} strokeWidth={2} strokeLinecap="round" />
            </Svg>
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder={t('customers.searchPlaceholder')}
              placeholderTextColor={colors.textMuted}
              style={cuStyles.cuSearchInput}
            />
          </View>
          <Pressable style={cuStyles.cuSortBtn} onPress={openSort}>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
              <Path d="M7 4 V20 M7 4 L4 7 M7 4 L10 7 M17 20 V4 M17 20 L14 17 M17 20 L20 17" stroke={colors.text} strokeWidth={2} strokeLinecap="round" />
            </Svg>
            <Text style={cuStyles.cuSortBtnText}>{t('customers.sortBy')}</Text>
            <Text style={cuStyles.cuSortChevron}>▾</Text>
          </Pressable>
        </View>

        <View style={cuStyles.cuTabs}>
          {(
            [
              ['all', t('customers.tabAll', { count: stats.total })],
              ['outstanding', t('customers.tabOutstanding', { count: stats.outstandingCount })],
              ['clear', t('customers.tabClear', { count: stats.clearCount })],
            ] as const
          ).map(([key, label]) => (
            <Pressable
              key={key}
              onPress={() => {
                setTab(key);
                setOverdueOnly(false);
              }}
              style={cuStyles.cuTabBtn}
            >
              <Text style={[cuStyles.cuTabText, tab === key && cuStyles.cuTabTextActive]}>{label}</Text>
              {tab === key ? <View style={cuStyles.cuTabIndicator} /> : null}
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );

  const listFooter = (
    <View style={cuStyles.cuFooterCards}>
      <Pressable
        style={[cuStyles.cuFooterCard, cuStyles.cuFooterCardGreen]}
        onPress={() => {
          navigation.navigate('FilteredCustomers', {
            mode: 'collect',
            title: t('customers.needToCollect'),
            subtitle: t('customers.needToCollectSub'),
          });
        }}
      >
        <View style={cuStyles.cuFooterCardIconGreen}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Circle cx={12} cy={12} r={8} stroke={colors.primary} strokeWidth={2} />
          </Svg>
        </View>
        <View style={cuStyles.cuFooterCardBody}>
          <Text style={cuStyles.cuFooterCardTitleGreen}>{t('customers.needToCollect')}</Text>
          <Text style={cuStyles.cuFooterCardValue}>{formatRs(stats.needToCollect)}</Text>
          <Text style={cuStyles.cuFooterCardMeta}>{t('customers.fromCustomers', { count: stats.outstandingCount })}</Text>
        </View>
        <Text style={cuStyles.cuFooterChevron}>›</Text>
      </Pressable>

      <Pressable
        style={[cuStyles.cuFooterCard, cuStyles.cuFooterCardOrange]}
        onPress={() => {
          navigation.navigate('FilteredCustomers', {
            mode: 'overdue',
            title: t('customers.overdue'),
            subtitle: t('customers.overdueSub'),
          });
        }}
      >
        <View style={cuStyles.cuFooterCardIconOrange}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Rect x={4} y={5} width={16} height={15} rx={2} stroke="#EA580C" strokeWidth={2} />
          </Svg>
        </View>
        <View style={cuStyles.cuFooterCardBody}>
          <Text style={cuStyles.cuFooterCardTitleOrange}>{t('customers.overdue')}</Text>
          <Text style={cuStyles.cuFooterCardValue}>{formatRs(stats.overdueAmount)}</Text>
          <Text style={cuStyles.cuFooterCardMeta}>{t('customers.fromCustomers', { count: stats.overdueCount })}</Text>
        </View>
        <Text style={cuStyles.cuFooterChevron}>›</Text>
      </Pressable>
    </View>
  );

  return (
    <View style={cuStyles.cuScreen}>
      <FlatList
        data={filteredCustomers}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <CustomerRow
            customer={item}
            onPress={() => openCustomer(item)}
            onLongPress={() => openCustomerActions(item)}
          />
        )}
        ListHeaderComponent={listHeader}
        ListFooterComponent={listFooter}
        ListEmptyComponent={
          <Text style={cuStyles.cuEmpty}>
            {overdueOnly ? t('customers.noOverdue') : t('customers.noCustomers')}
          </Text>
        }
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const cuStyles = StyleSheet.create({
  cuScreen: { flex: 1, backgroundColor: '#F3F4F6' },
  cuHeader: {
    backgroundColor: colors.primaryDark,
    paddingHorizontal: spacing.md,
    paddingBottom: 18,
  },
  cuHeaderTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cuHeaderTitles: { flex: 1 },
  cuHeaderTitle: { color: '#FFFFFF', fontSize: ty.h1, fontWeight: '800' },
  cuHeaderSubtitle: { color: 'rgba(255,255,255,0.85)', fontSize: ty.bodyLg, marginTop: 4 },
  cuHeaderActions: { flexDirection: 'row', gap: 2 },
  cuHeaderIconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cuBody: { paddingHorizontal: spacing.md, paddingTop: spacing.md },
  cuError: { color: colors.danger, marginBottom: 10, fontSize: ty.bodyLg },
  cuStatsScroll: { gap: spacing.sm, paddingBottom: spacing.md, paddingRight: 8 },
  cuStatCard: {
    width: 168,
    backgroundColor: '#FFFFFF',
    borderRadius: radius.card,
    padding: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cuStatIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  cuStatLabel: { fontSize: ty.sm, color: colors.textMuted, marginBottom: 4, fontWeight: '500' },
  cuStatValue: { fontSize: ty.xl, fontWeight: '800', marginBottom: 6 },
  cuStatFooter: { fontSize: ty.xs, fontWeight: '600', color: colors.textMuted },
  cuSearchRow: { flexDirection: 'row', gap: 10, marginBottom: spacing.md },
  cuSearchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  cuSearchInput: { flex: 1, fontSize: ty.bodyLg, color: colors.text, padding: 0 },
  cuSortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  cuSortBtnText: { fontSize: ty.body, fontWeight: '600', color: colors.text },
  cuSortChevron: { fontSize: ty.sm, color: colors.textMuted },
  cuTabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: 8,
  },
  cuTabBtn: { flex: 1, alignItems: 'center', paddingBottom: 10 },
  cuTabText: { fontSize: ty.sm, fontWeight: '600', color: colors.textMuted, textAlign: 'center' },
  cuTabTextActive: { color: colors.primary },
  cuTabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: '10%',
    right: '10%',
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
  cuCustomerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 14,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cuAvatar: {
    width: 44,
    height: 44,
    borderRadius: radius.container,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  cuAvatarText: { fontWeight: '800', fontSize: ty.md },
  cuCustomerMain: { flex: 1, paddingRight: 8 },
  cuCustomerName: { fontSize: ty.md, fontWeight: '700', color: colors.text },
  cuCustomerPhone: { fontSize: ty.body, color: colors.textMuted, marginTop: 2, marginBottom: 8 },
  cuLastTxLabel: { fontSize: ty.sm, color: colors.textMuted },
  cuLastTxTime: { fontSize: ty.caption, color: colors.text, fontWeight: '500', marginTop: 2 },
  cuBadge: {
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  cuBadgePaid: { backgroundColor: '#DCFCE7' },
  cuBadgeCredit: { backgroundColor: '#DBEAFE' },
  cuBadgeText: { fontSize: ty.sm, fontWeight: '700' },
  cuBadgeTextPaid: { color: colors.primary },
  cuBadgeTextCredit: { color: '#2563EB' },
  cuCustomerDue: { alignItems: 'flex-end', minWidth: 88 },
  cuDueLabel: { fontSize: ty.sm, color: colors.textMuted },
  cuDueValue: { fontSize: ty.bodyLg, fontWeight: '800', marginTop: 4 },
  cuDueValueRed: { color: colors.danger },
  cuDueValueGreen: { color: colors.primary },
  cuChevron: { color: colors.textMuted, fontSize: ty.xl, marginTop: 8 },
  cuEmpty: { textAlign: 'center', color: colors.textMuted, marginTop: 32, marginHorizontal: 16 },
  cuFooterCards: { paddingHorizontal: spacing.md, paddingTop: 8, paddingBottom: 8, gap: 10 },
  cuFooterCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cuFooterCardGreen: { backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#BBF7D0' },
  cuFooterCardOrange: { backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FED7AA' },
  cuFooterCardIconGreen: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cuFooterCardIconOrange: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cuFooterCardBody: { flex: 1 },
  cuFooterCardTitleGreen: { fontSize: ty.bodyLg, fontWeight: '700', color: colors.primary },
  cuFooterCardTitleOrange: { fontSize: ty.bodyLg, fontWeight: '700', color: '#EA580C' },
  cuFooterCardValue: { fontSize: ty.lg, fontWeight: '800', color: colors.text, marginTop: 2 },
  cuFooterCardMeta: { fontSize: ty.caption, color: colors.textMuted, marginTop: 2 },
  cuFooterChevron: { fontSize: ty.xxl, color: colors.textMuted },
});
