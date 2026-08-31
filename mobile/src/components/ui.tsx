import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle } from 'react-native';
import AppLoading from './AppLoading';
import { colors } from '../theme/colors';
import { layout } from '../theme/layout';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { textStyles } from '../theme/textStyles';
import { typeScale } from '../theme/typography';

export function Screen({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[uiStyles.uiScreen, style]}>{children}</View>;
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[uiStyles.uiCard, style]}>{children}</View>;
}

export function Title({ children }: { children: React.ReactNode }) {
  return <Text style={uiStyles.uiTitle}>{children}</Text>;
}

export function Subtitle({ children }: { children: React.ReactNode }) {
  return <Text style={uiStyles.uiSubtitle}>{children}</Text>;
}

export function Input({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={uiStyles.uiInputWrap}>
      <Text style={uiStyles.uiLabel}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.textMuted}
        style={uiStyles.uiInput}
        {...props}
      />
    </View>
  );
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  large,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  large?: boolean;
}) {
  const variantStyle =
    variant === 'secondary'
      ? uiStyles.uiBtnSecondary
      : variant === 'outline'
        ? uiStyles.uiBtnOutline
        : variant === 'danger'
          ? uiStyles.uiBtnDanger
          : uiStyles.uiBtnPrimary;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        uiStyles.uiBtn,
        large && uiStyles.uiBtnLarge,
        variantStyle,
        (disabled || loading) && uiStyles.uiBtnDisabled,
        pressed && uiStyles.uiBtnPressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'outline' ? colors.primary : '#fff'} />
      ) : (
        <Text
          style={[
            uiStyles.uiBtnText,
            large && uiStyles.uiBtnTextLarge,
            variant === 'outline' && { color: colors.primary },
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

export function LoadingState() {
  return <AppLoading />;
}

export function ErrorText({ message }: { message: string }) {
  return <Text style={uiStyles.uiError}>{message}</Text>;
}

export function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <View style={[uiStyles.uiStatCard, accent && uiStyles.uiStatCardAccent]}>
      <Text style={uiStyles.uiStatLabel}>{label}</Text>
      <Text style={[uiStyles.uiStatValue, accent && uiStyles.uiStatValueAccent]}>{value}</Text>
    </View>
  );
}

const uiStyles = StyleSheet.create({
  uiScreen: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: layout.screenPaddingX,
    paddingTop: layout.screenPaddingTop,
    paddingBottom: layout.screenPaddingBottom,
  },
  uiCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: layout.cardPadding,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  uiTitle: {
    ...textStyles.h2,
    marginBottom: spacing.xxs,
  },
  uiSubtitle: {
    ...textStyles.bodySmall,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  uiInputWrap: { marginBottom: spacing.sm },
  uiLabel: {
    ...textStyles.label,
    marginBottom: spacing.xs,
  },
  uiInput: {
    ...textStyles.input,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.input,
    paddingHorizontal: layout.inputPaddingX,
    minHeight: layout.inputHeight,
    paddingVertical: spacing.sm,
  },
  uiBtn: {
    borderRadius: radius.button,
    minHeight: layout.buttonHeight,
    paddingHorizontal: layout.buttonPaddingX,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  uiBtnLarge: {
    minHeight: layout.buttonHeightProminent,
  },
  uiBtnPrimary: { backgroundColor: colors.primary },
  uiBtnSecondary: { backgroundColor: colors.primaryDark },
  uiBtnOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  uiBtnDanger: { backgroundColor: colors.danger },
  uiBtnDisabled: { opacity: 0.6 },
  uiBtnPressed: { opacity: 0.85 },
  uiBtnText: textStyles.button,
  uiBtnTextLarge: textStyles.buttonLarge,
  uiCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  uiError: textStyles.error,
  uiStatCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  uiStatCardAccent: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  uiStatLabel: {
    ...typeScale.captionMedium,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  uiStatValue: {
    ...typeScale.h3,
    color: colors.text,
  },
  uiStatValueAccent: { color: '#fff' },
});
