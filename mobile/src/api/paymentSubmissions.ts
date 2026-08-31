import { request } from './client';

export type PaymentSubmission = {
  id: string;
  customerId?: string;
  customerName?: string;
  shopName?: string;
  amount: number;
  method?: string;
  payType?: string;
  payLabel?: string;
  transactionId?: string | null;
  itemIndex?: number | null;
  itemName?: string;
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

export const fetchShopkeeperSubmissions = (params: {
  status?: string;
  page?: number;
  limit?: number;
} = {}) => {
  const qs = new URLSearchParams();
  if (params.status) qs.set('status', params.status);
  if (params.page != null) qs.set('page', String(params.page));
  if (params.limit != null) qs.set('limit', String(params.limit));
  const query = qs.toString();
  return request<{
    success: boolean;
    submissions: PaymentSubmission[];
    pagination?: { page: number; totalPages: number; total: number };
  }>(`/payment-submissions${query ? `?${query}` : ''}`);
};

export const fetchPendingSubmissionCount = () =>
  request<{ success: boolean; count: number }>('/payment-submissions/pending-count');

export const fetchShopkeeperSubmission = (id: string) =>
  request<{ success: boolean; submission: PaymentSubmission }>(`/payment-submissions/${id}`);

export const acceptPaymentSubmission = (id: string, note = '') =>
  request<{ success: boolean; submission: PaymentSubmission; paymentId?: string }>(
    `/payment-submissions/${id}/accept`,
    {
      method: 'POST',
      body: JSON.stringify({ note }),
    }
  );

export const rejectPaymentSubmission = (id: string, note: string) =>
  request<{ success: boolean; submission: PaymentSubmission }>(
    `/payment-submissions/${id}/reject`,
    {
      method: 'POST',
      body: JSON.stringify({ note }),
    }
  );

export const reportPaymentSubmission = (id: string, reason: string) =>
  request<{ success: boolean; submission: PaymentSubmission }>(
    `/payment-submissions/${id}/report`,
    {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }
  );
