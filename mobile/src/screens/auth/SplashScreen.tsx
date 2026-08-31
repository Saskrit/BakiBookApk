import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Image,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import SplashBackground from '../../components/splash/SplashBackground';
import SplashHeroCarousel, { HERO_SEQUENCE_MS } from '../../components/splash/SplashHeroCarousel';
import { colors } from '../../theme/colors';
import { s } from '../../theme/scale';
import { typeScale } from '../../theme/typography';
import { spacing } from '../../theme/spacing';
import { preloadSessionCache } from '../../utils/sessionCache';
import { warmAuthDuringSplash } from '../../utils/warmApi';

import type { RootStackParamList } from '../../navigation/types';

type StackProps = NativeStackScreenProps<RootStackParamList, 'Splash'>;

type Props = Partial<StackProps> & {
  /** Boot gate: called after full 8s sequence (and auth ready). No navigation. */
  onBootComplete?: () => void;
};

const LOGO = require('../../../assets/icon.png');

/** 4 heroes × 2s each — never leave early. */
const SPLASH_PROGRESS_MS = HERO_SEQUENCE_MS;
const SPLASH_HOLD_AT_100_MS = 250;

export default function SplashScreen({ navigation, onBootComplete }: Props) {
  const { t } = useTranslation();
  const { user, loading } = useAuth();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const progress = useRef(new Animated.Value(0)).current;
  const hasFinished = useRef(false);
  const [progressDone, setProgressDone] = useState(false);
  const [warmupDone, setWarmupDone] = useState(false);
  const [percentLabel, setPercentLabel] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const startedAt = Date.now();

    void (async () => {
      await Promise.allSettled([
        warmAuthDuringSplash(SPLASH_PROGRESS_MS),
        preloadSessionCache(),
      ]);
      const remaining = SPLASH_PROGRESS_MS - (Date.now() - startedAt);
      if (remaining > 0) {
        await new Promise((resolve) => setTimeout(resolve, remaining));
      }
      if (!cancelled) setWarmupDone(true);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    progress.setValue(0);
    setPercentLabel(0);

    const listenerId = progress.addListener(({ value }) => {
      setPercentLabel(Math.min(100, Math.round(value * 100)));
    });

    Animated.timing(progress, {
      toValue: 1,
      duration: SPLASH_PROGRESS_MS,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) {
        setPercentLabel(100);
        setProgressDone(true);
      }
    });

    return () => {
      progress.removeListener(listenerId);
    };
  }, [progress]);

  useEffect(() => {
    // Full 8s + auth resolved before leaving splash.
    if (loading || !progressDone || !warmupDone || hasFinished.current) return;

    const timer = setTimeout(() => {
      if (hasFinished.current) return;
      hasFinished.current = true;
      if (onBootComplete) {
        onBootComplete();
        return;
      }
      if (!navigation) return;
      if (!user) {
        navigation.replace('Login');
        return;
      }
      navigation.replace(user.role === 'shopkeeper' ? 'Shopkeeper' : 'Customer');
    }, SPLASH_HOLD_AT_100_MS);

    return () => clearTimeout(timer);
  }, [loading, progressDone, warmupDone, user, navigation, onBootComplete]);

  const barFillWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const progressBarWidth = Math.min(width - 64, 320);

  return (
    <View style={spStyles.spContainer}>
      <StatusBar style="dark" />
      <SplashBackground />

      <View style={[spStyles.spContent, { paddingTop: insets.top + 20 }]}>
        <Image
          source={LOGO}
          style={spStyles.spLogo}
          resizeMode="contain"
          accessibilityLabel={t('splash.logoA11y')}
        />
        <Text style={spStyles.spBrandName}>
          <Text style={spStyles.spBrandBaki}>Baki</Text>
          <Text style={spStyles.spBrandBook}>Book</Text>
        </Text>

        <View style={spStyles.spSeparator}>
          <View style={spStyles.spSeparatorDot} />
          <View style={spStyles.spSeparatorLine} />
          <View style={[spStyles.spSeparatorDot, spStyles.spSeparatorDotCenter]} />
          <View style={spStyles.spSeparatorLine} />
          <View style={spStyles.spSeparatorDot} />
        </View>

        <Text style={spStyles.spTagline}>{t('splash.tagline')}</Text>

        <View style={spStyles.spHeroSlot}>
          <SplashHeroCarousel frozen={percentLabel >= 100} />
        </View>
      </View>

      <View style={[spStyles.spBottom, { paddingBottom: insets.bottom + 28 }]}>
        <Text style={spStyles.spBottomTagline}>
          {percentLabel < 100 ? t('splash.loadingCache') : t('auth.tagline')}
        </Text>
        <View style={[spStyles.spProgressTrack, { width: progressBarWidth }]}>
          <Animated.View style={[spStyles.spProgressFill, { width: barFillWidth }]} />
        </View>
        <Text style={spStyles.spProgressPercent}>{percentLabel}%</Text>
      </View>
    </View>
  );
}

const spStyles = StyleSheet.create({
  spContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  spContent: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  spLogo: {
    width: s(56),
    height: s(56),
    marginBottom: 8,
  },
  spBrandName: {
    fontSize: typeScale.display.fontSize,
    lineHeight: typeScale.display.lineHeight,
    fontFamily: typeScale.display.fontFamily,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  spBrandBaki: {
    color: colors.text,
  },
  spBrandBook: {
    color: colors.primary,
  },
  spSeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 8,
    gap: 0,
  },
  spSeparatorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  spSeparatorLine: {
    width: 32,
    height: 2,
    backgroundColor: colors.primary,
  },
  spSeparatorDotCenter: {
    marginHorizontal: 4,
  },
  spTagline: {
    fontSize: typeScale.body.fontSize,
    lineHeight: typeScale.body.lineHeight,
    color: colors.textMuted,
    textAlign: 'center',
    maxWidth: 280,
    marginBottom: spacing.sm,
  },
  spHeroSlot: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 200,
  },
  spBottom: {
    alignItems: 'center',
    paddingHorizontal: 32,
    zIndex: 1,
  },
  spBottomTagline: {
    fontSize: 13,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: spacing.md,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  spProgressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.35)',
    overflow: 'hidden',
  },
  spProgressFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
  },
  spProgressPercent: {
    marginTop: 8,
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '600',
  },
});
