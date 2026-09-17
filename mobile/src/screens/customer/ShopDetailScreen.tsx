import { useCallback, useMemo, useState, type ReactNode } from 'react';
import {
  Image,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { fetchPortalShopDetail } from '../../api/portal';
import AppBackButton from '../../components/AppBackButton';
import { CustomerLoading } from '../../components/customer/CustomerUi';
import { appAlert } from '../../contexts/DialogContext';
import { customerColors as c } from '../../theme/customerColors';
import { spacing } from '../../theme/spacing';
import { radius } from '../../theme/radius';

import { formatRs } from '../../utils/format';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ShopDetail'>;

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
  balanceDelta?: number;
  sortAt?: string;
};

type TimelineFilter = 'all' | 'credits' | 'payments';

function isCreditEntry(entry: LedgerEntry) {
  const type = String(entry.type || entry.label || '').toLowerCase();
  return type === 'credit' || type.includes('credit');
}

function entryAmount(entry: LedgerEntry) {
  if (isCreditEntry(entry)) return Number(entry.creditAmount || entry.balanceDelta || 0);
  return Math.abs(Number(entry.paymentAmount || entry.balanceDelta || 0));
}

function normalizePhone(phone: string) {
  return phone.replace(/[^\d+]/g, '');
}

export default function ShopDetailScreen({ navigation, route }: Props) {
  const { customerId } = route.params;
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<TimelineFilter>('all');
  const [shop, setShop] = useState<{
    customerId: string;
    shopName: string;
    shopkeeper?: string;
    phone?: string;
    location?: string;
    shopImage?: string;
    verified?: boolean;
    status?: string;
    creditScore?: string;
    balance: number;
  } | null>(null);
  const [summary, setSummary] = useState({
    currentDue: 0,
    totalPurchases: 0,
    totalPaid: 0,
    transactionCount: 0,
    lastPaymentAmount: 0,
    lastPaymentDate: null as string | null,
  });
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [recentPurchaseItems, setRecentPurchaseItems] = useState<
    Array<{ name: string; qty?: number; price?: number }>
  >([]);

  const load = useCallback(async () => {
    const data = await fetchPortalShopDetail(customerId);
    setShop(data.shop);
    setSummary(data.summary);
    setLedger((data.ledger || []) as LedgerEntry[]);
    setRecentPurchaseItems(data.recentPurchaseItems || []);
  }, [customerId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load()
        .catch(() => {
          setShop(null);
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

  const scoreLabel = shop?.creditScore
    ? t(`customer.scores.${String(shop.creditScore).toLowerCase()}`, {
        defaultValue: shop.creditScore,
      })
    : t('customer.scores.average');

  const scoreTone =
    shop?.creditScore === 'Excellent' || shop?.creditScore === 'Good'
      ? { bg: '#DCFCE7', fg: '#15803D' }
      : shop?.creditScore === 'Risky' || shop?.creditScore === 'Defaulter'
        ? { bg: '#FEE2E2', fg: '#B91C1C' }
        : { bg: '#FEF3C7', fg: '#B45309' };

  const openFilter = () => {
    appAlert(t('customer.filterTimeline'), t('customer.filterTimelineBody'), [
      { text: t('customer.tabAll'), onPress: () => setFilter('all') },
      { text: t('customer.tabCredits'), onPress: () => setFilter('credits') },
      { text: t('customer.tabPayments'), onPress: () => setFilter('payments') },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  const callShop = () => {
    const phone = shop?.phone?.trim();
    if (!phone) {
      appAlert(t('common.error'), t('customer.noShopPhone'));
      return;
    }
    Linking.openURL(`tel:${normalizePhone(phone)}`).catch(() =>
      appAlert(t('common.error'), t('customer.callFailed'))
    );
  };

  const openWhatsApp = () => {
    const phone = shop?.phone?.trim();
    if (!phone) {
      appAlert(t('common.error'), t('customer.noShopPhone'));
      return;
    }
    const digits = normalizePhone(phone).replace(/^\+/, '');
    Linking.openURL(`https://wa.me/${digits}`).catch(() =>
      appAlert(t('common.error'), t('customer.whatsappFailed'))
    );
  };

  const openDirections = () => {
    const location = shop?.location?.trim();
    if (!location) {
      appAlert(t('common.error'), t('customer.noShopLocation'));
      return;
    }
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
    Linking.openURL(url).catch(() =>
      appAlert(t('common.error'), t('customer.directionsFailed'))
    );
  };

  const shareShop = async () => {
    if (!shop) return;
    try {
      await Share.share({
        message: t('customer.shareShopMessage', {
          name: shop.shopName,
          location: shop.location || '',
          due: formatRs(summary.currentDue),
        }),
      });
    } catch {
      /* user cancelled */
    }
  };

  const contactShop = () => {
    appAlert(t('customer.contactShop'), t('customer.contactShopBody'), [
      { text: t('customer.call'), onPress: callShop },
      { text: t('customer.whatsapp'), onPress: openWhatsApp },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  const uploadScreenshot = () => {
    navigation.navigate('Customer', {
      screen: 'Payments',
      params: { customerId, openSubmit: true, shopName: shop?.shopName },
    });
  };

  const viewAllTransactions = () => {
    navigation.navigate('ShopTimeline', {
      customerId: String(customerId),
      shopName: shop?.shopName || route.params.shopName,
    });
  };

  const viewStatement = async () => {
    try {
      const { exportCustomerStatement } = await import('../../utils/customerStatement');
      await exportCustomerStatement({
        customerId,
        shopName: shop?.shopName,
      });
    } catch (err) {
      appAlert(
        t('common.error'),
        err instanceof Error ? err.message : t('customer.statementFailed')
      );
    }
  };

  if (loading || !shop) return <CustomerLoading />;

  const dueGuidance =
    summary.currentDue > 0 ? t('customer.dueReminderGeneric') : t('customer.noDue');

  return (
    <View style={[sdStyles.sdScreen, { paddingTop: insets.top }]}>
      <View style={sdStyles.sdTopBar}>
        <AppBackButton onPress={() => navigation.goBack()} />
        <Text style={sdStyles.sdTopTitle} numberOfLines={1}>
          {shop.shopName}
        </Text>
        <Pressable style={sdStyles.sdShareBtn} onPress={shareShop}>
          <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
            <Path
              d="M12 16 V5 M8 8 L12 4 L16 8 M5 14 V18 C5 19.1 5.9 20 7 20 H17 C18.1 20 19 19.1 19 18 V14"
              stroke="#EA580C"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
          <Text style={sdStyles.sdShareText}>{t('customer.share')}</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[sdStyles.sdContent, { paddingBottom: insets.bottom + 110 }]}
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
      >
        {/* Shop identity */}
        <View style={sdStyles.sdIdentityRow}>
          <View style={sdStyles.sdShopIconWrap}>
            {shop.shopImage ? (
              <Image source={{ uri: shop.shopImage }} style={sdStyles.sdShopImage} />
            ) : (
              <Svg width={34} height={34} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M4 9 L5 4 H19 L20 9 M5 9 V19 H19 V9"
                  stroke="#EA580C"
                  strokeWidth={2}
                  strokeLinejoin="round"
                />
                <Path d="M9 19 V13 H15 V19" stroke="#EA580C" strokeWidth={2} />
              </Svg>
            )}
          </View>
          <View style={sdStyles.sdIdentityMain}>
            {shop.creditScore ? (
              <View style={sdStyles.sdMetaRow}>
                <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M12 3 L14.5 9 H21 L16 13 L18 20 L12 16 L6 20 L8 13 L3 9 H9.5 Z"
                    fill="#F59E0B"
                  />
                </Svg>
                <Text style={sdStyles.sdMetaStrong} numberOfLines={2}>
                  {scoreLabel}
                </Text>
              </View>
            ) : null}
            {shop.location ? (
              <View style={sdStyles.sdMetaRow}>
                <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M12 21 C12 21 5 14 5 10 C5 6.1 8.1 3 12 3 C15.9 3 19 6.1 19 10 C19 14 12 21 12 21 Z"
                    stroke="#94A3B8"
                    strokeWidth={2}
                  />
                  <Circle cx={12} cy={10} r={2.5} fill="#94A3B8" />
                </Svg>
                <Text style={sdStyles.sdMetaText} numberOfLines={2}>
                  {shop.location}
                </Text>
              </View>
            ) : null}
            <View style={sdStyles.sdActiveBadge}>
              <Text style={sdStyles.sdActiveBadgeText}>{t('customer.activeShop')}</Text>
            </View>
          </View>
        </View>

        {/* Quick actions */}
        <View style={sdStyles.sdActionsRow}>
          <ActionBtn
            label={t('customer.call')}
            onPress={callShop}
            icon={
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M6 4 H10 L12 9 L9.5 10.5 C10.5 12.5 12 14 14 15 L15.5 12.5 L20.5 14.5 V18.5 C20.5 19.5 19.5 20.5 18.5 20.5 C10.5 20.5 3.5 13.5 3.5 5.5 C3.5 4.5 4.5 3.5 5.5 3.5"
                  stroke="#C2410C"
                  strokeWidth={1.8}
                />
              </Svg>
            }
          />
          <ActionBtn
            label={t('customer.whatsapp')}
            onPress={openWhatsApp}
            icon={
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M12 3 C7 3 3 6.8 3 11.5 C3 13.2 3.6 14.8 4.6 16.1 L3.5 20.5 L8.1 19.2 C9.3 19.8 10.6 20.1 12 20.1 C17 20.1 21 16.3 21 11.6 C21 6.8 17 3 12 3 Z"
                  stroke="#16A34A"
                  strokeWidth={1.8}
                />
                <Path
                  d="M9.5 9.5 C10.5 11.5 12.5 13.5 14.5 14.5"
                  stroke="#16A34A"
                  strokeWidth={1.8}
                  strokeLinecap="round"
                />
              </Svg>
            }
          />
          <ActionBtn
            label={t('customer.directions')}
            onPress={openDirections}
            icon={
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M12 21 C12 21 5 14 5 10 C5 6.1 8.1 3 12 3 C15.9 3 19 6.1 19 10 C19 14 12 21 12 21 Z"
                  stroke="#C2410C"
                  strokeWidth={2}
                />
                <Circle cx={12} cy={10} r={2.5} fill="#C2410C" />
              </Svg>
            }
          />
        </View>

        {/* Metric cards */}
        <View style={sdStyles.sdMetricsRow}>
          <View style={[sdStyles.sdMetricCard, { backgroundColor: '#FFF7ED' }]}>
            <View style={sdStyles.sdMetricTop}>
              <Text style={sdStyles.sdMetricLabel}>{t('customer.currentDue')}</Text>
              <View style={[sdStyles.sdMetricIcon, { backgroundColor: '#FFEDD5' }]}>
                <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                  <Rect x={4} y={7} width={16} height={12} rx={2} stroke="#EA580C" strokeWidth={2} />
                  <Path d="M4 11 H20" stroke="#EA580C" strokeWidth={2} />
                </Svg>
              </View>
            </View>
            <Text
              style={[sdStyles.sdMetricValue, { color: '#EA580C' }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
            >
              {formatRs(summary.currentDue)}
            </Text>
            <Pressable onPress={viewAllTransactions}>
              <Text style={sdStyles.sdMetricLink}>{t('customer.viewDetails')} ›</Text>
            </Pressable>
          </View>

          <View style={[sdStyles.sdMetricCard, { backgroundColor: '#F0FDF4' }]}>
            <View style={sdStyles.sdMetricTop}>
              <Text style={sdStyles.sdMetricLabel}>{t('customer.creditScore')}</Text>
              <View style={[sdStyles.sdMetricIcon, { backgroundColor: '#DCFCE7' }]}>
                <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M4 16 L9 10 L13 13 L20 6"
                    stroke="#16A34A"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </View>
            </View>
            <View style={[sdStyles.sdScorePill, { backgroundColor: scoreTone.bg }]}>
              <Text style={[sdStyles.sdScorePillText, { color: scoreTone.fg }]}>
                {scoreLabel.toUpperCase()}
              </Text>
            </View>
            <Text style={sdStyles.sdScorePoints}>{t('customer.shopCreditScoreHint')}</Text>
          </View>

          <View style={[sdStyles.sdMetricCard, { backgroundColor: '#EFF6FF' }]}>
            <View style={sdStyles.sdMetricTop}>
              <Text style={sdStyles.sdMetricLabel}>{t('customer.lastPayment')}</Text>
              <View style={[sdStyles.sdMetricIcon, { backgroundColor: '#DBEAFE' }]}>
                <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                  <Rect x={4} y={5} width={16} height={15} rx={2} stroke="#2563EB" strokeWidth={2} />
                  <Path d="M8 3 V7 M16 3 V7 M4 10 H20" stroke="#2563EB" strokeWidth={2} />
                </Svg>
              </View>
            </View>
            <Text style={sdStyles.sdLastPayDate}>
              {summary.lastPaymentDate || t('common.noActivity')}
            </Text>
            {summary.lastPaymentAmount > 0 ? (
              <View style={sdStyles.sdLastPayAmount}>
                <Text style={sdStyles.sdLastPayAmountText}>
                  {formatRs(summary.lastPaymentAmount)}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Account summary */}
        <View style={sdStyles.sdSectionCard}>
          <View style={sdStyles.sdSectionHeader}>
            <Text style={sdStyles.sdSectionTitle} numberOfLines={1}>
              {t('customer.accountSummary')}
            </Text>
            <Pressable style={sdStyles.sdStatementLink} onPress={viewStatement}>
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                <Rect x={5} y={3} width={14} height={18} rx={2} stroke="#2563EB" strokeWidth={2} />
                <Path d="M8 8 H16 M8 12 H14" stroke="#2563EB" strokeWidth={2} />
              </Svg>
              <Text style={sdStyles.sdStatementText} numberOfLines={1}>
                {t('customer.viewStatement')}
              </Text>
            </Pressable>
          </View>
          <View style={sdStyles.sdSummaryGrid}>
            <SummaryStat
              label={t('customer.totalPurchases')}
              value={formatRs(summary.totalPurchases)}
              color="#EA580C"
              iconBg="#FFEDD5"
              icon={
                <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M6 8 H18 L17 20 H7 Z M9 8 V6 C9 4.5 10 3.5 12 3.5 C14 3.5 15 4.5 15 6 V8"
                    stroke="#EA580C"
                    strokeWidth={2}
                  />
                </Svg>
              }
            />
            <SummaryStat
              label={t('customer.totalPaid')}
              value={formatRs(summary.totalPaid)}
              color="#16A34A"
              iconBg="#DCFCE7"
              icon={
                <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M12 4 V16 M8 12 L12 16 L16 12"
                    stroke="#16A34A"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              }
            />
            <SummaryStat
              label={t('customer.remainingDue')}
              value={formatRs(summary.currentDue)}
              color="#EA580C"
              iconBg="#FFEDD5"
              icon={
                <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                  <Rect x={4} y={7} width={16} height={12} rx={2} stroke="#EA580C" strokeWidth={2} />
                  <Path d="M4 11 H20" stroke="#EA580C" strokeWidth={2} />
                </Svg>
              }
            />
            <SummaryStat
              label={t('customer.totalTransactions')}
              value={String(summary.transactionCount)}
              color="#2563EB"
              iconBg="#DBEAFE"
              icon={
                <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                  <Rect x={5} y={3} width={14} height={18} rx={2} stroke="#2563EB" strokeWidth={2} />
                  <Path d="M8 8 H16 M8 12 H14" stroke="#2563EB" strokeWidth={2} />
                </Svg>
              }
            />
          </View>
        </View>

        {/* Transaction timeline */}
        <View style={sdStyles.sdSectionCard}>
          <View style={sdStyles.sdSectionHeader}>
            <Text style={sdStyles.sdSectionTitle} numberOfLines={1}>
              {t('customer.transactionTimeline')}
            </Text>
            <Pressable style={sdStyles.sdFilterChip} onPress={openFilter}>
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M4 6 H20 M7 12 H17 M10 18 H14"
                  stroke="#F97316"
                  strokeWidth={2}
                  strokeLinecap="round"
                />
              </Svg>
              <Text style={sdStyles.sdFilterChipText}>{t('customer.filter')}</Text>
            </Pressable>
          </View>

          {timeline.length === 0 ? (
            <Text style={sdStyles.sdEmptyTimeline}>{t('customer.noLedger')}</Text>
          ) : (
            timeline.slice(0, 8).map((entry, index) => {
              const credit = isCreditEntry(entry);
              const amount = entryAmount(entry);
              const title =
                entry.desc ||
                entry.items ||
                entry.products ||
                (credit ? t('common.credit') : t('customer.paymentReceived'));
              const balance =
                entry.runningBalance != null ? Number(entry.runningBalance) : null;
              return (
                <View key={String(entry.id || index)} style={sdStyles.sdTimelineRow}>
                  <View style={sdStyles.sdTimelineRail}>
                    <View
                      style={[
                        sdStyles.sdTimelineDot,
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
                    {index < Math.min(timeline.length, 8) - 1 ? (
                      <View style={sdStyles.sdTimelineLine} />
                    ) : null}
                  </View>
                  <View style={sdStyles.sdTimelineBody}>
                    <View style={sdStyles.sdTimelineTop}>
                      <Text style={sdStyles.sdTimelineTitle} numberOfLines={2}>
                        {title}
                      </Text>
                      <Text
                        style={[
                          sdStyles.sdTimelineAmount,
                          { color: credit ? '#EA580C' : '#16A34A' },
                        ]}
                        numberOfLines={1}
                      >
                        {credit ? `+ ${formatRs(amount)}` : `- ${formatRs(amount)}`}
                      </Text>
                    </View>
                    <Text style={sdStyles.sdTimelineSub} numberOfLines={1}>
                      {credit ? t('customer.addedToCredit') : t('customer.paymentReceived')}
                    </Text>
                    <View style={sdStyles.sdTimelineMetaRow}>
                      <View
                        style={[
                          sdStyles.sdTypeBadge,
                          { backgroundColor: credit ? '#FFEDD5' : '#DCFCE7' },
                        ]}
                      >
                        <Text
                          style={[
                            sdStyles.sdTypeBadgeText,
                            { color: credit ? '#C2410C' : '#15803D' },
                          ]}
                        >
                          {credit ? t('customer.badgeCredit') : t('customer.badgePayment')}
                        </Text>
                      </View>
                      <Text style={sdStyles.sdTimelineDate}>
                        {entry.date || '—'}
                        {entry.time ? ` · ${entry.time}` : ''}
                      </Text>
                    </View>
                    {balance != null ? (
                      <Text style={sdStyles.sdTimelineBalance}>
                        {t('customer.balance')}: {formatRs(balance)}
                      </Text>
                    ) : null}
                  </View>
                </View>
              );
            })
          )}

          <Pressable style={sdStyles.sdViewAllBtn} onPress={viewAllTransactions}>
            <Text style={sdStyles.sdViewAllText}>{t('customer.viewAllTransactions')}</Text>
            <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
              <Path
                d="M6 9 L12 15 L18 9"
                stroke="#64748B"
                strokeWidth={2.2}
                strokeLinecap="round"
              />
            </Svg>
          </Pressable>
        </View>

        {/* Bottom info widgets */}
        <View style={sdStyles.sdWidgetsRow}>
          <View style={[sdStyles.sdWidget, { backgroundColor: '#FFF7ED' }]}>
            <View style={sdStyles.sdWidgetHead}>
              <Text style={sdStyles.sdWidgetTitle}>{t('customer.recentPurchases')}</Text>
              <View style={sdStyles.sdWidgetArt}>
                <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M6 8 H18 L17 20 H7 Z M9 8 V6 C9 4.5 10 3.5 12 3.5 C14 3.5 15 4.5 15 6 V8"
                    stroke="#EA580C"
                    strokeWidth={1.8}
                  />
                </Svg>
              </View>
            </View>
            {recentPurchaseItems.length === 0 ? (
              <Text style={sdStyles.sdWidgetEmpty}>{t('customer.noRecentPurchases')}</Text>
            ) : (
              recentPurchaseItems.slice(0, 4).map((item, i) => (
                <Text key={`${item.name}-${i}`} style={sdStyles.sdWidgetItem} numberOfLines={2}>
                  • {item.name}
                  {item.qty ? ` ×${item.qty}` : ''}
                </Text>
              ))
            )}
          </View>

          <View style={[sdStyles.sdWidget, { backgroundColor: '#FEFCE8' }]}>
            <View style={sdStyles.sdBellWrap}>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M6 16 H18 L16.5 9.5 C16 7 14.2 5.5 12 5.5 C9.8 5.5 8 7 7.5 9.5 Z"
                  stroke="#CA8A04"
                  strokeWidth={2}
                />
                <Path d="M10 18 C10 19.1 10.9 20 12 20 C13.1 20 14 19.1 14 18" stroke="#CA8A04" strokeWidth={2} />
              </Svg>
            </View>
            <Text style={sdStyles.sdWidgetTitle}>{t('customer.paymentGuidance')}</Text>
            <Text style={sdStyles.sdReminderText}>{dueGuidance}</Text>
            <View style={sdStyles.sdReminderTip}>
              <Text style={sdStyles.sdReminderTipText}>{t('customer.creditTipBody')}</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Footer actions */}
      <View style={[sdStyles.sdFooter, { paddingBottom: insets.bottom + 10 }]}>
        <Pressable style={sdStyles.sdFooterBtnBlue} onPress={uploadScreenshot}>
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
            <Path
              d="M12 16 V7 M8 10 L12 6 L16 10 M5 16 V18 C5 19.1 5.9 20 7 20 H17 C18.1 20 19 19.1 19 18 V16"
              stroke="#2563EB"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
          <Text style={sdStyles.sdFooterBtnBlueText} numberOfLines={2}>
            {t('customer.uploadScreenshot')}
          </Text>
        </Pressable>
        <Pressable style={sdStyles.sdFooterBtnOrange} onPress={contactShop}>
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
            <Path
              d="M5 6 H19 V16 H9 L5 19 Z"
              stroke="#EA580C"
              strokeWidth={2}
              strokeLinejoin="round"
            />
          </Svg>
          <Text style={sdStyles.sdFooterBtnOrangeText} numberOfLines={2}>
            {t('customer.contactShop')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function ActionBtn({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: ReactNode;
  onPress: () => void;
}) {
  return (
    <Pressable style={sdStyles.sdActionBtn} onPress={onPress}>
      {icon}
      <Text style={sdStyles.sdActionLabel} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function SummaryStat({
  label,
  value,
  color,
  iconBg,
  icon,
}: {
  label: string;
  value: string;
  color: string;
  iconBg: string;
  icon: ReactNode;
}) {
  return (
    <View style={sdStyles.sdSummaryStat}>
      <View style={[sdStyles.sdSummaryIcon, { backgroundColor: iconBg }]}>{icon}</View>
      <Text style={sdStyles.sdSummaryStatLabel} numberOfLines={1}>
        {label}
      </Text>
      <Text
        style={[sdStyles.sdSummaryStatValue, { color }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
      >
        {value}
      </Text>
    </View>
  );
}

const sdStyles = StyleSheet.create({
  sdScreen: { flex: 1, backgroundColor: '#F7F8FC' },
  sdTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  sdIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexShrink: 0,
  },
  sdTopTitle: {
    flex: 1,
    minWidth: 0,
    textAlign: 'left',
    fontSize: 17,
    fontWeight: '800',
    color: '#1E293B',
  },
  sdShareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#FED7AA',
    flexShrink: 0,
  },
  sdShareText: { color: '#EA580C', fontWeight: '800', fontSize: 12 },
  sdContent: { paddingHorizontal: spacing.md, paddingTop: 4, gap: spacing.md },
  sdIdentityRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  sdShopIconWrap: {
    width: 72,
    height: 72,
    borderRadius: radius.container,
    backgroundColor: '#FFEDD5',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  sdShopImage: { width: 72, height: 72 },
  sdIdentityMain: { flex: 1, minWidth: 0, gap: 2 },
  sdMetaRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 4 },
  sdMetaStrong: { flex: 1, minWidth: 0, fontSize: 13, fontWeight: '700', color: '#334155', lineHeight: 18 },
  sdMetaText: { flex: 1, minWidth: 0, fontSize: 13, color: '#64748B', fontWeight: '600', lineHeight: 18 },
  sdActiveBadge: {
    alignSelf: 'flex-start',
    marginTop: 4,
    backgroundColor: '#DCFCE7',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  sdActiveBadgeText: { color: '#15803D', fontWeight: '800', fontSize: 11 },
  sdActionsRow: { flexDirection: 'row', gap: 10 },
  sdActionBtn: {
    flex: 1,
    minWidth: 0,
    backgroundColor: '#FFF',
    borderRadius: radius.card,
    paddingVertical: spacing.sm,
    paddingHorizontal: 6,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sdActionLabel: { fontSize: 12, fontWeight: '800', color: '#334155', textAlign: 'center' },
  sdMetricsRow: { flexDirection: 'column', gap: 8 },
  sdMetricCard: {
    width: '100%',
    borderRadius: radius.card,
    padding: spacing.md,
  },
  sdMetricTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
    gap: 8,
  },
  sdMetricLabel: { flex: 1, minWidth: 0, fontSize: 12, fontWeight: '700', color: '#64748B' },
  sdMetricIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sdMetricValue: { fontSize: 20, fontWeight: '800', letterSpacing: -0.2 },
  sdMetricLink: { marginTop: 6, fontSize: 12, fontWeight: '700', color: '#64748B' },
  sdScorePill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 6,
  },
  sdScorePillText: { fontSize: 12, fontWeight: '800' },
  sdScorePoints: { fontSize: 14, fontWeight: '700', color: '#334155' },
  sdLastPayDate: { fontSize: 14, fontWeight: '800', color: '#1E293B', marginBottom: 6 },
  sdLastPayAmount: {
    alignSelf: 'flex-start',
    backgroundColor: '#DBEAFE',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  sdLastPayAmountText: { fontSize: 12, fontWeight: '800', color: '#1D4ED8' },
  sdSectionCard: {
    backgroundColor: '#FFF',
    borderRadius: radius.container,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#EEF2F7',
  },
  sdSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 8,
  },
  sdSectionTitle: { flex: 1, minWidth: 0, fontSize: 16, fontWeight: '800', color: '#1E293B' },
  sdStatementLink: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0, maxWidth: '48%' },
  sdStatementText: { color: '#2563EB', fontWeight: '800', fontSize: 12 },
  sdSummaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  sdSummaryStat: {
    width: '47%',
    flexGrow: 1,
    minWidth: '42%',
    gap: 2,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
  },
  sdSummaryIcon: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  sdSummaryStatLabel: { fontSize: 11, fontWeight: '700', color: '#64748B' },
  sdSummaryStatValue: { fontSize: 14, fontWeight: '800' },
  sdFilterChip: {
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
  sdFilterChipText: { color: '#EA580C', fontWeight: '800', fontSize: 12 },
  sdEmptyTimeline: { color: '#94A3B8', fontWeight: '600', paddingVertical: spacing.sm },
  sdTimelineRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md, alignItems: 'stretch' },
  sdTimelineRail: { width: 28, alignItems: 'center', flexShrink: 0 },
  sdTimelineDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sdTimelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#E2E8F0',
    marginTop: 4,
    minHeight: 24,
  },
  sdTimelineBody: { flex: 1, minWidth: 0 },
  sdTimelineTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  sdTimelineTitle: { flex: 1, minWidth: 0, fontSize: 13, fontWeight: '800', color: '#1E293B', lineHeight: 18 },
  sdTimelineAmount: { flexShrink: 0, maxWidth: '42%', fontSize: 13, fontWeight: '800', textAlign: 'right' },
  sdTimelineSub: { marginTop: 2, fontSize: 11, color: '#94A3B8', fontWeight: '600' },
  sdTimelineMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  sdTypeBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  sdTypeBadgeText: { fontSize: 10, fontWeight: '800' },
  sdTimelineDate: { fontSize: 11, fontWeight: '700', color: '#64748B' },
  sdTimelineBalance: { marginTop: 4, fontSize: 11, color: '#94A3B8', fontWeight: '600' },
  sdViewAllBtn: {
    marginTop: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
  },
  sdViewAllText: { fontWeight: '800', color: '#475569', fontSize: 13 },
  sdWidgetsRow: { flexDirection: 'column', gap: 10 },
  sdWidget: {
    width: '100%',
    borderRadius: radius.card,
    padding: spacing.md,
  },
  sdWidgetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 8,
  },
  sdWidgetTitle: { flex: 1, minWidth: 0, fontSize: 14, fontWeight: '800', color: '#1E293B', marginBottom: 4 },
  sdWidgetEmpty: { fontSize: 12, color: '#94A3B8', fontWeight: '600', lineHeight: 17 },
  sdWidgetItem: { fontSize: 13, color: '#475569', fontWeight: '600', marginBottom: 4, lineHeight: 18 },
  sdWidgetArt: { opacity: 0.45, flexShrink: 0 },
  sdBellWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#FEF08A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  sdReminderText: { fontSize: 13, fontWeight: '700', color: '#334155', lineHeight: 19 },
  sdReminderTip: {
    marginTop: 10,
    backgroundColor: '#FFFBEB',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  sdReminderTipText: { fontSize: 11, color: '#92400E', fontWeight: '600', lineHeight: 16 },
  sdFooter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: spacing.md,
    paddingTop: 10,
    backgroundColor: '#F7F8FC',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  sdFooterBtnBlue: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#DBEAFE',
    borderRadius: radius.card,
    paddingVertical: spacing.sm,
    paddingHorizontal: 8,
    minHeight: 48,
  },
  sdFooterBtnBlueText: {
    flexShrink: 1,
    color: '#1D4ED8',
    fontWeight: '800',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 15,
  },
  sdFooterBtnOrange: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFEDD5',
    borderRadius: radius.card,
    paddingVertical: spacing.sm,
    paddingHorizontal: 8,
    minHeight: 48,
  },
  sdFooterBtnOrangeText: {
    flexShrink: 1,
    color: '#C2410C',
    fontWeight: '800',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 15,
  },
});

