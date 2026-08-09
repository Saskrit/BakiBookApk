import { request } from './client';

export type MyQrResponse = {
  success: boolean;
  qr: {
    qrCode: string;
    payload: string;
    role: 'shopkeeper' | 'customer';
    label: string;
    subtitle?: string;
  };
};

export type QrPreviewTarget =
  | {
      kind: 'shopkeeper';
      userId: string;
      qrCode: string;
      name: string;
      shopName: string;
      location?: string;
      phone?: string;
      shopImage?: string;
      verified?: boolean;
    }
  | {
      kind: 'customer';
      userId: string;
      qrCode: string;
      name: string;
      email?: string;
      phone?: string;
      profileImage?: string;
    }
  | {
      kind: 'ledger-customer';
      customerId: string;
      name: string;
      phone?: string;
      email?: string;
      qrCode?: string;
    };

export type QrPreviewResponse = {
  success: boolean;
  canConnect: boolean;
  alreadyLinked: boolean;
  customerId?: string | null;
  message?: string;
  token?: string;
  target: QrPreviewTarget;
};

export type QrConnectResponse = {
  success: boolean;
  alreadyLinked: boolean;
  created?: boolean;
  message?: string;
  customer: { id: string; name?: string };
  shop?: {
    customerId: string;
    shopName: string;
    shopkeeper?: string;
  };
};

export const fetchMyQr = () => request<MyQrResponse>('/qr/me');

export const previewQr = (token: string) =>
  request<QrPreviewResponse>('/qr/preview', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });

export const connectQr = (token: string) =>
  request<QrConnectResponse>('/qr/connect', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
