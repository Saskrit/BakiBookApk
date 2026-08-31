import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  ImageSourcePropType,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';

const HERO_IMAGES: ImageSourcePropType[] = [
  require('../../../assets/splash/herosplash1.png'),
  require('../../../assets/splash/herosplash2.png'),
  require('../../../assets/splash/herosplash3.png'),
  require('../../../assets/splash/herosplash4.png'),
];

/** Exactly 2 seconds per hero × 4 photos = 8s splash. */
export const HERO_SLIDE_MS = 2000;
export const HERO_COUNT = HERO_IMAGES.length;
export const HERO_SEQUENCE_MS = HERO_SLIDE_MS * HERO_COUNT;

const FADE_MS = 350;

type Props = {
  /** When true, stop swapping and hold the last hero. */
  frozen?: boolean;
};

/**
 * Plays herosplash1–4 in order on a fixed 2s clock (total 8s).
 * Index is driven by wall-clock time so it cannot skip or rush.
 */
export default function SplashHeroCarousel({ frozen = false }: Props) {
  const { width, height } = useWindowDimensions();
  const [activeIndex, setActiveIndex] = useState(0);
  const [outgoingIndex, setOutgoingIndex] = useState<number | null>(null);
  const startedAtRef = useRef(Date.now());
  const lastIndexRef = useRef(0);

  const opacity = useRef(new Animated.Value(1)).current;
  const outgoingOpacity = useRef(new Animated.Value(0)).current;
  const floatY = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;

  const heroSize = useMemo(() => {
    const maxW = Math.min(width - 24, 420);
    const maxH = Math.min(height * 0.48, 440);
    return Math.min(maxW, maxH);
  }, [width, height]);

  useEffect(() => {
    const bob = Animated.loop(
      Animated.sequence([
        Animated.timing(floatY, {
          toValue: -6,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatY, {
          toValue: 4,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.02,
          duration: 2600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 2600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    bob.start();
    pulse.start();
    return () => {
      bob.stop();
      pulse.stop();
    };
  }, [floatY, scale]);

  useEffect(() => {
    if (frozen) return undefined;

    startedAtRef.current = Date.now();
    lastIndexRef.current = 0;
    setActiveIndex(0);
    setOutgoingIndex(null);
    opacity.setValue(1);

    const tick = () => {
      const elapsed = Date.now() - startedAtRef.current;
      const nextIndex = Math.min(
        HERO_IMAGES.length - 1,
        Math.floor(elapsed / HERO_SLIDE_MS)
      );
      if (nextIndex === lastIndexRef.current) return;

      const previous = lastIndexRef.current;
      lastIndexRef.current = nextIndex;
      setOutgoingIndex(previous);
      outgoingOpacity.setValue(1);
      opacity.setValue(0);
      setActiveIndex(nextIndex);

      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: FADE_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(outgoingOpacity, {
          toValue: 0,
          duration: FADE_MS,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) setOutgoingIndex(null);
      });
    };

    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, [frozen, opacity, outgoingOpacity]);

  return (
    <View style={[styles.wrap, { width: heroSize, height: heroSize }]}>
      {outgoingIndex != null ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.layer,
            {
              opacity: outgoingOpacity,
              transform: [{ translateY: floatY }, { scale }],
            },
          ]}
        >
          <Image source={HERO_IMAGES[outgoingIndex]} style={styles.image} resizeMode="contain" />
        </Animated.View>
      ) : null}

      <Animated.View
        style={[
          styles.layer,
          {
            opacity,
            transform: [{ translateY: floatY }, { scale }],
          },
        ]}
      >
        <Image
          source={HERO_IMAGES[activeIndex]}
          style={styles.image}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
  },
  layer: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
