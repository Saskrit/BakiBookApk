import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { appAlert } from '../../contexts/DialogContext';
import { updateTutorialProgress } from '../../api/auth';
import {
  ALL_TUTORIAL_STEP_IDS,
  getChapterStats,
  TUTORIAL_CHAPTERS,
} from '../../features/tutorial/catalog';
import TutorialIllustration, {
  chapterAccent,
} from '../../features/tutorial/TutorialIllustration';
import { colors } from '../../theme/colors';
import { typography as typo, typeScale } from '../../theme/typography';
import { spacing } from '../../theme/spacing';
import { radius } from '../../theme/radius';

import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'TutorialChapter'>;

const { width: SCREEN_W } = Dimensions.get('window');

export default function TutorialChapterScreen({ navigation, route }: Props) {
  const { chapterId } = route.params;
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { user, applyUser } = useAuth();
  const chapter = TUTORIAL_CHAPTERS.find((c) => c.id === chapterId);
  const completedIds = user?.tutorialProgress?.completedStepIds || [];
  const [index, setIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const listRef = useRef<FlatList>(null);
  const accent = chapterAccent(chapterId);

  const stats = useMemo(
    () => getChapterStats(chapterId, completedIds),
    [chapterId, completedIds]
  );

  useEffect(() => {
    if (!chapter) return;
    const firstOpen = chapter.steps.findIndex((s) => !completedIds.includes(s.id));
    if (firstOpen > 0) {
      setIndex(firstOpen);
      requestAnimationFrame(() => {
        listRef.current?.scrollToIndex({ index: firstOpen, animated: false });
      });
    }
    // only on mount / chapter change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterId]);

  if (!chapter) {
    return (
      <View style={tcStyles.tcCenter}>
        <Text>{t('errors.generic')}</Text>
      </View>
    );
  }

  const step = chapter.steps[index];
  const done = step ? completedIds.includes(step.id) : false;
  const isLast = index >= chapter.steps.length - 1;

  const openFeature = (routeName?: string) => {
    if (!routeName) return;
    if (
      routeName === 'Dashboard' ||
      routeName === 'Customers' ||
      routeName === 'Reports' ||
      routeName === 'Settings'
    ) {
      navigation.navigate('Shopkeeper', { screen: routeName } as never);
      return;
    }
    if (
      routeName === 'ShopProfile' ||
      routeName === 'AddCredit' ||
      routeName === 'AddCustomer' ||
      routeName === 'Products' ||
      routeName === 'Expenses' ||
      routeName === 'Notifications' ||
      routeName === 'Security' ||
      routeName === 'QRScanner'
    ) {
      navigation.navigate(routeName as never);
    }
  };

  const persistStep = async (stepId: string, completed: boolean) => {
    setSaving(true);
    try {
      const res = await updateTutorialProgress({ stepId, completed });
      await applyUser(res.user);
    } finally {
      setSaving(false);
    }
  };

  const goTo = (next: number) => {
    const clamped = Math.max(0, Math.min(chapter.steps.length - 1, next));
    setIndex(clamped);
    listRef.current?.scrollToIndex({ index: clamped, animated: true });
  };

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
    if (next !== index) setIndex(next);
  };

  const handleNext = async () => {
    if (!step) return;
    if (!done) await persistStep(step.id, true);
    if (isLast) {
      navigation.goBack();
      return;
    }
    goTo(index + 1);
  };

  const handleSkipStep = async () => {
    if (!step) return;
    if (!done) await persistStep(step.id, true);
    if (isLast) {
      navigation.goBack();
      return;
    }
    goTo(index + 1);
  };

  const handleSkipChapter = () => {
    appAlert(t('tutorial.skipChapterTitle'), t('tutorial.skipChapterBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('tutorial.skip'),
        onPress: async () => {
          setSaving(true);
          try {
            const merged = new Set([
              ...completedIds,
              ...chapter.steps.map((s) => s.id),
            ]);
            const res = await updateTutorialProgress({
              completedStepIds: [...merged],
            });
            await applyUser(res.user);
            navigation.goBack();
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  const handleSkipAll = () => {
    appAlert(t('tutorial.skipAllTitle'), t('tutorial.skipAllBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('tutorial.skipAll'),
        onPress: async () => {
          setSaving(true);
          try {
            const res = await updateTutorialProgress({
              completedStepIds: [...ALL_TUTORIAL_STEP_IDS],
            });
            await applyUser(res.user);
            navigation.navigate('Tutorial');
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  return (
    <View style={[tcStyles.tcScreen, { paddingTop: insets.top }]}>
      <View style={tcStyles.tcTopBar}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
          <Text style={tcStyles.tcTopLink}>{t('common.close')}</Text>
        </Pressable>
        <Text style={tcStyles.tcTopMeta}>
          {index + 1}/{chapter.steps.length}
        </Text>
        <Pressable onPress={handleSkipChapter} hitSlop={10} disabled={saving}>
          <Text style={[tcStyles.tcTopLink, { color: accent.fg }]}>{t('tutorial.skip')}</Text>
        </Pressable>
      </View>

      <Text style={tcStyles.tcChapterLabel}>{t(`tutorial.chapters.${chapterId}.title`)}</Text>

      <FlatList
        ref={listRef}
        data={chapter.steps}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        getItemLayout={(_, i) => ({
          length: SCREEN_W,
          offset: SCREEN_W * i,
          index: i,
        })}
        renderItem={({ item, index: i }) => (
          <View style={{ width: SCREEN_W, paddingHorizontal: 20 }}>
            <View style={tcStyles.tcPictureCard}>
              <TutorialIllustration chapterId={chapterId} stepIndex={i} />
            </View>
            <View style={tcStyles.tcCopyBlock}>
              <View style={[tcStyles.tcPill, done && { backgroundColor: accent.fg }]}>
                <Text style={[tcStyles.tcPillText, done && { color: '#FFF' }]}>
                  {done ? t('tutorial.completed') : t('tutorial.stepLabel', { n: i + 1 })}
                </Text>
              </View>
              <Text style={tcStyles.tcStepTitle}>{t(`tutorial.steps.${item.id}.title`)}</Text>
              <Text style={tcStyles.tcStepBody}>{t(`tutorial.steps.${item.id}.body`)}</Text>
            </View>
          </View>
        )}
      />

      <View style={tcStyles.tcDots}>
        {chapter.steps.map((s, i) => {
          const isDone = completedIds.includes(s.id);
          return (
            <View
              key={s.id}
              style={[
                tcStyles.tcDot,
                i === index && { width: 22, backgroundColor: accent.fg },
                isDone && i !== index && { backgroundColor: accent.fg, opacity: 0.35 },
              ]}
            />
          );
        })}
      </View>

      <View style={[tcStyles.tcFooter, { paddingBottom: insets.bottom + 16 }]}>
        <View style={tcStyles.tcFooterRow}>
          <Pressable
            style={[tcStyles.tcGhostBtn, index === 0 && tcStyles.tcBtnDisabled]}
            disabled={index === 0 || saving}
            onPress={() => goTo(index - 1)}
          >
            <Text style={tcStyles.tcGhostBtnText}>{t('common.previous')}</Text>
          </Pressable>
          {step?.route ? (
            <Pressable style={tcStyles.tcGhostBtn} onPress={() => openFeature(step.route)}>
              <Text style={[tcStyles.tcGhostBtnText, { color: accent.fg }]}>
                {t('common.openFeature')}
              </Text>
            </Pressable>
          ) : (
            <View style={{ width: 8 }} />
          )}
        </View>

        <Pressable
          style={[tcStyles.tcPrimaryBtn, { backgroundColor: accent.fg }]}
          disabled={saving}
          onPress={handleNext}
        >
          <Text style={tcStyles.tcPrimaryBtnText}>
            {isLast ? t('tutorial.finishChapter') : t('tutorial.nextStep')}
          </Text>
        </Pressable>

        <View style={tcStyles.tcSkipRow}>
          <Pressable onPress={handleSkipStep} disabled={saving} hitSlop={8}>
            <Text style={tcStyles.tcSkipText}>{t('tutorial.skipStep')}</Text>
          </Pressable>
          <Text style={tcStyles.tcSkipDot}>·</Text>
          <Pressable onPress={handleSkipAll} disabled={saving} hitSlop={8}>
            <Text style={tcStyles.tcSkipText}>{t('tutorial.skipAll')}</Text>
          </Pressable>
        </View>

        <Text style={tcStyles.tcProgressHint}>
          {t('tutorial.stepsComplete', {
            completed: stats.completedCount,
            total: stats.total,
          })}
        </Text>
      </View>
    </View>
  );
}

const tcStyles = StyleSheet.create({
  tcScreen: { flex: 1, backgroundColor: '#FAFBFC' },
  tcCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tcTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  tcTopLink: { fontSize: 15, fontWeight: '700', color: colors.textMuted },
  tcTopMeta: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  tcChapterLabel: {
    paddingHorizontal: 20,
    fontSize: 13,
    fontWeight: '800',
    color: colors.primaryDark,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  tcPictureCard: {
    height: Math.min(360, Dimensions.get('window').height * 0.42),
    borderRadius: 28,
    overflow: 'hidden',
  },
  tcCopyBlock: { marginTop: 22, paddingHorizontal: 4 },
  tcPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#EEF2F7',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    marginBottom: 10,
  },
  tcPillText: { fontSize: 12, fontWeight: '800', color: colors.textMuted },
  tcStepTitle: {
    fontSize: typo.h1,
    lineHeight: typeScale.h1.lineHeight,
    fontFamily: typeScale.h1.fontFamily,
    fontWeight: '700',
    color: colors.text,
  },
  tcStepBody: {
    marginTop: 8,
    fontSize: typo.bodyLg,
    lineHeight: typeScale.body.lineHeight,
    fontFamily: typeScale.body.fontFamily,
    color: colors.textMuted,
  },
  tcDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginVertical: 10,
  },
  tcDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D1D5DB',
  },
  tcFooter: {
    paddingHorizontal: 20,
    gap: 10,
  },
  tcFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tcGhostBtn: {
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  tcBtnDisabled: { opacity: 0.35 },
  tcGhostBtnText: { fontWeight: '700', color: colors.textMuted, fontSize: 15 },
  tcPrimaryBtn: {
    borderRadius: radius.card,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  tcPrimaryBtnText: { color: '#FFF', fontWeight: '800', fontSize: 16 },
  tcSkipRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  tcSkipText: { color: colors.textMuted, fontWeight: '600', fontSize: 13 },
  tcSkipDot: { color: '#C4C9D4' },
  tcProgressHint: {
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: typo.caption,
    marginTop: 2,
  },
});
