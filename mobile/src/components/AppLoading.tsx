import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors } from '../theme/colors';
import { typeScale } from '../theme/typography';

const LOGO = require('../../assets/icon.png');

type Props = {
  accent?: string;
  label?: string;
};

export default function AppLoading({ accent = colors.primary, label }: Props) {
  const { t } = useTranslation();
  return (
    <View style={alStyles.wrap}>
      <Image source={LOGO} style={alStyles.logo} resizeMode="contain" accessibilityLabel={t('splash.logoA11y')} />
      <ActivityIndicator size="large" color={accent} style={alStyles.spinner} />
      <Text style={alStyles.label}>{label ?? t('common.loading')}</Text>
    </View>
  );
}

const alStyles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 12,
  },
  logo: {
    width: 56,
    height: 56,
  },
  spinner: {
    marginTop: 4,
  },
  label: {
    fontSize: typeScale.body.fontSize,
    color: colors.textMuted,
    fontWeight: '600',
  },
});
