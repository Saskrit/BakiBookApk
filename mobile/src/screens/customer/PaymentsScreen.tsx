import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import {
  CompositeNavigationProp,
  RouteProp,
  useFocusEffect,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Svg, { Circle, Path } from 'react-native-svg';
import {
  fetchPortalDues,
  fetchPortalPayments,
  fetchPortalPaymentSubmissions,
  submitPortalPayment,
  type PortalSubmission,
} from '../../api/portal';
import { uploadImage } from '../../api/upload';
import { promptImageSource } from '../../utils/pickImage';
import NotificationBell from '../../components/NotificationBell';
import { CustomerLoading } from '../../components/customer/CustomerUi';
import { appAlert } from '../../contexts/DialogContext';
import { useSocket } from '../../contexts/SocketContext';
import { customerColors as c } from '../../theme/customerColors';
import { spacing } from '../../theme/spacing';
import { radius } from '../../theme/radius';

import { formatRs } from '../../utils/format';
import { normalizeImageUrlSync } from '../../utils/normalizeImageUrl';
import type { CustomerTabParamList, RootStackParamList } from '../../navigation/types';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<CustomerTabParamList, 'Payments'>,
  NativeStackNavigationProp<RootStackParamList>
>;

type StatusTab = 'all' | 'pending' | 'reported' | 'verified' | 'rejected';
type Method = 'eSewa' | 'Khalti' | 'Bank Transfer';
type PayStatus = 'pending' | 'reported' | 'verified' | 'rejected';

type PayRow = {
  id: string;
  submissionId?: string;
  paymentId?: string;
  customerId?: string;
  shopName: string;
  amount: number;
  method?: string;
  payLabel?: string;
  status: PayStatus;
  date?: string;
  time?: string;
  reviewedAt?: string | null;
  screenshotUrl?: string;
  note?: string;
  reviewNote?: string;
  receiptNo?: string;
};

const METHODS: Method[] = ['eSewa', 'Khalti', 'Bank Transfer'];

function mapSubmissionStatus(status: string): PayStatus {
  if (status === 'accepted') return 'verified';
  if (status === 'reported') return 'reported';
  if (status === 'rejected') return 'rejected';
  return 'pending';
}

export default function PaymentsScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<CustomerTabParamList, 'Payments'>>();
  const { socket } = useSocket();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rows, setRows] = useState<PayRow[]>([]);
  const [shops, setShops] = useState<
    Array<{ customerId: string; shopName: string; balance: number }>
  >([]);
  const [tab, setTab] = useState<StatusTab>('all');
  const [shopFilterId, setShopFilterId] = useState<string | undefined>();
  const [shopFilterName, setShopFilterName] = useState<string | undefined>();
  const [submitOpen, setSubmitOpen] = useState(false);
  const [presetShopId, setPresetShopId] = useState<string | undefined>();
  const [detail, setDetail] = useState<PayRow | null>(null);

  useFocusEffect(
    useCallback(() => {
      const params = route.params;
      if (params?.customerId) {
        setShopFilterId(params.customerId);
        setShopFilterName(params.shopName);
      }
      if (params?.openSubmit) {
        setPresetShopId(params.customerId);
        setSubmitOpen(true);
        navigation.setParams({
          openSubmit: undefined,
          customerId: params.customerId,
          shopName: params.shopName,
        });
      }
    }, [route.params, navigation])
  );

  const load = useCallback(async () => {
    const [paymentsRes, submissionsRes, duesRes] = await Promise.all([
      fetchPortalPayments(),
      fetchPortalPaymentSubmissions().catch(() => ({ submissions: [] as PortalSubmission[] })),
      fetchPortalDues().catch(() => ({
        currentDue: 0,
        breakdown: [] as Array<{ customerId: string; shopName: string; balance: number }>,
      })),
    ]);

    setShops(duesRes.breakdown || []);

    const fromSubmissions: PayRow[] = (submissionsRes.submissions || []).map((s) => ({
      id: `sub-${s.id}`,
      submissionId: s.id,
      paymentId: s.paymentId ? String(s.paymentId) : undefined,
      customerId: s.customerId,
      shopName: s.shopName || 'Shop',
      amount: Number(s.amount || 0),
      method: s.method,
      payLabel: s.payLabel || s.method,
      status: mapSubmissionStatus(s.status),
      date: s.date,
      time: s.time,
      reviewedAt: s.reviewedAt,
      screenshotUrl: normalizeImageUrlSync(s.screenshotUrl),
      note: s.note,
      reviewNote: s.reviewNote || s.reportReason,
      receiptNo: s.paymentId ? undefined : undefined,
    }));

    const linkedPaymentIds = new Set(
      (submissionsRes.submissions || [])
        .filter((s) => s.paymentId)
        .map((s) => String(s.paymentId))
    );
    const linkedSubmissionIds = new Set(
      (paymentsRes.payments || [])
        .map((p) => (p.submissionId ? String(p.submissionId) : ''))
        .filter(Boolean)
    );

    const fromPayments: PayRow[] = (paymentsRes.payments || [])
      .filter((p) => !linkedPaymentIds.has(String(p.id)))
      .map((p) => ({
        id: `pay-${p.id}`,
        paymentId: String(p.id),
        submissionId: p.submissionId ? String(p.submissionId) : undefined,
        customerId: p.customerId,
        shopName: p.shopName || 'Shop',
        amount: Number(p.amount || 0),
        method: p.method,
        payLabel: p.paidFor || p.method,
        status: 'verified' as const,
        date: p.date,
        time: p.time,
        reviewedAt: p.date,
        screenshotUrl: normalizeImageUrlSync(p.screenshotUrl),
        note: p.note,
        receiptNo: p.receiptNo || '',
      }))
      .filter((p) => !(p.submissionId && linkedSubmissionIds.has(p.submissionId)));

    // Prefer submission rows (they carry review state); hide duplicate payments linked by ID.
    const submissionPaymentIds = new Set(
      fromSubmissions.map((s) => s.paymentId).filter(Boolean) as string[]
    );
    const uniquePayments = fromPayments.filter(
      (p) => !p.paymentId || !submissionPaymentIds.has(p.paymentId)
    );

    // Attach receipt numbers from payments onto accepted submissions when available.
    const receiptByPaymentId = Object.fromEntries(
      (paymentsRes.payments || [])
        .filter((p) => p.receiptNo)
        .map((p) => [String(p.id), p.receiptNo as string])
    );
    const submissionsWithReceipt = fromSubmissions.map((s) =>
      s.paymentId && receiptByPaymentId[s.paymentId]
        ? { ...s, receiptNo: receiptByPaymentId[s.paymentId] }
        : s
    );

    setRows([...submissionsWithReceipt, ...uniquePayments]);
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load()
        .catch(() => setRows([]))
        .finally(() => setLoading(false));
    }, [load])
  );

  useEffect(() => {
    if (!socket) return;
    const onUpdated = () => {
      void load();
    };
    socket.on('payment-submission:updated', onUpdated);
    return () => {
      socket.off('payment-submission:updated', onUpdated);
    };
  }, [socket, load]);

  const counts = useMemo(() => {
    const scoped = shopFilterId
      ? rows.filter((r) => r.customerId === shopFilterId)
      : rows;
    const pending = scoped.filter((r) => r.status === 'pending').length;
    const reported = scoped.filter((r) => r.status === 'reported').length;
    const verified = scoped.filter((r) => r.status === 'verified').length;
    const rejected = scoped.filter((r) => r.status === 'rejected').length;
    return { pending, reported, verified, rejected, all: scoped.length };
  }, [rows, shopFilterId]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (shopFilterId && r.customerId !== shopFilterId) return false;
      return tab === 'all' ? true : r.status === tab;
    });
  }, [rows, tab, shopFilterId]);

  const statusMeta = (status: PayStatus) => {
    if (status === 'verified') {
      return {
        label: t('customer.payVerified'),
        bg: '#DCFCE7',
        fg: '#15803D',
        iconBg: '#D1FAE5',
        icon: '#10B981',
      };
    }
    if (status === 'reported') {
      return {
        label: t('customer.payReported'),
        bg: '#FFEDD5',
        fg: '#C2410C',
        iconBg: '#FFEDD5',
        icon: '#F59E0B',
      };
    }
    if (status === 'rejected') {
      return {
        label: t('customer.payRejected'),
        bg: '#FEE2E2',
        fg: '#B91C1C',
        iconBg: '#FEE2E2',
        icon: '#EF4444',
      };
    }
    return {
      label: t('customer.payPending'),
      bg: '#DBEAFE',
      fg: '#1D4ED8',
      iconBg: '#DBEAFE',
      icon: '#3B82F6',
    };
  };

  const statusDateLabel = (item: PayRow) => {
    if (item.status === 'verified' && item.reviewedAt) {
      return t('customer.verifiedOn', { date: item.reviewedAt });
    }
    if (item.status === 'reported') {
      return item.reviewedAt
        ? t('customer.reportedOn', { date: item.reviewedAt })
        : t('customer.payReported');
    }
    if (item.status === 'rejected') {
      return item.reviewedAt
        ? t('customer.rejectedOn', { date: item.reviewedAt })
        : t('customer.payRejected');
    }
    return item.date
      ? t('customer.submittedOn', { date: item.date })
      : t('customer.awaitingReview');
  };

  if (loading) return <CustomerLoading />;

  return (
    <View style={[pyStyles.pyScreen, { paddingTop: insets.top }]}>
    <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: insets.bottom + 28 }}
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
          <View style={pyStyles.pyHeaderWrap}>
            <View style={pyStyles.pyTopBar}>
              <View style={{ width: 40 }} />
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={pyStyles.pyTitle}>{t('customer.verificationTitle')}</Text>
                <Text style={pyStyles.pySubtitle}>{t('customer.verificationSubtitle')}</Text>
              </View>
              <Pressable
                style={pyStyles.pyHelpBtn}
                onPress={() =>
                  appAlert(t('customer.howPaymentsTitle'), t('customer.howPaymentsBody'))
                }
              >
                <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                  <Circle cx={12} cy={12} r={8} stroke="#2563EB" strokeWidth={2} />
                  <Path
                    d="M9.5 9.5 C9.5 8 10.5 7 12 7 C13.5 7 14.5 8 14.5 9.5 C14.5 11 12 11.5 12 13"
                    stroke="#2563EB"
                    strokeWidth={2}
                  />
                  <Circle cx={12} cy={16.5} r={1} fill="#2563EB" />
                </Svg>
                <Text style={pyStyles.pyHelpText}>{t('common.help')}</Text>
              </Pressable>
            </View>

            <View style={pyStyles.pyStatusGrid}>
              {(
                [
                  ['pending', t('customer.payPending'), counts.pending, '#DBEAFE', '#3B82F6'],
                  ['verified', t('customer.payVerified'), counts.verified, '#D1FAE5', '#10B981'],
                  ['reported', t('customer.payReported'), counts.reported, '#FFEDD5', '#F59E0B'],
                  ['rejected', t('customer.payRejected'), counts.rejected, '#FEE2E2', '#EF4444'],
                ] as const
              ).map(([key, label, count, bg, fg]) => (
                <Pressable
                  key={key}
                  style={[pyStyles.pyStatusTile, { backgroundColor: bg }]}
                  onPress={() => setTab(key)}
                >
                  <View style={[pyStyles.pyStatusTileIcon, { backgroundColor: '#FFF' }]}>
                    <Text style={{ color: fg, fontWeight: '900', fontSize: 12 }}>
                      {key === 'pending' ? '⏱' : key === 'verified' ? '✓' : key === 'reported' ? '!' : '✕'}
                    </Text>
                  </View>
                  <Text style={pyStyles.pyStatusTileLabel}>{label}</Text>
                  <Text style={[pyStyles.pyStatusTileCount, { color: fg }]}>
                    {t('customer.paymentsCount', { count })}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={pyStyles.pySendCard}>
              <Text style={pyStyles.pySendText}>{t('customer.madePayment')}</Text>
              <Pressable style={pyStyles.pySendBtn} onPress={() => setSubmitOpen(true)}>
                <Text style={pyStyles.pySendBtnText}>{t('customer.sendScreenshot')}</Text>
              </Pressable>
            </View>

            {shopFilterId ? (
              <View style={pyStyles.pyFilterBanner}>
                <Text style={pyStyles.pyFilterBannerText}>
                  {t('customer.filteredByShop', { shop: shopFilterName || 'Shop' })}
                </Text>
                <Pressable
                  onPress={() => {
                    setShopFilterId(undefined);
                    setShopFilterName(undefined);
                    navigation.setParams({ customerId: undefined, shopName: undefined });
                  }}
                >
                  <Text style={pyStyles.pyFilterClear}>{t('customer.clearShopFilter')}</Text>
                </Pressable>
              </View>
            ) : null}

            <Text style={pyStyles.pySectionTitle}>{t('customer.allPayments')}</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={pyStyles.pyTabs}
            >
              {(
                [
                  ['all', t('customer.tabAll'), counts.all],
                  ['pending', t('customer.tabPending'), counts.pending],
                  ['reported', t('customer.tabReported'), counts.reported],
                  ['verified', t('customer.tabVerified'), counts.verified],
                  ['rejected', t('customer.tabRejected'), counts.rejected],
                ] as const
              ).map(([key, label, count]) => {
                const active = tab === key;
                return (
                  <Pressable
                    key={key}
                    style={[pyStyles.pyTab, active && pyStyles.pyTabActive]}
                    onPress={() => setTab(key)}
                  >
                    <Text style={[pyStyles.pyTabText, active && pyStyles.pyTabTextActive]}>
                      {label}
                      {key !== 'all' && count > 0 ? ` (${count})` : ''}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        }
        ListEmptyComponent={
          <Text style={pyStyles.pyEmpty}>{t('customer.noPayments')}</Text>
        }
        ListFooterComponent={
          <View style={pyStyles.pyTipBanner}>
            <View style={pyStyles.pyTipIcon}>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                <Circle cx={12} cy={12} r={8} stroke="#2563EB" strokeWidth={2} />
                <Path d="M12 11 V16 M12 8 V8.5" stroke="#2563EB" strokeWidth={2} />
              </Svg>
            </View>
            <Text style={pyStyles.pyTipText}>{t('customer.verificationTip')}</Text>
            <NotificationBell tint="#2563EB" badgeColor="#16A34A" />
          </View>
        }
      renderItem={({ item }) => {
          const status = statusMeta(item.status);
        return (
            <Pressable style={pyStyles.pyPayCard} onPress={() => setDetail(item)}>
              <View style={[pyStyles.pyShopIcon, { backgroundColor: status.iconBg }]}>
                <Text style={{ color: status.icon, fontWeight: '900' }}>
                  {item.status === 'pending'
                    ? '⏱'
                    : item.status === 'verified'
                      ? '✓'
                      : item.status === 'reported'
                        ? '!'
                        : '✕'}
                </Text>
              </View>
              <View style={pyStyles.pyPayMid}>
                <Text style={pyStyles.pyShopName}>{item.shopName}</Text>
                <Text style={pyStyles.pyPayAmountLine}>
                  {formatRs(item.amount)}
                  {item.date ? `  ·  ${item.date}${item.time ? ` ${item.time}` : ''}` : ''}
                </Text>
                {item.receiptNo ? (
                  <Text style={pyStyles.pyTxnId}>
                    {t('customer.receiptNo', { id: item.receiptNo })}
                  </Text>
                ) : null}
              </View>
              <View style={pyStyles.pyPayRight}>
                <View style={[pyStyles.pyStatusBadge, { backgroundColor: status.bg }]}>
                  <Text style={[pyStyles.pyStatusText, { color: status.fg }]}>
                    {status.label}
                  </Text>
                </View>
                <Text style={pyStyles.pyVerifiedOn}>{statusDateLabel(item)}</Text>
                {item.screenshotUrl ? (
                  <Image
                    source={{ uri: item.screenshotUrl }}
                    style={pyStyles.pyThumb}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                  />
                ) : null}
              </View>
              <Text style={pyStyles.pyChevron}>›</Text>
            </Pressable>
          );
        }}
      />

      <Modal visible={!!detail} transparent animationType="fade" onRequestClose={() => setDetail(null)}>
        <View style={pyStyles.pyDetailBackdrop}>
          <View style={pyStyles.pyDetailCard}>
            <Text style={pyStyles.pyDetailTitle}>{detail?.shopName}</Text>
            <Text style={pyStyles.pyDetailAmount}>{formatRs(detail?.amount || 0)}</Text>
            <Text style={pyStyles.pyDetailMeta}>
              {[detail?.method, detail?.payLabel, detail?.date, detail?.time]
                .filter(Boolean)
                .join(' · ')}
            </Text>
            {detail?.receiptNo ? (
              <Text style={pyStyles.pyTxnId}>{t('customer.receiptNo', { id: detail.receiptNo })}</Text>
            ) : null}
            {detail?.reviewNote ? (
              <Text style={pyStyles.pyDetailNote}>{detail.reviewNote}</Text>
            ) : null}
            {detail?.screenshotUrl ? (
              <Image
                source={{ uri: detail.screenshotUrl }}
                style={pyStyles.pyDetailImage}
                contentFit="contain"
                cachePolicy="memory-disk"
              />
            ) : null}
            <Pressable style={pyStyles.pyDetailClose} onPress={() => setDetail(null)}>
              <Text style={pyStyles.pyDetailCloseText}>{t('common.close')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <SubmitPaymentModal
        visible={submitOpen}
        shops={shops}
        initialCustomerId={presetShopId}
        onClose={() => {
          setSubmitOpen(false);
          setPresetShopId(undefined);
        }}
        onSubmitted={async () => {
          setSubmitOpen(false);
          setPresetShopId(undefined);
          await load();
        }}
      />
    </View>
  );
}

function SubmitPaymentModal({
  visible,
  shops,
  initialCustomerId,
  onClose,
  onSubmitted,
}: {
  visible: boolean;
  shops: Array<{ customerId: string; shopName: string; balance: number }>;
  initialCustomerId?: string;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [shopId, setShopId] = useState(initialCustomerId || shops[0]?.customerId || '');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<Method>('eSewa');
  const [note, setNote] = useState('');
  const [preview, setPreview] = useState('');
  const [screenshotUrl, setScreenshotUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      const preferred =
        (initialCustomerId && shops.some((s) => s.customerId === initialCustomerId)
          ? initialCustomerId
          : null) ||
        shops[0]?.customerId ||
        '';
      setShopId(preferred);
    }
  }, [visible, shops, initialCustomerId]);

  const reset = () => {
    setShopId(initialCustomerId || shops[0]?.customerId || '');
    setAmount('');
    setMethod('eSewa');
    setNote('');
    setPreview('');
    setScreenshotUrl('');
  };

  const pickScreenshot = () => {
    promptImageSource({
      title: t('customer.chooseScreenshot'),
      onPicked: uploadShot,
    });
  };

  const uploadShot = async (uri: string) => {
    setUploading(true);
    setPreview(uri);
    try {
      const url = await uploadImage(uri, 'payment');
      setScreenshotUrl(url);
    } catch (err) {
      setPreview('');
      setScreenshotUrl('');
      appAlert(t('common.error'), err instanceof Error ? err.message : t('upload.uploadFailed'));
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    if (!shopId) {
      appAlert(t('common.error'), t('customer.selectShop'));
      return;
    }
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      appAlert(t('common.error'), t('customer.enterAmount'));
      return;
    }
    if (!screenshotUrl) {
      appAlert(t('common.error'), t('customer.screenshotRequired'));
      return;
    }

    setSubmitting(true);
    try {
      await submitPortalPayment({
        customerId: shopId,
        amount: parsed,
        method,
        payType: 'custom',
        screenshotUrl,
        note: note.trim(),
      });
      appAlert(t('customer.paymentSubmitted'), t('customer.paymentSubmittedBody'));
      reset();
      onSubmitted();
    } catch (err) {
      appAlert(
        t('common.error'),
        err instanceof Error ? err.message : t('customer.paymentSubmitFailed')
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={pyStyles.pyModalBackdrop}>
        <View style={[pyStyles.pyModalCard, { paddingBottom: insets.bottom + 16 }]}>
          <View style={pyStyles.pyModalHeader}>
            <Text style={pyStyles.pyModalTitle}>{t('customer.sendScreenshot')}</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={pyStyles.pyModalClose}>{t('common.close')}</Text>
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={pyStyles.pyFieldLabel}>{t('customer.selectShop')}</Text>
            {shops.length === 0 ? (
              <Text style={pyStyles.pyHint}>{t('customer.noDueShops')}</Text>
            ) : (
              shops.map((shop) => {
                const active = shopId === shop.customerId;
                return (
                  <Pressable
                    key={shop.customerId}
                    style={[pyStyles.pyShopOption, active && pyStyles.pyShopOptionActive]}
                    onPress={() => {
                      setShopId(shop.customerId);
                      if (!amount) setAmount(String(shop.balance));
                    }}
                  >
                    <Text style={pyStyles.pyShopOptionName}>{shop.shopName}</Text>
                    <Text style={pyStyles.pyShopOptionDue}>
                      {t('customer.due', { amount: formatRs(shop.balance) })}
                    </Text>
                  </Pressable>
                );
              })
            )}

            <Text style={pyStyles.pyFieldLabel}>{t('customer.amount')}</Text>
            <TextInput
              style={pyStyles.pyInput}
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
              placeholder="0"
              placeholderTextColor="#94A3B8"
            />

            <Text style={pyStyles.pyFieldLabel}>{t('customer.paymentMethod')}</Text>
            <View style={pyStyles.pyMethodRow}>
              {METHODS.map((m) => (
                <Pressable
                  key={m}
                  style={[pyStyles.pyMethodChip, method === m && pyStyles.pyMethodChipActive]}
                  onPress={() => setMethod(m)}
                >
                  <Text
                    style={[
                      pyStyles.pyMethodChipText,
                      method === m && pyStyles.pyMethodChipTextActive,
                    ]}
                  >
                    {m}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={pyStyles.pyFieldLabel}>{t('customer.noteOptional')}</Text>
            <TextInput
              style={[pyStyles.pyInput, { height: 70, textAlignVertical: 'top' }]}
              value={note}
              onChangeText={setNote}
              multiline
              placeholder={t('customer.notePlaceholder')}
              placeholderTextColor="#94A3B8"
            />

            <Text style={pyStyles.pyFieldLabel}>{t('customer.paymentScreenshot')}</Text>
            <Pressable style={pyStyles.pyUploadBox} onPress={pickScreenshot} disabled={uploading}>
              {preview ? (
                <Image source={{ uri: preview }} style={pyStyles.pyPreview} contentFit="cover" />
              ) : (
                <Text style={pyStyles.pyUploadText}>
                  {uploading ? t('upload.uploading') : t('customer.tapUploadScreenshot')}
                </Text>
              )}
            </Pressable>

            <Pressable
              style={[pyStyles.pySubmitBtn, (submitting || uploading) && { opacity: 0.6 }]}
              disabled={submitting || uploading}
              onPress={submit}
            >
              <Text style={pyStyles.pySubmitBtnText}>
                {submitting ? t('common.saving') : t('customer.submitPayment')}
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const pyStyles = StyleSheet.create({
  pyScreen: { flex: 1, backgroundColor: '#F7F8FC' },
  pyHeaderWrap: { paddingHorizontal: spacing.md, paddingTop: 6 },
  pyTopBar: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: spacing.md },
  pyTitle: { fontSize: 18, fontWeight: '800', color: '#1E293B', textAlign: 'center' },
  pySubtitle: { marginTop: 3, fontSize: 12, color: '#64748B', textAlign: 'center' },
  pyHelpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  pyHelpText: { color: '#2563EB', fontWeight: '800', fontSize: 11 },
  pyStatusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  pyStatusTile: {
    width: '48%',
    flexGrow: 1,
    borderRadius: radius.card,
    padding: 12,
    minHeight: 88,
  },
  pyStatusTileIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  pyStatusTileLabel: { fontSize: 12, fontWeight: '800', color: '#334155' },
  pyStatusTileCount: { marginTop: 2, fontSize: 13, fontWeight: '800' },
  pySendCard: {
    backgroundColor: '#FFE8D4',
    borderRadius: radius.card,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  pySendText: { flex: 1, fontSize: 13, fontWeight: '700', color: '#7C2D12', lineHeight: 18 },
  pySendBtn: {
    backgroundColor: '#F97316',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  pySendBtnText: { color: '#FFF', fontWeight: '800', fontSize: 12 },
  pyFilterBanner: {
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
  pyFilterBannerText: { flex: 1, fontSize: 12, fontWeight: '700', color: '#1D4ED8' },
  pyFilterClear: { fontSize: 12, fontWeight: '800', color: '#2563EB' },
  pyTabs: { gap: spacing.md, paddingBottom: 8, paddingRight: 8 },
  pyTab: {
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  pyTabActive: { borderBottomColor: '#3B82F6' },
  pyTabText: { fontSize: 13, fontWeight: '800', color: '#94A3B8' },
  pyTabTextActive: { color: '#2563EB' },
  pySectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 8,
  },
  pyEmpty: { textAlign: 'center', color: '#94A3B8', marginTop: 30, paddingHorizontal: 24 },
  pyPayCard: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: '#FFF',
    borderRadius: radius.card,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  pyShopIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.container,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pyPayMid: { flex: 1 },
  pyShopName: { fontSize: 14, fontWeight: '800', color: '#1E293B' },
  pyPayAmountLine: { marginTop: 3, fontSize: 12, color: '#64748B', fontWeight: '600' },
  pyTxnId: { marginTop: 4, fontSize: 12, color: '#2563EB', fontWeight: '700' },
  pyPayRight: { alignItems: 'flex-end', maxWidth: 120, gap: 4 },
  pyStatusBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  pyStatusText: { fontSize: 10, fontWeight: '800' },
  pyVerifiedOn: { fontSize: 10, color: '#94A3B8', fontWeight: '600', textAlign: 'right' },
  pyThumb: { width: 36, height: 36, borderRadius: 8, backgroundColor: '#E2E8F0', marginTop: 2 },
  pyChevron: { fontSize: 18, color: '#CBD5E1' },
  pyTipBanner: {
    marginHorizontal: 16,
    marginTop: 8,
    backgroundColor: '#EAF2FF',
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pyTipIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.card,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pyTipText: { flex: 1, fontSize: 11, color: '#334155', lineHeight: 15, fontWeight: '600' },
  pyDetailBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  pyDetailCard: {
    backgroundColor: '#FFF',
    borderRadius: radius.container,
    padding: spacing.lg,
  },
  pyDetailTitle: { fontSize: 18, fontWeight: '800', color: '#1E293B' },
  pyDetailAmount: { marginTop: 6, fontSize: 22, fontWeight: '800', color: '#EA580C' },
  pyDetailMeta: { marginTop: 6, color: '#64748B', fontWeight: '600', fontSize: 13 },
  pyDetailNote: { marginTop: 10, color: '#B91C1C', fontWeight: '600', fontSize: 13 },
  pyDetailImage: {
    marginTop: 14,
    width: '100%',
    height: 220,
    borderRadius: 12,
    backgroundColor: '#E2E8F0',
  },
  pyDetailClose: {
    marginTop: 14,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  pyDetailCloseText: { fontWeight: '800', color: '#475569' },
  pyModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'flex-end',
  },
  pyModalCard: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  pyModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  pyModalTitle: { fontSize: 18, fontWeight: '800', color: '#1E293B' },
  pyModalClose: { color: '#64748B', fontWeight: '700' },
  pyFieldLabel: {
    marginTop: 10,
    marginBottom: 6,
    fontSize: 12,
    fontWeight: '800',
    color: '#64748B',
  },
  pyHint: { color: '#94A3B8', fontSize: 13, marginBottom: 8 },
  pyShopOption: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  pyShopOptionActive: { borderColor: '#F97316', backgroundColor: '#FFF7ED' },
  pyShopOptionName: { fontWeight: '800', color: '#1E293B' },
  pyShopOptionDue: { marginTop: 2, color: '#EA580C', fontWeight: '700', fontSize: 12 },
  pyInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#1E293B',
    backgroundColor: '#FFF',
  },
  pyMethodRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  pyMethodChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFF',
  },
  pyMethodChipActive: { borderColor: '#F97316', backgroundColor: '#FFEDD5' },
  pyMethodChipText: { fontWeight: '700', color: '#64748B', fontSize: 12 },
  pyMethodChipTextActive: { color: '#EA580C' },
  pyUploadBox: {
    borderWidth: 1,
    borderColor: '#FDBA74',
    borderStyle: 'dashed',
    borderRadius: 14,
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF7ED',
    overflow: 'hidden',
  },
  pyUploadText: { color: '#EA580C', fontWeight: '700' },
  pyPreview: { width: '100%', height: 160 },
  pySubmitBtn: {
    marginTop: 16,
    marginBottom: 8,
    backgroundColor: '#F97316',
    borderRadius: 14,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  pySubmitBtnText: { color: '#FFF', fontWeight: '800', fontSize: 15 },
});
