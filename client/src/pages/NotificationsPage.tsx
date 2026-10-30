import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/useAuth.js';
import { useNotifications } from '../context/NotificationContext.js';
import { useRouter } from '../router/index.js';
import { Container } from '../components/layout/Container.js';
import { PageHeading } from '../components/ui/PageHeading.js';
import { Card } from '../components/ui/Card.js';
import { Button } from '../components/ui/Button.js';
import { Alert } from '../components/ui/Alert.js';
import { EmptyState } from '../components/ui/EmptyState.js';
import { CheckIcon, SettingsIcon, ArrowRightIcon } from '../components/ui/icons.js';
import type { NotificationItem, NotificationType } from '../types/notification.js';

function formatRelativeTime(dateStr: string): string {
  try {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    if (diffSecs < 60) return 'Just now';
    const diffMins = Math.floor(diffSecs / 60);
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(dateStr).toLocaleDateString();
  } catch {
    return dateStr;
  }
}

function getTypeBadge(type: NotificationType) {
  switch (type) {
    case 'RESOLUTION_SUBMITTED':
    case 'RESOLUTION_VERIFIED':
      return {
        label: type.replace(/_/g, ' '),
        classes: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      };
    case 'COMPLAINT_REOPENED':
      return {
        label: 'REOPENED',
        classes: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      };
    case 'MESSAGE_RECEIVED':
      return {
        label: 'MESSAGE',
        classes: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
      };
    case 'DEPARTMENT_ASSIGNED':
      return {
        label: 'ASSIGNMENT',
        classes: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
      };
    case 'PROGRESS_UPDATE':
      return {
        label: 'PROGRESS UPDATE',
        classes: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      };
    case 'STATUS_CHANGED':
      return {
        label: 'STATUS UPDATE',
        classes: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
      };
    case 'COMPLAINT_SUBMITTED':
      return {
        label: 'LODGED',
        classes: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      };
    default:
      return {
        label: type.replace(/_/g, ' '),
        classes: 'bg-[#A8BFAE]/20 text-[#3E4B44] dark:text-[#C5D4C9] border-[#A8BFAE]/30',
      };
  }
}

