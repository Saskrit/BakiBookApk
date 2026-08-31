import { request } from './client';

export type PortalShop = {
  id?: string;
  shopName: string;
  shopkeeper?: string;
  phone?: string;
  location?: string;
  shopImage?: string;
  verified?: boolean;
  balance: number;
  creditScore?: string;
  transactionCount?: number;
  lastTransactionAt?: string | null;
  lastTransaction?: string | null;
  badge?: string;
};

export type PortalPayment = {
  id: string;
  customerId?: string;
  amount: number;
  amountLabel?: string;
  method?: string;
  shopName?: string;
  paidFor?: string;
  note?: string;
  screenshotUrl?: string;
  receiptNo?: string;
  submissionId?: string | null;
  status?: string;
  date?: string;
  time?: string;
  relativeDate?: string;
  createdAt?: string;
};

export type PortalSubmission = {
  id: string;
  customerId: string;
  shopName?: string;
  amount: number;
  method?: string;
  payLabel?: string;
  screenshotUrl?: string;
  note?: string;
  status: 'pending' | 'accepted' | 'rejected' | 'reported' | string;
  reviewNote?: string;
  reportReason?: string;
  paymentId?: string | null;
  date?: string;
  time?: string;
  reviewedAt?: string | null;
};

export const fetchPortalDashboard = () =>
  request<{
    success: boolean;
    summary: {
      currentDue: number;
      totalPurchases: number;
      totalPaid: number;
      lastPayment: string | null;
      totalShops?: number;
      totalTransactions?: number;
    };
    shops: PortalShop[];
  }>('/portal/dashboard');

export const fetchPortalLedger = () =>
  request<{ success: boolean; ledger: Array<Record<string, unknown>> }>('/portal/ledger');

export const fetchPortalPayments = () =>
  request<{
    success: boolean;
    summary?: {
      totalPaid: number;
      thisMonth: number;
      lastMonth: number;
      monthChangePercent: number;
      shopCount: number;
    };
    payments: PortalPayment[];
  }>('/portal/payments');

export const fetchPortalPaymentSubmissions = () =>
  request<{ success: boolean; submissions: PortalSubmission[] }>(
    '/portal/payment-submissions'
  );

export const submitPortalPayment = (payload: {
  customerId: string;
  amount: number;
  method: 'eSewa' | 'Khalti' | 'Bank Transfer';
  payType?: 'custom' | 'transaction' | 'item';
  screenshotUrl: string;
  note?: string;
}) =>
  request<{ success: boolean; message?: string; submission?: PortalSubmission }>(
    '/portal/payment-submissions',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );

export const fetchPortalDues = () =>
  request<{
    success: boolean;
    currentDue: number;
    breakdown: Array<{
      customerId: string;
      shopName: string;
      balance: number;
      customPaymentStatus?: string;
    }>;
  }>('/portal/dues');

export const fetchPortalShopDetail = (customerId: string) =>
  request<{
    success: boolean;
    shop: {
      customerId: string;
      shopName: string;
      shopkeeper?: string;
      phone?: string;
      location?: string;
      shopImage?: string;
      verified?: boolean;
      status?: string;
      creditScore?: string;
      balance: number;
    };
    summary: {
      currentDue: number;
      totalPurchases: number;
      totalPaid: number;
      transactionCount: number;
      lastPaymentAmount: number;
      lastPaymentDate: string | null;
    };
    ledger: Array<Record<string, unknown>>;
    recentPurchaseItems: Array<{ name: string; qty?: number; price?: number }>;
  }>(`/portal/shops/${customerId}`);

export const fetchPendingLinks = () =>
  request<{
    success: boolean;
    count: number;
    invitations: PendingInvitation[];
  }>('/links/pending');

export const fetchPendingLinkDetail = (customerId: string) =>
  request<{
    success: boolean;
    invitation: PendingInvitation;
  }>(`/links/pending/${customerId}`);

export const acceptShopLink = (customerId: string) =>
  request(`/links/${customerId}/accept`, { method: 'POST' });

export const rejectShopLink = (customerId: string) =>
  request(`/links/${customerId}/reject`, { method: 'POST' });

export type PendingInvitation = {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  balance?: number;
  creditScore?: string;
  shopName?: string;
  shopkeeperName?: string;
  shopLocation?: string;
  shopImage?: string;
  shopkeeperPhone?: string;
  shopVerificationStatus?: string;
  shopVerified?: boolean;
  invitedAt?: string;
};