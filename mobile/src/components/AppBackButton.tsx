import { Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../theme/colors';
import { radius } from '../theme/radius';

type Variant = 'default' | 'plain' | 'onDark';

type Props = {
  onPress: () => void;
  variant?: Variant;
  showLabel?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  accessibilityLabel?: string;
};

const CHEVRON = {
  default: '#1E293B',
  plain: '#1E293B',
  onDark: 'rgba(255,255,255,0.95)',
} as const;

export default function AppBackButton({
  onPress,
  variant = 'default',
  showLabel = false,
  disabled = false,
  style,
  accessibilityLabel,
}: Props) {
  const { t } = useTranslation();
  const stroke = CHEVRON[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || t('common.back')}
      style={({ pressed }) => [
        styles.base,
        variant === 'default' && styles.boxed,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
        <Path
          d="M15 6 L9 12 L15 18"
          stroke={stroke}
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
      {showLabel ? (
        <Text
          style={[
            styles.label,
            variant === 'onDark' ? styles.labelOnDark : styles.labelDefault,
          ]}
        >
          {t('common.back')}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    minWidth: 40,
    minHeight: 40,
    justifyContent: 'center',
  },
  boxed: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0 },
  label: { fontSize: 16, fontWeight: '600' },
  labelDefault: { color: colors.text },
  labelOnDark: { color: 'rgba(255,255,255,0.95)' },
});
