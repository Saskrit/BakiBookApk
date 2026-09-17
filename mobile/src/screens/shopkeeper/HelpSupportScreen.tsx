import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import ScreenHeader from '../../components/ScreenHeader';
import { useAuth } from '../../contexts/AuthContext';
import { appAlert } from '../../contexts/DialogContext';
import { getActiveApiBaseUrl } from '../../api/client';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { radius } from '../../theme/radius';

import type { RootStackParamList } from '../../navigation/types';

const DEFAULT_SUPPORT_EMAIL = 'saskreetking@gmail.com';
const DEFAULT_SUPPORT_PHONE = '+977 9703649841';
const SUPPORT_HOURS = '8:00 AM – 8:00 PM';

type TopicKey =
  | 'makePayment'
  | 'uploadScreenshot'
  | 'paymentVerified'
  | 'creditScore'
  | 'scanShopQr'
  | 'downloadStatement'
  | 'addCredit'
  | 'recordPayment'
  | 'exportReports'
  | 'trackExpenses'
  | 'manageProducts'
  | 'changePassword'
  | 'serverUnreachable'
  | 'howItWorks'
  | 'safety'
  | 'forShops';

function FaqExpand({
  question,
  answer,
  icon,
}: {
  question: string;
  answer: string;
  icon: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Pressable
      onPress={() => setOpen((v) => !v)}
      style={({ pressed }) => [hsStyles.hsTopicRow, pressed && { opacity: 0.9 }]}
    >
      <View style={hsStyles.hsTopicIcon}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={hsStyles.hsTopicTitle}>{question}</Text>
        {open ? <Text style={hsStyles.hsTopicAnswer}>{answer}</Text> : null}
      </View>
      <Text style={hsStyles.hsChevron}>{open ? '▾' : '›'}</Text>
    </Pressable>
  );
}

