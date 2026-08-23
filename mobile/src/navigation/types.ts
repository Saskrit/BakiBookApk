import type { NavigatorScreenParams } from '@react-navigation/native';
import type { TutorialChapterId } from '../features/tutorial/catalog';

export type ShopkeeperTabParamList = {
  Dashboard: undefined;
  Customers: undefined;
  Scan: undefined;
  Reports: undefined;
  Settings: undefined;
};

export type CustomerTabParamList = {
  Home: undefined;
  Ledger: { customerId?: string; shopName?: string } | undefined;
  Payments: { customerId?: string; shopName?: string; openSubmit?: boolean } | undefined;
  Shops: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Splash: undefined;
  Login: undefined;
  Register: undefined;
  VerifyEmail: { email: string; role: 'shopkeeper' | 'customer' };
  Shopkeeper: NavigatorScreenParams<ShopkeeperTabParamList> | undefined;
  Customer: NavigatorScreenParams<CustomerTabParamList> | undefined;
  AddCustomer: undefined;
  CustomerProfile: { customerId: string };
  EditCustomer: { customerId: string };
  FilteredCustomers: {
    mode: 'collect' | 'overdue';
    title: string;
    subtitle: string;
  };
  AddCredit: { customerId?: string; customerName?: string } | undefined;
  RecordPayment: { customerId: string; customerName?: string };
  LinkShops: undefined;
  ShopDetail: { customerId: string; shopName?: string };
  ShopTimeline: { customerId: string; shopName?: string };
  ShopProfile: undefined;
  Products: undefined;
  Expenses: undefined;
  Security: undefined;
  PersonalInfo: undefined;
  HelpSupport: undefined;
  LegalDocument: { slug: string; title: string };
  Notifications: undefined;
  QRScanner: { initialTab?: 'scan' | 'myqr' } | undefined;
  Tutorial: undefined;
  TutorialChapter: { chapterId: TutorialChapterId };
};