export function NotificationsPage() {
  const { isAuthenticated } = useAuth();
  const { markAsRead, markAllAsRead, refreshUnreadCount } = useNotifications();
  const { navigate } = useRouter();

  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(10);

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(limit));
      if (filter === 'unread') params.set('isRead', 'false');
      if (filter === 'read') params.set('isRead', 'true');

      const res = await fetch(`/api/notifications?${params.toString()}`, {
        headers: { Accept: 'application/json' },
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch notifications: HTTP ${res.status}`);
      }

      const json = await res.json();
      if (json.success) {
        setNotifications(json.data.notifications || []);
        setTotalPages(json.data.pagination?.totalPages || 1);
        setTotalCount(json.data.pagination?.total || 0);
        setUnreadCount(json.data.pagination?.unreadCount || 0);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error loading notifications. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, page, limit, filter]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkItemRead = async (id: string) => {
    const success = await markAsRead(id);
    if (success) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      refreshUnreadCount();
    }
  };

  const handleMarkAllRead = async () => {
    const success = await markAllAsRead();
    if (success) {
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, isRead: true, readAt: new Date().toISOString() }))
      );
      setUnreadCount(0);
      refreshUnreadCount();
    }
  };

  const handleItemNavigation = async (item: NotificationItem) => {
    if (!item.isRead) {
      await handleMarkItemRead(item.id);
    }
    if (item.actionUrl) {
      navigate(item.actionUrl as any);
    }
  };

  if (!isAuthenticated) {
    return (
      <Container size="md" className="py-12">
        <Alert variant="warning" title="Sign In Required">
          Please sign in to view your notification center and alerts.
        </Alert>
        <div className="mt-4">
          <Button variant="primary" onClick={() => navigate('/login')}>
            Sign In
          </Button>
        </div>
      </Container>
    );
  }

  return (
    <Container size="lg" className="py-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <PageHeading
            title="Notification Center"
            description="Track real-time status updates, department assignments, and communication across your civic complaints."
          />
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {unreadCount > 0 && (
            <Button variant="secondary" size="sm" onClick={handleMarkAllRead}>
              <CheckIcon className="w-4 h-4 mr-1.5" />
              Mark All as Read
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/settings/notifications')}
            title="Configure Alert Preferences"
          >
            <SettingsIcon className="w-4 h-4 mr-1.5" />
            Preferences
          </Button>
        </div>
      </div>

      {errorMsg && (
        <div className="mb-6">
          <Alert variant="error" title="Error">
            {errorMsg}
          </Alert>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-[#DED8CB] dark:border-[#283931] pb-3 mb-6">
        <button
          type="button"
          onClick={() => {
            setFilter('all');
            setPage(1);
          }}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
            filter === 'all'
              ? 'bg-[#173D32] text-[#F4F0E6] shadow-xs'
              : 'text-[#54625A] dark:text-[#C5D4C9] hover:text-[#202522] dark:hover:text-[#F5F2EA] hover:bg-[#ECE7DB] dark:hover:bg-[#1D2A25]'
          }`}
        >
          All Alerts ({totalCount})
        </button>
        <button
          type="button"
          onClick={() => {
            setFilter('unread');
            setPage(1);
          }}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${
            filter === 'unread'
              ? 'bg-[#173D32] text-[#F4F0E6] shadow-xs'
              : 'text-[#54625A] dark:text-[#C5D4C9] hover:text-[#202522] dark:hover:text-[#F5F2EA] hover:bg-[#ECE7DB] dark:hover:bg-[#1D2A25]'
          }`}
        >
          <span>Unread</span>
          {unreadCount > 0 && (
            <span className="px-1.5 py-0.2 text-[10px] bg-[#9C3B2D] text-white font-bold rounded-full">
              {unreadCount}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => {
            setFilter('read');
            setPage(1);
          }}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
            filter === 'read'
              ? 'bg-[#173D32] text-[#F4F0E6] shadow-xs'
              : 'text-[#54625A] dark:text-[#C5D4C9] hover:text-[#202522] dark:hover:text-[#F5F2EA] hover:bg-[#ECE7DB] dark:hover:bg-[#1D2A25]'
          }`}
        >
          Archived Read
        </button>
      </div>

      {/* Notification List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="p-4 rounded-xl border border-[#DED8CB] dark:border-[#283931] bg-[#ECE7DB]/40 dark:bg-[#1D2A25]/40 animate-pulse space-y-2"
            >
              <div className="h-4 bg-[#DED8CB] dark:bg-[#283931] rounded w-1/4"></div>
              <div className="h-3 bg-[#DED8CB] dark:bg-[#283931] rounded w-3/4"></div>
            </div>
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <Card className="py-12 text-center">
          <EmptyState
            title="No Notifications Found"
            description={
              filter === 'unread'
                ? 'You have zero unread alerts. You are completely caught up!'
                : 'No notification records found in your activity log.'
            }
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {notifications.map((item) => {
            const badge = getTypeBadge(item.type);
            return (
              <div
                key={item.id}
                className={`p-4 sm:p-5 rounded-xl border transition-all duration-150 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  !item.isRead
                    ? 'bg-white dark:bg-[#16201C] border-[#173D32] dark:border-[#7BC4B2] shadow-xs'
                    : 'bg-white/60 dark:bg-[#16201C]/60 border-[#DED8CB] dark:border-[#283931] hover:border-[#173D32]/40 dark:hover:border-[#7BC4B2]/40'
                }`}
              >
                <div className="flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-block px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase border rounded-md ${badge.classes}`}
                    >
                      {badge.label}
                    </span>
                    {!item.isRead && (
                      <span className="w-2 h-2 rounded-full bg-[#173D32] dark:bg-[#7BC4B2] shrink-0" aria-label="Unread alert" />
                    )}
                    <span
                      className="text-xs text-[#54625A] dark:text-[#C5D4C9]"
                      title={new Date(item.createdAt).toLocaleString()}
                    >
                      {formatRelativeTime(item.createdAt)}
                    </span>
                  </div>

                  <h3 className="text-sm sm:text-base font-semibold text-[#202522] dark:text-[#F5F2EA]">
                    {item.title}
                  </h3>

                  <p className="text-xs sm:text-sm text-[#3E4B44] dark:text-[#C5D4C9] leading-relaxed max-w-3xl">
                    {item.message}
                  </p>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  {!item.isRead && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleMarkItemRead(item.id)}
                      className="text-[#54625A] hover:text-[#202522] dark:text-[#C5D4C9] dark:hover:text-[#E8F0EC]"
                      title="Mark as read"
                    >
                      <CheckIcon className="w-4 h-4 mr-1" />
                      Mark Read
                    </Button>
                  )}
                  {item.actionUrl && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleItemNavigation(item)}
                    >
                      <span>View</span>
                      <ArrowRightIcon className="w-3.5 h-3.5 ml-1" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-8 pt-4 border-t border-[#DED8CB] dark:border-[#283931] text-xs text-[#54625A] dark:text-[#C5D4C9]">
          <span>
            Page {page} of {totalPages} ({totalCount} total alerts)
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </Container>
  );
}
