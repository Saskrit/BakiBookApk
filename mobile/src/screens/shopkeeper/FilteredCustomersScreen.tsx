import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { fetchCustomers } from '../../api/customers';
import { LoadingState } from '../../components/ui';
import { colors } from '../../theme/colors';
import { typography as ty } from '../../theme/typography';
import {
  avatarColor,
  formatLastTransaction,
  formatRs,
  getInitials,
  getTransactionBadge,
  isOverdueCustomer,
} from '../../utils/format';
import type { Customer } from '../../types';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'FilteredCustomers'>;

function CustomerRow({
  customer,
  onPress,
  showOverdueDays,
}: {
  customer: Customer;
  onPress: () => void;
  showOverdueDays?: boolean;
}) {
  const { t } = useTranslation();
  const badge = getTransactionBadge(
    customer.balance,
    customer.lastCreditDate,
    customer.lastPaymentDate
  );
  const daysOverdue =
    customer.lastCreditDate && customer.balance > 0
      ? Math.floor(
          (Date.now() - new Date(customer.lastCreditDate).getTime()) / (1000 * 60 * 60 * 24)
        )
      : 0;

  return (
    <Pressable onPress={onPress} style={fcStyles.fcRow}>
      <View style={[fcStyles.fcAvatar, { backgroundColor: `${avatarColor(customer.name)}22` }]}>
        <Text style={[fcStyles.fcAvatarText, { color: avatarColor(customer.name) }]}>
          {getInitials(customer.name)}
        </Text>
      </View>
      <View style={fcStyles.fcBody}>
        <Text style={fcStyles.fcName}>{customer.name}</Text>
        <Text style={fcStyles.fcPhone}>{customer.phone || t('customers.noPhone')}</Text>
        {customer.address ? <Text style={fcStyles.fcMeta}>{customer.address}</Text> : null}
        <Text style={fcStyles.fcMeta}>
          {t('customers.lastActivity', {
            time: formatLastTransaction(customer.lastCreditDate, customer.lastPaymentDate),
          })}
        </Text>
        {showOverdueDays && daysOverdue > 0 ? (
          <Text style={fcStyles.fcOverdueTag}>{t('common.daysOverdue', { count: daysOverdue })}</Text>
        ) : null}
        <View style={[fcStyles.fcBadge, badge.tone === 'paid' ? fcStyles.fcBadgePaid : fcStyles.fcBadgeCredit]}>
          <Text style={fcStyles.fcBadgeText}>{badge.label}</Text>
        </View>
      </View>
      <View style={fcStyles.fcDueCol}>
        <Text style={fcStyles.fcDueLabel}>{t('customers.due')}</Text>
        <Text style={fcStyles.fcDueValue}>{formatRs(customer.balance)}</Text>
        <Text style={fcStyles.fcChevron}>›</Text>
      </View>
    </Pressable>
  );
}

export default function FilteredCustomersScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const { mode, title, subtitle } = route.params;
  const insets = useSafeAreaInsets();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const res = await fetchCustomers({ all: 'true' });
    setCustomers(Array.isArray(res.customers) ? res.customers : []);
  }, []);

  const filtered = useMemo(() => {
    if (mode === 'collect') {
      return customers.filter((c) => c.balance > 0).sort((a, b) => b.balance - a.balance);
    }
    return customers
      .filter((c) => isOverdueCustomer(c.balance, c.lastCreditDate))
      .sort((a, b) => b.balance - a.balance);
  }, [customers, mode]);

  const totalDue = filtered.reduce((sum, c) => sum + c.balance, 0);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  if (loading) return <LoadingState />;

  return (
    <View style={fcStyles.fcScreen}>
      <View style={[fcStyles.fcHeader, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Text style={fcStyles.fcBack}>{t('common.back')}</Text>
        </Pressable>
        <Text style={fcStyles.fcTitle}>{title}</Text>
        <Text style={fcStyles.fcSubtitle}>{subtitle}</Text>
        <View style={fcStyles.fcSummaryBar}>
          <Text style={fcStyles.fcSummaryText}>
            {t('customers.summaryBar', {
              count: filtered.length,
              amount: formatRs(totalDue),
            })}
          </Text>
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <CustomerRow
            customer={item}
            showOverdueDays={mode === 'overdue'}
            onPress={() => navigation.navigate('CustomerProfile', { customerId: item.id })}
          />
        )}
        ListEmptyComponent={
          <Text style={fcStyles.fcEmpty}>
            {mode === 'overdue' ? t('customers.noOverdueList') : t('customers.noOutstandingList')}
          </Text>
        }
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 16 }}
      />
    </View>
  );
}

const fcStyles = StyleSheet.create({
  fcScreen: { flex: 1, backgroundColor: '#F4F5F7' },
  fcHeader: {
    backgroundColor: colors.primaryDark,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  fcBack: { color: 'rgba(255,255,255,0.95)', fontSize: ty.bodyLg, fontWeight: '600', marginBottom: 8 },
  fcTitle: { color: '#FFF', fontSize: ty.h1, fontWeight: '800' },
  fcSubtitle: { color: 'rgba(255,255,255,0.85)', fontSize: ty.body, marginTop: 4 },
  fcSummaryBar: {
    marginTop: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  fcSummaryText: { color: '#FFF', fontSize: ty.body, fontWeight: '600' },
  fcRow: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#ECEEF2',
  },
  fcAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  fcAvatarText: { fontWeight: '800', fontSize: ty.md },
  fcBody: { flex: 1, paddingRight: 8 },
  fcName: { fontSize: ty.md, fontWeight: '700', color: colors.text },
  fcPhone: { fontSize: ty.body, color: colors.textMuted, marginTop: 2 },
  fcMeta: { fontSize: ty.caption, color: colors.textMuted, marginTop: 4 },
  fcOverdueTag: { fontSize: ty.caption, color: '#EA580C', fontWeight: '700', marginTop: 4 },
  fcBadge: {
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#DBEAFE',
  },
  fcBadgePaid: { backgroundColor: '#DCFCE7' },
  fcBadgeCredit: { backgroundColor: '#DBEAFE' },
  fcBadgeText: { fontSize: ty.sm, fontWeight: '700', color: colors.primary },
  fcDueCol: { alignItems: 'flex-end', minWidth: 80 },
  fcDueLabel: { fontSize: ty.sm, color: colors.textMuted },
  fcDueValue: { fontSize: ty.bodyLg, fontWeight: '800', color: colors.danger, marginTop: 2 },
  fcChevron: { color: colors.textMuted, fontSize: ty.xl, marginTop: 6 },
  fcEmpty: { textAlign: 'center', color: colors.textMuted, marginTop: 40 },
});
