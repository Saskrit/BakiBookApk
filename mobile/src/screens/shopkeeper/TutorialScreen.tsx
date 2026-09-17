import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import AppBackButton from '../../components/AppBackButton';
import { useAuth } from '../../contexts/AuthContext';
import { appAlert } from '../../contexts/DialogContext';
import { updateTutorialProgress } from '../../api/auth';
import {
  ALL_TUTORIAL_STEP_IDS,
  getChapterStats,
  getTutorialStats,
  TUTORIAL_CHAPTERS,
  type TutorialChapterId,
} from '../../features/tutorial/catalog';
import { chapterAccent } from '../../features/tutorial/TutorialIllustration';
import { colors } from '../../theme/colors';
import { typography as typo, typeScale } from '../../theme/typography';
import { spacing } from '../../theme/spacing';
import { radius } from '../../theme/radius';

import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Tutorial'>;

function MiniArt({ chapterId }: { chapterId: TutorialChapterId }) {
  const accent = chapterAccent(chapterId);
  return (
    <View style={[tuStyles.tuMiniArt, { backgroundColor: accent.bg }]}>
      <Svg width={56} height={56} viewBox="0 0 56 56">
        <Rect x={10} y={8} width={36} height={40} rx={8} fill="#FFF" />
        <Rect x={16} y={14} width={18} height={4} rx={2} fill={accent.fg} />
        <Circle cx={28} cy={30} r={8} fill={accent.bg} />
        <Path d="M18 42 H38" stroke={accent.fg} strokeWidth={3} strokeLinecap="round" />
      </Svg>
    </View>
  );
}

