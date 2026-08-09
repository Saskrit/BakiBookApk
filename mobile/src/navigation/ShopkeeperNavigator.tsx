import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BottomTabBarButtonProps, createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import DashboardScreen from '../screens/shopkeeper/DashboardScreen';
import CustomersScreen from '../screens/shopkeeper/CustomersScreen';
import QRScannerScreen from '../screens/shared/QRScannerScreen';
import ReportsScreen from '../screens/shopkeeper/ReportsScreen';
import SettingsScreen from '../screens/shopkeeper/SettingsScreen';
import { colors } from '../theme/colors';
import type { ShopkeeperTabParamList } from './types';

const Tab = createBottomTabNavigator<ShopkeeperTabParamList>();

function TabIcon({ name, focused }: { name: keyof ShopkeeperTabParamList; focused: boolean }) {
  const tint = focused ? colors.primary : colors.textMuted;
  const icons: Record<keyof ShopkeeperTabParamList, ReactNode> = {
    Dashboard: (
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
        <Path d="M4 10 L12 4 L20 10 V19 C20 19.55 19.55 20 19 20 H5 C4.45 20 4 19.55 4 19 Z" stroke={tint} strokeWidth={2} />
      </Svg>
    ),
    Customers: (
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
        <Circle cx={9} cy={8} r={3} stroke={tint} strokeWidth={2} />
        <Path d="M3 19 C3 15 6 13 9 13" stroke={tint} strokeWidth={2} />
        <Circle cx={17} cy={9} r={2.5} stroke={tint} strokeWidth={2} />
      </Svg>
    ),
    Scan: (
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
        <Rect x={4} y={4} width={7} height={7} stroke={tint} strokeWidth={2} />
        <Rect x={13} y={13} width={7} height={7} stroke={tint} strokeWidth={2} />
      </Svg>
    ),
    Reports: (
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
        <Path d="M6 19 V11 M12 19 V5 M18 19 V14" stroke={tint} strokeWidth={2} strokeLinecap="round" />
      </Svg>
    ),
    Settings: (
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
        <Circle cx={12} cy={12} r={3} stroke={tint} strokeWidth={2} />
        <Path
          d="M12 3 V5 M12 19 V21 M3 12 H5 M19 12 H21 M5.6 5.6 L7 7 M17 17 L18.4 18.4 M5.6 18.4 L7 17 M17 7 L18.4 5.6"
          stroke={tint}
          strokeWidth={2}
          strokeLinecap="round"
        />
      </Svg>
    ),
  };
  return icons[name];
}

function AddTabButton({ onPress }: BottomTabBarButtonProps) {
  return (
    <Pressable onPress={onPress} style={styles.addBtnWrap}>
      <View style={styles.addBtn}>
        <Text style={styles.addBtnText}>+</Text>
      </View>
    </Pressable>
  );
}

export default function ShopkeeperNavigator() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: '#FFFFFF' },
        headerTitleStyle: { color: colors.primaryDark, fontWeight: '700' },
        headerShadowVisible: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: colors.border,
          height: 62 + insets.bottom,
          paddingBottom: insets.bottom + 4,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
        tabBarIcon: ({ focused }) => (
          <TabIcon name={route.name as keyof ShopkeeperTabParamList} focused={focused} />
        ),
      })}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ headerShown: false, tabBarLabel: t('nav.home') }}
      />
      <Tab.Screen
        name="Customers"
        component={CustomersScreen}
        options={{ headerShown: false, title: t('nav.customers'), tabBarLabel: t('nav.customers') }}
      />
      <Tab.Screen
        name="Scan"
        component={QRScannerScreen}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            e.preventDefault();
            navigation.getParent()?.navigate('AddCredit');
          },
        })}
        options={{
          title: t('nav.addCredit'),
          tabBarLabel: t('nav.add'),
          tabBarButton: (props) => <AddTabButton {...props} />,
        }}
      />
      <Tab.Screen
        name="Reports"
        component={ReportsScreen}
        options={{ headerShown: false, title: t('nav.reports'), tabBarLabel: t('nav.reports') }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ headerShown: false, tabBarLabel: t('nav.more') }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  addBtnWrap: {
    top: -18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '300',
    lineHeight: 34,
    marginTop: -2,
  },
});
