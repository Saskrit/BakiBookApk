import { Dimensions, PixelRatio } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/** Typical Android phone width used as the design baseline */
const BASE_WIDTH = 360;

/**
 * Extra-compact UI scale for all phones.
 * Small (~320) → ~0.78, normal (360) → 0.84, large (~430) → 0.88
 */
export const uiScale = Math.min(1.05, Math.max(0.92, SCREEN_WIDTH / BASE_WIDTH)) * 0.84;

export function s(size: number): number {
  return Math.round(PixelRatio.roundToNearestPixel(size * uiScale));
}

/** Cap system font scaling so layouts don't overflow on large accessibility sizes */
export const MAX_FONT_SCALE = 1.1;
