import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { customerColors as c } from '../../theme/customerColors';
import { layout } from '../../theme/layout';
import { radius } from '../../theme/radius';
import { spacing } from '../../theme/spacing';
import { typeScale } from '../../theme/typography';

export function CustomerScreen({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return <View style={[cuiStyles.cuiScreen, style]}>{children}</View>;
}

export function CustomerCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return <View style={[cuiStyles.cuiCard, style]}>{children}</View>;
}

export function CustomerTitle({ children }: { children: React.ReactNode }) {
  return <Text style={cuiStyles.cuiTitle}>{children}</Text>;
}

export function CustomerSubtitle({ children }: { children: React.ReactNode }) {
  return <Text style={cuiStyles.cuiSubtitle}>{children}</Text>;
}

export function CustomerButton({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  loading?: boolean;
  disabled?: boolean;
}) {
  const variantStyle =
    variant === 'secondary'
      ? cuiStyles.cuiBtnSecondary
      : variant === 'outline'
        ? cuiStyles.cuiBtnOutline
        : variant === 'danger'
          ? cuiStyles.cuiBtnDanger
          : cuiStyles.cuiBtnPrimary;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        cuiStyles.cuiBtn,
        variantStyle,
        (disabled || loading) && cuiStyles.cuiBtnDisabled,
        pressed && cuiStyles.cuiBtnPressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'outline' ? c.peachDark : '#fff'} />
      ) : (
        <Text style={[cuiStyles.cuiBtnText, variant === 'outline' && { color: c.peachDark }]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

export function CustomerStatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <View style={[cuiStyles.cuiStatCard, accent && cuiStyles.cuiStatCardAccent]}>
      <Text style={cuiStyles.cuiStatLabel}>{label}</Text>
      <Text style={[cuiStyles.cuiStatValue, accent && cuiStyles.cuiStatValueAccent]}>{value}</Text>
    </View>
  );
}

export function CustomerLoading() {
  return (
    <View style={cuiStyles.cuiCenter}>
      <ActivityIndicator size="large" color={c.peachDark} />
    </View>
  );
}

const cuiStyles = StyleSheet.create({
  cuiScreen: { flex: 1, backgroundColor: c.cream },
  cuiCard: {
    backgroundColor: c.white,
    borderRadius: radius.card,
    padding: layout.cardPadding,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: c.border,
  },
  cuiTitle: {
    ...typeScale.h2,
    color: c.text,
  },
  cuiSubtitle: {
    ...typeScale.bodySmall,
    color: c.textMuted,
    marginTop: spacing.xxs,
    marginBottom: spacing.md,
  },
  cuiBtn: {
    borderRadius: radius.button,
    minHeight: layout.buttonHeight,
    paddingHorizontal: layout.buttonPaddingX,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  cuiBtnPrimary: { backgroundColor: c.peach },
  cuiBtnSecondary: { backgroundColor: c.sand },
  cuiBtnOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: c.peach,
  },
  cuiBtnDanger: { backgroundColor: c.danger },
  cuiBtnDisabled: { opacity: 0.55 },
  cuiBtnPressed: { opacity: 0.88 },
  cuiBtnText: { ...typeScale.buttonLarge, color: c.white },
  cuiStatCard: {
    flex: 1,
    backgroundColor: c.white,
    borderRadius: radius.card,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: c.border,
  },
  cuiStatCardAccent: {
    backgroundColor: c.sky,
    borderColor: 'rgba(207,235,255,0.9)',
  },
  cuiStatLabel: { ...typeScale.captionMedium, color: c.textMuted },
  cuiStatValue: {
    marginTop: spacing.xs,
    ...typeScale.h3,
    color: c.text,
  },
  cuiStatValueAccent: { color: c.peachDark },
  cuiCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.cream },
});
