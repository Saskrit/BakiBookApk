import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import {
  configureGoogleSignIn,
  getGoogleIdToken,
  getGoogleSignInErrorMessage,
  isGoogleSignInAvailable,
} from '../../utils/googleSignIn';
import { colors } from '../../theme/colors';
import { radius } from '../../theme/radius';

type Props = {
  disabled?: boolean;
  onCredential: (credential: string) => void | Promise<void>;
  onError?: (message: string) => void;
};

function GoogleLogo({ size = 22 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <Path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <Path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <Path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </Svg>
  );
}

export default function GoogleSignInButton({ disabled, onCredential, onError }: Props) {
  const [loading, setLoading] = useState(false);
  const available = isGoogleSignInAvailable();

  useEffect(() => {
    if (available) configureGoogleSignIn();
  }, [available]);

  const handlePress = useCallback(async () => {
    if (disabled || loading) return;
    setLoading(true);
    try {
      const credential = await getGoogleIdToken();
      await onCredential(credential);
    } catch (err) {
      onError?.(getGoogleSignInErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [disabled, loading, onCredential, onError]);

  if (!available) {
    return null;
  }

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={handlePress}
        disabled={disabled || loading}
        accessibilityRole="button"
        accessibilityLabel="Sign in with Google"
        style={({ pressed }) => [
          styles.button,
          (disabled || loading) && styles.buttonDisabled,
          pressed && styles.buttonPressed,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <GoogleLogo size={24} />
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
  },
  button: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  buttonPressed: {
    backgroundColor: '#F7F7F7',
    opacity: 0.95,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
});