export default function HelpSupportScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const isCustomer = user?.role === 'customer';
  const [supportEmail, setSupportEmail] = useState(DEFAULT_SUPPORT_EMAIL);
  const [supportPhone, setSupportPhone] = useState(DEFAULT_SUPPORT_PHONE);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const apiBase = await getActiveApiBaseUrl();
        if (!apiBase || cancelled) return;
        const res = await fetch(`${apiBase}/platform-contact`);
        const data = res.ok ? await res.json() : null;
        if (cancelled || !data) return;
        if (typeof data.supportEmail === 'string' && data.supportEmail.trim()) {
          setSupportEmail(data.supportEmail.trim());
        }
        if (typeof data.supportPhone === 'string' && data.supportPhone.trim()) {
          setSupportPhone(data.supportPhone.trim());
        }
      } catch {
        // keep defaults
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const whatsappDigits = supportPhone.replace(/[^\d]/g, '').replace(/^977/, '') || '9703649841';

  const popularTopics = useMemo(() => {
    if (isCustomer) {
      return [
        'makePayment',
        'uploadScreenshot',
        'paymentVerified',
        'creditScore',
        'scanShopQr',
        'downloadStatement',
      ] as TopicKey[];
    }
    return [
      'addCredit',
      'recordPayment',
      'exportReports',
      'trackExpenses',
      'manageProducts',
      'changePassword',
    ] as TopicKey[];
  }, [isCustomer]);

  const openEmail = () => {
    Linking.openURL(
      `mailto:${supportEmail}?subject=${encodeURIComponent(t('help.supportSubject'))}`
    ).catch(() => Linking.openURL(`mailto:${supportEmail}`).catch(() => {}));
  };

  const openWhatsApp = () => {
    Linking.openURL(`https://wa.me/977${whatsappDigits}`).catch(() =>
      appAlert(t('common.error'), t('help.whatsappFailed'))
    );
  };

  const openCall = () => {
    Linking.openURL(`tel:${supportPhone.replace(/[^\d+]/g, '')}`).catch(() =>
      appAlert(t('common.error'), t('help.callFailed'))
    );
  };

  const openLiveChat = () => {
    appAlert(t('help.liveChat'), t('help.liveChatBody'), [
      { text: t('help.emailSupport'), onPress: openEmail },
      { text: t('customer.whatsapp'), onPress: openWhatsApp },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  const openTickets = () => {
    appAlert(t('help.myTickets'), t('help.myTicketsBody'), [
      { text: t('help.emailSupport'), onPress: openEmail },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  const openQuick = (key: 'faqs' | 'howItWorks' | 'safety' | 'forShops') => {
    if (key === 'faqs') {
      appAlert(t('help.quickFaqs'), t('help.quickFaqsBody'));
      return;
    }
    if (key === 'howItWorks') {
      if (!isCustomer) {
        navigation.navigate('Tutorial');
        return;
      }
      appAlert(t('help.howItWorks'), t('help.howItWorksBody'));
      return;
    }
    if (key === 'safety') {
      navigation.navigate('LegalDocument', {
        slug: 'privacy',
        title: t('help.privacy'),
      });
      return;
    }
    appAlert(t('help.forShops'), t('help.forShopsBody'));
  };

  const topicIcon = (key: TopicKey) => {
    const stroke = colors.primary;
    if (key === 'makePayment' || key === 'recordPayment') {
      return (
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
          <Rect x={3} y={6} width={18} height={12} rx={2} stroke={stroke} strokeWidth={2} />
          <Path d="M3 10 H21" stroke={stroke} strokeWidth={2} />
        </Svg>
      );
    }
    if (key === 'uploadScreenshot') {
      return (
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
          <Path
            d="M12 16 V7 M8 10 L12 6 L16 10 M5 18 H19"
            stroke={stroke}
            strokeWidth={2}
            strokeLinecap="round"
          />
        </Svg>
      );
    }
    if (key === 'paymentVerified' || key === 'safety') {
      return (
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
          <Path
            d="M12 3 L20 7 V12 C20 17 16.5 20.5 12 21 C7.5 20.5 4 17 4 12 V7 Z"
            stroke={stroke}
            strokeWidth={2}
          />
        </Svg>
      );
    }
    if (key === 'creditScore') {
      return (
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
          <Path
            d="M4 16 L9 10 L13 13 L20 6"
            stroke={stroke}
            strokeWidth={2}
            strokeLinecap="round"
          />
          <Circle cx={20} cy={6} r={1.5} fill={stroke} />
        </Svg>
      );
    }
    if (key === 'scanShopQr') {
      return (
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
          <Rect x={4} y={4} width={7} height={7} stroke={stroke} strokeWidth={2} />
          <Rect x={13} y={13} width={7} height={7} stroke={stroke} strokeWidth={2} />
        </Svg>
      );
    }
    if (key === 'downloadStatement' || key === 'exportReports') {
      return (
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
          <Path
            d="M12 4 V14 M8 10 L12 14 L16 10 M5 18 H19"
            stroke={stroke}
            strokeWidth={2}
            strokeLinecap="round"
          />
        </Svg>
      );
    }
    return (
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
        <Circle cx={12} cy={12} r={8} stroke={stroke} strokeWidth={2} />
        <Path d="M12 11 V16 M12 8 V8.5" stroke={stroke} strokeWidth={2} />
      </Svg>
    );
  };

  return (
    <View style={[hsStyles.hsScreen, { paddingTop: insets.top }]}>
      <ScreenHeader
        layout="inline"
        title={t('help.title')}
        subtitle={t('help.heroSubtitle')}
        onBack={() => navigation.goBack()}
        includeSafeArea={false}
        style={hsStyles.hsHeaderInner}
        right={
          <Pressable style={hsStyles.hsTicketsBtn} onPress={openTickets}>
            <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
              <Path
                d="M4 8 H20 V11 C18.5 11 17.5 12 17.5 13.5 C17.5 15 18.5 16 20 16 V19 H4 V16 C5.5 16 6.5 15 6.5 13.5 C6.5 12 5.5 11 4 11 Z"
                stroke={colors.primary}
                strokeWidth={1.8}
              />
            </Svg>
            <Text style={hsStyles.hsTicketsText}>{t('help.myTickets')}</Text>
          </Pressable>
        }
      />

      <ScrollView
        contentContainerStyle={[hsStyles.hsContent, { paddingBottom: insets.bottom + 28 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero support card */}
        <View style={hsStyles.hsHeroCard}>
          <View style={hsStyles.hsHeroArt}>
            <View style={hsStyles.hsHeroAvatar}>
              <Text style={hsStyles.hsHeroAvatarText}>B</Text>
            </View>
            <Svg width={44} height={44} viewBox="0 0 48 48" fill="none">
              <Circle cx={24} cy={16} r={8} fill="#4C5C2D" />
              <Path
                d="M8 40 C8 30 16 26 24 26 C32 26 40 30 40 40"
                fill="#6A7E3F"
              />
              <Path
                d="M30 14 C34 12 38 14 38 18"
                stroke="#FFF"
                strokeWidth={2}
                strokeLinecap="round"
              />
            </Svg>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={hsStyles.hsHeroText}>{t('help.heroBody')}</Text>
          </View>
          <View style={hsStyles.hsHoursBox}>
            <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
              <Circle cx={12} cy={12} r={8} stroke="#FFF" strokeWidth={2} />
              <Path d="M12 8 V12 L15 14" stroke="#FFF" strokeWidth={2} strokeLinecap="round" />
            </Svg>
            <Text style={hsStyles.hsHoursLabel}>{t('help.supportHours')}</Text>
            <Text style={hsStyles.hsHoursValue}>{SUPPORT_HOURS}</Text>
            <Text style={hsStyles.hsHoursEveryday}>{t('help.everyday')}</Text>
          </View>
        </View>

        {/* Quick help */}
        <Text style={hsStyles.hsSectionTitle}>{t('help.quickHelp')}</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={hsStyles.hsQuickRow}
        >
          {(
            [
              {
                key: 'faqs' as const,
                title: t('help.quickFaqs'),
                sub: t('help.quickFaqsSub'),
                bg: '#ECFDF5',
                fg: colors.primary,
              },
              {
                key: 'howItWorks' as const,
                title: t('help.howItWorks'),
                sub: t('help.howItWorksSub'),
                bg: '#DBEAFE',
                fg: '#2563EB',
              },
              {
                key: 'safety' as const,
                title: t('help.safety'),
                sub: t('help.safetySub'),
                bg: '#EDE9FE',
                fg: '#7C3AED',
              },
              {
                key: 'forShops' as const,
                title: t('help.forShops'),
                sub: t('help.forShopsSub'),
                bg: '#FFEDD5',
                fg: '#EA580C',
              },
            ]
          ).map((item) => (
            <Pressable
              key={item.key}
              style={hsStyles.hsQuickCard}
              onPress={() => openQuick(item.key)}
            >
              <View style={[hsStyles.hsQuickIcon, { backgroundColor: item.bg }]}>
                {item.key === 'faqs' ? (
                  <Text style={{ color: item.fg, fontWeight: '900', fontSize: 16 }}>?</Text>
                ) : item.key === 'howItWorks' ? (
                  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                    <Path
                      d="M7 4 H17 C18 4 19 5 19 6 V20 L12 17 L5 20 V6 C5 5 6 4 7 4 Z"
                      stroke={item.fg}
                      strokeWidth={2}
                    />
                  </Svg>
                ) : item.key === 'safety' ? (
                  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                    <Path
                      d="M12 3 L20 7 V12 C20 17 16.5 20.5 12 21 C7.5 20.5 4 17 4 12 V7 Z"
                      stroke={item.fg}
                      strokeWidth={2}
                    />
                  </Svg>
                ) : (
                  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                    <Path
                      d="M6 8 H18 L17 20 H7 Z M9 8 V6 C9 4.5 10 3.5 12 3.5 C14 3.5 15 4.5 15 6 V8"
                      stroke={item.fg}
                      strokeWidth={2}
                    />
                  </Svg>
                )}
              </View>
              <Text style={hsStyles.hsQuickTitle}>{item.title}</Text>
              <Text style={hsStyles.hsQuickSub}>{item.sub}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Popular topics */}
        <Text style={hsStyles.hsSectionTitle}>{t('help.popularTopics')}</Text>
        <View style={hsStyles.hsCard}>
          {popularTopics.map((key) => (
            <FaqExpand
              key={key}
              question={t(`help.topics.${key}.q`)}
              answer={t(`help.topics.${key}.a`)}
              icon={topicIcon(key)}
            />
          ))}
        </View>

        {/* Contact support */}
        <Text style={hsStyles.hsSectionTitle}>{t('help.contactSupport')}</Text>
        <View style={hsStyles.hsCard}>
          <Pressable style={hsStyles.hsContactRow} onPress={openLiveChat}>
            <View style={[hsStyles.hsContactIcon, { backgroundColor: '#ECFDF5' }]}>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M5 6 H19 V16 H9 L5 19 Z"
                  stroke={colors.primary}
                  strokeWidth={2}
                />
              </Svg>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={hsStyles.hsContactTitle}>{t('help.liveChat')}</Text>
              <Text style={hsStyles.hsContactSub}>{t('help.liveChatSub')}</Text>
            </View>
            <View style={hsStyles.hsOnlineBadge}>
              <Text style={hsStyles.hsOnlineText}>{t('help.online')}</Text>
            </View>
          </Pressable>

          <Pressable style={hsStyles.hsContactRow} onPress={openWhatsApp}>
            <View style={[hsStyles.hsContactIcon, { backgroundColor: '#DCFCE7' }]}>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M12 3 C7 3 3 6.8 3 11.5 C3 13.2 3.6 14.8 4.6 16.1 L3.5 20.5 L8.1 19.2 C9.3 19.8 10.6 20.1 12 20.1 C17 20.1 21 16.3 21 11.6 C21 6.8 17 3 12 3 Z"
                  stroke="#16A34A"
                  strokeWidth={1.8}
                />
              </Svg>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={hsStyles.hsContactTitle}>{t('help.whatsappSupport')}</Text>
              <Text style={hsStyles.hsContactSub}>{t('help.whatsappSub')}</Text>
            </View>
            <Text style={hsStyles.hsContactValue}>{supportPhone}</Text>
          </Pressable>

          <Pressable style={hsStyles.hsContactRow} onPress={openEmail}>
            <View style={[hsStyles.hsContactIcon, { backgroundColor: '#DBEAFE' }]}>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Rect x={3} y={5} width={18} height={14} rx={2} stroke="#2563EB" strokeWidth={2} />
                <Path d="M3 7 L12 13 L21 7" stroke="#2563EB" strokeWidth={2} />
              </Svg>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={hsStyles.hsContactTitle}>{t('help.emailSupport')}</Text>
              <Text style={hsStyles.hsContactSub}>{t('help.emailSub')}</Text>
            </View>
            <Text style={[hsStyles.hsContactValue, { fontSize: 11 }]}>{supportEmail}</Text>
          </Pressable>

          <Pressable style={[hsStyles.hsContactRow, { borderBottomWidth: 0 }]} onPress={openCall}>
            <View style={[hsStyles.hsContactIcon, { backgroundColor: '#FFEDD5' }]}>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M6 4 H10 L12 9 L9.5 10.5 C10.5 12.5 12 14 14 15 L15.5 12.5 L20.5 14.5 V18.5 C20.5 19.5 19.5 20.5 18.5 20.5 C10.5 20.5 3.5 13.5 3.5 5.5 C3.5 4.5 4.5 3.5 5.5 3.5"
                  stroke="#EA580C"
                  strokeWidth={1.8}
                />
              </Svg>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={hsStyles.hsContactTitle}>{t('help.callSupport')}</Text>
              <Text style={hsStyles.hsContactSub}>{t('help.callSub')}</Text>
            </View>
            <Text style={hsStyles.hsContactValue}>{supportPhone}</Text>
          </Pressable>
        </View>

        <View style={hsStyles.hsResponseBanner}>
          <View style={hsStyles.hsBellIcon}>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
              <Path
                d="M6 16 H18 L16.5 9.5 C16 7 14.2 5.5 12 5.5 C9.8 5.5 8 7 7.5 9.5 Z"
                stroke="#CA8A04"
                strokeWidth={2}
              />
              <Path
                d="M10 18 C10 19.1 10.9 20 12 20 C13.1 20 14 19.1 14 18"
                stroke="#CA8A04"
                strokeWidth={2}
              />
            </Svg>
          </View>
          <Text style={hsStyles.hsResponseText}>{t('help.responseBanner')}</Text>
        </View>

        <Pressable
          style={hsStyles.hsLegalLink}
          onPress={() =>
            navigation.navigate('LegalDocument', {
              slug: 'terms',
              title: t('help.terms'),
            })
          }
        >
          <Text style={hsStyles.hsLegalLinkText}>{t('help.terms')} · {t('help.privacy')}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const hsStyles = StyleSheet.create({
  hsScreen: { flex: 1, backgroundColor: '#F7F8F4' },
  hsHeaderInner: { paddingBottom: 8 },
  hsTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  hsIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hsTitle: { fontSize: 18, fontWeight: '800', color: colors.primaryDark },
  hsSubtitle: { marginTop: 2, fontSize: 12, color: '#6B7280', fontWeight: '600' },
  hsTicketsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  hsTicketsText: { color: colors.primary, fontWeight: '800', fontSize: 11 },
  hsContent: { paddingHorizontal: spacing.md, paddingTop: 8, gap: 10 },
  hsHeroCard: {
    backgroundColor: '#E8F0D8',
    borderRadius: radius.container,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  hsHeroArt: { alignItems: 'center', justifyContent: 'center' },
  hsHeroAvatar: {
    position: 'absolute',
    top: 2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  hsHeroAvatarText: { color: '#FFF', fontSize: 10, fontWeight: '900' },
  hsHeroText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primaryDark,
    lineHeight: 18,
  },
  hsHoursBox: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    padding: 10,
    minWidth: 108,
    alignItems: 'flex-start',
    gap: 2,
  },
  hsHoursLabel: { color: 'rgba(255,255,255,0.9)', fontSize: 10, fontWeight: '700', marginTop: 4 },
  hsHoursValue: { color: '#FFF', fontSize: 11, fontWeight: '800' },
  hsHoursEveryday: { color: 'rgba(255,255,255,0.85)', fontSize: 10, fontWeight: '600' },
  hsSectionTitle: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  hsQuickRow: { gap: 10, paddingVertical: 4, paddingRight: 8 },
  hsQuickCard: {
    width: 148,
    backgroundColor: '#FFF',
    borderRadius: radius.card,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E8EDE0',
  },
  hsQuickIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  hsQuickTitle: { fontSize: 13, fontWeight: '800', color: colors.primaryDark },
  hsQuickSub: { marginTop: 4, fontSize: 11, color: '#6B7280', lineHeight: 15, fontWeight: '600' },
  hsCard: {
    backgroundColor: '#FFF',
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: '#E8EDE0',
    overflow: 'hidden',
  },
  hsTopicRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F2EC',
  },
  hsTopicIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.container,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hsTopicTitle: { fontSize: 14, fontWeight: '700', color: colors.text, lineHeight: 19 },
  hsTopicAnswer: {
    marginTop: 8,
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 19,
    fontWeight: '500',
  },
  hsChevron: { fontSize: 18, color: '#9CA3AF', marginTop: 6 },
  hsContactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F2EC',
  },
  hsContactIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hsContactTitle: { fontSize: 14, fontWeight: '800', color: colors.text },
  hsContactSub: { marginTop: 2, fontSize: 12, color: '#6B7280', fontWeight: '600' },
  hsContactValue: { color: colors.primary, fontWeight: '800', fontSize: 12, maxWidth: 110, textAlign: 'right' },
  hsOnlineBadge: {
    backgroundColor: '#DCFCE7',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  hsOnlineText: { color: '#15803D', fontWeight: '800', fontSize: 11 },
  hsResponseBanner: {
    marginTop: 4,
    backgroundColor: '#FEF9C3',
    borderRadius: radius.card,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  hsBellIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#FEF08A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hsResponseText: {
    flex: 1,
    fontSize: 12,
    color: '#854D0E',
    fontWeight: '600',
    lineHeight: 17,
  },
  hsLegalLink: { alignItems: 'center', paddingVertical: 8 },
  hsLegalLinkText: { color: colors.primary, fontWeight: '700', fontSize: 12 },
});
