import { useState, useRef, useEffect } from 'react';
import { useNotifications } from '../../context/NotificationContext.js';
import { useRouter } from '../../router/index.js';
import { BellIcon, CheckIcon, SettingsIcon, InfoIcon } from '../ui/icons.js';
import type { NotificationItem, NotificationType } from '../../types/notification.js';

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

function getBadgeColor(type: NotificationType): string {
  switch (type) {
    case 'RESOLUTION_SUBMITTED':
    case 'RESOLUTION_VERIFIED':
      return 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-[#34D399]/15 dark:text-[#6EE7B7] dark:border-[#34D399]/35';
    case 'COMPLAINT_REOPENED':
      return 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-[#FCD34D] dark:border-amber-500/35';
    case 'MESSAGE_RECEIVED':
      return 'bg-[#E5ECE8] text-[#0B3D2E] border-[#0B3D2E]/20 dark:bg-sky-500/15 dark:text-[#7DD3FC] dark:border-sky-500/35';
    case 'DEPARTMENT_ASSIGNED':
    case 'PROGRESS_UPDATE':
      return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-[#273548] dark:text-[#D1D5DB] dark:border-[#4B5563]';
    case 'STATUS_CHANGED':
      return 'bg-emerald-50 text-[#0B6640] border-emerald-200 dark:bg-[#34D399]/15 dark:text-[#34D399] dark:border-[#34D399]/35';
    default:
      return 'bg-[#F3F4F6] text-[#4B5563] dark:bg-[#273548] dark:text-[#D1D5DB] border-[#E5E7EB] dark:border-[#374151]';
  }
}

export function NotificationDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const { unreadCount, recentNotifications, isLoading, fetchRecentNotifications, markAsRead, markAllAsRead } =
    useNotifications();
  const { navigate } = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleToggle = () => {
    const next = !isOpen;
    setIsOpen(next);
    if (next) {
      fetchRecentNotifications();
    }
  };

  const handleNotificationClick = async (item: NotificationItem) => {
    if (!item.isRead) {
      await markAsRead(item.id);
    }
    setIsOpen(false);
    if (item.actionUrl) {
      navigate(item.actionUrl as any);
    } else {
      navigate('/notifications');
    }
  };

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={handleToggle}
        aria-label={`Notifications (${unreadCount} unread)`}
        aria-expanded={isOpen}
        className="civora-liquid-btn civora-liquid-btn--ghost relative p-2 rounded-lg min-h-[36px] min-w-[36px]"
      >
        <BellIcon className="w-5 h-5" />
        {unreadCount > 0 && (
          <span
            className="absolute top-0.5 right-0.5 z-20 flex items-center justify-center min-w-[1.125rem] h-4.5 px-1 text-[10px] font-bold text-white bg-[#B91C1C] border border-white dark:border-[#111827] rounded-full"
            aria-hidden="true"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Panel */}
      {isOpen && (
        <div
          role="region"
          aria-label="Recent notifications"
          className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl bg-white dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-[#374151] shadow-2xl z-50 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#E5E7EB] dark:border-[#374151] bg-[#F9FAFB] dark:bg-[#182230]">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-[#111827] dark:text-[#F9FAFB] text-sm">Notifications</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 text-xs font-semibold bg-[#E5ECE8] text-[#0B3D2E] dark:bg-[#34D399]/15 dark:text-[#34D399] border border-[#0B3D2E]/15 dark:border-[#34D399]/30 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="civora-liquid-btn civora-liquid-btn--ghost px-2.5 py-1 rounded-md text-xs gap-1"
                title="Mark all as read"
              >
                <CheckIcon className="w-3.5 h-3.5" />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-[#F3F4F6] dark:divide-[#374151]">
            {isLoading && recentNotifications.length === 0 ? (
              <div className="p-6 text-center text-[#6B7280] dark:text-[#9CA3AF] text-xs">
                Loading notifications...
              </div>
            ) : recentNotifications.length === 0 ? (
              <div className="p-8 text-center text-[#6B7280] dark:text-[#9CA3AF]">
                <InfoIcon className="w-8 h-8 mx-auto mb-2 text-[#9CA3AF]" />
                <p className="text-sm font-medium text-[#111827] dark:text-[#F9FAFB]">All caught up!</p>
                <p className="text-xs text-[#6B7280] dark:text-[#D1D5DB] mt-1">No unread alerts at this time.</p>
              </div>
            ) : (
              recentNotifications.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleNotificationClick(item)}
                  className={`p-3.5 hover:bg-[#F9FAFB] dark:hover:bg-[#273548] transition-colors cursor-pointer flex gap-3 ${
                    !item.isRead ? 'bg-[#F8FAF9] dark:bg-[#273548]/60' : ''
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span
                        className={`inline-block px-1.5 py-0.5 text-[10px] font-semibold border rounded ${getBadgeColor(
                          item.type
                        )}`}
                      >
                        {item.type.replace(/_/g, ' ')}
                      </span>
                      <span className="text-[11px] text-[#6B7280] dark:text-[#9CA3AF] whitespace-nowrap">
                        {formatRelativeTime(item.createdAt)}
                      </span>
                    </div>
                    <p className={`text-xs ${!item.isRead ? 'font-semibold text-[#111827] dark:text-[#F9FAFB]' : 'text-[#4B5563] dark:text-[#D1D5DB]'}`}>
                      {item.title}
                    </p>
                    <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] line-clamp-2 mt-0.5">{item.message}</p>
                  </div>
                  {!item.isRead && (
                    <div className="w-2 h-2 rounded-full bg-[#0B3D2E] dark:bg-[#34D399] self-center shrink-0" aria-label="Unread" />
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-[#E5E7EB] dark:border-[#374151] bg-[#F9FAFB] dark:bg-[#182230] text-xs font-medium">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                navigate('/notifications');
              }}
              className="civora-liquid-btn civora-liquid-btn--text px-2 py-1 -ml-2 rounded-md text-xs font-semibold"
            >
              See all notifications &rarr;
            </button>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                navigate('/settings/notifications');
              }}
              className="civora-liquid-btn civora-liquid-btn--ghost px-2.5 py-1 rounded-md text-xs gap-1"
              title="Notification Settings"
            >
              <SettingsIcon className="w-3.5 h-3.5" />
              <span>Settings</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
