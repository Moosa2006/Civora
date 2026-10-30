import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { useAuth } from './useAuth.js';
import type { NotificationItem } from '../types/notification.js';

interface NotificationContextValue {
  unreadCount: number;
  recentNotifications: NotificationItem[];
  isLoading: boolean;
  refreshUnreadCount: () => Promise<void>;
  fetchRecentNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<boolean>;
  markAllAsRead: () => Promise<boolean>;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [recentNotifications, setRecentNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const refreshUnreadCount = useCallback(async () => {
    if (!isAuthenticated) {
      setUnreadCount(0);
      return;
    }

    try {
      const res = await fetch('/api/notifications/unread-count', {
        headers: { Accept: 'application/json' },
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && typeof json.data?.unreadCount === 'number') {
          setUnreadCount(json.data.unreadCount);
        }
      }
    } catch {
      // Background poll failure handled gracefully
    }
  }, [isAuthenticated]);

  const fetchRecentNotifications = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/notifications?limit=5', {
        headers: { Accept: 'application/json' },
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data?.notifications)) {
          setRecentNotifications(json.data.notifications);
          if (typeof json.data?.pagination?.unreadCount === 'number') {
            setUnreadCount(json.data.pagination.unreadCount);
          }
        }
      }
    } catch {
      // Graceful fallback
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  const markAsRead = useCallback(async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/notifications/${id}/read`, {
        method: 'PATCH',
        headers: { Accept: 'application/json' },
      });
      if (res.ok) {
        setRecentNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
        return true;
      }
    } catch {
      // Ignore
    }
    return false;
  }, []);

  const markAllAsRead = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch('/api/notifications/mark-all-read', {
        method: 'POST',
        headers: { Accept: 'application/json' },
      });
      if (res.ok) {
        setRecentNotifications((prev) =>
          prev.map((n) => ({ ...n, isRead: true, readAt: new Date().toISOString() }))
        );
        setUnreadCount(0);
        return true;
      }
    } catch {
      // Ignore
    }
    return false;
  }, []);

  // Polling effect: periodic check every 25s & focus listener
  useEffect(() => {
    if (!isAuthenticated) {
      setUnreadCount(0);
      setRecentNotifications([]);
      return;
    }

    refreshUnreadCount();

    const interval = setInterval(refreshUnreadCount, 25000);

    const onFocus = () => {
      refreshUnreadCount();
    };
    window.addEventListener('focus', onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [isAuthenticated, refreshUnreadCount]);

  return (
    <NotificationContext.Provider
      value={{
        unreadCount,
        recentNotifications,
        isLoading,
        refreshUnreadCount,
        fetchRecentNotifications,
        markAsRead,
        markAllAsRead,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return ctx;
}
