import type { ReactNode } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import MyDueScreen from '../screens/customer/MyDueScreen';
import LedgerScreen from '../screens/customer/LedgerScreen';
import PaymentsScreen from '../screens/customer/PaymentsScreen';
import ShopsScreen from '../screens/customer/ShopsScreen';
import ProfileScreen from '../screens/customer/ProfileScreen';
import { customerColors as c } from '../theme/customerColors';
import { iconSize } from '../theme/icons';
import { layout } from '../theme/layout';
import { typeScale } from '../theme/typography';
import type { CustomerTabParamList } from './types';

const Tab = createBottomTabNavigator<CustomerTabParamList>();

function TabIcon({ name, focused }: { name: keyof CustomerTabParamList; focused: boolean }) {
  const tint = focused ? c.peachDark : c.textMuted;
  const icons: Record<keyof CustomerTabParamList, ReactNode> = {
    Home: (
      <Svg width={iconSize.md} height={iconSize.md} viewBox="0 0 24 24" fill="none">
        <Path
          d="M4 10 L12 4 L20 10 V19 C20 19.55 19.55 20 19 20 H5 C4.45 20 4 19.55 4 19 Z"
          stroke={tint}
          strokeWidth={2}
        />
      </Svg>
    ),
    Ledger: (
      <Svg width={iconSize.md} height={iconSize.md} viewBox="0 0 24 24" fill="none">
        <Rect x={5} y={3} width={14} height={18} rx={2} stroke={tint} strokeWidth={2} />
        <Path d="M8 8 H16 M8 12 H16 M8 16 H13" stroke={tint} strokeWidth={2} strokeLinecap="round" />
      </Svg>
    ),
    Payments: (
      <Svg width={iconSize.md} height={iconSize.md} viewBox="0 0 24 24" fill="none">
        <Rect x={3} y={6} width={18} height={12} rx={2} stroke={tint} strokeWidth={2} />
        <Path d="M3 10 H21" stroke={tint} strokeWidth={2} />
        <Circle cx={16} cy={14} r={1.5} fill={tint} />
      </Svg>
    ),
    Shops: (
      <Svg width={iconSize.md} height={iconSize.md} viewBox="0 0 24 24" fill="none">
        <Path
          d="M4 9 L5 4 H19 L20 9 M5 9 V19 H19 V9"
          stroke={tint}
          strokeWidth={2}
          strokeLinejoin="round"
        />
        <Path d="M9 19 V13 H15 V19" stroke={tint} strokeWidth={2} />
      </Svg>
    ),
    Profile: (
      <Svg width={iconSize.md} height={iconSize.md} viewBox="0 0 24 24" fill="none">
        <Circle cx={12} cy={8} r={3.5} stroke={tint} strokeWidth={2} />
        <Path
          d="M5 19 C5 15.5 8 13.5 12 13.5 C16 13.5 19 15.5 19 19"
          stroke={tint}
          strokeWidth={2}
        />
      </Svg>
    ),
  };
  return icons[name];
}

export default function CustomerNavigator() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: c.peachDark,
        tabBarInactiveTintColor: c.textMuted,
        tabBarStyle: {
          backgroundColor: c.white,
          borderTopColor: c.border,
          height: layout.tabBarHeight + insets.bottom,
          paddingBottom: insets.bottom + 4,
          paddingTop: 8,
        },
        tabBarLabelStyle: typeScale.navLabel,
        tabBarIcon: ({ focused }) => (
          <TabIcon name={route.name as keyof CustomerTabParamList} focused={focused} />
        ),
      })}
    >
      <Tab.Screen name="Home" component={MyDueScreen} options={{ tabBarLabel: t('nav.home') }} />
      <Tab.Screen
        name="Ledger"
        component={LedgerScreen}
        options={{ tabBarLabel: t('nav.myLedger') }}
      />
      <Tab.Screen
        name="Payments"
        component={PaymentsScreen}
        options={{ tabBarLabel: t('nav.payments') }}
      />
      <Tab.Screen name="Shops" component={ShopsScreen} options={{ tabBarLabel: t('nav.shops') }} />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarLabel: t('nav.profile') }}
      />
    </Tab.Navigator>
  );
}
