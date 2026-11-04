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
        classes: 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30',
      };
    case 'COMPLAINT_REOPENED':
      return {
        label: 'REOPENED',
        classes: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30',
      };
    case 'MESSAGE_RECEIVED':
      return {
        label: 'MESSAGE',
        classes: 'bg-[#E5ECE8] text-[#0B3D2E] border-[#0B3D2E]/20 dark:bg-[#273548] dark:text-[#34D399] dark:border-[#374151]',
      };
    case 'DEPARTMENT_ASSIGNED':
      return {
        label: 'ASSIGNMENT',
        classes: 'bg-[#F3F4F6] text-[#374151] border-[#D1D5DB] dark:bg-[#273548] dark:text-[#D1D5DB] dark:border-[#374151]',
      };
    case 'PROGRESS_UPDATE':
      return {
        label: 'PROGRESS UPDATE',
        classes: 'bg-[#E5ECE8] text-[#0B3D2E] border-[#0B3D2E]/20 dark:bg-[#273548] dark:text-[#34D399] dark:border-[#374151]',
      };
    case 'STATUS_CHANGED':
      return {
        label: 'STATUS UPDATE',
        classes: 'bg-emerald-50 text-[#0B6640] border-emerald-200 dark:bg-teal-500/20 dark:text-teal-300 dark:border-teal-500/30',
      };
    case 'COMPLAINT_SUBMITTED':
      return {
        label: 'LODGED',
        classes: 'bg-[#F3F4F6] text-[#111827] border-[#D1D5DB] dark:bg-[#273548] dark:text-[#D1D5DB] dark:border-[#374151]',
      };
    default:
      return {
        label: type.replace(/_/g, ' '),
        classes: 'bg-[#F3F4F6] text-[#374151] dark:bg-[#273548] dark:text-[#D1D5DB] border-[#E5E7EB] dark:border-[#374151]',
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
    <Container size="xl" className="space-y-6">
      {/* Standardized Page Header */}
      <PageHeading
        title="Notification Center"
        description="Track real-time status updates, department assignments, and communication across your civic complaints."
        className="mb-0"
        actions={
          <>
            {unreadCount > 0 && (
              <Button variant="secondary" size="sm" onClick={handleMarkAllRead} leftIcon={<CheckIcon className="w-4 h-4" />}>
                Mark All as Read
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/settings/notifications')}
              title="Configure Alert Preferences"
              leftIcon={<SettingsIcon className="w-4 h-4" />}
            >
              Preferences
            </Button>
          </>
        }
      />

      {errorMsg && (
        <div className="mb-6">
          <Alert variant="error" title="Error">
            {errorMsg}
          </Alert>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-[#E5E7EB] dark:border-[#374151] pb-3 mb-6">
        <button
          type="button"
          data-active={filter === 'all'}
          onClick={() => {
            setFilter('all');
            setPage(1);
          }}
          className={`civora-liquid-tab px-3.5 py-1.5 text-xs font-semibold rounded-lg ${
            filter === 'all' ? '' : 'text-[#6B7280] dark:text-[#D1D5DB]'
          }`}
        >
          All Alerts ({totalCount})
        </button>
        <button
          type="button"
          data-active={filter === 'unread'}
          onClick={() => {
            setFilter('unread');
            setPage(1);
          }}
          className={`civora-liquid-tab px-3.5 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 ${
            filter === 'unread' ? '' : 'text-[#6B7280] dark:text-[#D1D5DB]'
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
          data-active={filter === 'read'}
          onClick={() => {
            setFilter('read');
            setPage(1);
          }}
          className={`civora-liquid-tab px-3.5 py-1.5 text-xs font-semibold rounded-lg ${
            filter === 'read' ? '' : 'text-[#6B7280] dark:text-[#D1D5DB]'
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
              className="p-4 rounded-xl border border-[#E5E7EB] dark:border-[#374151] bg-[#F9FAFB] dark:bg-[#182230] animate-pulse space-y-2"
            >
              <div className="h-4 bg-[#E5E7EB] dark:bg-[#374151] rounded w-1/4"></div>
              <div className="h-3 bg-[#E5E7EB] dark:bg-[#374151] rounded w-3/4"></div>
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
                    ? 'bg-white dark:bg-[#1F2937] border-[#0B3D2E] dark:border-[#34D399] shadow-xs'
                    : 'bg-white/60 dark:bg-[#182230] border-[#E5E7EB] dark:border-[#374151] hover:border-[#0B3D2E]/40 dark:hover:border-[#34D399]/50'
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
                      <span className="w-2 h-2 rounded-full bg-[#0B3D2E] dark:bg-[#34D399] shrink-0" aria-label="Unread alert" />
                    )}
                    <span
                      className="text-xs text-[#6B7280] dark:text-[#D1D5DB]"
                      title={new Date(item.createdAt).toLocaleString()}
                    >
                      {formatRelativeTime(item.createdAt)}
                    </span>
                  </div>

                  <h3 className="text-sm sm:text-base font-semibold text-[#111827] dark:text-[#F9FAFB]">
                    {item.title}
                  </h3>

                  <p className="text-xs sm:text-sm text-[#374151] dark:text-[#D1D5DB] leading-relaxed max-w-3xl">
                    {item.message}
                  </p>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  {!item.isRead && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleMarkItemRead(item.id)}
                      className="text-[#6B7280] hover:text-[#111827] dark:text-[#D1D5DB] dark:hover:text-[#F9FAFB]"
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
        <div className="flex items-center justify-between mt-8 pt-4 border-t border-[#E5E7EB] dark:border-[#374151] text-xs text-[#6B7280] dark:text-[#D1D5DB]">
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
