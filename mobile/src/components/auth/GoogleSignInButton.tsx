import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  configureGoogleSignIn,
  getGoogleIdToken,
  getGoogleSignInErrorMessage,
  isGoogleSignInAvailable,
} from '../../utils/googleSignIn';
import { colors } from '../../theme/colors';

type Props = {
  disabled?: boolean;
  onCredential: (credential: string) => void | Promise<void>;
  onError?: (message: string) => void;
};

export default function GoogleSignInButton({ disabled, onCredential, onError }: Props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const available = isGoogleSignInAvailable();

  const GoogleSigninButton = useMemo(() => {
    if (!available) return null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require('@react-native-google-signin/google-signin').GoogleSigninButton;
    } catch {
      return null;
    }
  }, [available]);

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

  if (!available || !GoogleSigninButton) {
    return null;
  }

  return (
    <View style={gsStyles.gsWrap}>
      {loading ? (
        <View style={gsStyles.gsLoadingRow}>
          <ActivityIndicator color={colors.primary} />
          <Text style={gsStyles.gsLoadingText}>{t('auth.signingInWithGoogle')}</Text>
        </View>
      ) : (
        <GoogleSigninButton
          size={GoogleSigninButton.Size.Wide}
          color={GoogleSigninButton.Color.Light}
          onPress={handlePress}
          disabled={disabled}
          style={gsStyles.gsBtn}
        />
      )}
    </View>
  );
}

const gsStyles = StyleSheet.create({
  gsWrap: {
    marginBottom: 4,
  },
  gsBtn: {
    width: '100%',
    height: 48,
  },
  gsLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
  },
  gsLoadingText: {
    fontSize: 14,
    color: colors.textMuted,
  },
});
