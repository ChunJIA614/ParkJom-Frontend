export type NotificationCategory = 'Booking' | 'Wallet' | 'Listing' | 'Support' | 'System' | 'Account';
export type NotificationPriority = 'Low' | 'Normal' | 'High' | 'Critical';
export type NotificationChannel = 'InApp' | 'WebPush' | 'Push' | 'Email' | 'SMS';

export interface NotificationEntity {
  type?: string;
  id?: string;
}

export interface NotificationDto {
  id: number;
  type: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  title: string;
  body: string;
  actionUrl?: string | null;
  entity?: NotificationEntity | null;
  data?: Record<string, unknown> | null;
  createdAt: string;
  readAt?: string | null;
}

export interface NotificationQuery {
  cursor?: number | null;
  limit?: number;
  status?: 'all' | 'unread';
  category?: NotificationCategory | string;
}

export interface NotificationInboxResponse {
  items: NotificationDto[];
  nextCursor?: number | null;
  hasMore: boolean;
  totalUnread: number;
}

export interface UnreadCountDto {
  total: number;
  byCategory: Record<string, number>;
}

export interface NotificationPreferenceItem {
  category: NotificationCategory;
  channel: NotificationChannel;
  enabled: boolean;
  isLocked: boolean;
}

export interface NotificationPreferencesResponse {
  preferences: NotificationPreferenceItem[];
}

export interface UpdatePreferenceItem {
  category: string;
  channel: string;
  enabled: boolean;
}

export interface PushSubscriptionRequest {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  userAgent?: string;
}

export interface AdminBroadcastRequest {
  title: string;
  body: string;
  actionUrl?: string;
  priority?: NotificationPriority;
  targetRole?: 'Renter' | 'PropertyOwner' | '';
  type?: string;
}

export interface DeliveryStatusRecord {
  deliveryId: number;
  notificationId: number;
  channel: string;
  status: string;
  attemptCount: number;
  sentAt?: string;
  lastError?: string;
  createdAt: string;
}
