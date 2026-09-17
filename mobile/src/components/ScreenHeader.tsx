import { ReactNode } from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppBackButton from './AppBackButton';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typeScale } from '../theme/typography';
import { customerColors as c } from '../theme/customerColors';

type Variant = 'default' | 'plain' | 'onDark' | 'customer';

type Props = {
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  showBack?: boolean;
  right?: ReactNode;
  layout?: 'stacked' | 'inline';
  variant?: Variant;
  bottom?: ReactNode;
  style?: ViewStyle;
  includeSafeArea?: boolean;
};

function backVariant(variant: Variant): 'default' | 'plain' | 'onDark' {
  if (variant === 'onDark') return 'onDark';
  if (variant === 'customer' || variant === 'plain') return 'plain';
  return 'default';
}

function titleColor(variant: Variant) {
  if (variant === 'onDark') return '#FFFFFF';
  if (variant === 'customer') return c.text;
  return colors.primaryDark;
}

function subtitleColor(variant: Variant) {
  if (variant === 'onDark') return 'rgba(255,255,255,0.88)';
  if (variant === 'customer') return c.textMuted;
  return colors.textMuted;
}

export default function ScreenHeader({
  title,
  subtitle,
  onBack,
  showBack = true,
  right,
  layout = 'stacked',
  variant = 'default',
  bottom,
  style,
  includeSafeArea = true,
}: Props) {
  const insets = useSafeAreaInsets();
  const canGoBack = showBack && !!onBack;

  if (layout === 'inline') {
    return (
      <View
        style={[
          styles.wrap,
          includeSafeArea && { paddingTop: insets.top + 8 },
          style,
        ]}
      >
        <View style={styles.inlineRow}>
          {canGoBack ? (
            <AppBackButton onPress={onBack!} variant={backVariant(variant)} />
          ) : (
            <View style={styles.spacer} />
          )}
          <View style={styles.inlineTitleWrap}>
            {title ? (
              <Text style={[styles.inlineTitle, { color: titleColor(variant) }]} numberOfLines={1}>
                {title}
              </Text>
            ) : null}
            {subtitle ? (
              <Text
                style={[styles.inlineSubtitle, { color: subtitleColor(variant) }]}
                numberOfLines={1}
              >
                {subtitle}
              </Text>
            ) : null}
          </View>
          {right ?? <View style={styles.spacer} />}
        </View>
        {bottom}
      </View>
    );
  }

  return (
    <View
      style={[
        styles.wrap,
        includeSafeArea && { paddingTop: insets.top + 8 },
        style,
      ]}
    >
      <View style={styles.stackedTopRow}>
        {canGoBack ? (
          <AppBackButton onPress={onBack!} variant={backVariant(variant)} />
        ) : (
          <View style={styles.spacer} />
        )}
        {right}
      </View>
      {title ? (
        <Text style={[styles.title, { color: titleColor(variant) }]} numberOfLines={2}>
          {title}
        </Text>
      ) : null}
      {subtitle ? (
        <Text style={[styles.subtitle, { color: subtitleColor(variant) }]} numberOfLines={2}>
          {subtitle}
        </Text>
      ) : null}
      {bottom}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 12,
  },
  stackedTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    minHeight: 40,
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 40,
  },
  inlineTitleWrap: { flex: 1, minWidth: 0 },
  inlineTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  inlineSubtitle: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  title: {
    fontSize: typeScale.h1.fontSize,
    lineHeight: typeScale.h1.lineHeight,
    fontFamily: typeScale.h1.fontFamily,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    color: colors.textMuted,
  },
  spacer: { width: 40, height: 40 },
});
