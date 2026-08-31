import { request } from './client';

export const BACKUP_SCHEMA_VERSION = 1;

export type ShopBackupSummary = {
  customerCount: number;
  transactionCount: number;
  paymentCount: number;
  productCount: number;
  expenseCount: number;
  totalOutstanding: number;
  shopName?: string;
};

export type ShopBackupPayload = {
  schemaVersion: number;
  exportedAt: string;
  shopOwnerId: string;
  shop: {
    shopName: string;
    shopLocation: string;
    shopImage: string;
    ownerName?: string;
    ownerEmail?: string;
  };
  customers: Array<Record<string, unknown>>;
  transactions: Array<Record<string, unknown>>;
  payments: Array<Record<string, unknown>>;
  products: Array<Record<string, unknown>>;
  expenses: Array<Record<string, unknown>>;
  summary: ShopBackupSummary;
};

export type RestoreBackupStats = {
  customersAdded: number;
  customersSkipped: number;
  transactionsAdded: number;
  transactionsSkipped: number;
  paymentsAdded: number;
  paymentsSkipped: number;
  productsAdded: number;
  productsUpdated: number;
  expensesAdded: number;
  expensesSkipped: number;
};

export type CustomerBackupPayload = {
  schemaVersion: number;
  backupType: 'customer';
  exportedAt: string;
  userId: string;
  profile: { fullName: string; email: string; phone: string };
  summary: {
    currentDue: number;
    totalPurchases: number;
    totalPaid: number;
    totalShops: number;
    ledgerCount: number;
  };
  shops: Array<Record<string, unknown>>;
  ledger: Array<Record<string, unknown>>;
  paymentSubmissions: Array<Record<string, unknown>>;
};

export const fetchCustomerBackup = () =>
  request<{ success: boolean; backup: CustomerBackupPayload }>('/portal/backup');

export const fetchShopBackup = () =>
  request<{ success: boolean; backup: ShopBackupPayload }>('/shop/backup');

export const restoreShopBackup = (backup: ShopBackupPayload, mode: 'merge' = 'merge') =>
  request<{ success: boolean; message: string; stats: RestoreBackupStats }>(
    '/shop/backup/restore',
    {
      method: 'POST',
      body: JSON.stringify({ backup, mode }),
    }
  );
