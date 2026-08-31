import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { layout, spacing } from '../../theme';
import { authStyles } from './AuthUi';

type Props = {
  children: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  /** Extra bottom padding while the keyboard is open. */
  keyboardExtraBottom?: number;
};

/**
 * Auth screens: when the keyboard opens, content shifts from centered
 * to top-aligned and scrolls up so inputs stay visible above the keyboard.
 */
export default function AuthKeyboardLayout({
  children,
  contentContainerStyle,
  keyboardExtraBottom = spacing.xl,
}: Props) {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = () => {
      setKeyboardOpen(true);
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ y: 0, animated: true });
      });
    };
    const onHide = () => setKeyboardOpen(false);

    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return (
    <KeyboardAvoidingView
      style={authStyles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        ref={scrollRef}
        style={authStyles.flex}
        contentContainerStyle={[
          styles.scrollContent,
          {
            justifyContent: keyboardOpen ? 'flex-start' : 'center',
            paddingHorizontal: Math.max(layout.screenPaddingXWide, 20),
            paddingTop: keyboardOpen
              ? insets.top + spacing.sm
              : insets.top + spacing.xl,
            paddingBottom: keyboardOpen
              ? keyboardExtraBottom + spacing.md
              : insets.bottom + spacing.md,
          },
          contentContainerStyle,
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        bounces={false}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
  },
});
