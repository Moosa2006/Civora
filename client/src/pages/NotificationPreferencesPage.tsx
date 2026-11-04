import { useState, useEffect } from 'react';
import { useAuth } from '../context/useAuth.js';
import { useRouter } from '../router/index.js';
import { Container } from '../components/layout/Container.js';
import { PageHeading } from '../components/ui/PageHeading.js';
import { Card } from '../components/ui/Card.js';
import { Button } from '../components/ui/Button.js';
import { Alert } from '../components/ui/Alert.js';
import { BellIcon, InfoIcon } from '../components/ui/icons.js';
import type { NotificationPreferences } from '../types/notification.js';

export function NotificationPreferencesPage() {
  const { isAuthenticated } = useAuth();
  const { navigate } = useRouter();

  const [prefs, setPrefs] = useState<NotificationPreferences>({
    emailNotifications: false,
    statusChangeAlerts: true,
    progressUpdateAlerts: true,
    assignmentAlerts: true,
    messageAlerts: true,
    resolutionAlerts: true,
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    async function loadPreferences() {
      if (!isAuthenticated) return;
      setIsLoading(true);
      setErrorMsg(null);
      try {
        const res = await fetch('/api/notifications/preferences', {
          headers: { Accept: 'application/json' },
        });
        if (!res.ok) {
          throw new Error(`Failed to load preferences: HTTP ${res.status}`);
        }
        const json = await res.json();
        if (json.success && json.data?.preferences) {
          setPrefs({
            emailNotifications: Boolean(json.data.preferences.emailNotifications),
            statusChangeAlerts: Boolean(json.data.preferences.statusChangeAlerts),
            progressUpdateAlerts: Boolean(json.data.preferences.progressUpdateAlerts),
            assignmentAlerts: Boolean(json.data.preferences.assignmentAlerts),
            messageAlerts: Boolean(json.data.preferences.messageAlerts),
            resolutionAlerts: Boolean(json.data.preferences.resolutionAlerts),
          });
        }
      } catch (err: any) {
        setErrorMsg(err.message || 'Could not load your notification preferences.');
      } finally {
        setIsLoading(false);
      }
    }

    loadPreferences();
  }, [isAuthenticated]);

  const handleToggle = (key: keyof NotificationPreferences) => {
    setPrefs((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
    setSuccessMsg(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(prefs),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error?.message || 'Failed to save preferences.');
      }

      setSuccessMsg('Your notification preferences have been saved successfully.');
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred while saving preferences.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <Container size="md" className="py-12">
        <Alert variant="warning" title="Authentication Required">
          Please sign in to configure your personal alert preferences.
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
    <Container size="md" className="space-y-6">
      <PageHeading
        title="Notification Settings"
        description="Control which events trigger in-app alerts and manage external delivery preferences."
        className="mb-0"
      />

      {successMsg && (
        <div className="mb-6">
          <Alert variant="success" title="Success">
            {successMsg}
          </Alert>
        </div>
      )}

      {errorMsg && (
        <div className="mb-6">
          <Alert variant="error" title="Error">
            {errorMsg}
          </Alert>
        </div>
      )}

      {isLoading ? (
        <Card className="p-8 text-center text-[#6B7280] dark:text-[#D1D5DB]">Loading your preferences...</Card>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          {/* In-App Alerts Category */}
          <Card className="p-6">
            <h2 className="text-base font-semibold text-[#111827] dark:text-[#F9FAFB] mb-1 flex items-center gap-2">
              <BellIcon className="w-5 h-5 text-civic-400" />
              <span>Grievance Lifecycle Alerts</span>
            </h2>
            <p className="text-xs text-[#6B7280] dark:text-[#D1D5DB] mb-6">
              Configure real-time in-app alerts for complaints you have lodged or are managing.
            </p>

            <div className="space-y-5 divide-y divide-[#E5E7EB] dark:divide-[#374151]">
              {/* Status Changes */}
              <div className="pt-4 first:pt-0 flex items-start justify-between gap-4">
                <div className="flex-1">
                  <label htmlFor="statusChangeAlerts" className="text-sm font-medium text-[#111827] dark:text-[#F9FAFB] block cursor-pointer">
                    Status Transition Alerts
                  </label>
                  <p className="text-xs text-[#6B7280] dark:text-[#D1D5DB] mt-0.5">
                    Receive alerts when complaints move through Under Review, Assigned, In Progress, or Closed states.
                  </p>
                </div>
                <input
                  id="statusChangeAlerts"
                  type="checkbox"
                  checked={prefs.statusChangeAlerts}
                  onChange={() => handleToggle('statusChangeAlerts')}
                  className="w-5 h-5 mt-1 rounded bg-[#F3F4F6] dark:bg-[#273548] border-[#E5E7EB] dark:border-[#374151] text-[#0B3D2E] accent-[#0B3D2E] dark:accent-[#34D399] focus:ring-[#0B3D2E] dark:focus:ring-[#34D399] cursor-pointer"
                />
              </div>

              {/* Official Progress Updates */}
              <div className="pt-4 flex items-start justify-between gap-4">
                <div className="flex-1">
                  <label htmlFor="progressUpdateAlerts" className="text-sm font-medium text-[#111827] dark:text-[#F9FAFB] block cursor-pointer">
                    Field Progress Updates
                  </label>
                  <p className="text-xs text-[#6B7280] dark:text-[#D1D5DB] mt-0.5">
                    Receive alerts when field officers log official milestone reports, photos, or technical notes.
                  </p>
                </div>
                <input
                  id="progressUpdateAlerts"
                  type="checkbox"
                  checked={prefs.progressUpdateAlerts}
                  onChange={() => handleToggle('progressUpdateAlerts')}
                  className="w-5 h-5 mt-1 rounded bg-[#F3F4F6] dark:bg-[#273548] border-[#E5E7EB] dark:border-[#374151] text-[#0B3D2E] accent-[#0B3D2E] dark:accent-[#34D399] focus:ring-[#0B3D2E] dark:focus:ring-[#34D399] cursor-pointer"
                />
              </div>

              {/* Department Assignments */}
              <div className="pt-4 flex items-start justify-between gap-4">
                <div className="flex-1">
                  <label htmlFor="assignmentAlerts" className="text-sm font-medium text-[#111827] dark:text-[#F9FAFB] block cursor-pointer">
                    Department Assignment & Reassignment
                  </label>
                  <p className="text-xs text-[#6B7280] dark:text-[#D1D5DB] mt-0.5">
                    Notifies citizens when complaints are assigned to municipal bodies and alerts officers of new assignments.
                  </p>
                </div>
                <input
                  id="assignmentAlerts"
                  type="checkbox"
                  checked={prefs.assignmentAlerts}
                  onChange={() => handleToggle('assignmentAlerts')}
                  className="w-5 h-5 mt-1 rounded bg-[#F3F4F6] dark:bg-[#273548] border-[#E5E7EB] dark:border-[#374151] text-[#0B3D2E] accent-[#0B3D2E] dark:accent-[#34D399] focus:ring-[#0B3D2E] dark:focus:ring-[#34D399] cursor-pointer"
                />
              </div>

              {/* Citizen-Official Messages */}
              <div className="pt-4 flex items-start justify-between gap-4">
                <div className="flex-1">
                  <label htmlFor="messageAlerts" className="text-sm font-medium text-[#111827] dark:text-[#F9FAFB] block cursor-pointer">
                    Direct Grievance Inquiries & Messages
                  </label>
                  <p className="text-xs text-[#6B7280] dark:text-[#D1D5DB] mt-0.5">
                    Instant alerts when citizens or department officials send messages regarding active issues.
                  </p>
                </div>
                <input
                  id="messageAlerts"
                  type="checkbox"
                  checked={prefs.messageAlerts}
                  onChange={() => handleToggle('messageAlerts')}
                  className="w-5 h-5 mt-1 rounded bg-[#F3F4F6] dark:bg-[#273548] border-[#E5E7EB] dark:border-[#374151] text-[#0B3D2E] accent-[#0B3D2E] dark:accent-[#34D399] focus:ring-[#0B3D2E] dark:focus:ring-[#34D399] cursor-pointer"
                />
              </div>

              {/* Resolution Verification */}
              <div className="pt-4 flex items-start justify-between gap-4">
                <div className="flex-1">
                  <label htmlFor="resolutionAlerts" className="text-sm font-medium text-[#111827] dark:text-[#F9FAFB] block cursor-pointer">
                    Resolution Verification & Dispute Alerts
                  </label>
                  <p className="text-xs text-[#6B7280] dark:text-[#D1D5DB] mt-0.5">
                    Alerts when a complaint is marked resolved awaiting citizen confirmation, or reopened for rework.
                  </p>
                </div>
                <input
                  id="resolutionAlerts"
                  type="checkbox"
                  checked={prefs.resolutionAlerts}
                  onChange={() => handleToggle('resolutionAlerts')}
                  className="w-5 h-5 mt-1 rounded bg-[#F3F4F6] dark:bg-[#273548] border-[#E5E7EB] dark:border-[#374151] text-[#0B3D2E] accent-[#0B3D2E] dark:accent-[#34D399] focus:ring-[#0B3D2E] dark:focus:ring-[#34D399] cursor-pointer"
                />
              </div>
            </div>
          </Card>

          {/* External Channel Delivery */}
          <Card className="p-6">
            <h2 className="text-base font-semibold text-[#111827] dark:text-[#F9FAFB] mb-1">External Channels</h2>
            <p className="text-xs text-[#6B7280] dark:text-[#D1D5DB] mb-6">
              Configure secondary notification channels outside the Civora web app.
            </p>

            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <label htmlFor="emailNotifications" className="text-sm font-medium text-[#111827] dark:text-[#F9FAFB] block cursor-pointer">
                  Email Notifications
                </label>
                <p className="text-xs text-[#6B7280] dark:text-[#D1D5DB] mt-0.5">
                  Receive summary emails for critical lifecycle events when email delivery service is configured.
                </p>
              </div>
              <input
                id="emailNotifications"
                type="checkbox"
                checked={prefs.emailNotifications}
                onChange={() => handleToggle('emailNotifications')}
                className="w-5 h-5 mt-1 rounded bg-[#F3F4F6] dark:bg-[#273548] border-[#E5E7EB] dark:border-[#374151] text-[#0B3D2E] accent-[#0B3D2E] dark:accent-[#34D399] focus:ring-[#0B3D2E] dark:focus:ring-[#34D399] cursor-pointer"
              />
            </div>
          </Card>

          {/* Mandatory Integrity Policy Alert */}
          <div className="flex items-start gap-3 p-4 rounded-xl bg-[#F9FAFB] dark:bg-[#182230] border border-[#E5E7EB] dark:border-[#374151] text-xs text-[#6B7280] dark:text-[#D1D5DB]">
            <InfoIcon className="w-5 h-5 text-civic-400 shrink-0 mt-0.5" />
            <p>
              <strong className="text-[#374151] dark:text-[#D1D5DB]">Public Accountability Guarantee:</strong> Critical audit events,
              including official complaint tracking ID issuance and final resolution confirmations, will always be
              recorded in your in-app notification center to ensure full transparency.
            </p>
          </div>

          {/* Form Action Controls */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/notifications')}
            >
              Back to Notifications
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save Preferences'}
            </Button>
          </div>
        </form>
      )}
    </Container>
  );
}
