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
import { typography as t } from '../../theme/typography';

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
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: c.border,
  },
  cuiTitle: {
    fontSize: t.xxl,
    fontWeight: '800',
    color: c.text,
    letterSpacing: -0.3,
  },
  cuiSubtitle: {
    fontSize: t.bodyLg,
    color: c.textMuted,
    marginTop: 4,
    marginBottom: 16,
  },
  cuiBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
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
  cuiBtnText: { color: c.white, fontWeight: '800', fontSize: t.bodyLg },
  cuiStatCard: {
    flex: 1,
    backgroundColor: c.white,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: c.border,
  },
  cuiStatCardAccent: {
    backgroundColor: c.sky,
    borderColor: 'rgba(207,235,255,0.9)',
  },
  cuiStatLabel: { fontSize: t.sm, color: c.textMuted, fontWeight: '600' },
  cuiStatValue: {
    marginTop: 6,
    fontSize: t.xl,
    fontWeight: '800',
    color: c.text,
  },
  cuiStatValueAccent: { color: c.peachDark },
  cuiCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.cream },
});
