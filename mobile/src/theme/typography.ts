import type { TextStyle } from 'react-native';
import { s } from './scale';

export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semiBold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

export const fontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semiBold: '600' as const,
  bold: '700' as const,
};

/** Tight type scale — readable but compact on phones */
export const typeScale = {
  display: {
    fontSize: s(18),
    lineHeight: s(22),
    fontWeight: fontWeight.bold,
    fontFamily: fonts.bold,
  },
  h1: {
    fontSize: s(17),
    lineHeight: s(22),
    fontWeight: fontWeight.bold,
    fontFamily: fonts.bold,
  },
  h2: {
    fontSize: s(15),
    lineHeight: s(20),
    fontWeight: fontWeight.semiBold,
    fontFamily: fonts.semiBold,
  },
  h3: {
    fontSize: s(13),
    lineHeight: s(18),
    fontWeight: fontWeight.semiBold,
    fontFamily: fonts.semiBold,
  },
  cardTitle: {
    fontSize: s(13),
    lineHeight: s(17),
    fontWeight: fontWeight.semiBold,
    fontFamily: fonts.semiBold,
  },
  body: {
    fontSize: s(12),
    lineHeight: s(16),
    fontWeight: fontWeight.regular,
    fontFamily: fonts.regular,
  },
  bodySmall: {
    fontSize: s(11),
    lineHeight: s(15),
    fontWeight: fontWeight.regular,
    fontFamily: fonts.regular,
  },
  caption: {
    fontSize: s(10),
    lineHeight: s(13),
    fontWeight: fontWeight.regular,
    fontFamily: fonts.regular,
  },
  captionMedium: {
    fontSize: s(10),
    lineHeight: s(13),
    fontWeight: fontWeight.medium,
    fontFamily: fonts.medium,
  },
  button: {
    fontSize: s(12),
    lineHeight: s(16),
    fontWeight: fontWeight.semiBold,
    fontFamily: fonts.semiBold,
  },
  buttonLarge: {
    fontSize: s(13),
    lineHeight: s(16),
    fontWeight: fontWeight.semiBold,
    fontFamily: fonts.semiBold,
  },
  input: {
    fontSize: s(13),
    lineHeight: s(16),
    fontWeight: fontWeight.regular,
    fontFamily: fonts.regular,
  },
  label: {
    fontSize: s(11),
    lineHeight: s(14),
    fontWeight: fontWeight.medium,
    fontFamily: fonts.medium,
  },
  navLabel: {
    fontSize: s(9),
    lineHeight: s(12),
    fontWeight: fontWeight.medium,
    fontFamily: fonts.medium,
  },
  badge: {
    fontSize: s(10),
    lineHeight: s(13),
    fontWeight: fontWeight.medium,
    fontFamily: fonts.medium,
  },
  appBarTitle: {
    fontSize: s(14),
    lineHeight: s(18),
    fontWeight: fontWeight.semiBold,
    fontFamily: fonts.semiBold,
  },
  metadata: {
    fontSize: s(9),
    lineHeight: s(12),
    fontWeight: fontWeight.regular,
    fontFamily: fonts.regular,
  },
} as const satisfies Record<string, TextStyle>;

export const typography = {
  xs: typeScale.metadata.fontSize,
  sm: typeScale.caption.fontSize,
  caption: typeScale.caption.fontSize,
  body: typeScale.bodySmall.fontSize,
  bodyLg: typeScale.body.fontSize,
  md: typeScale.body.fontSize,
  lg: typeScale.cardTitle.fontSize,
  xxl: typeScale.cardTitle.fontSize,
  xl: typeScale.h3.fontSize,
  h3: typeScale.h3.fontSize,
  h2: typeScale.h2.fontSize,
  h1: typeScale.h1.fontSize,
  display: typeScale.display.fontSize,
} as const;

export const lineHeights = {
  xs: typeScale.metadata.lineHeight,
  sm: typeScale.caption.lineHeight,
  caption: typeScale.caption.lineHeight,
  body: typeScale.bodySmall.lineHeight,
  bodyLg: typeScale.body.lineHeight,
  md: typeScale.body.lineHeight,
  lg: typeScale.cardTitle.lineHeight,
  xxl: typeScale.cardTitle.lineHeight,
  xl: typeScale.h3.lineHeight,
  h3: typeScale.h3.lineHeight,
  h2: typeScale.h2.lineHeight,
  h1: typeScale.h1.lineHeight,
  display: typeScale.display.lineHeight,
} as const;
