import { useCallback, useState } from 'react';
import {
  Image,
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
import {
  CustomerButton,
  CustomerCard,
  CustomerLoading,
} from '../../components/customer/CustomerUi';
import { appAlert } from '../../contexts/DialogContext';
import { customerColors as c } from '../../theme/customerColors';
import { typeScale } from '../../theme/typography';
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

  if (loading) return <CustomerLoading />;

  const shopImage = normalizeImageUrlSync(inv?.shopImage);
  const balance = Number(inv?.balance || 0);
  const verifiedLabel = inv?.shopVerified
    ? t('customer.verifiedShop')
    : inv?.shopVerificationStatus === 'pending'
      ? t('customer.pendingShopVerification')
      : t('customer.unverifiedShop');

  return (
    <View style={styles.screen}>
      <LinearGradient
        colors={[c.peach, c.sky]}
        style={[styles.header, { paddingTop: insets.top + 10 }]}
      >
        <Text style={styles.back} onPress={() => navigation.goBack()}>
          {t('common.back')}
        </Text>
        <Text style={styles.title}>{t('customer.reviewInviteTitle')}</Text>
        <Text style={styles.subtitle}>{t('customer.reviewInviteSubtitle')}</Text>
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
            </CustomerCard>

            <CustomerCard>
              <Text style={styles.sectionTitle}>{t('customer.accountSummary')}</Text>
              <DetailRow label={t('customer.invitedOn')} value={inv.invitedAt} />
              <DetailRow
                label={t('customer.currentDue')}
                value={formatRs(balance)}
                highlight={balance > 0}
              />
              {inv.creditScore ? (
                <DetailRow label={t('customer.creditScore')} value={String(inv.creditScore)} />
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
    paddingHorizontal: spacing.lg,
    paddingBottom: 18,
    borderBottomLeftRadius: radius.container,
    borderBottomRightRadius: radius.container,
  },
  back: { color: c.text, fontSize: 16, fontWeight: '600', marginBottom: 10 },
  title: {
    fontSize: typeScale.h1.fontSize,
    lineHeight: typeScale.h1.lineHeight,
    fontFamily: typeScale.h1.fontFamily,
    fontWeight: '700',
    color: c.text,
  },
  subtitle: { marginTop: 4, color: c.textMuted },
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
  row: {
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
  },
  rowLabel: { fontSize: 12, color: c.textMuted, marginBottom: 2 },
  rowValue: { fontSize: 15, fontWeight: '700', color: c.text },
  rowValueHighlight: { color: '#B91C1C' },
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
