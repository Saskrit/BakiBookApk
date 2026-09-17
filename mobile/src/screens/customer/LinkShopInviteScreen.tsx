import { useCallback, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import {
  acceptShopLink,
  fetchPendingLinkDetail,
  rejectShopLink,
  type PendingInvitation,
} from '../../api/portal';
import ScreenHeader from '../../components/ScreenHeader';
import {
  CustomerButton,
  CustomerCard,
  CustomerLoading,
} from '../../components/customer/CustomerUi';
import {
  ShopTimelineList,
  type TimelineEntry,
} from '../../components/customer/ShopTimelineList';
import { appAlert } from '../../contexts/DialogContext';
import { customerColors as c } from '../../theme/customerColors';
import { spacing } from '../../theme/spacing';
import { radius } from '../../theme/radius';
import { formatRs } from '../../utils/format';
import { normalizeImageUrlSync } from '../../utils/normalizeImageUrl';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'LinkShopInvite'>;

function DetailRow({ label, value, highlight }: { label: string; value?: string; highlight?: boolean }) {
  if (!value) return null;
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, highlight && styles.rowValueHighlight]}>{value}</Text>
    </View>
  );
}

function SummaryStat({ label, value, tone }: { label: string; value: string; tone?: 'due' | 'paid' | 'neutral' }) {
  const valueStyle =
    tone === 'due' ? styles.statValueDue : tone === 'paid' ? styles.statValuePaid : styles.statValue;
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={valueStyle} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

export default function LinkShopInviteScreen({ navigation, route }: Props) {
  const { customerId } = route.params;
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<'accept' | 'reject' | ''>('');
  const [inv, setInv] = useState<PendingInvitation | null>(null);

  const load = useCallback(async () => {
    const data = await fetchPendingLinkDetail(customerId);
    setInv(data.invitation);
  }, [customerId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load()
        .catch(() => {
          setInv(null);
          appAlert(t('common.error'), t('customer.inviteLoadFailed'));
        })
        .finally(() => setLoading(false));
    }, [load, t])
  );

  const handleAccept = () => {
    if (!inv) return;
    appAlert(t('customer.acceptInviteTitle'), t('customer.acceptInviteBody', { shop: inv.shopName || 'Shop' }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('customer.accept'),
        onPress: async () => {
          setActing('accept');
          try {
            await acceptShopLink(customerId);
            appAlert(t('customer.linked'), t('customer.linkedSuccess'));
            navigation.navigate('Customer', { screen: 'Shops' });
          } catch (err) {
            appAlert(
              t('common.error'),
              err instanceof Error ? err.message : t('customer.acceptInviteFailed')
            );
          } finally {
            setActing('');
          }
        },
      },
    ]);
  };

  const handleDecline = () => {
    if (!inv) return;
    appAlert(t('customer.declineInviteTitle'), t('customer.declineInviteBody', { shop: inv.shopName || 'Shop' }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('customer.decline'),
        style: 'destructive',
        onPress: async () => {
          setActing('reject');
          try {
            await rejectShopLink(customerId);
            navigation.navigate('LinkShops');
          } catch (err) {
            appAlert(
              t('common.error'),
              err instanceof Error ? err.message : t('customer.declineInviteFailed')
            );
          } finally {
            setActing('');
          }
        },
      },
    ]);
  };

  const viewAllTransactions = () => {
    navigation.navigate('ShopTimeline', {
      customerId,
      shopName: inv?.shopName || route.params.shopName,
      pending: true,
    });
  };

  if (loading) return <CustomerLoading />;

  const shopImage = normalizeImageUrlSync(inv?.shopImage);
  const summary = inv?.summary;
  const currentDue = Number(summary?.currentDue ?? inv?.balance ?? 0);
  const verifiedLabel = inv?.shopVerified
    ? t('customer.verifiedShop')
    : inv?.shopVerificationStatus === 'pending'
      ? t('customer.pendingShopVerification')
      : t('customer.unverifiedShop');
  const scoreLabel = inv?.creditScore
    ? t(`customer.scores.${String(inv.creditScore).toLowerCase()}`, {
        defaultValue: inv.creditScore,
      })
    : null;
  const recentItems = inv?.recentPurchaseItems || [];
  const ledgerCount = inv?.ledger?.length || 0;

  return (
    <View style={styles.screen}>
      <LinearGradient colors={[c.peach, c.sky]} style={styles.header}>
        <ScreenHeader
          title={t('customer.reviewInviteTitle')}
          subtitle={t('customer.reviewInviteSubtitle')}
          onBack={() => navigation.goBack()}
          variant="customer"
          style={styles.headerInner}
        />
      </LinearGradient>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]}
        showsVerticalScrollIndicator={false}
      >
        {!inv ? (
          <Text style={styles.empty}>{t('customer.inviteNotFound')}</Text>
        ) : (
          <>
            <CustomerCard>
              <View style={styles.shopHead}>
                {shopImage ? (
                  <Image source={{ uri: shopImage }} style={styles.shopImage} />
                ) : (
                  <View style={styles.shopPlaceholder}>
                    <Text style={styles.shopPlaceholderText}>
                      {(inv.shopName || 'S').slice(0, 1).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={styles.shopInfo}>
                  <Text style={styles.shopName}>{inv.shopName || 'Shop'}</Text>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{verifiedLabel}</Text>
                  </View>
                  {inv.shopkeeperName ? (
                    <Text style={styles.meta}>
                      {t('customer.ownerLabel', { name: inv.shopkeeperName })}
                    </Text>
                  ) : null}
                  {inv.shopLocation ? <Text style={styles.meta}>{inv.shopLocation}</Text> : null}
                  {inv.shopkeeperPhone ? <Text style={styles.meta}>{inv.shopkeeperPhone}</Text> : null}
                </View>
              </View>
            </CustomerCard>

            <CustomerCard>
              <Text style={styles.sectionTitle}>{t('customer.yourRecordTitle')}</Text>
              <Text style={styles.sectionNote}>{t('customer.yourRecordNote')}</Text>
              <DetailRow label={t('customer.nameOnRecord')} value={inv.name} />
              <DetailRow label={t('customer.emailOnRecord')} value={inv.email} />
              <DetailRow label={t('customer.phoneOnRecord')} value={inv.phone} />
              <DetailRow label={t('customer.addressOnRecord')} value={inv.address} />
              {inv.notes ? <DetailRow label={t('customer.notesOnRecord')} value={inv.notes} /> : null}
            </CustomerCard>

            <CustomerCard>
              <Text style={styles.sectionTitle}>{t('customer.accountSummary')}</Text>
              <View style={styles.statsGrid}>
                <SummaryStat
                  label={t('customer.currentDue')}
                  value={formatRs(currentDue)}
                  tone="due"
                />
                <SummaryStat
                  label={t('customer.totalPurchases')}
                  value={formatRs(summary?.totalPurchases ?? 0)}
                />
                <SummaryStat
                  label={t('customer.totalPaid')}
                  value={formatRs(summary?.totalPaid ?? 0)}
                  tone="paid"
                />
                <SummaryStat
                  label={t('customer.totalTransactions')}
                  value={String(summary?.transactionCount ?? ledgerCount)}
                />
              </View>
              <DetailRow label={t('customer.invitedOn')} value={inv.invitedAt} />
              {summary?.lastCreditDate ? (
                <DetailRow label={t('customer.lastCredit')} value={summary.lastCreditDate} />
              ) : null}
              {summary?.lastPaymentDate ? (
                <DetailRow
                  label={t('customer.lastPayment')}
                  value={
                    summary.lastPaymentAmount
                      ? `${summary.lastPaymentDate} · ${formatRs(summary.lastPaymentAmount)}`
                      : summary.lastPaymentDate
                  }
                />
              ) : null}
              {scoreLabel ? (
                <DetailRow label={t('customer.creditScore')} value={scoreLabel} />
              ) : null}
            </CustomerCard>

            {recentItems.length > 0 ? (
              <CustomerCard>
                <Text style={styles.sectionTitle}>{t('customer.recentPurchases')}</Text>
                {recentItems.map((item, index) => (
                  <View key={`${item.name}-${index}`} style={styles.purchaseRow}>
                    <View style={styles.purchaseMain}>
                      <Text style={styles.purchaseName} numberOfLines={2}>
                        {item.name}
                      </Text>
                      <Text style={styles.purchaseMeta}>
                        {t('customer.qtyPrice', {
                          qty: item.qty ?? 1,
                          price: formatRs(item.price ?? 0),
                        })}
                      </Text>
                    </View>
                    <Text style={styles.purchaseTotal}>
                      {formatRs((item.qty ?? 1) * (item.price ?? 0))}
                    </Text>
                  </View>
                ))}
              </CustomerCard>
            ) : null}

            <CustomerCard>
              <ShopTimelineList
                ledger={(inv.ledger || []) as TimelineEntry[]}
                limit={0}
                onViewAll={ledgerCount > 0 ? viewAllTransactions : undefined}
              />
              {ledgerCount > 0 ? (
                <Pressable style={styles.viewAllLink} onPress={viewAllTransactions}>
                  <Text style={styles.viewAllLinkText}>{t('customer.viewAllTransactions')}</Text>
                </Pressable>
              ) : null}
            </CustomerCard>

            <Text style={styles.hint}>{t('customer.acceptInviteHint')}</Text>

            <View style={styles.actions}>
              <CustomerButton
                title={t('customer.accept')}
                size="medium"
                style={styles.actionBtn}
                loading={acting === 'accept'}
                disabled={Boolean(acting)}
                onPress={handleAccept}
              />
              <CustomerButton
                title={t('customer.decline')}
                size="medium"
                variant="outline"
                style={styles.actionBtn}
                loading={acting === 'reject'}
                disabled={Boolean(acting)}
                onPress={handleDecline}
              />
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.cream },
  header: {
    borderBottomLeftRadius: radius.container,
    borderBottomRightRadius: radius.container,
  },
  headerInner: { paddingBottom: 18 },
  content: { padding: spacing.md },
  empty: { textAlign: 'center', color: c.textMuted, marginTop: 40 },
  shopHead: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  shopImage: {
    width: 72,
    height: 72,
    borderRadius: radius.card,
    backgroundColor: c.sand,
  },
  shopPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: radius.card,
    backgroundColor: c.peach,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shopPlaceholderText: { color: '#fff', fontSize: 28, fontWeight: '800' },
  shopInfo: { flex: 1, minWidth: 0 },
  shopName: { fontSize: 18, fontWeight: '800', color: c.text },
  badge: {
    alignSelf: 'flex-start',
    marginTop: 6,
    marginBottom: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#FEF3C7',
  },
  badgeText: {
    color: '#B45309',
    fontSize: 12,
    fontWeight: '700',
  },
  meta: { color: c.textMuted, marginTop: 2, fontSize: 13 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: c.text, marginBottom: 4 },
  sectionNote: { color: c.textMuted, fontSize: 13, marginBottom: 12 },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 8,
  },
  statCard: {
    width: '47%',
    flexGrow: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.border,
    padding: 12,
  },
  statLabel: { fontSize: 11, color: c.textMuted, fontWeight: '700', marginBottom: 4 },
  statValue: { fontSize: 15, fontWeight: '800', color: c.text },
  statValueDue: { fontSize: 15, fontWeight: '800', color: '#B91C1C' },
  statValuePaid: { fontSize: 15, fontWeight: '800', color: '#15803D' },
  row: {
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
  },
  rowLabel: { fontSize: 12, color: c.textMuted, marginBottom: 2 },
  rowValue: { fontSize: 15, fontWeight: '700', color: c.text },
  rowValueHighlight: { color: '#B91C1C' },
  purchaseRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
  },
  purchaseMain: { flex: 1, minWidth: 0 },
  purchaseName: { fontSize: 14, fontWeight: '700', color: c.text },
  purchaseMeta: { marginTop: 2, fontSize: 12, color: c.textMuted },
  purchaseTotal: { fontSize: 14, fontWeight: '800', color: '#EA580C' },
  viewAllLink: { marginTop: 8, alignSelf: 'center' },
  viewAllLinkText: { color: '#EA580C', fontWeight: '800', fontSize: 13 },
  hint: {
    color: c.textMuted,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 14,
    marginTop: 4,
  },
  actions: { flexDirection: 'row', gap: 10 },
  actionBtn: { flex: 1 },
});
