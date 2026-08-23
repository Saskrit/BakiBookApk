import { StyleSheet } from 'react-native';
import { colors } from './colors';
import { typeScale } from './typography';

/** Pre-built text styles with color hierarchy (palette unchanged) */
export const textStyles = StyleSheet.create({
  display: { ...typeScale.display, color: colors.text },
  h1: { ...typeScale.h1, color: colors.text },
  h2: { ...typeScale.h2, color: colors.text },
  h3: { ...typeScale.h3, color: colors.text },
  cardTitle: { ...typeScale.cardTitle, color: colors.text },
  body: { ...typeScale.body, color: colors.text },
  bodySmall: { ...typeScale.bodySmall, color: colors.text },
  caption: { ...typeScale.caption, color: colors.textMuted },
  captionMedium: { ...typeScale.captionMedium, color: colors.textMuted },
  label: { ...typeScale.label, color: colors.text },
  button: { ...typeScale.button, color: '#FFFFFF' },
  buttonLarge: { ...typeScale.buttonLarge, color: '#FFFFFF' },
  input: { ...typeScale.input, color: colors.text },
  navLabel: { ...typeScale.navLabel, color: colors.textMuted },
  appBarTitle: { ...typeScale.appBarTitle, color: colors.primaryDark },
  metadata: { ...typeScale.metadata, color: colors.textMuted },
  error: { ...typeScale.bodySmall, color: colors.danger },
  link: { ...typeScale.bodySmall, color: colors.primary, fontFamily: typeScale.label.fontFamily },
});
