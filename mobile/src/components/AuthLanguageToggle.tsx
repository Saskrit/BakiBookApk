import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import ServerStatusDot from './ServerStatusDot';
import { useLanguage } from '../contexts/LanguageContext';
import { colors } from '../theme/colors';
import { layout } from '../theme/layout';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { typeScale } from '../theme/typography';
import type { AppLanguage } from '../types';

/** Compact EN / ने toggle for login and signup (works without an account). */
export default function AuthLanguageToggle() {
  const { t } = useTranslation();
  const { language, setLanguage } = useLanguage();

  const options: { code: AppLanguage; short: string; label: string }[] = [
    { code: 'en', short: 'EN', label: t('common.english') },
    { code: 'ne', short: 'ने', label: t('common.nepali') },
  ];

  return (
    <View style={styles.row}>
      <ServerStatusDot />
      <View style={styles.wrap} accessibilityLabel={t('common.language')}>
        {options.map(({ code, short, label }) => {
          const active = language === code;
          return (
            <Pressable
              key={code}
              onPress={() => setLanguage(code)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={label}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{short}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  wrap: {
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: layout.touchTarget,
    alignItems: 'center',
  },
  chip: {
    minWidth: 44,
    minHeight: 36,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: {
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}18`,
  },
  chipText: {
    ...typeScale.button,
    color: colors.textMuted,
  },
  chipTextActive: {
    color: colors.primary,
  },
});