export default function TutorialScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { user, applyUser } = useAuth();
  const completed = user?.tutorialProgress?.completedStepIds || [];
  const stats = getTutorialStats(completed);

  const handleReset = () => {
    appAlert(t('tutorial.resetConfirmTitle'), t('tutorial.resetConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('tutorial.resetAction'),
        style: 'destructive',
        onPress: async () => {
          const res = await updateTutorialProgress({ reset: true });
          await applyUser(res.user);
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
          const res = await updateTutorialProgress({
            completedStepIds: [...ALL_TUTORIAL_STEP_IDS],
          });
          await applyUser(res.user);
        },
      },
    ]);
  };

  return (
    <View style={[tuStyles.tuScreen, { paddingTop: insets.top }]}>
      <View style={tuStyles.tuHero}>
        <View style={tuStyles.tuHeroTop}>
          <AppBackButton onPress={() => navigation.goBack()} variant="onDark" />
          <Pressable onPress={handleSkipAll} hitSlop={8}>
            <Text style={tuStyles.tuSkipAll}>{t('tutorial.skipAll')}</Text>
          </Pressable>
        </View>
        <Text style={tuStyles.tuTitle}>{t('tutorial.title')}</Text>
        <Text style={tuStyles.tuSubtitle}>{t('tutorial.pictureSubtitle')}</Text>

        <View style={tuStyles.tuProgressCard}>
          <View style={tuStyles.tuProgressRingWrap}>
            <Text style={tuStyles.tuProgressPct}>{stats.percent}%</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={tuStyles.tuProgressLabel}>{t('tutorial.progressLabel')}</Text>
            <View style={tuStyles.tuBarTrack}>
              <View style={[tuStyles.tuBarFill, { width: `${stats.percent}%` }]} />
            </View>
            <Text style={tuStyles.tuProgressMeta}>
              {t('tutorial.stepsComplete', {
                completed: stats.completedCount,
                total: stats.total,
              })}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[tuStyles.tuContent, { paddingBottom: insets.bottom + 28 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={tuStyles.tuSectionLabel}>{t('tutorial.chaptersLabel')}</Text>
        {TUTORIAL_CHAPTERS.map((chapter) => {
          const chapterStats = getChapterStats(chapter.id, completed);
          const accent = chapterAccent(chapter.id);
          return (
            <Pressable
              key={chapter.id}
              style={tuStyles.tuChapterCard}
              onPress={() =>
                navigation.navigate('TutorialChapter', {
                  chapterId: chapter.id as TutorialChapterId,
                })
              }
            >
              <MiniArt chapterId={chapter.id} />
              <View style={tuStyles.tuChapterBody}>
                <Text style={tuStyles.tuChapterTitle}>
                  {t(`tutorial.chapters.${chapter.id}.title`)}
                </Text>
                <Text style={tuStyles.tuChapterDesc} numberOfLines={2}>
                  {t(`tutorial.chapters.${chapter.id}.description`)}
                </Text>
                <View style={tuStyles.tuMetaRow}>
                  <View style={[tuStyles.tuMiniTrack, { backgroundColor: accent.bg }]}>
                    <View
                      style={[
                        tuStyles.tuMiniFill,
                        { width: `${chapterStats.percent}%`, backgroundColor: accent.fg },
                      ]}
                    />
                  </View>
                  <Text style={[tuStyles.tuChapterMeta, { color: accent.fg }]}>
                    {chapterStats.isComplete
                      ? t('tutorial.chapterComplete')
                      : `${chapterStats.completedCount}/${chapterStats.total}`}
                  </Text>
                </View>
              </View>
              <Text style={tuStyles.tuChevron}>›</Text>
            </Pressable>
          );
        })}

        <Pressable style={tuStyles.tuResetBtn} onPress={handleReset}>
          <Text style={tuStyles.tuResetText}>{t('tutorial.reset')}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const tuStyles = StyleSheet.create({
  tuScreen: { flex: 1, backgroundColor: '#F7F8FA' },
  tuHero: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  tuHeroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  tuBack: { color: colors.primaryDark, fontSize: 16, fontWeight: '700' },
  tuSkipAll: { color: colors.textMuted, fontSize: 14, fontWeight: '700' },
  tuTitle: {
    color: colors.text,
    fontSize: typo.h1,
    fontFamily: typeScale.h1.fontFamily,
    fontWeight: '700',
  },
  tuSubtitle: {
    color: colors.textMuted,
    marginTop: 6,
    marginBottom: 18,
    fontSize: 15,
    lineHeight: 22,
  },
  tuProgressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: '#FFF',
    borderRadius: radius.container,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#ECEEF2',
  },
  tuProgressRingWrap: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#EEF6E8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tuProgressPct: { color: colors.primaryDark, fontWeight: '800', fontSize: 15 },
  tuProgressLabel: { color: colors.text, fontWeight: '700', fontSize: typo.body },
  tuBarTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: '#F3F4F6',
    overflow: 'hidden',
    marginTop: 8,
  },
  tuBarFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 999 },
  tuProgressMeta: { color: colors.textMuted, marginTop: 6, fontSize: typo.caption },
  tuContent: { padding: spacing.md, gap: spacing.sm },
  tuSectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  tuChapterCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: radius.container,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ECEEF2',
    gap: spacing.sm,
  },
  tuMiniArt: {
    width: 64,
    height: 64,
    borderRadius: radius.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tuChapterBody: { flex: 1 },
  tuChapterTitle: { fontSize: typo.bodyLg, fontWeight: '800', color: colors.text },
  tuChapterDesc: { marginTop: 2, color: colors.textMuted, fontSize: typo.caption, lineHeight: 18 },
  tuMetaRow: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  tuMiniTrack: {
    flex: 1,
    height: 6,
    borderRadius: 999,
    overflow: 'hidden',
  },
  tuMiniFill: { height: '100%', borderRadius: 999 },
  tuChapterMeta: { fontSize: typo.xs, fontWeight: '700' },
  tuChevron: { fontSize: 24, color: '#C4C9D4', fontWeight: '300' },
  tuResetBtn: {
    marginTop: 8,
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  tuResetText: { color: colors.danger, fontWeight: '700' },
});
