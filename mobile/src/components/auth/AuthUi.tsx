import type { ReactNode } from 'react';
import { Image, Platform, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { colors } from '../../theme/colors';

export const LOGO = require('../../../assets/android-icon-foreground.png');

export function EmailIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={5} width={18} height={14} rx={2} stroke={colors.primary} strokeWidth={2} />
      <Path d="M3 7 L12 13 L21 7" stroke={colors.primary} strokeWidth={2} />
    </Svg>
  );
}

export function LockIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Rect x={5} y={11} width={14} height={10} rx={2} stroke={colors.primary} strokeWidth={2} />
      <Path
        d="M8 11 V8 C8 5.79 9.79 4 12 4 C14.21 4 16 5.79 16 8 V11"
        stroke={colors.primary}
        strokeWidth={2}
      />
    </Svg>
  );
}

export function UserIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={8} r={4} stroke={colors.primary} strokeWidth={2} />
      <Path
        d="M5 20 C5 16.13 8.13 13 12 13 C15.87 13 19 16.13 19 20"
        stroke={colors.primary}
        strokeWidth={2}
      />
    </Svg>
  );
}

export function EyeIcon({ visible }: { visible: boolean }) {
  if (visible) {
    return (
      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
        <Path
          d="M2 12 C5 6 19 6 22 12 C19 18 5 18 2 12 Z"
          stroke={colors.textMuted}
          strokeWidth={2}
        />
        <Circle cx={12} cy={12} r={3} stroke={colors.textMuted} strokeWidth={2} />
      </Svg>
    );
  }
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M3 3 L21 21" stroke={colors.textMuted} strokeWidth={2} />
      <Path
        d="M2 12 C5 6 19 6 22 12 C20 15 17 17 12 17"
        stroke={colors.textMuted}
        strokeWidth={2}
      />
    </Svg>
  );
}

function ShieldIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3 L20 7 V12 C20 17 16.5 20.5 12 21 C7.5 20.5 4 17 4 12 V7 Z"
        stroke={colors.primary}
        strokeWidth={1.8}
      />
      <Path d="M9 12 L11 14 L15 10" stroke={colors.primary} strokeWidth={1.8} />
    </Svg>
  );
}

function CloudIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path
        d="M7 18 H17 C19.21 18 21 16.21 21 14 C21 12.13 19.84 10.53 18.2 9.92 C17.76 6.61 14.87 4 11.5 4 C8.46 4 5.92 6.08 5.18 8.88 C3.47 9.38 2.25 11.02 2.25 12.96 C2.25 15.68 4.52 17.88 7.24 17.99"
        stroke={colors.primary}
        strokeWidth={1.8}
      />
      <Path d="M12 11 V16 M12 11 L10 13 M12 11 L14 13" stroke={colors.primary} strokeWidth={1.8} />
    </Svg>
  );
}

function HeadsetIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 12 V11 C4 6.58 7.58 3 12 3 C16.42 3 20 6.58 20 11 V12"
        stroke={colors.primary}
        strokeWidth={1.8}
      />
      <Rect x={2} y={12} width={4} height={7} rx={2} stroke={colors.primary} strokeWidth={1.8} />
      <Rect x={18} y={12} width={4} height={7} rx={2} stroke={colors.primary} strokeWidth={1.8} />
      <Path d="M6 19 C8 21 16 21 18 19" stroke={colors.primary} strokeWidth={1.8} />
    </Svg>
  );
}

function FooterFeature({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <View style={authStyles.footerFeature}>
      {icon}
      <Text style={authStyles.footerLabel}>{label}</Text>
    </View>
  );
}

export function AuthHeader() {
  const { t } = useTranslation();
  return (
    <View style={authStyles.header}>
      <Image source={LOGO} style={authStyles.logo} resizeMode="contain" accessibilityLabel={t('splash.logoA11y')} />
      <Text style={authStyles.brandName}>BakiBook</Text>
      <Text style={authStyles.tagline}>{t('auth.tagline')}</Text>
    </View>
  );
}

export function AuthFooter() {
  const { t } = useTranslation();
  return (
    <View style={authStyles.footer}>
      <FooterFeature icon={<ShieldIcon />} label={t('auth.secureSafe')} />
      <View style={authStyles.footerDivider} />
      <FooterFeature icon={<CloudIcon />} label={t('auth.dailyBackups')} />
      <View style={authStyles.footerDivider} />
      <FooterFeature icon={<HeadsetIcon />} label={t('auth.support247')} />
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

export const authStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  flex: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logo: {
    width: 72,
    height: 72,
    marginBottom: 10,
  },
  brandName: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: 0.2,
  },
  tagline: {
    marginTop: 6,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#1A1A1A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(232, 224, 224, 0.6)',
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 20,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    marginBottom: 16,
    gap: 10,
    backgroundColor: '#FAFAFA',
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    padding: 0,
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnDisabled: {
    opacity: 0.7,
  },
  primaryBtnPressed: {
    opacity: 0.9,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  primaryBtnArrow: {
    position: 'absolute',
    right: 20,
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  altRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
    flexWrap: 'wrap',
  },
  altText: {
    fontSize: 13,
    color: colors.textMuted,
  },
  altLink: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 32,
    paddingHorizontal: 4,
  },
  footerFeature: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  footerLabel: {
    fontSize: 10,
    color: colors.textMuted,
    textAlign: 'center',
    fontWeight: '500',
  },
  footerDivider: {
    width: 1,
    height: 36,
    backgroundColor: colors.border,
  },
  backBtn: {
    alignSelf: 'flex-start',
    marginBottom: 8,
    padding: 4,
  },
  orDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 18,
    gap: 12,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  orText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
