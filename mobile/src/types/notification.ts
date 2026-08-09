export type NotificationType = 'info' | 'success' | 'warning';

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  type: NotificationType;
  date?: string;
  time?: string;
  createdAt?: string | null;
  read: boolean;
  archived?: boolean;
  linkPath?: string;
  customerId?: string | null;
}
