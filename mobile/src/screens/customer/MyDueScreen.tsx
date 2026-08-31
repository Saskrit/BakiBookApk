import { useCallback, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { CompositeNavigationProp, useFocusEffect, useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { fetchPortalDashboard, fetchPortalLedger, fetchPendingLinks } from '../../api/portal';
import NotificationBell from '../../components/NotificationBell';
import UserAvatar from '../../components/UserAvatar';
import { CustomerLoading } from '../../components/customer/CustomerUi';
import { useAuth } from '../../contexts/AuthContext';
import { customerColors as c } from '../../theme/customerColors';
import { radius } from '../../theme/radius';
import { spacing } from '../../theme/spacing';
import { typeScale } from '../../theme/typography';
import { formatDate, formatRs } from '../../utils/format';
import type { RootStackParamList, CustomerTabParamList } from '../../navigation/types';

type HomeNav = CompositeNavigationProp<
  BottomTabNavigationProp<CustomerTabParamList, 'Home'>,
  NativeStackNavigationProp<RootStackParamList>
>;

type LedgerEntry = Record<string, unknown>;

export default function MyDueScreen() {
  const navigation = useNavigation<HomeNav>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState({
    currentDue: 0,
    totalPurchases: 0,
    totalPaid: 0,
    lastPayment: null as string | null,
  });
  const [shops, setShops] = useState<Array<{ shopName: string; balance: number }>>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [recent, setRecent] = useState<LedgerEntry[]>([]);

  const load = useCallback(async () => {
    const [dashboard, pending, ledger] = await Promise.all([
      fetchPortalDashboard(),
      fetchPendingLinks(),
      fetchPortalLedger().catch(() => ({ ledger: [] as LedgerEntry[] })),
    ]);
    setSummary(dashboard.summary);
    setShops(dashboard.shops || []);
    setPendingCount(pending.count || 0);
    setRecent((ledger.ledger || []).slice(0, 5));
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load()
        .catch(() => {})
        .finally(() => setLoading(false));
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  const firstName = user?.fullName?.split(' ')[0] || 'there';
  const shopCount = shops.length;
  const upcomingCount = shops.filter((s) => s.balance > 0).length;

  const exportStatement = async () => {
    try {
      const { exportCustomerStatement } = await import('../../utils/customerStatement');
      await exportCustomerStatement({
        fullName: user?.fullName,
        email: user?.email,
      });
    } catch {
      /* share cancelled or failed — statement util surfaces errors when needed */
    }
  };

  if (loading) return <CustomerLoading />;

  return (
    <View style={mdStyles.mdScreen}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 28 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.peachDark} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={[mdStyles.mdHeader, { paddingTop: insets.top + 10 }]}>
          <View style={mdStyles.mdHeaderLeft}>
            <Pressable onPress={() => navigation.navigate('Profile')} hitSlop={6}>
              <UserAvatar
                uri={user?.profileImage}
                name={user?.fullName || 'C'}
                size={44}
                borderRadius={radius.container}
                fallbackBg={c.sand}
                fallbackColor={c.peachDark}
              />
            </Pressable>
            <View>
              <Text style={mdStyles.mdHello}>{t('customer.hiName', { name: firstName })}</Text>
              <Text style={mdStyles.mdWelcome}>{t('customer.welcomeBakibook')}</Text>
            </View>
          </View>
          <View style={mdStyles.mdHeaderRight}>
            <NotificationBell tint={c.text} badgeColor="#EF4444" />
            <Pressable
              style={mdStyles.mdScanBtn}
              onPress={() => navigation.navigate('QRScanner')}
            >
              <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                <Rect x={4} y={4} width={7} height={7} stroke={c.text} strokeWidth={2} />
                <Rect x={13} y={13} width={7} height={7} stroke={c.text} strokeWidth={2} />
                <Path d="M13 4 H17 V8 M11 20 H7 V16" stroke={c.text} strokeWidth={2} />
              </Svg>
              <Text style={mdStyles.mdScanLabel}>{t('customer.scanQr')}</Text>
            </Pressable>
          </View>
        </View>

        <View style={mdStyles.mdBody}>
          {/* Total Outstanding hero */}
          <LinearGradient
            colors={['#FFE4CC', '#FFD4A8', '#FFC48A']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={mdStyles.mdHeroCard}
          >
            <View style={mdStyles.mdHeroLeft}>
              <Text style={mdStyles.mdHeroLabel}>{t('customer.totalOutstanding')}</Text>
              <Text style={mdStyles.mdHeroAmount}>{formatRs(summary.currentDue)}</Text>
              <Text style={mdStyles.mdHeroMeta}>
                {t('customer.acrossShops', { count: shopCount })}
              </Text>
              <Pressable
                style={mdStyles.mdHeroBtn}
                onPress={() => navigation.navigate('Ledger')}
              >
                <Text style={mdStyles.mdHeroBtnText}>{t('customer.viewDetails')}</Text>
                <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M9 6 L15 12 L9 18"
                    stroke="#FFF"
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </Pressable>
            </View>
            <View style={mdStyles.mdWalletArt}>
              <Svg width={96} height={96} viewBox="0 0 96 96" fill="none">
                <Rect x={18} y={28} width={58} height={42} rx={10} fill="#F4A261" />
                <Rect x={18} y={28} width={58} height={14} rx={6} fill="#E76F3C" />
                <Circle cx={62} cy={52} r={8} fill="#FFD166" />
                <Rect x={28} y={18} width={36} height={14} rx={4} fill="#2A9D8F" />
                <Rect x={32} y={14} width={28} height={10} rx={3} fill="#57C5A0" />
              </Svg>
            </View>
          </LinearGradient>

          {pendingCount > 0 ? (
            <Pressable
              style={mdStyles.mdPendingBanner}
              onPress={() => navigation.navigate('LinkShops')}
            >
              <Text style={mdStyles.mdPendingText}>
                {t('customer.invitationsBody', { count: pendingCount })}
              </Text>
              <Text style={mdStyles.mdPendingLink}>{t('customer.reviewLinks')}</Text>
            </Pressable>
          ) : null}

          {/* Quick Actions */}
          <View style={mdStyles.mdQuickRow}>
            <QuickAction
              label={t('customer.qaLedger')}
              bg="#DBEAFE"
              fg="#2563EB"
              onPress={() => navigation.navigate('Ledger')}
              icon="ledger"
            />
            <QuickAction
              label={t('customer.qaPayments')}
              bg="#DCFCE7"
              fg="#16A34A"
              onPress={() => navigation.navigate('Payments')}
              icon="payments"
            />
            <QuickAction
              label={t('customer.qaNotifications')}
              bg="#FFEDD5"
              fg="#EA580C"
              onPress={() => navigation.navigate('Notifications')}
              icon="reminders"
            />
            <QuickAction
              label={t('customer.qaStatements')}
              bg="#EDE9FE"
              fg="#7C3AED"
              onPress={() => void exportStatement()}
              icon="statements"
            />
          </View>

          {/* Account Overview */}
          <Text style={mdStyles.mdSectionTitle}>{t('customer.accountOverview')}</Text>
          <Pressable style={mdStyles.mdOverviewCard} onPress={() => navigation.navigate('Ledger')}>
            <OverviewItem
              label={t('customer.totalPurchases')}
              value={formatRs(summary.totalPurchases)}
              color="#2563EB"
              bg="#DBEAFE"
              icon="bag"
            />
            <OverviewItem
              label={t('customer.totalPayments')}
              value={formatRs(summary.totalPaid)}
              color="#16A34A"
              bg="#DCFCE7"
              icon="down"
            />
            <OverviewItem
              label={t('customer.remainingDue')}
              value={formatRs(summary.currentDue)}
              color="#EA580C"
              bg="#FFEDD5"
              icon="wallet"
            />
            <OverviewItem
              label={t('customer.linkedShops')}
              value={String(shopCount)}
              color="#7C3AED"
              bg="#EDE9FE"
              icon="score"
            />
            <View style={mdStyles.mdOverviewChevron}>
              <Text style={mdStyles.mdChevron}>›</Text>
            </View>
          </Pressable>

          {/* Recent Transactions */}
          <View style={mdStyles.mdSectionHeader}>
            <Text style={mdStyles.mdSectionTitleInline}>{t('customer.recentTransactions')}</Text>
            <Pressable onPress={() => navigation.navigate('Ledger')}>
              <Text style={mdStyles.mdViewAll}>{t('common.viewAll')}</Text>
            </Pressable>
          </View>

          {recent.length === 0 ? (
            <View style={mdStyles.mdEmptyCard}>
              <Text style={mdStyles.mdEmptyText}>{t('customer.noLedger')}</Text>
            </View>
          ) : (
            recent.map((item, index) => {
              const isCredit =
                item.creditAmount != null ||
                String(item.type || '').toLowerCase().includes('credit') ||
                String(item.label || '').toLowerCase().includes('credit');
              const amount =
                item.creditAmount != null
                  ? Number(item.creditAmount)
                  : item.paymentAmount != null
                    ? Number(item.paymentAmount)
                    : Number(item.amount || 0);
              const title = String(
                item.label || item.desc || item.title || (isCredit ? 'Credit' : 'Payment')
              );
              const shop = String(item.shopName || item.shop || '');
              const date = formatDate(String(item.date || item.createdAt || ''));

              return (
                <Pressable
                  key={String(item.id || index)}
                  style={mdStyles.mdTxRow}
                  onPress={() => navigation.navigate('Ledger')}
                >
                  <View
                    style={[
                      mdStyles.mdTxIcon,
                      { backgroundColor: isCredit ? '#FFEDD5' : '#DCFCE7' },
                    ]}
                  >
                    {isCredit ? (
                      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                        <Path
                          d="M6 6 H18 V18 H6 Z M9 9 H15 M9 12 H15 M9 15 H12"
                          stroke="#EA580C"
                          strokeWidth={2}
                        />
                      </Svg>
                    ) : (
                      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                        <Path
                          d="M12 4 V16 M7 11 L12 16 L17 11"
                          stroke="#16A34A"
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </Svg>
                    )}
                  </View>
                  <View style={mdStyles.mdTxMid}>
                    <Text style={mdStyles.mdTxTitle} numberOfLines={1}>
                      {title}
                    </Text>
                    {shop ? <Text style={mdStyles.mdTxShop}>{shop}</Text> : null}
                    {date ? <Text style={mdStyles.mdTxDate}>{date}</Text> : null}
                  </View>
                  <View style={mdStyles.mdTxRight}>
                    <View
                      style={[
                        mdStyles.mdTxBadge,
                        { backgroundColor: isCredit ? '#FFEDD5' : '#DCFCE7' },
                      ]}
                    >
                      <Text
                        style={[
                          mdStyles.mdTxBadgeText,
                          { color: isCredit ? '#EA580C' : '#16A34A' },
                        ]}
                      >
                        {isCredit ? t('customer.badgeCredit') : t('customer.badgePayment')}
                      </Text>
                    </View>
                    <Text
                      style={[
                        mdStyles.mdTxAmount,
                        { color: isCredit ? c.text : '#16A34A' },
                      ]}
                    >
                      {isCredit ? formatRs(amount) : `-${formatRs(amount)}`}
                    </Text>
                  </View>
                  <Text style={mdStyles.mdChevron}>›</Text>
                </Pressable>
              );
            })
          )}

          {/* Upcoming dues */}
          {upcomingCount > 0 ? (
            <View style={mdStyles.mdDuesBanner}>
              <View style={mdStyles.mdDuesIcon}>
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M12 4 C8 4 5 7 5 10 C5 16 3 17 3 17 H21 C21 17 19 16 19 10 C19 7 16 4 12 4 Z"
                    stroke="#D97706"
                    strokeWidth={2}
                  />
                </Svg>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={mdStyles.mdDuesTitle}>
                  {t('customer.upcomingDues', { count: upcomingCount })}
                </Text>
                <Text style={mdStyles.mdDuesSub}>{t('customer.upcomingDuesHint')}</Text>
              </View>
              <Pressable style={mdStyles.mdDuesBtn} onPress={() => navigation.navigate('Shops')}>
                <Text style={mdStyles.mdDuesBtnText}>{t('customer.viewDues')}</Text>
                <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M9 6 L15 12 L9 18"
                    stroke="#FFF"
                    strokeWidth={2.5}
                    strokeLinecap="round"
                  />
                </Svg>
              </Pressable>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

function QuickAction({
  label,
  bg,
  fg,
  onPress,
  icon,
}: {
  label: string;
  bg: string;
  fg: string;
  onPress: () => void;
  icon: 'ledger' | 'payments' | 'reminders' | 'statements';
}) {
  return (
    <Pressable style={mdStyles.mdQaCard} onPress={onPress}>
      <View style={[mdStyles.mdQaIcon, { backgroundColor: bg }]}>
        {icon === 'ledger' ? (
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Rect x={5} y={3} width={14} height={18} rx={2} stroke={fg} strokeWidth={2} />
            <Path d="M8 8 H16 M8 12 H14" stroke={fg} strokeWidth={2} />
          </Svg>
        ) : null}
        {icon === 'payments' ? (
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Rect x={3} y={6} width={18} height={12} rx={2} stroke={fg} strokeWidth={2} />
            <Path d="M3 10 H21" stroke={fg} strokeWidth={2} />
          </Svg>
        ) : null}
        {icon === 'reminders' ? (
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Rect x={4} y={5} width={16} height={15} rx={2} stroke={fg} strokeWidth={2} />
            <Path d="M8 3 V7 M16 3 V7 M4 10 H20" stroke={fg} strokeWidth={2} />
          </Svg>
        ) : null}
        {icon === 'statements' ? (
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Path d="M7 3 H14 L19 8 V21 H7 Z" stroke={fg} strokeWidth={2} />
            <Path d="M14 3 V8 H19" stroke={fg} strokeWidth={2} />
          </Svg>
        ) : null}
      </View>
      <Text style={mdStyles.mdQaLabel}>{label}</Text>
    </Pressable>
  );
}

function OverviewItem({
  label,
  value,
  color,
  bg,
  icon,
}: {
  label: string;
  value: string;
  color: string;
  bg: string;
  icon: 'bag' | 'down' | 'wallet' | 'score';
}) {
  return (
    <View style={mdStyles.mdOverviewItem}>
      <View style={[mdStyles.mdOverviewIcon, { backgroundColor: bg }]}>
        {icon === 'bag' ? (
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
            <Path
              d="M6 8 H18 L17 20 H7 Z M9 8 V6 C9 4.5 10 3.5 12 3.5 C14 3.5 15 4.5 15 6 V8"
              stroke={color}
              strokeWidth={2}
            />
          </Svg>
        ) : null}
        {icon === 'down' ? (
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
            <Path
              d="M12 4 V16 M7 11 L12 16 L17 11"
              stroke={color}
              strokeWidth={2}
              strokeLinecap="round"
            />
          </Svg>
        ) : null}
        {icon === 'wallet' ? (
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
            <Rect x={3} y={6} width={18} height={12} rx={2} stroke={color} strokeWidth={2} />
            <Circle cx={16} cy={12} r={1.5} fill={color} />
          </Svg>
        ) : null}
        {icon === 'score' ? (
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
            <Circle cx={12} cy={12} r={8} stroke={color} strokeWidth={2} />
            <Path d="M12 4 A8 8 0 0 1 20 12 L12 12 Z" fill={color} opacity={0.35} />
          </Svg>
        ) : null}
      </View>
      <Text style={mdStyles.mdOverviewLabel}>{label}</Text>
      <Text style={[mdStyles.mdOverviewValue, { color }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const mdStyles = StyleSheet.create({
  mdScreen: { flex: 1, backgroundColor: '#F7F8FC' },
  mdHeader: {
    paddingHorizontal: spacing.md,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F7F8FC',
  },
  mdHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  mdHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  mdAvatar: {
    width: 44,
    height: 44,
    borderRadius: radius.container,
    backgroundColor: c.sand,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  mdAvatarText: { fontWeight: '800', color: c.peachDark, fontSize: 15 },
  mdHello: { fontSize: 18, fontWeight: '800', color: '#1E293B' },
  mdWelcome: { marginTop: 1, fontSize: 12, color: c.textMuted, fontWeight: '600' },
  mdScanBtn: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#EEF1F6',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  mdScanLabel: { fontSize: 8, fontWeight: '700', color: c.textMuted },
  mdBody: { paddingHorizontal: spacing.md, paddingTop: spacing.xs },
  mdHeroCard: {
    borderRadius: radius.card,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  mdHeroLeft: { flex: 1, paddingRight: 8 },
  mdHeroLabel: { fontSize: 13, fontWeight: '700', color: '#5C4033' },
  mdHeroAmount: {
    marginTop: 4,
    fontSize: typeScale.display.fontSize,
    lineHeight: typeScale.display.lineHeight,
    fontFamily: typeScale.display.fontFamily,
    fontWeight: '700',
    color: '#E86A2E',
  },
  mdHeroMeta: { marginTop: 4, fontSize: 12, color: '#8A6F5C', fontWeight: '600' },
  mdHeroBtn: {
    marginTop: 14,
    alignSelf: 'flex-start',
    backgroundColor: '#F97316',
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  mdHeroBtnText: { color: '#FFF', fontWeight: '800', fontSize: 13 },
  mdWalletArt: { opacity: 0.95 },
  mdPendingBanner: {
    marginTop: 12,
    backgroundColor: c.sky,
    borderRadius: 14,
    padding: 12,
  },
  mdPendingText: { color: c.text, fontWeight: '600', fontSize: 13 },
  mdPendingLink: { marginTop: 4, color: c.peachDark, fontWeight: '800' },
  mdQuickRow: {
    marginTop: 16,
    flexDirection: 'row',
    gap: 8,
  },
  mdQaCard: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: radius.card,
    paddingVertical: spacing.sm,
    paddingHorizontal: 6,
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  mdQaIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  mdQaLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#334155',
    textAlign: 'center',
  },
  mdSectionTitle: {
    marginTop: 22,
    marginBottom: 10,
    fontSize: 17,
    fontWeight: '800',
    color: '#1E293B',
  },
  mdSectionHeader: {
    marginTop: 22,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mdSectionTitleInline: { fontSize: 17, fontWeight: '800', color: '#1E293B' },
  mdViewAll: { color: '#F97316', fontWeight: '800', fontSize: 13 },
  mdOverviewCard: {
    backgroundColor: '#EAF4FF',
    borderRadius: radius.container,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'stretch',
    position: 'relative',
  },
  mdOverviewItem: { flex: 1, alignItems: 'center', paddingHorizontal: 2 },
  mdOverviewIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  mdOverviewLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: c.textMuted,
    textAlign: 'center',
    marginBottom: 4,
  },
  mdOverviewValue: { fontSize: 11, fontWeight: '800', textAlign: 'center' },
  mdOverviewChevron: {
    position: 'absolute',
    right: 6,
    top: '50%',
    marginTop: -10,
  },
  mdChevron: { fontSize: 20, color: '#94A3B8', fontWeight: '300' },
  mdEmptyCard: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: spacing.lg,
  },
  mdEmptyText: { color: c.textMuted, textAlign: 'center' },
  mdTxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: radius.card,
    padding: 12,
    marginBottom: 8,
    gap: 10,
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  mdTxIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.container,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mdTxMid: { flex: 1 },
  mdTxTitle: { fontSize: 14, fontWeight: '800', color: '#1E293B' },
  mdTxShop: { marginTop: 2, fontSize: 12, color: c.textMuted },
  mdTxDate: { marginTop: 1, fontSize: 11, color: '#94A3B8' },
  mdTxRight: { alignItems: 'flex-end', gap: 4 },
  mdTxBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  mdTxBadgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.4 },
  mdTxAmount: { fontSize: 13, fontWeight: '800' },
  mdDuesBanner: {
    marginTop: 14,
    backgroundColor: '#FFF7E8',
    borderRadius: radius.card,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  mdDuesIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.container,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mdDuesTitle: { fontSize: 13, fontWeight: '800', color: '#1E293B' },
  mdDuesSub: { marginTop: 2, fontSize: 11, color: c.textMuted },
  mdDuesBtn: {
    backgroundColor: '#F97316',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  mdDuesBtnText: { color: '#FFF', fontWeight: '800', fontSize: 12 },
});
