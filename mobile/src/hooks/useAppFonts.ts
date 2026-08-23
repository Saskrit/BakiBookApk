import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { useEffect } from 'react';
import { Text, TextInput } from 'react-native';
import { MAX_FONT_SCALE } from '../theme/scale';
import { fonts } from '../theme/typography';

export function useAppFonts(): boolean {
  const [loaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (!loaded) return;
    const defaultFont = { fontFamily: fonts.regular };
    const textDefaults = Text as typeof Text & {
      defaultProps?: { style?: object; maxFontSizeMultiplier?: number };
    };
    const inputDefaults = TextInput as typeof TextInput & {
      defaultProps?: { style?: object; maxFontSizeMultiplier?: number };
    };
    textDefaults.defaultProps = {
      ...textDefaults.defaultProps,
      style: defaultFont,
      maxFontSizeMultiplier: MAX_FONT_SCALE,
    };
    inputDefaults.defaultProps = {
      ...inputDefaults.defaultProps,
      style: defaultFont,
      maxFontSizeMultiplier: MAX_FONT_SCALE,
    };
  }, [loaded]);

  return loaded;
}
