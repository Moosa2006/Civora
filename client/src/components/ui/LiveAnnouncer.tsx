import { useState, useEffect } from 'react';

type AnnouncementPriority = 'polite' | 'assertive';

interface AnnouncementEventDetail {
  message: string;
  priority?: AnnouncementPriority;
}

/**
 * Global helper to announce messages to assistive technologies (screen readers)
 */
export function announceToScreenReader(
  message: string,
  priority: AnnouncementPriority = 'polite'
) {
  if (typeof window === 'undefined') return;
  const event = new CustomEvent<AnnouncementEventDetail>('civora:announce', {
    detail: { message, priority },
  });
  window.dispatchEvent(event);
}

/**
 * Invisible live region component placed at root of application
 */
export function LiveAnnouncer() {
  const [politeMessage, setPoliteMessage] = useState('');
  const [assertiveMessage, setAssertiveMessage] = useState('');

  useEffect(() => {
    const handleAnnounce = (e: Event) => {
      const customEvent = e as CustomEvent<AnnouncementEventDetail>;
      const { message, priority = 'polite' } = customEvent.detail;

      if (priority === 'assertive') {
        setAssertiveMessage('');
        setTimeout(() => setAssertiveMessage(message), 50);
      } else {
        setPoliteMessage('');
        setTimeout(() => setPoliteMessage(message), 50);
      }
    };

    window.addEventListener('civora:announce', handleAnnounce);
    return () => window.removeEventListener('civora:announce', handleAnnounce);
  }, []);

  return (
    <div aria-hidden="false" className="sr-only">
      {/* Polite announcements for status changes and general feedback */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        id="a11y-live-polite"
      >
        {politeMessage}
      </div>

      {/* Assertive announcements for urgent alerts or errors */}
      <div
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        id="a11y-live-assertive"
      >
        {assertiveMessage}
      </div>
    </div>
  );
}
