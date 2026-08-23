import { s } from './scale';
import { spacing } from './spacing';

export const layout = {
  screenPaddingX: spacing.md,
  screenPaddingXWide: spacing.lg,
  screenPaddingTop: spacing.md,
  screenPaddingBottom: spacing.md,

  appBarHeight: s(44),
  tabBarHeight: s(48),

  buttonHeight: s(38),
  buttonHeightProminent: s(40),
  buttonPaddingX: spacing.md,

  inputHeight: s(38),
  inputPaddingX: spacing.md,

  touchTarget: s(38),
  iconTouchTarget: s(38),

  cardPadding: spacing.md,
  sectionGap: spacing.sm,
  titleToSubtitle: spacing.xxs,
  subtitleToContent: spacing.md,
} as const;
