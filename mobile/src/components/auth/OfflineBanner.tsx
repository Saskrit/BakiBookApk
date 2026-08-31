import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { getDeviceOnlineSync, subscribeDeviceNetwork } from '../../utils/deviceNetwork';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

/** Visible warning when the device has no internet connection. */
export default function OfflineBanner() {
  const { t } = useTranslation();
  const [online, setOnline] = useState(getDeviceOnlineSync);

  useEffect(() => subscribeDeviceNetwork(setOnline), []);

  if (online) return null;

  return (
    <View style={styles.banner} accessibilityRole="alert">
      <Text style={styles.text}>{t('errors.noInternet')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 10,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
    marginBottom: spacing.sm,
  },
  text: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    textAlign: 'center',
  },
});
