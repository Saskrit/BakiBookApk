import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Svg, { Path } from 'react-native-svg';
import { appAlert } from '../../contexts/DialogContext';
import { spacing } from '../../theme/spacing';
import { formatRs } from '../../utils/format';

export type TimelineEntry = {
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
  balanceDelta?: number;
  sortAt?: string;
  method?: string;
  receipt?: string;
  paidFor?: string;
};

type TimelineFilter = 'all' | 'credits' | 'payments';

export function isCreditTimelineEntry(entry: TimelineEntry) {
  const type = String(entry.type || entry.label || '').toLowerCase();
  if (type === 'payment' || type === 'paid') return false;
  if (type === 'credit') return true;
  if (entry.paymentAmount != null && entry.creditAmount == null) return false;
  return entry.creditAmount != null;
}

export function timelineEntryAmount(entry: TimelineEntry) {
  if (isCreditTimelineEntry(entry)) {
    return Number(entry.creditAmount || entry.balanceDelta || 0);
  }
  return Math.abs(Number(entry.paymentAmount || entry.balanceDelta || 0));
}

type Props = {
  ledger: TimelineEntry[];
  /** Max entries to show. Omit or pass 0 for all. */
  limit?: number;
  showFilter?: boolean;
  onViewAll?: () => void;
};

