import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNotifications } from '../contexts/NotificationContext';
import type { RootStackParamList } from '../navigation/types';

type Props = {
  tint?: string;
  badgeColor?: string;
};

export default function NotificationBell({
  tint = '#FFFFFF',
  badgeColor = '#C45C5C',
}: Props) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { unreadCount } = useNotifications();

  return (
    <Pressable
      onPress={() => navigation.navigate('Notifications')}
      style={nbStyles.nbBtn}
      hitSlop={8}
      accessibilityLabel="Notifications"
    >
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
        <Path
          d="M12 4 C8 4 5 7 5 10 C5 16 3 17 3 17 H21 C21 17 19 16 19 10 C19 7 16 4 12 4 Z"
          stroke={tint}
          strokeWidth={2}
        />
        <Path d="M10 19 C10.5 20.5 11.2 21 12 21 C12.8 21 13.5 20.5 14 19" stroke={tint} strokeWidth={2} />
      </Svg>
      {unreadCount > 0 ? (
        <View style={[nbStyles.nbBadge, { backgroundColor: badgeColor }]}>
          <Text style={nbStyles.nbBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const nbStyles = StyleSheet.create({
  nbBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nbBadge: {
    position: 'absolute',
    top: 4,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  nbBadgeText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '800',
  },
});
