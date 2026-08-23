import { Image, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import {
  colors,
  layout,
  radius,
  spacing,
  uiScale,
} from '../../theme';

export const LOGO = require('../../../assets/icon.png');

/** Milder scale for auth screens — global UI scale is too compact here. */
function asz(size: number) {
  const factor = Math.min(1.1, Math.max(0.98, uiScale / 0.84));
  return Math.round(size * factor);
}

const AUTH_ICON = asz(22);

export function EmailIcon() {
  return (
    <Svg width={AUTH_ICON} height={AUTH_ICON} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={5} width={18} height={14} rx={2} stroke={colors.primary} strokeWidth={2} />
      <Path
        d="M4 7 L12 13 L20 7"
        stroke={colors.primary}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function LockIcon() {
  return (
    <Svg width={AUTH_ICON} height={AUTH_ICON} viewBox="0 0 24 24" fill="none">
      <Rect x={5} y={10} width={14} height={11} rx={2} stroke={colors.primary} strokeWidth={2} />
      <Path
        d="M8 10 V8 A4 4 0 0 1 16 8 V10"
        stroke={colors.primary}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function UserIcon() {
  return (
    <Svg width={AUTH_ICON} height={AUTH_ICON} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={8} r={4} stroke={colors.primary} strokeWidth={2} />
      <Path
        d="M5 20 C5 16.2 8.1 13 12 13 C15.9 13 19 16.2 19 20"
        stroke={colors.primary}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function EyeIcon({ visible }: { visible: boolean }) {
  return (
    <Svg width={AUTH_ICON} height={AUTH_ICON} viewBox="0 0 24 24" fill="none">
      <Path
        d="M2.5 12 C5.2 7.3 8.3 5.5 12 5.5 C15.7 5.5 18.8 7.3 21.5 12 C18.8 16.7 15.7 18.5 12 18.5 C8.3 18.5 5.2 16.7 2.5 12 Z"
        stroke={colors.textMuted}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {visible ? (
        <Circle cx={12} cy={12} r={2.8} stroke={colors.textMuted} strokeWidth={1.8} />
      ) : (
        <Path d="M4 4 L20 20" stroke={colors.textMuted} strokeWidth={2} strokeLinecap="round" />
      )}
    </Svg>
  );
}

export function StoreIcon() {
  return (
    <Svg width={asz(26)} height={asz(26)} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 10 L5.5 5 H18.5 L20 10 C20 11.7 18.7 13 17 13 C15.9 13 15 12.5 14.5 11.7 C14 12.5 13.1 13 12 13 C10.9 13 10 12.5 9.5 11.7 C9 12.5 8.1 13 7 13 C5.3 13 4 11.7 4 10 Z"
        stroke={colors.primary}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      <Path d="M5 12.5 V20 H19 V12.5" stroke={colors.primary} strokeWidth={1.8} />
      <Path d="M10 20 V16 H14 V20" stroke={colors.primary} strokeWidth={1.8} />
    </Svg>
  );
}

export function PersonRoleIcon() {
  return (
    <Svg width={asz(26)} height={asz(26)} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={7.5} r={3.5} stroke={colors.primary} strokeWidth={1.8} />
      <Path
        d="M5 20 C5 15.9 8 13.5 12 13.5 C16 13.5 19 15.9 19 20"
        stroke={colors.primary}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function AuthHeader({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();

  return (
    <View style={[authStyles.header, compact && authStyles.headerCompact]}>
      <Image
        source={LOGO}
        style={[authStyles.logo, compact && authStyles.logoCompact]}
        resizeMode="contain"
        accessibilityLabel="BakiBook"
      />
      <Text style={[authStyles.brandName, compact && authStyles.brandNameCompact]}>BakiBook</Text>
      <Text style={[authStyles.tagline, compact && authStyles.taglineCompact]}>
        {t('auth.tagline')}
      </Text>
    </View>
  );
}

export function OrDivider() {
  const { t } = useTranslation();

  return (
    <View style={authStyles.orDivider}>
      <View style={authStyles.orLine} />
      <Text style={authStyles.orText}>{t('auth.or')}</Text>
      <View style={authStyles.orLine} />
    </View>
  );
}

export function AuthFooter() {
  return null;
}

export const authStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Math.max(layout.screenPaddingXWide, 20),
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  headerCompact: {
    marginBottom: spacing.sm,
  },
  logo: {
    width: asz(64),
    height: asz(64),
    marginBottom: spacing.xs,
  },
  logoCompact: {
    width: asz(52),
    height: asz(52),
    marginBottom: 4,
  },
  brandName: {
    fontSize: asz(24),
    lineHeight: asz(30),
    fontWeight: '700',
    color: colors.primaryDark,
  },
  brandNameCompact: {
    fontSize: asz(22),
    lineHeight: asz(28),
    fontWeight: '700',
    color: colors.primaryDark,
  },
  tagline: {
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
    fontSize: asz(13),
    lineHeight: asz(18),
    color: colors.textMuted,
    textAlign: 'center',
  },
  taglineCompact: {
    marginTop: 2,
    fontSize: asz(12),
    lineHeight: asz(16),
  },
  card: {
    width: '100%',
    padding: asz(18),
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.container,
  },
  cardTitle: {
    fontSize: asz(20),
    lineHeight: asz(26),
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: asz(14),
    lineHeight: asz(20),
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  error: {
    fontSize: asz(13),
    lineHeight: asz(18),
    color: colors.danger,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  label: {
    fontSize: asz(13),
    lineHeight: asz(18),
    fontWeight: '600',
    color: colors.text,
    marginBottom: 6,
  },
  inputRow: {
    minHeight: asz(50),
    marginBottom: spacing.sm,
    paddingHorizontal: asz(14),
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.input,
  },
  input: {
    flex: 1,
    paddingVertical: 0,
    fontSize: asz(16),
    lineHeight: asz(22),
    color: colors.text,
  },
  primaryBtn: {
    minHeight: asz(52),
    paddingHorizontal: asz(18),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.button,
  },
  primaryBtnDisabled: {
    opacity: 0.55,
  },
  primaryBtnPressed: {
    backgroundColor: colors.primaryDark,
  },
  primaryBtnText: {
    fontSize: asz(16),
    lineHeight: asz(22),
    fontWeight: '700',
    color: colors.surface,
  },
  primaryBtnArrow: {
    position: 'absolute',
    right: asz(18),
    color: colors.surface,
    fontSize: asz(18),
  },
  altRow: {
    marginTop: spacing.md,
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  altText: {
    fontSize: asz(14),
    lineHeight: asz(20),
    color: colors.textMuted,
  },
  altLink: {
    fontSize: asz(14),
    lineHeight: asz(20),
    fontWeight: '700',
    color: colors.primary,
  },
  orDivider: {
    marginVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  orLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  orText: {
    fontSize: asz(13),
    lineHeight: asz(18),
    fontWeight: '600',
    color: colors.textMuted,
  },
  backBtn: {
    minWidth: asz(44),
    minHeight: asz(44),
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
});
