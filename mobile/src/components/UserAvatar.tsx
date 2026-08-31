import { Image } from 'expo-image';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { getInitials } from '../utils/format';
import { colors } from '../theme/colors';

type Props = {
  uri?: string | null;
  name?: string;
  size: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
  fallbackBg?: string;
  fallbackColor?: string;
  fontSize?: number;
};

function publicUri(uri?: string | null) {
  const value = uri?.trim() || '';
  if (!value) return '';
  if (/^http:\/\/.*cloudinary\.com/i.test(value)) {
    return value.replace(/^http:\/\//i, 'https://');
  }
  return value;
}

/**
 * Same as web `<img src={profileImage} />`.
 * Uses expo-image so Android still paints remote URLs inside overflow:hidden headers.
 */
export default function UserAvatar({
  uri,
  name = '',
  size,
  borderRadius,
  style,
  fallbackBg = colors.primary,
  fallbackColor = '#FFFFFF',
  fontSize,
}: Props) {
  const src = publicUri(uri);
  const radius = borderRadius ?? size / 2;
  const canShow =
    src.startsWith('https://') ||
    src.startsWith('http://') ||
    src.startsWith('file:') ||
    src.startsWith('content:') ||
    src.startsWith('data:');

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: canShow ? 'transparent' : fallbackBg,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      {canShow ? (
        <Image
          source={{ uri: src }}
          accessibilityLabel={name || 'Profile photo'}
          contentFit="cover"
          cachePolicy="memory-disk"
          recyclingKey={src}
          style={{ width: size, height: size, borderRadius: radius }}
        />
      ) : (
        <Text
          style={[
            styles.initials,
            { color: fallbackColor, fontSize: fontSize ?? Math.round(size * 0.38) },
          ]}
        >
          {getInitials(name || 'U')}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  initials: {
    fontWeight: '800',
  },
});
