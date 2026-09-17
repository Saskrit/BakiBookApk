export type UserRole = 'shopkeeper' | 'customer';
export type AppLanguage = 'en' | 'ne';
export type ShopTeamRole = 'owner' | 'partner' | 'staff';

export interface TutorialProgress {
  completedStepIds: string[];
  updatedAt?: string | null;
  totalSteps: number;
  completedCount: number;
  percent: number;
}

export interface User {
  id: string;
  role: UserRole;
  fullName: string;
  email: string;
  phone?: string;
  profileImage?: string;
  shopName?: string;
  shopLocation?: string;
  shopImage?: string;
  isEmailVerified?: boolean;
  isShopVerified?: boolean;
  authProvider?: 'local' | 'google';
  shopVerificationStatus?: string;
  needsShopSetup?: boolean;
  isAdmin?: boolean;
  pendingLinkCount?: number;
  preferredLanguage?: AppLanguage;
  tutorialProgress?: TutorialProgress;
  createdAt?: string;
  teamRole?: ShopTeamRole;
  canEditShop?: boolean;
  shopOwnerId?: string;
  mustChangePassword?: boolean;
  hasPassword?: boolean;
}

export interface Customer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  balance: number;
  creditScore?: string;
  linkStatus?: string;
  status?: string;
  qrCode?: string;
  notes?: string;
  avatar?: string;
  profileImage?: string;
  lastCreditDate?: string;
  lastPaymentDate?: string;
}

export type ProductUnit = 'none' | 'kg' | 'ltr';

export interface LineItem {
  name: string;
  qty: number;
  price: number;
  unit?: ProductUnit;
}

export interface ShopProduct {
  id: string;
  name: string;
  lastPrice: number;
  usageCount: number;
  lastUsedAt?: string;
}

export interface ShopExpense {
  id: string;
  title: string;
  amount: number;
  category: string;
  note?: string;
  expenseDate?: string;
  createdAt?: string;
}

export const EXPENSE_CATEGORIES = [
  'Stock',
  'Rent',
  'Utilities',
  'Transport',
  'Salary',
  'Marketing',
  'Maintenance',
  'Other',
] as const;

export interface Transaction {
  id: string;
  customerId: string;
  customerName: string;
  items: LineItem[];
  total: number;
  note?: string;
  date?: string;
  time?: string;
}

export interface Payment {
  id: string;
  customerId: string;
  customerName: string;
  amount: number;
  method?: string;
  note?: string;
  date?: string;
  time?: string;
  receiptNo?: string;
}

export interface DashboardStats {
  totalCustomers: number;
  totalOutstanding: number;
  totalCredit: number;
  totalPayments: number;
  todayTransactions: number;
  weekCredit: number;
  weekPayment: number;
  customersWithDues: number;
}

export interface Pagination {
  page: number;
  totalPages: number;
  total: number;
}

export interface AuthResponse {
  success: boolean;
  token: string;
  user: User;
  pendingLinkCount?: number;
  message?: string;
}
