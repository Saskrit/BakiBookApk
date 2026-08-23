import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import SplashScreen from '../screens/auth/SplashScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import VerifyEmailScreen from '../screens/auth/VerifyEmailScreen';
import ShopkeeperNavigator from './ShopkeeperNavigator';
import CustomerNavigator from './CustomerNavigator';
import AddCustomerScreen from '../screens/shopkeeper/AddCustomerScreen';
import CustomerProfileScreen from '../screens/shopkeeper/CustomerProfileScreen';
import AddCreditScreen from '../screens/shopkeeper/AddCreditScreen';
import RecordPaymentScreen from '../screens/shopkeeper/RecordPaymentScreen';
import LinkShopsScreen from '../screens/customer/LinkShopsScreen';
import ShopDetailScreen from '../screens/customer/ShopDetailScreen';
import ShopTimelineScreen from '../screens/customer/ShopTimelineScreen';
import EditCustomerScreen from '../screens/shopkeeper/EditCustomerScreen';
import FilteredCustomersScreen from '../screens/shopkeeper/FilteredCustomersScreen';
import ShopProfileScreen from '../screens/shopkeeper/ShopProfileScreen';
import ProductsScreen from '../screens/shopkeeper/ProductsScreen';
import ExpensesScreen from '../screens/shopkeeper/ExpensesScreen';
import SecurityScreen from '../screens/shopkeeper/SecurityScreen';
import PersonalInfoScreen from '../screens/customer/PersonalInfoScreen';
import HelpSupportScreen from '../screens/shopkeeper/HelpSupportScreen';
import LegalDocumentScreen from '../screens/shopkeeper/LegalDocumentScreen';
import NotificationsScreen from '../screens/shared/NotificationsScreen';
import TutorialScreen from '../screens/shopkeeper/TutorialScreen';
import TutorialChapterScreen from '../screens/shopkeeper/TutorialChapterScreen';
import QRScannerScreen from '../screens/shared/QRScannerScreen';
import { colors } from '../theme/colors';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

function getInitialRoute(loading: boolean, user: ReturnType<typeof useAuth>['user']) {
  if (loading) return 'Splash';
  if (!user) return 'Login';
  return user.role === 'shopkeeper' ? 'Shopkeeper' : 'Customer';
}

export default function RootNavigator() {
  const { user, loading } = useAuth();
  const { t } = useTranslation();
  const navKey = loading ? 'boot' : user ? `${user.id}-${user.role}` : 'guest';

  return (
    <NavigationContainer key={navKey}>
      <Stack.Navigator
        initialRouteName={getInitialRoute(loading, user)}
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.primaryDark,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="Splash" component={SplashScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Register" component={RegisterScreen} options={{ headerShown: false }} />
        <Stack.Screen name="VerifyEmail" component={VerifyEmailScreen} options={{ headerShown: false }} />
        <Stack.Screen
          name="Shopkeeper"
          component={ShopkeeperNavigator}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Customer"
          component={CustomerNavigator}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="AddCustomer"
          component={AddCustomerScreen}
          options={{ title: t('nav.addCustomer') }}
        />
        <Stack.Screen
          name="CustomerProfile"
          component={CustomerProfileScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="EditCustomer"
          component={EditCustomerScreen}
          options={{ title: t('nav.editCustomer') }}
        />
        <Stack.Screen
          name="FilteredCustomers"
          component={FilteredCustomersScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="AddCredit"
          component={AddCreditScreen}
          options={{ headerShown: false, title: t('nav.addCredit') }}
        />
        <Stack.Screen
          name="RecordPayment"
          component={RecordPaymentScreen}
          options={{ title: t('nav.recordPayment') }}
        />
        <Stack.Screen name="LinkShops" component={LinkShopsScreen} options={{ headerShown: false }} />
        <Stack.Screen
          name="ShopDetail"
          component={ShopDetailScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="ShopTimeline"
          component={ShopTimelineScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="ShopProfile"
          component={ShopProfileScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Products"
          component={ProductsScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Expenses"
          component={ExpensesScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Security"
          component={SecurityScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="PersonalInfo"
          component={PersonalInfoScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="HelpSupport"
          component={HelpSupportScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="LegalDocument"
          component={LegalDocumentScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Notifications"
          component={NotificationsScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="QRScanner"
          component={QRScannerScreen}
          options={{ headerShown: false, title: t('nav.scanQr') }}
        />
        <Stack.Screen
          name="Tutorial"
          component={TutorialScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="TutorialChapter"
          component={TutorialChapterScreen}
          options={{ headerShown: false }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
