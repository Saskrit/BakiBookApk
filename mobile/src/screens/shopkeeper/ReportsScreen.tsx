import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { fetchCompleteReport } from '../../api/shop';
import { useAuth } from '../../contexts/AuthContext';
import { appAlert } from '../../contexts/DialogContext';
import { Button, ErrorText, LoadingState } from '../../components/ui';
import { colors } from '../../theme/colors';
import { typography as ty } from '../../theme/typography';
import { formatReportDate } from '../../utils/pdfHtml';
import { exportCompleteShopReportPdf } from '../../utils/shopReportPdf';
import { avatarColor, formatRs, getInitials } from '../../utils/format';

type Period = 'daily' | 'weekly' | 'monthly';

type CompleteReport = {
  report: Record<string, unknown>;
  credits?: Array<Record<string, unknown>>;
  payments?: Array<Record<string, unknown>>;
  products?: Array<Record<string, unknown>>;
  activity?: Array<Record<string, unknown>>;
  customers?: Array<Record<string, unknown>>;
  outstanding?: Array<Record<string, unknown>>;
};

const PERIOD_KEYS: Record<Period, string> = {
  daily: 'reports.periodToday',
  weekly: 'reports.periodWeek',
  monthly: 'reports.periodMonth',
};

function SummaryStat({
  label,
  value,
  color,
  icon,
  iconBg,
}: {
  label: string;
  value: string;
  color: string;
  icon: ReactNode;
  iconBg: string;
}) {
  return (
    <View style={rp2Styles.rptSummaryStat}>
      <View style={[rp2Styles.rptSummaryStatIcon, { backgroundColor: iconBg }]}>{icon}</View>
      <Text style={rp2Styles.rptSummaryStatLabel}>{label}</Text>
      <Text style={[rp2Styles.rptSummaryStatValue, { color }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function CountChip({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={rp2Styles.rptCountChip}>
      <Text style={rp2Styles.rptCountChipValue}>{value}</Text>
      <Text style={rp2Styles.rptCountChipLabel}>{label}</Text>
    </View>
  );
}

function CollapsibleSection({
  title,
  count,
  icon,
  iconBg,
  defaultOpen = false,
  children,
}: {
  title: string;
  count?: number;
  icon: ReactNode;
  iconBg: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(defaultOpen);

  return (
    <View style={rp2Styles.rptSectionCard}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        style={({ pressed }) => [rp2Styles.rptSectionHeader, pressed && rp2Styles.rptSectionHeaderPressed]}
      >
        <View style={[rp2Styles.rptSectionIcon, { backgroundColor: iconBg }]}>{icon}</View>
        <View style={rp2Styles.rptSectionHeaderBody}>
          <Text style={rp2Styles.rptSectionTitle}>{title}</Text>
          {count != null ? (
            <Text style={rp2Styles.rptSectionCount}>{t('common.records', { count })}</Text>
          ) : null}
        </View>
        <Text style={rp2Styles.rptSectionChevron}>{open ? '▾' : '›'}</Text>
      </Pressable>
      {open ? <View style={rp2Styles.rptSectionBody}>{children}</View> : null}
    </View>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <View style={rp2Styles.rptEmptyHint}>
      <Text style={rp2Styles.rptEmptyHintText}>{text}</Text>
    </View>
  );
}

function CreditRow({ item }: { item: Record<string, unknown> }) {
  const { t } = useTranslation();
  const customer = String(item.customer || t('common.customer'));
  return (
    <View style={rp2Styles.rptRecordRow}>
      <View style={[rp2Styles.rptRecordAvatar, { backgroundColor: avatarColor(customer) }]}>
        <Text style={rp2Styles.rptRecordAvatarText}>{getInitials(customer)}</Text>
      </View>
      <View style={rp2Styles.rptRecordBody}>
        <Text style={rp2Styles.rptRecordTitle} numberOfLines={1}>
          {customer}
        </Text>
        <Text style={rp2Styles.rptRecordSub} numberOfLines={2}>
          {String(item.products || t('common.credit'))}
          {item.note ? ` · ${item.note}` : ''}
        </Text>
        <Text style={rp2Styles.rptRecordDate}>{String(item.date || '')}</Text>
      </View>
      <Text style={[rp2Styles.rptRecordAmount, rp2Styles.rptAmountCredit]}>
        {formatRs(Number(item.total || 0))}
      </Text>
    </View>
  );
}

function PaymentRow({ item }: { item: Record<string, unknown> }) {
  const { t } = useTranslation();
  const customer = String(item.customer || t('common.customer'));
  return (
    <View style={rp2Styles.rptRecordRow}>
      <View style={[rp2Styles.rptRecordAvatar, { backgroundColor: avatarColor(customer) }]}>
        <Text style={rp2Styles.rptRecordAvatarText}>{getInitials(customer)}</Text>
      </View>
      <View style={rp2Styles.rptRecordBody}>
        <Text style={rp2Styles.rptRecordTitle} numberOfLines={1}>
          {customer}
        </Text>
        <Text style={rp2Styles.rptRecordSub} numberOfLines={1}>
          {String(item.paidFor || t('reports.paidFor'))}
          {item.method ? ` · ${item.method}` : ''}
        </Text>
        <Text style={rp2Styles.rptRecordDate}>{String(item.date || '')}</Text>
      </View>
      <Text style={[rp2Styles.rptRecordAmount, rp2Styles.rptAmountPayment]}>
        +{formatRs(Number(item.amount || 0))}
      </Text>
    </View>
  );
}

function ProductRow({ item }: { item: Record<string, unknown> }) {
  const { t } = useTranslation();
  return (
    <View style={rp2Styles.rptRecordRow}>
      <View style={[rp2Styles.rptRecordAvatar, { backgroundColor: '#FFF7ED' }]}>
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
          <Rect x={4} y={6} width={16} height={14} rx={2} stroke="#EA580C" strokeWidth={2} />
        </Svg>
      </View>
      <View style={rp2Styles.rptRecordBody}>
        <Text style={rp2Styles.rptRecordTitle} numberOfLines={1}>
          {String(item.product || t('common.product'))}
        </Text>
        <Text style={rp2Styles.rptRecordSub} numberOfLines={1}>
          {String(item.customer || '')} · ×{String(item.qty || 1)} @ {formatRs(Number(item.price || 0))}
        </Text>
        <Text style={rp2Styles.rptRecordDate}>{String(item.date || '')}</Text>
      </View>
      <Text style={rp2Styles.rptRecordAmount}>{formatRs(Number(item.total || 0))}</Text>
    </View>
  );
}

function ActivityRow({ item }: { item: Record<string, unknown> }) {
  const { t } = useTranslation();
  const type = String(item.type || t('common.activity'));
  const isPayment = type.toLowerCase().includes('payment');
  return (
    <View style={rp2Styles.rptRecordRow}>
      <View
        style={[
          rp2Styles.rptRecordBadge,
          { backgroundColor: isPayment ? '#DCFCE7' : '#FEE2E2' },
        ]}
      >
        <Text
          style={[
            rp2Styles.rptRecordBadgeText,
            { color: isPayment ? colors.primary : colors.danger },
          ]}
        >
          {type.slice(0, 1)}
        </Text>
      </View>
      <View style={rp2Styles.rptRecordBody}>
        <Text style={rp2Styles.rptRecordTitle} numberOfLines={1}>
          {String(item.customer || '—')}
        </Text>
        <Text style={rp2Styles.rptRecordSub} numberOfLines={2}>
          {String(item.details || type)}
        </Text>
        <Text style={rp2Styles.rptRecordDate}>{String(item.date || '')}</Text>
      </View>
      <Text
        style={[
          rp2Styles.rptRecordAmount,
          isPayment ? rp2Styles.rptAmountPayment : rp2Styles.rptAmountCredit,
        ]}
      >
        {formatRs(Number(item.amount || 0))}
      </Text>
    </View>
  );
}

function OutstandingRow({ item }: { item: Record<string, unknown> }) {
  const { t } = useTranslation();
  const name = String(item.name || t('common.customer'));
  return (
    <View style={rp2Styles.rptRecordRow}>
      <View style={[rp2Styles.rptRecordAvatar, { backgroundColor: avatarColor(name) }]}>
        <Text style={rp2Styles.rptRecordAvatarText}>{getInitials(name)}</Text>
      </View>
      <View style={rp2Styles.rptRecordBody}>
        <Text style={rp2Styles.rptRecordTitle} numberOfLines={1}>
          {name}
        </Text>
        <Text style={rp2Styles.rptRecordSub} numberOfLines={1}>
          {item.phone ? String(item.phone) : t('reports.noPhone')}
          {item.creditScore ? ` · ${item.creditScore}` : ''}
        </Text>
      </View>
      <Text style={[rp2Styles.rptRecordAmount, rp2Styles.rptAmountCredit]}>
        {formatRs(Number(item.balance || 0))}
      </Text>
    </View>
  );
}

function RecordBlock({
  items,
  empty,
  renderItem,
  preview = 8,
}: {
  items: Array<Record<string, unknown>> | undefined;
  empty: string;
  renderItem: (item: Record<string, unknown>, index: number) => ReactNode;
  preview?: number;
}) {
  const { t } = useTranslation();
  if (!items?.length) return <EmptyHint text={empty} />;
  const shown = items.slice(0, preview);
  return (
    <View style={rp2Styles.rptRecordList}>
      {shown.map((item, index) => (
        <View key={String(item.id || index)}>{renderItem(item, index)}</View>
      ))}
      {items.length > preview ? (
        <Text style={rp2Styles.rptMoreHint}>
          {t('reports.moreInPdf', { count: items.length - preview })}
        </Text>
      ) : null}
    </View>
  );
}

export default function ReportsScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [period, setPeriod] = useState<Period>('daily');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState<CompleteReport | null>(null);

  const loadReport = useCallback(async (nextPeriod: Period, silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const res = (await fetchCompleteReport(nextPeriod)) as CompleteReport & { success?: boolean };
      setData({
        report: res.report || {},
        credits: Array.isArray(res.credits) ? res.credits : [],
        payments: Array.isArray(res.payments) ? res.payments : [],
        products: Array.isArray(res.products) ? res.products : [],
        activity: Array.isArray(res.activity) ? res.activity : [],
        customers: Array.isArray(res.customers) ? res.customers : [],
        outstanding: Array.isArray(res.outstanding) ? res.outstanding : [],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('reports.loadFailed'));
    } finally {
      if (!silent) setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadReport('daily');
  }, [loadReport]);

  const onPeriodChange = (next: Period) => {
    setPeriod(next);
    loadReport(next);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadReport(period, true);
    setRefreshing(false);
  };

  const exportPdf = async () => {
    if (!data) {
      appAlert(t('reports.noReport'), t('reports.generateFirst'));
      return;
    }
    setExporting(true);
    try {
      await exportCompleteShopReportPdf({
        period,
        shopName: user?.shopName,
        shopOwner: user?.fullName,
        ...data,
      });
    } catch (err) {
      appAlert(
        t('reports.exportFailed'),
        err instanceof Error ? err.message : t('reports.exportFailedBody')
      );
    } finally {
      setExporting(false);
    }
  };

  const report = data?.report || {};
  const periodStart = formatReportDate(String(report.periodStart || ''));
  const periodEnd = formatReportDate(String(report.periodEnd || ''));

  return (
    <View style={rp2Styles.rptScreen}>
      <LinearGradient
        colors={[colors.primaryDark, colors.primary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[rp2Styles.rptHeader, { paddingTop: insets.top + 12 }]}
      >
        <Text style={rp2Styles.rptHeaderTitle}>{t('reports.title')}</Text>
        <Text style={rp2Styles.rptHeaderSubtitle}>
          {t('reports.subtitle', { shop: user?.shopName || t('reports.yourShop') })}
        </Text>

        <View style={rp2Styles.rptPeriodRow}>
          {(['daily', 'weekly', 'monthly'] as Period[]).map((p) => (
            <Pressable
              key={p}
              onPress={() => onPeriodChange(p)}
              style={[rp2Styles.rptPeriodChip, period === p && rp2Styles.rptPeriodChipActive]}
            >
              <Text style={[rp2Styles.rptPeriodChipText, period === p && rp2Styles.rptPeriodChipTextActive]}>
                {t(PERIOD_KEYS[p])}
              </Text>
            </Pressable>
          ))}
        </View>

        {data && !loading ? (
          <View style={rp2Styles.rptDateRange}>
            <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
              <Rect x={3} y={5} width={18} height={16} rx={2} stroke="rgba(255,255,255,0.8)" strokeWidth={2} />
              <Path d="M3 10 H21" stroke="rgba(255,255,255,0.8)" strokeWidth={2} />
            </Svg>
            <Text style={rp2Styles.rptDateRangeText}>
              {periodStart}
              {periodEnd && periodEnd !== periodStart ? ` – ${periodEnd}` : ''}
            </Text>
          </View>
        ) : null}
      </LinearGradient>

      <ScrollView
        style={rp2Styles.rptScroll}
        contentContainerStyle={[rp2Styles.rptContent, { paddingBottom: insets.bottom + 100 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {loading && !data ? <LoadingState /> : null}
        {error ? <ErrorText message={error} /> : null}

        {data && !loading ? (
          <>
            <View style={rp2Styles.rptSummaryGrid}>
              <SummaryStat
                label={t('reports.creditGiven')}
                value={formatRs(Number(report.creditGiven || 0))}
                color="#EA580C"
                iconBg="#FFF7ED"
                icon={
                  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                    <Path d="M12 5 V19 M5 12 H19" stroke="#EA580C" strokeWidth={2.5} strokeLinecap="round" />
                  </Svg>
                }
              />
              <SummaryStat
                label={t('reports.collected')}
                value={formatRs(Number(report.paymentsReceived || 0))}
                color={colors.primary}
                iconBg="#ECFDF5"
                icon={
                  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                    <Path d="M5 12 L10 17 L19 7" stroke={colors.primary} strokeWidth={2.5} strokeLinecap="round" />
                  </Svg>
                }
              />
              <SummaryStat
                label={t('reports.outstanding')}
                value={formatRs(Number(report.totalOutstanding || 0))}
                color={colors.danger}
                iconBg="#FEE2E2"
                icon={
                  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                    <Circle cx={12} cy={12} r={8} stroke={colors.danger} strokeWidth={2} />
                    <Path d="M12 8 V13" stroke={colors.danger} strokeWidth={2} strokeLinecap="round" />
                  </Svg>
                }
              />
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={rp2Styles.rptCountRow}
            >
              <CountChip label={t('reports.credits')} value={Number(report.transactionCount ?? 0)} />
              <CountChip label={t('reports.payments')} value={Number(report.paymentCount ?? 0)} />
              <CountChip label={t('reports.products')} value={Number(report.productCount ?? 0)} />
              <CountChip label={t('reports.customers')} value={Number(report.customerCount ?? 0)} />
              <CountChip label={t('reports.withDues')} value={Number(report.customersWithDues ?? 0)} />
            </ScrollView>

            <CollapsibleSection
              title={t('reports.creditTransactions')}
              count={data.credits?.length}
              iconBg="#FFF7ED"
              defaultOpen
              icon={
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                  <Path d="M12 5 V19 M5 12 H19" stroke="#EA580C" strokeWidth={2.5} strokeLinecap="round" />
                </Svg>
              }
            >
              <RecordBlock
                items={data.credits}
                empty={t('reports.noCredit')}
                renderItem={(item) => <CreditRow item={item} />}
              />
            </CollapsibleSection>

            <CollapsibleSection
              title={t('reports.paymentsReceived')}
              count={data.payments?.length}
              iconBg="#ECFDF5"
              icon={
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                  <Path d="M5 12 L10 17 L19 7" stroke={colors.primary} strokeWidth={2.5} strokeLinecap="round" />
                </Svg>
              }
            >
              <RecordBlock
                items={data.payments}
                empty={t('reports.noPayments')}
                renderItem={(item) => <PaymentRow item={item} />}
              />
            </CollapsibleSection>

            <CollapsibleSection
              title={t('reports.productSales')}
              count={data.products?.length}
              iconBg="#FFF7ED"
              icon={
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                  <Rect x={4} y={6} width={16} height={14} rx={2} stroke="#EA580C" strokeWidth={2} />
                </Svg>
              }
            >
              <RecordBlock
                items={data.products}
                empty={t('reports.noProducts')}
                renderItem={(item) => <ProductRow item={item} />}
              />
            </CollapsibleSection>

            <CollapsibleSection
              title={t('reports.allActivity')}
              count={data.activity?.length}
              iconBg="#EFF6FF"
              icon={
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                  <Path d="M6 19 V11 M12 19 V5 M18 19 V14" stroke="#2563EB" strokeWidth={2} strokeLinecap="round" />
                </Svg>
              }
            >
              <RecordBlock
                items={data.activity}
                empty={t('reports.noActivity')}
                renderItem={(item) => <ActivityRow item={item} />}
              />
            </CollapsibleSection>

            <CollapsibleSection
              title={t('reports.outstandingCustomers')}
              count={data.outstanding?.length}
              iconBg="#FEE2E2"
              icon={
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                  <Circle cx={12} cy={8} r={4} stroke={colors.danger} strokeWidth={2} />
                  <Path d="M4 20 C4 16 7 14 12 14 C17 14 20 16 20 20" stroke={colors.danger} strokeWidth={2} />
                </Svg>
              }
            >
              <RecordBlock
                items={data.outstanding}
                empty={t('reports.allClear')}
                renderItem={(item) => <OutstandingRow item={item} />}
              />
            </CollapsibleSection>
          </>
        ) : loading && data ? (
          <View style={rp2Styles.rptLoadingOverlay}>
            <LoadingState />
          </View>
        ) : null}
      </ScrollView>

      <View style={[rp2Styles.rptExportBar, { paddingBottom: insets.bottom + 12 }]}>
        <Button
          title={exporting ? t('common.exporting') : t('reports.exportPdf')}
          onPress={exportPdf}
          disabled={!data || exporting || loading}
        />
        <Text style={rp2Styles.rptExportHint}>{t('reports.exportHint')}</Text>
      </View>
    </View>
  );
}

const rp2Styles = StyleSheet.create({
  rptScreen: { flex: 1, backgroundColor: '#F4F5F7' },
  rptHeader: {
    paddingHorizontal: 16,
    paddingBottom: 18,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
  },
  rptHeaderTitle: { color: '#FFF', fontSize: ty.h1, fontWeight: '800' },
  rptHeaderSubtitle: { color: 'rgba(255,255,255,0.88)', fontSize: ty.body, marginTop: 4 },
  rptPeriodRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
    backgroundColor: 'rgba(0,0,0,0.12)',
    borderRadius: 12,
    padding: 4,
  },
  rptPeriodChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  rptPeriodChipActive: { backgroundColor: '#FFF' },
  rptPeriodChipText: { color: 'rgba(255,255,255,0.85)', fontSize: ty.caption, fontWeight: '700' },
  rptPeriodChipTextActive: { color: colors.primaryDark },
  rptDateRange: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    alignSelf: 'center',
  },
  rptDateRangeText: { color: 'rgba(255,255,255,0.9)', fontSize: ty.caption, fontWeight: '600' },
  rptScroll: { flex: 1 },
  rptContent: { padding: 16, paddingTop: 14 },
  rptLoadingOverlay: { paddingVertical: 24 },
  rptSummaryGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  rptSummaryStat: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ECEEF2',
    minWidth: 0,
  },
  rptSummaryStatIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  rptSummaryStatLabel: { fontSize: ty.sm, color: colors.textMuted, fontWeight: '600' },
  rptSummaryStatValue: { fontSize: ty.bodyLg, fontWeight: '800', marginTop: 4 },
  rptCountRow: { gap: 8, paddingBottom: 14 },
  rptCountChip: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ECEEF2',
    minWidth: 72,
  },
  rptCountChipValue: { fontSize: ty.lg, fontWeight: '800', color: colors.text },
  rptCountChipLabel: { fontSize: ty.sm, color: colors.textMuted, marginTop: 2, fontWeight: '600' },
  rptSectionCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#ECEEF2',
    overflow: 'hidden',
  },
  rptSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  rptSectionHeaderPressed: { backgroundColor: '#FAFAFA' },
  rptSectionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rptSectionHeaderBody: { flex: 1 },
  rptSectionTitle: { fontSize: ty.md, fontWeight: '700', color: colors.text },
  rptSectionCount: { fontSize: ty.caption, color: colors.textMuted, marginTop: 2 },
  rptSectionChevron: { fontSize: 20, color: colors.textMuted, fontWeight: '300' },
  rptSectionBody: {
    borderTopWidth: 1,
    borderTopColor: '#F0F1F3',
    paddingHorizontal: 14,
    paddingBottom: 12,
    paddingTop: 4,
  },
  rptRecordList: { gap: 0 },
  rptRecordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  rptRecordAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rptRecordAvatarText: { color: '#FFF', fontWeight: '800', fontSize: ty.caption },
  rptRecordBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rptRecordBadgeText: { fontWeight: '800', fontSize: ty.bodyLg },
  rptRecordBody: { flex: 1, minWidth: 0 },
  rptRecordTitle: { fontSize: ty.bodyLg, fontWeight: '700', color: colors.text },
  rptRecordSub: { fontSize: ty.caption, color: colors.textMuted, marginTop: 2, lineHeight: 16 },
  rptRecordDate: { fontSize: ty.sm, color: colors.textMuted, marginTop: 3 },
  rptRecordAmount: { fontSize: ty.bodyLg, fontWeight: '800', color: colors.text },
  rptAmountCredit: { color: colors.danger },
  rptAmountPayment: { color: colors.primary },
  rptMoreHint: {
    fontSize: ty.caption,
    color: colors.primary,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 10,
  },
  rptEmptyHint: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  rptEmptyHintText: { fontSize: ty.body, color: colors.textMuted, textAlign: 'center' },
  rptExportBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 16,
    paddingTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 8,
  },
  rptExportHint: {
    fontSize: ty.sm,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 6,
  },
});
