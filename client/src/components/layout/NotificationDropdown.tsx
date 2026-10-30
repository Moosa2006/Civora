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
      return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    case 'COMPLAINT_REOPENED':
      return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    case 'MESSAGE_RECEIVED':
      return 'bg-sky-500/20 text-sky-400 border-sky-500/30';
    case 'DEPARTMENT_ASSIGNED':
    case 'PROGRESS_UPDATE':
      return 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30';
    case 'STATUS_CHANGED':
      return 'bg-teal-500/20 text-teal-400 border-teal-500/30';
    default:
      return 'bg-[#A8BFAE]/20 text-[#3E4B44] dark:text-[#C5D4C9] border-[#A8BFAE]/30';
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
        className="relative p-2 rounded-lg text-[#E4E0D5] hover:text-white hover:bg-[#112F26] transition-colors focus:outline-none focus:ring-2 focus:ring-[#A8BFAE] cursor-pointer"
      >
        <BellIcon className="w-5 h-5" />
        {unreadCount > 0 && (
          <span
            className="absolute top-1 right-1 flex items-center justify-center min-w-[1.125rem] h-4.5 px-1 text-[10px] font-bold text-white bg-[#B94B3B] border border-[#173D32] rounded-full"
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
          className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl bg-white dark:bg-[#16201C] border border-[#DED8CB] dark:border-[#283931] shadow-2xl z-50 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#EAE5D9] dark:border-[#283931] bg-[#FAF8F5] dark:bg-[#141C18]">
            <div className="flex items-center gap-2">
              <span className="font-heading font-semibold text-[#202522] dark:text-[#F5F2EA] text-sm">Notifications</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 text-xs font-semibold bg-[#4F9B8B]/15 text-[#2D6E62] dark:text-[#7BC4B2] border border-[#4F9B8B]/30 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="inline-flex items-center gap-1 text-xs text-[#54625A] hover:text-[#173D32] dark:text-[#C5D4C9] dark:hover:text-[#F5F2EA] transition-colors cursor-pointer"
                title="Mark all as read"
              >
                <CheckIcon className="w-3.5 h-3.5" />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-[#EAE5D9] dark:divide-[#283931]">
            {isLoading && recentNotifications.length === 0 ? (
              <div className="p-6 text-center text-[#54625A] text-xs">
                Loading notifications...
              </div>
            ) : recentNotifications.length === 0 ? (
              <div className="p-8 text-center text-[#54625A]">
                <InfoIcon className="w-8 h-8 mx-auto mb-2 text-[#A8BFAE]" />
                <p className="text-sm font-heading font-medium text-[#202522] dark:text-[#F5F2EA]">All caught up!</p>
                <p className="text-xs text-[#54625A] dark:text-[#C5D4C9] mt-1">No unread alerts at this time.</p>
              </div>
            ) : (
              recentNotifications.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleNotificationClick(item)}
                  className={`p-3.5 hover:bg-[#FAF8F5] dark:hover:bg-[#1C2823] transition-colors cursor-pointer flex gap-3 ${
                    !item.isRead ? 'bg-[#FAF8F5]/80 dark:bg-[#18241F]' : ''
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
                      <span className="text-[11px] text-[#54625A] dark:text-[#C5D4C9] whitespace-nowrap">
                        {formatRelativeTime(item.createdAt)}
                      </span>
                    </div>
                    <p className={`text-xs ${!item.isRead ? 'font-semibold text-[#202522] dark:text-[#F5F2EA]' : 'text-[#3E4B44] dark:text-[#C5D4C9]'}`}>
                      {item.title}
                    </p>
                    <p className="text-xs text-[#54625A] dark:text-[#C5D4C9] line-clamp-2 mt-0.5">{item.message}</p>
                  </div>
                  {!item.isRead && (
                    <div className="w-2 h-2 rounded-full bg-[#173D32] dark:bg-[#4F9B8B] self-center shrink-0" aria-label="Unread" />
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-[#EAE5D9] dark:border-[#283931] bg-[#FAF8F5] dark:bg-[#141C18] text-xs font-medium">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                navigate('/notifications');
              }}
              className="text-[#173D32] dark:text-[#7BC4B2] hover:underline transition-colors cursor-pointer"
            >
              See all notifications &rarr;
            </button>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                navigate('/settings/notifications');
              }}
              className="inline-flex items-center gap-1 text-[#54625A] hover:text-[#202522] dark:text-[#889B90] dark:hover:text-[#F5F2EA] transition-colors cursor-pointer"
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