export function ShopTimelineList({
  ledger,
  limit,
  showFilter = true,
  onViewAll,
}: Props) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<TimelineFilter>('all');

  const timeline = useMemo(() => {
    const sorted = [...ledger].sort((a, b) => {
      const da = a.sortAt ? new Date(a.sortAt).getTime() : 0;
      const db = b.sortAt ? new Date(b.sortAt).getTime() : 0;
      return db - da;
    });
    return sorted.filter((entry) => {
      const credit = isCreditTimelineEntry(entry);
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

  const showAll = limit == null || limit <= 0;
  const visible = showAll ? timeline : timeline.slice(0, limit);
  const hasMore = !showAll && timeline.length > visible.length;

  return (
    <View>
      <View style={styles.header}>
        <View style={styles.titleWrap}>
          <Text style={styles.title} numberOfLines={1}>
            {t('customer.transactionTimeline')}
          </Text>
          {ledger.length > 0 ? (
            <Text style={styles.count}>
              {t('customer.timelineEntryCount', { count: timeline.length })}
            </Text>
          ) : null}
        </View>
        {showFilter ? (
          <Pressable style={styles.filterChip} onPress={openFilter}>
            <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
              <Path
                d="M4 6 H20 M7 12 H17 M10 18 H14"
                stroke="#F97316"
                strokeWidth={2}
                strokeLinecap="round"
              />
            </Svg>
            <Text style={styles.filterChipText}>{t('customer.filter')}</Text>
          </Pressable>
        ) : null}
      </View>

      {visible.length === 0 ? (
        <Text style={styles.empty}>{t('customer.noLedger')}</Text>
      ) : (
        visible.map((entry, index) => {
          const credit = isCreditTimelineEntry(entry);
          const amount = timelineEntryAmount(entry);
          const title =
            entry.desc ||
            entry.items ||
            entry.products ||
            (credit ? t('common.credit') : t('customer.paymentReceived'));
          const balance =
            entry.runningBalance != null ? Number(entry.runningBalance) : null;
          const entryType = String(entry.type || '').toLowerCase();
          const subLabel =
            entryType === 'paid'
              ? t('customer.itemPaid')
              : credit
                ? t('customer.addedToCredit')
                : t('customer.paymentReceived');

          return (
            <View key={String(entry.id || index)} style={styles.row}>
              <View style={styles.rail}>
                <View
                  style={[styles.dot, { backgroundColor: credit ? '#FFEDD5' : '#DCFCE7' }]}
                >
                  {credit ? (
                    <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
                      <Path
                        d="M6 8 H18 L17 20 H7 Z M9 8 V6 C9 4.5 10.3 3.5 12 3.5 C14 3.5 15 4.5 15 6 V8"
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
                {index < visible.length - 1 ? <View style={styles.line} /> : null}
              </View>
              <View style={styles.body}>
                <View style={styles.top}>
                  <Text style={styles.entryTitle} numberOfLines={3}>
                    {title}
                  </Text>
                  <Text
                    style={[styles.amount, { color: credit ? '#EA580C' : '#16A34A' }]}
                    numberOfLines={1}
                  >
                    {credit ? `+ ${formatRs(amount)}` : `- ${formatRs(amount)}`}
                  </Text>
                </View>
                <Text style={styles.sub} numberOfLines={2}>
                  {subLabel}
                </Text>
                {!credit && entry.paidFor && entry.paidFor !== title ? (
                  <Text style={styles.detail} numberOfLines={2}>
                    {t('customer.paidFor')}: {entry.paidFor}
                  </Text>
                ) : null}
                {!credit && entry.method ? (
                  <Text style={styles.detail} numberOfLines={1}>
                    {t('customer.paymentMethod')}: {entry.method}
                  </Text>
                ) : null}
                {!credit && entry.receipt ? (
                  <Text style={styles.detail} numberOfLines={1}>
                    {t('customer.receiptNo', { id: entry.receipt })}
                  </Text>
                ) : null}
                <View style={styles.metaRow}>
                  <View
                    style={[
                      styles.typeBadge,
                      { backgroundColor: credit ? '#FFEDD5' : '#DCFCE7' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.typeBadgeText,
                        { color: credit ? '#C2410C' : '#15803D' },
                      ]}
                    >
                      {credit
                        ? t('customer.badgeCredit')
                        : entryType === 'paid'
                          ? t('customer.badgePaid')
                          : t('customer.badgePayment')}
                    </Text>
                  </View>
                  <Text style={styles.date}>
                    {entry.date || '—'}
                    {entry.time ? ` · ${entry.time}` : ''}
                  </Text>
                </View>
                {balance != null ? (
                  <Text style={styles.balance}>
                    {t('customer.balance')}: {formatRs(balance)}
                  </Text>
                ) : null}
              </View>
            </View>
          );
        })
      )}

      {hasMore && onViewAll ? (
        <Pressable style={styles.viewAllBtn} onPress={onViewAll}>
          <Text style={styles.viewAllText}>{t('customer.viewAllTransactions')}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: spacing.sm,
  },
  titleWrap: { flex: 1, minWidth: 0 },
  title: { fontSize: 15, fontWeight: '800', color: '#1E293B' },
  count: { marginTop: 2, fontSize: 11, fontWeight: '600', color: '#94A3B8' },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#FFF7ED',
    flexShrink: 0,
  },
  filterChipText: { color: '#EA580C', fontWeight: '800', fontSize: 12 },
  empty: { color: '#94A3B8', fontWeight: '600', paddingVertical: spacing.sm },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
    alignItems: 'stretch',
  },
  rail: { width: 28, alignItems: 'center', flexShrink: 0 },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  line: {
    width: 2,
    flex: 1,
    backgroundColor: '#E2E8F0',
    marginTop: 4,
    minHeight: 24,
  },
  body: { flex: 1, minWidth: 0 },
  top: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  entryTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    fontWeight: '800',
    color: '#1E293B',
    lineHeight: 18,
  },
  amount: {
    flexShrink: 0,
    maxWidth: '42%',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'right',
  },
  sub: { marginTop: 2, fontSize: 11, color: '#94A3B8', fontWeight: '600' },
  detail: { marginTop: 4, fontSize: 11, color: '#64748B', fontWeight: '600' },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  typeBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  typeBadgeText: { fontSize: 10, fontWeight: '800' },
  date: { fontSize: 11, fontWeight: '700', color: '#64748B' },
  balance: { marginTop: 4, fontSize: 11, color: '#94A3B8', fontWeight: '600' },
  viewAllBtn: {
    marginTop: 4,
    alignSelf: 'flex-start',
    paddingVertical: 6,
  },
  viewAllText: { color: '#EA580C', fontWeight: '800', fontSize: 13 },
});
