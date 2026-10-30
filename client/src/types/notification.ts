export type NotificationType =
  | 'COMPLAINT_SUBMITTED'
  | 'STATUS_CHANGED'
  | 'DEPARTMENT_ASSIGNED'
  | 'PROGRESS_UPDATE'
  | 'RESOLUTION_SUBMITTED'
  | 'RESOLUTION_VERIFIED'
  | 'COMPLAINT_REOPENED'
  | 'MESSAGE_RECEIVED'
  | 'PROJECT_UPDATE'
  | 'SYSTEM_ALERT';

export interface NotificationItem {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  entityType?: string | null;
  entityId?: string | null;
  actionUrl?: string | null;
  isRead: boolean;
  readAt?: string | null;
  createdAt: string;
}

export interface NotificationPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  unreadCount: number;
}

export interface NotificationQueryResponse {
  notifications: NotificationItem[];
  pagination: NotificationPagination;
}

export interface NotificationPreferences {
  userId?: string;
  emailNotifications: boolean;
  statusChangeAlerts: boolean;
  progressUpdateAlerts: boolean;
  assignmentAlerts: boolean;
  messageAlerts: boolean;
  resolutionAlerts: boolean;
  isDefault?: boolean;
}

export interface ComplaintMessage {
  id: string;
  complaintId: string;
  senderId: string;
  message: string;
  isInternal: boolean;
  isRead: boolean;
  readAt?: string | null;
  createdAt: string;
  sender: {
    id: string;
    name: string;
    role: 'CITIZEN' | 'GOVERNMENT_OFFICIAL' | 'ADMIN';
  };
}
