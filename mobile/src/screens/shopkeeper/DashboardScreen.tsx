import { useCallback, useRef, useState, type ReactNode } from 'react';
import {
  Image,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import Sparkline from '../../components/dashboard/Sparkline';
import NotificationBell from '../../components/NotificationBell';
import { LoadingState } from '../../components/ui';
import {
  fetchDashboardStats,
  type DashboardDueReminder,
  type DashboardRecentTransaction,
  type DashboardTopDueCustomer,
} from '../../api/shop';
import { colors } from '../../theme/colors';
import { radius } from '../../theme/radius';
import { spacing } from '../../theme/spacing';
import { typography as ty } from '../../theme/typography';
import {
  avatarColor,
  formatRelativeTime,
  formatRs,
  getInitials,
  isNewAccount,
  parseMoneyAmount,
  sumSlice,
  trendPercent,
} from '../../utils/format';
import type { RootStackParamList, ShopkeeperTabParamList } from '../../navigation/types';

type DashboardNav = CompositeNavigationProp<
  BottomTabNavigationProp<ShopkeeperTabParamList, 'Dashboard'>,
  NativeStackNavigationProp<RootStackParamList>
>;

const parseCustomerName = (text: string, fallback: string) => {
  const match = text.match(/(?:to|from)\s+(.+)$/i);
  return match?.[1]?.trim() || fallback;
};

function SectionHeader({
  title,
  onViewAll,
}: {
  title: string;
  onViewAll?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <View style={dbStyles.dbSectionHeader}>
      <Text style={dbStyles.dbSectionTitle}>{title}</Text>
      {onViewAll ? (
        <Pressable onPress={onViewAll}>
          <Text style={dbStyles.dbViewAll}>{t('common.viewAll')}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function StatCard({
  label,
  value,
  valueColor,
  trend,
  trendUp,
  icon,
  iconBg,
}: {
  label: string;
  value: string;
  valueColor: string;
  trend: string;
  trendUp: boolean;
  icon: ReactNode;
  iconBg: string;
}) {
  return (
    <View style={dbStyles.dbStatCard}>
      <View style={[dbStyles.dbStatIconWrap, { backgroundColor: iconBg }]}>{icon}</View>
      <Text style={dbStyles.dbStatLabel}>{label}</Text>
      <Text style={[dbStyles.dbStatValue, { color: valueColor }]}>{value}</Text>
      <Text style={[dbStyles.dbStatTrend, trendUp ? dbStyles.dbTrendUp : dbStyles.dbTrendDown]}>
        {trendUp ? '▲' : '▼'} {trend}
      </Text>
    </View>
  );
}

function QuickAction({
  label,
  onPress,
  icon,
}: {
  label: string;
  onPress: () => void;
  icon: ReactNode;
}) {
  return (
    <Pressable onPress={onPress} style={dbStyles.dbQuickAction}>
      <View style={dbStyles.dbQuickActionIcon}>{icon}</View>
      <Text style={dbStyles.dbQuickActionLabel}>{label}</Text>
    </Pressable>
  );
}

function TransactionRow({ item }: { item: DashboardRecentTransaction }) {
  const { t } = useTranslation();
  const name = parseCustomerName(item.text, t('common.customer'));
  const isPayment = item.type === 'payment';
  const amount = parseMoneyAmount(item.amount);

  return (
    <View style={dbStyles.dbTxRow}>
      <View style={[dbStyles.dbAvatar, { backgroundColor: avatarColor(name) }]}>
        <Text style={dbStyles.dbAvatarText}>{getInitials(name)}</Text>
      </View>
      <View style={dbStyles.dbTxBody}>
        <Text style={dbStyles.dbTxName}>{name}</Text>
        <Text style={dbStyles.dbTxType}>
          {isPayment ? t('dashboard.paymentReceived') : t('dashboard.creditAdded')}
        </Text>
      </View>
      <View style={dbStyles.dbTxMeta}>
        <Text style={[dbStyles.dbTxAmount, isPayment ? dbStyles.dbAmountGreen : dbStyles.dbAmountOrange]}>
          {isPayment ? '+' : ''}
          {formatRs(amount)}
        </Text>
        <Text style={dbStyles.dbTxTime}>{formatRelativeTime(item.time)}</Text>
      </View>
    </View>
  );
}

function OutstandingRow({
  rank,
  item,
  onPress,
}: {
  rank: number;
  item: DashboardTopDueCustomer;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={dbStyles.dbOutRow}>
      <Text style={dbStyles.dbOutRank}>{rank}</Text>
      <Text style={dbStyles.dbOutName} numberOfLines={1}>
        {item.name}
      </Text>
      <Text style={dbStyles.dbOutAmount}>{formatRs(item.amount)}</Text>
    </Pressable>
  );
}

function ReminderRow({ item }: { item: DashboardDueReminder }) {
  const { t } = useTranslation();
  const dueLabel =
    item.daysOverdue === 0
      ? t('common.today')
      : item.daysOverdue === 1
        ? t('common.yesterday')
        : item.daysLabel || t('common.daysAgo', { count: item.daysOverdue });

  return (
    <View style={dbStyles.dbReminderRow}>
      <View style={dbStyles.dbReminderIcon}>
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
          <Rect x={3} y={5} width={18} height={16} rx={2} stroke={colors.primary} strokeWidth={2} />
          <Path d="M3 10 H21" stroke={colors.primary} strokeWidth={2} />
        </Svg>
      </View>
      <View style={dbStyles.dbReminderBody}>
        <Text style={dbStyles.dbReminderName}>{item.name}</Text>
        <Text style={dbStyles.dbReminderAmount}>
          {t('customer.due', { amount: formatRs(item.amount) })} · {dueLabel}
        </Text>
      </View>
      <Text style={dbStyles.dbReminderWhen}>{dueLabel}</Text>
    </View>
  );
}

export default function DashboardScreen() {
  const navigation = useNavigation<DashboardNav>();
  const { user } = useAuth();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [stats, setStats] = useState({
    totalOutstanding: 0,
    totalCustomers: 0,
    totalPayments: 0,
    weekCredit: 0,
    weekPayment: 0,
  });
  const [chart, setChart] = useState({ credit: [] as number[], payment: [] as number[] });
  const [recent, setRecent] = useState<DashboardRecentTransaction[]>([]);
  const [topDue, setTopDue] = useState<DashboardTopDueCustomer[]>([]);
  const [reminders, setReminders] = useState<DashboardDueReminder[]>([]);

  const load = useCallback(async () => {
    const data = await fetchDashboardStats();
    setStats({
      totalOutstanding: data.stats.totalOutstanding,
      totalCustomers: data.stats.totalCustomers,
      totalPayments: data.stats.totalPayments,
      weekCredit: data.stats.weekCredit,
      weekPayment: data.stats.weekPayment,
    });
    setChart({
      credit: data.chart?.credit ?? [],
      payment: data.chart?.payment ?? [],
    });
    setRecent(data.recentTransactions || []);
    setTopDue(data.topDueCustomers || []);
    setReminders(data.dueReminders || []);
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      setError('');
      load()
        .catch((err) =>
          setError(err instanceof Error ? err.message : t('dashboard.loadFailed'))
        )
        .finally(() => setLoading(false));
    }, [load, t])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  const todayCollection = chart.payment.at(-1) || 0;
  const todayCredit = chart.credit.at(-1) || 0;
  const last7Pay = sumSlice(chart.payment, -7, chart.payment.length);
  const prev7Pay = sumSlice(chart.payment, -14, -7);
  const last7Credit = sumSlice(chart.credit, -7, chart.credit.length);
  const prev7Credit = sumSlice(chart.credit, -14, -7);
  const monthCollection = sumSlice(chart.payment, -30, chart.payment.length);
  const monthCredit = sumSlice(chart.credit, -30, chart.credit.length);
  const monthNet = monthCollection - monthCredit;

  const firstName = user?.fullName?.split(' ')[0] || t('auth.shopkeeper');
  const hasShop = Boolean(user?.shopName?.trim());
  const isNewUser = isNewAccount(user?.createdAt);
  const greetingLine = isNewUser
    ? t('dashboard.welcome', { name: firstName })
    : t('dashboard.welcomeBack', { name: firstName });
  const openShopProfile = () => navigation.getParent()?.navigate('ShopProfile');
  const avatarLabel = hasShop ? user!.shopName! : user?.fullName || t('auth.shopkeeper');

  if (loading) return <LoadingState />;

  return (
    <View style={dbStyles.dbScreen}>
      <ScrollView
        ref={scrollRef}
        style={dbStyles.dbScroll}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={[colors.primaryDark, colors.primary, '#7A9249']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[dbStyles.dbHeader, { paddingTop: insets.top + 10 }]}
        >
          <View style={dbStyles.dbHeaderOrbLarge} />
          <View style={dbStyles.dbHeaderOrbSmall} />

          <View style={dbStyles.dbHeaderTop}>
            <Pressable style={dbStyles.dbHeaderGlassBtn} onPress={() => navigation.navigate('Settings')}>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Path d="M4 7 H20 M4 12 H20 M4 17 H20" stroke="#FFFFFF" strokeWidth={2.5} strokeLinecap="round" />
              </Svg>
            </Pressable>
            <Text style={dbStyles.dbHeaderBrand}>BakiBook</Text>
            <View style={dbStyles.dbHeaderActions}>
              <View style={dbStyles.dbHeaderGlassBtn}>
                <NotificationBell tint="#FFFFFF" />
              </View>
            </View>
          </View>

          <View style={dbStyles.dbHeaderHero}>
            <Pressable onPress={openShopProfile} style={dbStyles.dbHeaderAvatarWrap}>
              {user?.shopImage ? (
                <Image source={{ uri: user.shopImage }} style={dbStyles.dbHeaderAvatar} />
              ) : (
                <View style={dbStyles.dbHeaderAvatarPlaceholder}>
                  <Text style={dbStyles.dbHeaderAvatarInitial}>{getInitials(avatarLabel)}</Text>
                </View>
              )}
              {!hasShop ? <View style={dbStyles.dbHeaderAvatarDot} /> : null}
            </Pressable>

            <View style={dbStyles.dbHeaderGreeting}>
              <Text style={dbStyles.dbWelcomeText}>
                {greetingLine} {isNewUser ? '✨' : '👋'}
              </Text>
              {hasShop ? (
                <Pressable onPress={openShopProfile} style={dbStyles.dbShopRow}>
                  <Text style={dbStyles.dbShopName} numberOfLines={1}>
                    {user!.shopName}
                  </Text>
                  <Text style={dbStyles.dbShopChevron}>▾</Text>
                </Pressable>
              ) : (
                <Pressable onPress={openShopProfile} style={dbStyles.dbRegisterShopBtn}>
                  <Text style={dbStyles.dbRegisterShopText}>{t('dashboard.registerYourShop')}</Text>
                  <Text style={dbStyles.dbRegisterShopArrow}>›</Text>
                </Pressable>
              )}
              {!hasShop ? (
                <Text style={dbStyles.dbShopHint}>{t('dashboard.shopHint')}</Text>
              ) : null}
            </View>
          </View>

          <View style={dbStyles.dbHeaderFooter}>
            <Pressable style={dbStyles.dbOverviewBtn} onPress={() => navigation.navigate('Reports')}>
              <Text style={dbStyles.dbOverviewBtnText}>{t('dashboard.businessOverview')}</Text>
              <Text style={dbStyles.dbOverviewBtnArrow}>›</Text>
            </Pressable>
            <View style={dbStyles.dbHeaderStatPill}>
              <Text style={dbStyles.dbHeaderStatLabel}>{t('dashboard.outstanding')}</Text>
              <Text style={dbStyles.dbHeaderStatValue}>{formatRs(stats.totalOutstanding)}</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={dbStyles.dbBody}>
          {error ? <Text style={dbStyles.dbError}>{error}</Text> : null}

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={dbStyles.dbStatsScroll}
          >
            <StatCard
              label={t('dashboard.totalOutstanding')}
              value={formatRs(stats.totalOutstanding)}
              valueColor={colors.danger}
              trend={t('dashboard.vsLastWeek', {
                percent: Math.abs(trendPercent(last7Credit, prev7Credit)),
              })}
              trendUp={stats.totalOutstanding <= 0}
              iconBg="#FEE2E2"
              icon={
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                  <Rect x={3} y={7} width={18} height={12} rx={2} stroke={colors.danger} strokeWidth={2} />
                  <Path d="M3 11 H21" stroke={colors.danger} strokeWidth={2} />
                </Svg>
              }
            />
            <StatCard
              label={t('dashboard.todaysCollection')}
              value={formatRs(todayCollection)}
              valueColor={colors.primary}
              trend={t('dashboard.vsLastWeek', {
                percent: Math.abs(trendPercent(last7Pay, prev7Pay)),
              })}
              trendUp={trendPercent(last7Pay, prev7Pay) >= 0}
              iconBg="#DCFCE7"
              icon={
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                  <Circle cx={12} cy={12} r={8} stroke={colors.primary} strokeWidth={2} />
                  <Path d="M12 8 V16 M9 11 H15" stroke={colors.primary} strokeWidth={2} />
                </Svg>
              }
            />
            <StatCard
              label={t('dashboard.todaysNewCredit')}
              value={formatRs(todayCredit)}
              valueColor={colors.warning}
              trend={t('dashboard.vsLastWeek', {
                percent: Math.abs(trendPercent(last7Credit, prev7Credit)),
              })}
              trendUp={trendPercent(last7Credit, prev7Credit) <= 0}
              iconBg="#FEF3C7"
              icon={
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                  <Rect x={5} y={4} width={14} height={16} rx={2} stroke={colors.warning} strokeWidth={2} />
                  <Path d="M12 8 V14 M9 11 H15" stroke={colors.warning} strokeWidth={2} />
                </Svg>
              }
            />
            <StatCard
              label={t('dashboard.totalCustomers')}
              value={String(stats.totalCustomers)}
              valueColor="#2563EB"
              trend={
                stats.weekPayment > 0
                  ? t('dashboard.activeThisWeek')
                  : t('dashboard.growingThisWeek')
              }
              trendUp
              iconBg="#DBEAFE"
              icon={
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                  <Circle cx={9} cy={8} r={3} stroke="#2563EB" strokeWidth={2} />
                  <Circle cx={17} cy={9} r={2.5} stroke="#2563EB" strokeWidth={2} />
                  <Path d="M3 19 C3 15 6 13 9 13 C12 13 15 15 15 19" stroke="#2563EB" strokeWidth={2} />
                </Svg>
              }
            />
          </ScrollView>

          <SectionHeader title={t('dashboard.quickActions')} onViewAll={() => navigation.navigate('Customers')} />
          <View style={dbStyles.dbQuickGrid}>
            <QuickAction
              label={t('dashboard.addCustomer')}
              onPress={() => navigation.navigate('AddCustomer')}
              icon={
                <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                  <Circle cx={10} cy={8} r={3} stroke={colors.primary} strokeWidth={2} />
                  <Path d="M4 19 C4 15 7 13 10 13" stroke={colors.primary} strokeWidth={2} />
                  <Path d="M17 8 V14 M14 11 H20" stroke={colors.primary} strokeWidth={2} />
                </Svg>
              }
            />
            <QuickAction
              label={t('dashboard.addCredit')}
              onPress={() => navigation.navigate('AddCredit')}
              icon={
                <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                  <Rect x={4} y={4} width={16} height={16} rx={2} stroke={colors.primary} strokeWidth={2} />
                  <Path d="M12 8 V16 M8 12 H16" stroke={colors.primary} strokeWidth={2} />
                </Svg>
              }
            />
            <QuickAction
              label={t('dashboard.receivePayment')}
              onPress={() => navigation.navigate('Customers')}
              icon={
                <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                  <Circle cx={12} cy={12} r={8} stroke={colors.primary} strokeWidth={2} />
                  <Path d="M12 8 V16 M8 12 H14" stroke={colors.primary} strokeWidth={2} />
                </Svg>
              }
            />
            <QuickAction
              label={t('dashboard.customers')}
              onPress={() => navigation.navigate('Customers')}
              icon={
                <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                  <Circle cx={9} cy={8} r={3} stroke={colors.primary} strokeWidth={2} />
                  <Path d="M3 19 C3 15 6 13 9 13" stroke={colors.primary} strokeWidth={2} />
                </Svg>
              }
            />
            <QuickAction
              label={t('dashboard.reminders')}
              onPress={() => scrollRef.current?.scrollToEnd({ animated: true })}
              icon={
                <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                  <Rect x={4} y={5} width={16} height={15} rx={2} stroke={colors.primary} strokeWidth={2} />
                  <Path d="M4 10 H20" stroke={colors.primary} strokeWidth={2} />
                </Svg>
              }
            />
            <QuickAction
              label={t('dashboard.scanQr')}
              onPress={() => navigation.navigate('Scan')}
              icon={
                <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                  <Rect x={4} y={4} width={7} height={7} stroke={colors.primary} strokeWidth={2} />
                  <Rect x={13} y={4} width={7} height={7} stroke={colors.primary} strokeWidth={2} />
                  <Rect x={4} y={13} width={7} height={7} stroke={colors.primary} strokeWidth={2} />
                  <Path d="M14 14 H17 V17" stroke={colors.primary} strokeWidth={2} />
                </Svg>
              }
            />
          </View>

          <View style={dbStyles.dbTwoCol}>
            <View style={dbStyles.dbColCard}>
              <SectionHeader title={t('dashboard.recentTransactions')} />
              {recent.length === 0 ? (
                <Text style={dbStyles.dbEmptyText}>{t('dashboard.noRecent')}</Text>
              ) : (
                recent.slice(0, 4).map((item) => <TransactionRow key={item.id} item={item} />)
              )}
            </View>

            <View style={dbStyles.dbColCard}>
              <SectionHeader
                title={t('dashboard.topOutstanding')}
                onViewAll={() => navigation.navigate('Customers')}
              />
              {topDue.length === 0 ? (
                <Text style={dbStyles.dbEmptyText}>{t('dashboard.noOutstanding')}</Text>
              ) : (
                topDue.map((item, index) => (
                  <OutstandingRow
                    key={item.id}
                    rank={index + 1}
                    item={item}
                    onPress={() => navigation.navigate('CustomerProfile', { customerId: item.id })}
                  />
                ))
              )}
              <Pressable
                style={dbStyles.dbViewAllBtn}
                onPress={() => navigation.navigate('Customers')}
              >
                <Text style={dbStyles.dbViewAllBtnText}>{t('dashboard.viewAllOutstanding')}</Text>
              </Pressable>
            </View>
          </View>

          <View style={dbStyles.dbCard}>
            <SectionHeader
              title={t('dashboard.businessOverviewMonth')}
              onViewAll={() => navigation.navigate('Reports')}
            />
            <View style={dbStyles.dbOverviewGrid}>
              <View style={dbStyles.dbOverviewItem}>
                <Text style={dbStyles.dbOverviewLabel}>{t('dashboard.totalCollection')}</Text>
                <Text style={[dbStyles.dbOverviewValue, { color: colors.primary }]}>
                  {formatRs(monthCollection)}
                </Text>
                <Sparkline data={chart.payment.slice(-14)} color={colors.primary} />
              </View>
              <View style={dbStyles.dbOverviewItem}>
                <Text style={dbStyles.dbOverviewLabel}>{t('dashboard.newCredit')}</Text>
                <Text style={[dbStyles.dbOverviewValue, { color: colors.warning }]}>
                  {formatRs(monthCredit)}
                </Text>
                <Sparkline data={chart.credit.slice(-14)} color={colors.warning} />
              </View>
              <View style={dbStyles.dbOverviewItem}>
                <Text style={dbStyles.dbOverviewLabel}>{t('dashboard.netBalance')}</Text>
                <Text
                  style={[
                    dbStyles.dbOverviewValue,
                    { color: monthNet >= 0 ? colors.primary : colors.danger },
                  ]}
                >
                  {formatRs(monthNet)}
                </Text>
                <Sparkline
                  data={chart.payment.slice(-14).map((v, i) => v - (chart.credit.slice(-14)[i] || 0))}
                  color={monthNet >= 0 ? colors.primary : colors.danger}
                />
              </View>
            </View>
          </View>

          <View style={dbStyles.dbCard}>
            <SectionHeader
              title={t('dashboard.upcomingReminders')}
              onViewAll={() => navigation.navigate('Customers')}
            />
            {reminders.length === 0 ? (
              <Text style={dbStyles.dbEmptyText}>{t('dashboard.noReminders')}</Text>
            ) : (
              reminders.slice(0, 4).map((item) => (
                <ReminderRow key={item.customerId} item={item} />
              ))
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const dbStyles = StyleSheet.create({
  dbScreen: { flex: 1, backgroundColor: '#F3F4F6' },
  dbScroll: { flex: 1 },
  dbHeader: {
    paddingHorizontal: spacing.md,
    paddingBottom: 22,
    borderBottomLeftRadius: radius.container,
    borderBottomRightRadius: radius.container,
    overflow: 'hidden',
  },
  dbHeaderOrbLarge: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.08)',
    top: -40,
    right: -30,
  },
  dbHeaderOrbSmall: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(255,255,255,0.06)',
    bottom: 20,
    left: -20,
  },
  dbHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  dbHeaderBrand: {
    color: '#FFFFFF',
    fontSize: ty.lg,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    opacity: 0.95,
  },
  dbHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dbHeaderGlassBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  dbNotifBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  dbNotifBadgeText: { color: '#FFF', fontSize: ty.sm, fontWeight: '700' },
  dbHeaderHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  dbHeaderAvatarWrap: { position: 'relative' },
  dbHeaderAvatar: {
    width: 56,
    height: 56,
    borderRadius: radius.container,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  dbHeaderAvatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: radius.container,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  dbHeaderAvatarInitial: { color: '#FFF', fontWeight: '800', fontSize: ty.lg },
  dbHeaderAvatarDot: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.warning,
    borderWidth: 2,
    borderColor: colors.primaryDark,
  },
  dbHeaderGreeting: { flex: 1 },
  dbWelcomeText: { color: '#FFFFFF', fontSize: ty.xl, fontWeight: '800', marginBottom: 6 },
  dbShopRow: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
  dbShopName: { color: 'rgba(255,255,255,0.92)', fontSize: ty.md, fontWeight: '600', flexShrink: 1 },
  dbShopChevron: { color: 'rgba(255,255,255,0.75)', fontSize: ty.body },
  dbRegisterShopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.container,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    gap: 4,
  },
  dbRegisterShopText: { color: '#FFFFFF', fontSize: ty.body, fontWeight: '700' },
  dbRegisterShopArrow: { color: '#FFFFFF', fontSize: ty.lg, fontWeight: '600' },
  dbShopHint: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: ty.sm,
    marginTop: 6,
    lineHeight: 18,
  },
  dbHeaderFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dbOverviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.16)',
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  dbOverviewBtnText: { color: '#FFFFFF', fontSize: ty.body, fontWeight: '700' },
  dbOverviewBtnArrow: { color: 'rgba(255,255,255,0.85)', fontSize: ty.lg, fontWeight: '600' },
  dbHeaderStatPill: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.12)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  dbHeaderStatLabel: { color: 'rgba(255,255,255,0.75)', fontSize: ty.xs, fontWeight: '600' },
  dbHeaderStatValue: { color: '#FFFFFF', fontSize: ty.md, fontWeight: '800', marginTop: 2 },
  dbBody: { paddingHorizontal: spacing.md, paddingTop: spacing.md },
  dbError: { color: colors.danger, marginBottom: 12, fontSize: ty.bodyLg },
  dbStatsScroll: { gap: spacing.sm, paddingBottom: 4, paddingRight: 4 },
  dbStatCard: {
    width: 140,
    backgroundColor: '#FFFFFF',
    borderRadius: radius.card,
    padding: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  dbStatIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  dbStatLabel: { fontSize: ty.sm, color: colors.textMuted, marginBottom: 4, fontWeight: '500' },
  dbStatValue: { fontSize: ty.xl, fontWeight: '800', marginBottom: 6 },
  dbStatTrend: { fontSize: ty.xs, fontWeight: '600' },
  dbTrendUp: { color: colors.primary },
  dbTrendDown: { color: colors.danger },
  dbSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    marginTop: 8,
  },
  dbSectionTitle: { fontSize: ty.lg, fontWeight: '700', color: colors.text },
  dbViewAll: { fontSize: ty.body, color: colors.primary, fontWeight: '600' },
  dbQuickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 8,
  },
  dbQuickAction: {
    width: '31%',
    minWidth: 100,
    flexGrow: 1,
    alignItems: 'center',
    marginBottom: 4,
  },
  dbQuickActionIcon: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dbQuickActionLabel: {
    fontSize: ty.sm,
    color: colors.text,
    textAlign: 'center',
    fontWeight: '500',
  },
  dbTwoCol: { gap: spacing.sm, marginTop: 8 },
  dbColCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.card,
    padding: spacing.md,
    marginBottom: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  dbEmptyText: { color: colors.textMuted, fontSize: ty.bodyLg, paddingVertical: 8 },
  dbTxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dbAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  dbAvatarText: { color: '#FFF', fontWeight: '700', fontSize: ty.body },
  dbTxBody: { flex: 1 },
  dbTxName: { fontSize: ty.bodyLg, fontWeight: '600', color: colors.text },
  dbTxType: { fontSize: ty.caption, color: colors.textMuted, marginTop: 2 },
  dbTxMeta: { alignItems: 'flex-end' },
  dbTxAmount: { fontSize: ty.bodyLg, fontWeight: '700' },
  dbAmountGreen: { color: colors.primary },
  dbAmountOrange: { color: colors.warning },
  dbTxTime: { fontSize: ty.sm, color: colors.textMuted, marginTop: 2 },
  dbOutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dbOutRank: { width: 22, fontSize: ty.bodyLg, fontWeight: '700', color: colors.textMuted },
  dbOutName: { flex: 1, fontSize: ty.bodyLg, fontWeight: '600', color: colors.text, marginRight: 8 },
  dbOutAmount: { fontSize: ty.bodyLg, fontWeight: '700', color: colors.danger },
  dbViewAllBtn: {
    marginTop: 10,
    backgroundColor: '#ECFDF5',
    borderRadius: 10,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  dbViewAllBtnText: { color: colors.primary, fontWeight: '700', fontSize: ty.bodyLg },
  dbCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.card,
    padding: spacing.md,
    marginTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  dbOverviewGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  dbOverviewItem: {
    width: '47%',
    flexGrow: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
  },
  dbOverviewLabel: { fontSize: ty.caption, color: colors.textMuted, marginBottom: 4 },
  dbOverviewValue: { fontSize: ty.lg, fontWeight: '800', marginBottom: 6 },
  dbReminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dbReminderIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  dbReminderBody: { flex: 1 },
  dbReminderName: { fontSize: ty.bodyLg, fontWeight: '600', color: colors.text },
  dbReminderAmount: { fontSize: ty.caption, color: colors.textMuted, marginTop: 2 },
  dbReminderWhen: { fontSize: ty.caption, color: colors.primary, fontWeight: '600' },
});
