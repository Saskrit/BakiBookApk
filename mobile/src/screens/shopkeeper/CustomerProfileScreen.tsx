import { useCallback, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { deleteCustomer } from '../../api/customers';
import { fetchSharedAccount, type LedgerEntry } from '../../api/shared';
import { useAuth } from '../../contexts/AuthContext';
import { appAlert } from '../../contexts/DialogContext';
import { Button, LoadingState } from '../../components/ui';
import { colors } from '../../theme/colors';
import { typography as ty } from '../../theme/typography';
import { exportCustomerReportPdf } from '../../utils/customerReportPdf';
import { avatarColor, formatRs, getInitials } from '../../utils/format';
import type { Customer } from '../../types';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'CustomerProfile'>;

function StatBox({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <View style={cprStyles.cprStatBox}>
      <Text style={cprStyles.cprStatLabel}>{label}</Text>
      <Text style={[cprStyles.cprStatValue, accent ? { color: accent } : null]}>{value}</Text>
    </View>
  );
}

function LedgerRow({ entry }: { entry: LedgerEntry }) {
  const { t } = useTranslation();
  const isCredit = entry.type === 'Credit';
  const typeLabel =
    entry.type === 'Credit'
      ? t('common.credit')
      : entry.type === 'Payment'
        ? t('common.payment')
        : entry.type || entry.label;
  return (
    <View style={cprStyles.cprLedgerRow}>
      <View style={[cprStyles.cprLedgerDot, { backgroundColor: isCredit ? '#FEE2E2' : '#DCFCE7' }]}>
        <Text style={{ color: isCredit ? colors.danger : colors.primary, fontWeight: '800', fontSize: ty.sm }}>
          {isCredit ? '+' : '−'}
        </Text>
      </View>
      <View style={cprStyles.cprLedgerBody}>
        <View style={cprStyles.cprLedgerTop}>
          <Text style={cprStyles.cprLedgerType}>{typeLabel}</Text>
          <Text style={[cprStyles.cprLedgerAmount, { color: isCredit ? colors.danger : colors.primary }]}>
            {entry.amount}
          </Text>
        </View>
        <Text style={cprStyles.cprLedgerDesc} numberOfLines={2}>
          {entry.desc || entry.products || entry.items || '—'}
        </Text>
        <View style={cprStyles.cprLedgerMeta}>
          <Text style={cprStyles.cprLedgerDate}>
            {entry.date}
            {entry.time ? ` · ${entry.time}` : ''}
          </Text>
          {entry.balance ? <Text style={cprStyles.cprLedgerBalance}>{t('customerProfile.balance', { amount: entry.balance })}</Text> : null}
        </View>
        {entry.method ? <Text style={cprStyles.cprLedgerExtra}>{t('customerProfile.method', { method: entry.method })}</Text> : null}
      </View>
    </View>
  );
}

export default function CustomerProfileScreen({ route }: Props) {
  const { t } = useTranslation();
  const { customerId } = route.params;
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [summary, setSummary] = useState({
    balance: 0,
    totalCredit: 0,
    totalPaid: 0,
    transactionCount: 0,
    paymentCount: 0,
  });
  const [credits, setCredits] = useState<Array<Record<string, unknown>>>([]);
  const [payments, setPayments] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    const data = await fetchSharedAccount(customerId);
    setCustomer(data.customer);
    setLedger(data.ledger);
    setSummary(data.summary);
    setCredits(data.transactions as unknown as Array<Record<string, unknown>>);
    setPayments(data.payments as unknown as Array<Record<string, unknown>>);
  }, [customerId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load()
        .catch(() => appAlert(t('common.error'), t('customerProfile.loadFailed')))
        .finally(() => setLoading(false));
    }, [load])
  );

  const handleDelete = () => {
    if (!customer) return;
    appAlert(
      t('customers.deleteTitle'),
      t('customers.deleteConfirmFull', { name: customer.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteCustomer(customerId);
              navigation.goBack();
            } catch (err) {
              appAlert(t('common.error'), err instanceof Error ? err.message : t('common.failedToDelete'));
            }
          },
        },
      ]
    );
  };

  const handleExport = async () => {
    if (!customer) return;
    setExporting(true);
    try {
      const creditRows = credits.map((tx) => ({
        ...tx,
        products:
          tx.products ||
          ((tx.items as Array<{ name: string; qty: number }>) || [])
            .map((i) => `${i.name} ×${i.qty}`)
            .join(', '),
      }));
      await exportCustomerReportPdf({
        shopName: user?.shopName,
        shopOwner: user?.fullName,
        customer,
        summary,
        ledger: ledger as unknown as Array<Record<string, unknown>>,
        credits: creditRows,
        payments,
      });
    } catch (err) {
      appAlert(t('customerProfile.exportFailed'), err instanceof Error ? err.message : t('customerProfile.exportFailedBody'));
    } finally {
      setExporting(false);
    }
  };

  if (loading || !customer) return <LoadingState />;

  const initials = getInitials(customer.name);
  const avatarBg = avatarColor(customer.name);

  return (
    <View style={cprStyles.cprScreen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      >
        <LinearGradient
          colors={[colors.primaryDark, colors.primary]}
          style={[cprStyles.cprHero, { paddingTop: insets.top + 12 }]}
        >
          <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
            <Text style={cprStyles.cprBack}>{t('common.back')}</Text>
          </Pressable>

          <View style={[cprStyles.cprAvatar, { backgroundColor: `${avatarBg}33` }]}>
            <Text style={[cprStyles.cprAvatarText, { color: '#FFFFFF' }]}>{initials}</Text>
          </View>
          <Text style={cprStyles.cprHeroName}>{customer.name}</Text>
          {customer.phone ? <Text style={cprStyles.cprHeroMeta}>{customer.phone}</Text> : null}
          {customer.email ? <Text style={cprStyles.cprHeroMeta}>{customer.email}</Text> : null}
          {customer.address ? <Text style={cprStyles.cprHeroMeta}>{customer.address}</Text> : null}

          <View style={cprStyles.cprChipRow}>
            {customer.creditScore ? (
              <View style={cprStyles.cprChip}>
                <Text style={cprStyles.cprChipText}>{t('customerProfile.score', { score: customer.creditScore })}</Text>
              </View>
            ) : null}
            <View style={cprStyles.cprChip}>
              <Text style={cprStyles.cprChipText}>
                {customer.linkStatus === 'linked' ? t('customerProfile.linkedAccount') : t('customerProfile.shopCustomer')}
              </Text>
            </View>
          </View>
        </LinearGradient>

        <View style={cprStyles.cprBody}>
          <View style={cprStyles.cprStatsRow}>
            <StatBox
              label={t('customerProfile.outstanding')}
              value={formatRs(summary.balance ?? customer.balance)}
              accent={customer.balance > 0 ? colors.danger : colors.primary}
            />
            <StatBox label={t('customerProfile.totalCredit')} value={formatRs(summary.totalCredit)} />
            <StatBox label={t('customerProfile.totalPaid')} value={formatRs(summary.totalPaid)} accent={colors.primary} />
          </View>

          {customer.notes?.trim() ? (
            <View style={cprStyles.cprNotesCard}>
              <Text style={cprStyles.cprNotesTitle}>{t('customerProfile.notes')}</Text>
              <Text style={cprStyles.cprNotesText}>{customer.notes}</Text>
            </View>
          ) : null}

          <View style={cprStyles.cprActionRow}>
            <Pressable
              style={cprStyles.cprActionBtn}
              onPress={() => navigation.navigate('EditCustomer', { customerId })}
            >
              <Text style={cprStyles.cprActionBtnText}>{t('common.edit')}</Text>
            </Pressable>
            <Pressable style={cprStyles.cprActionBtn} onPress={handleExport} disabled={exporting}>
              <Text style={cprStyles.cprActionBtnText}>{exporting ? t('common.exporting') : t('customerProfile.downloadReport')}</Text>
            </Pressable>
            <Pressable style={[cprStyles.cprActionBtn, cprStyles.cprActionBtnDanger]} onPress={handleDelete}>
              <Text style={[cprStyles.cprActionBtnText, cprStyles.cprActionBtnDangerText]}>{t('common.delete')}</Text>
            </Pressable>
          </View>

          <View style={cprStyles.cprQuickActions}>
            <Button
              title={t('customerProfile.addCredit')}
              onPress={() =>
                navigation.navigate('AddCredit', { customerId, customerName: customer.name })
              }
            />
            <Button
              title={t('customerProfile.recordPayment')}
              variant="outline"
              onPress={() =>
                navigation.navigate('RecordPayment', { customerId, customerName: customer.name })
              }
            />
          </View>

          <Text style={cprStyles.cprSectionTitle}>{t('customerProfile.ledgerTitle')}</Text>
          <Text style={cprStyles.cprSectionSub}>
            {t('customerProfile.ledgerSub', {
              credits: summary.transactionCount,
              payments: summary.paymentCount,
            })}
          </Text>

          <View style={cprStyles.cprLedgerCard}>
            {ledger.length === 0 ? (
              <Text style={cprStyles.cprEmptyLedger}>{t('customerProfile.noTransactions')}</Text>
            ) : (
              ledger.map((entry) => <LedgerRow key={entry.id} entry={entry} />)
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const cprStyles = StyleSheet.create({
  cprScreen: { flex: 1, backgroundColor: '#F4F5F7' },
  cprHero: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  cprBack: {
    alignSelf: 'flex-start',
    color: 'rgba(255,255,255,0.95)',
    fontSize: ty.bodyLg,
    fontWeight: '600',
    marginBottom: 12,
  },
  cprAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.5)',
    marginBottom: 10,
  },
  cprAvatarText: { fontSize: ty.h2, fontWeight: '800' },
  cprHeroName: { color: '#FFF', fontSize: ty.h2, fontWeight: '800', textAlign: 'center' },
  cprHeroMeta: { color: 'rgba(255,255,255,0.9)', fontSize: ty.body, marginTop: 4, textAlign: 'center' },
  cprChipRow: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap', justifyContent: 'center' },
  cprChip: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  cprChipText: { color: '#FFF', fontSize: ty.caption, fontWeight: '600' },
  cprBody: { padding: 16, marginTop: -8 },
  cprStatsRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  cprStatBox: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ECEEF2',
  },
  cprStatLabel: { fontSize: ty.sm, color: colors.textMuted, marginBottom: 4 },
  cprStatValue: { fontSize: ty.bodyLg, fontWeight: '800', color: colors.text },
  cprNotesCard: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#ECEEF2',
  },
  cprNotesTitle: { fontSize: ty.bodyLg, fontWeight: '700', color: colors.text, marginBottom: 6 },
  cprNotesText: { fontSize: ty.body, color: colors.textMuted, lineHeight: 18 },
  cprActionRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  cprActionBtn: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ECEEF2',
  },
  cprActionBtnDanger: { borderColor: '#FECACA', backgroundColor: '#FEF2F2' },
  cprActionBtnText: { fontSize: ty.caption, fontWeight: '700', color: colors.primary },
  cprActionBtnDangerText: { color: colors.danger },
  cprQuickActions: { gap: 8, marginBottom: 18 },
  cprSectionTitle: { fontSize: ty.lg, fontWeight: '800', color: colors.text },
  cprSectionSub: { fontSize: ty.caption, color: colors.textMuted, marginBottom: 10, marginTop: 2 },
  cprLedgerCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 4,
    borderWidth: 1,
    borderColor: '#ECEEF2',
  },
  cprLedgerRow: {
    flexDirection: 'row',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F2F5',
    gap: 10,
  },
  cprLedgerDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  cprLedgerBody: { flex: 1 },
  cprLedgerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  cprLedgerType: { fontSize: ty.bodyLg, fontWeight: '700', color: colors.text },
  cprLedgerAmount: { fontSize: ty.bodyLg, fontWeight: '800' },
  cprLedgerDesc: { fontSize: ty.body, color: colors.textMuted, marginTop: 4, lineHeight: 17 },
  cprLedgerMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    gap: 8,
  },
  cprLedgerDate: { fontSize: ty.caption, color: colors.textMuted },
  cprLedgerBalance: { fontSize: ty.caption, fontWeight: '700', color: colors.primary },
  cprLedgerExtra: { fontSize: ty.caption, color: colors.textMuted, marginTop: 2 },
  cprEmptyLedger: { textAlign: 'center', color: colors.textMuted, padding: 24, fontSize: ty.body },
});
