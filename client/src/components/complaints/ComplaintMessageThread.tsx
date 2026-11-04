import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../context/useAuth.js';
import { Card } from '../ui/Card.js';
import { Button } from '../ui/Button.js';
import { Alert } from '../ui/Alert.js';
import { TextArea } from '../ui/TextArea.js';
import { ChatBubbleIcon, RefreshCwIcon } from '../ui/icons.js';
import type { ComplaintMessage } from '../../types/notification.js';

interface ComplaintMessageThreadProps {
  complaintId: string;
  trackingId?: string;
  className?: string;
}

function formatMessageTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' · ' + date.toLocaleDateString();
  } catch {
    return dateStr;
  }
}

export function ComplaintMessageThread({
  complaintId,
  trackingId,
  className = '',
}: ComplaintMessageThreadProps) {
  const { user, isAuthenticated } = useAuth();
  const [messages, setMessages] = useState<ComplaintMessage[]>([]);
  const [newMessage, setNewMessage] = useState<string>('');
  const [isInternal, setIsInternal] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const isInitialLoad = useRef(true);

  const isStaff = user?.role === 'ADMIN' || user?.role === 'GOVERNMENT_OFFICIAL';

  const fetchMessages = useCallback(async () => {
    if (!isAuthenticated || !complaintId) return;
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/complaints/${complaintId}/messages`, {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) {
        if (res.status === 403) {
          throw new Error('You are not authorized to view messages for this complaint.');
        }
        throw new Error(`Failed to load messages (HTTP ${res.status})`);
      }
      const json = await res.json();
      if (json.success && Array.isArray(json.data?.messages)) {
        setMessages(json.data.messages);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error loading communication thread.');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, complaintId]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  useEffect(() => {
    // Scroll only the message history container to bottom, without affecting the window/page scroll position
    if (messagesContainerRef.current) {
      if (isInitialLoad.current) {
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
        if (messages.length > 0) {
          isInitialLoad.current = false;
        }
      } else {
        messagesContainerRef.current.scrollTo({
          top: messagesContainerRef.current.scrollHeight,
          behavior: 'smooth',
        });
      }
    }
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    setIsSending(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`/api/complaints/${complaintId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          message: newMessage.trim(),
          isInternal: isStaff ? isInternal : false,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error?.message || 'Failed to send message.');
      }

      const json = await res.json();
      if (json.success && json.data?.message) {
        setMessages((prev) => [...prev, json.data.message]);
        setNewMessage('');
        setIsInternal(false);
        setSuccessMsg('Message posted successfully.');
        setTimeout(() => setSuccessMsg(null), 3000);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error submitting message.');
    } finally {
      setIsSending(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <Card className={`p-6 ${className}`}>
        <div className="flex items-center gap-2 text-[#6B7280] dark:text-[#D1D5DB] text-sm">
          <ChatBubbleIcon className="w-5 h-5 text-[#6B7280] dark:text-[#D1D5DB]" />
          <span>Sign in to view and participate in this complaint communication thread.</span>
        </div>
      </Card>
    );
  }

  return (
    <Card className={`p-5 sm:p-6 flex flex-col h-full ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-[#E5E7EB] dark:border-[#374151] mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#E5ECE8] dark:bg-[#273548] border border-[#0B3D2E]/20 dark:border-[#374151] flex items-center justify-center text-[#0B3D2E] dark:text-[#34D399]">
            <ChatBubbleIcon className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#111827] dark:text-[#F9FAFB]">Direct Communication Thread</h3>
            <p className="text-xs text-[#6B7280] dark:text-[#D1D5DB]">
              Official dialogue between citizen and department {trackingId ? `for ${trackingId}` : ''}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={fetchMessages}
          title="Refresh messages"
          aria-label="Refresh messages"
        >
          <RefreshCwIcon className="w-4 h-4" />
        </Button>
      </div>

      {errorMsg && (
        <div className="mb-4">
          <Alert variant="error" title="Communication Error">
            {errorMsg}
          </Alert>
        </div>
      )}

      {successMsg && (
        <div className="mb-4">
          <Alert variant="success" title="Success">
            {successMsg}
          </Alert>
        </div>
      )}

      {/* Message History Container */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto space-y-4 max-h-96 pr-1 mb-4">
        {isLoading ? (
          <div className="p-8 text-center text-[#6B7280] dark:text-[#D1D5DB] text-xs">
            Loading communication history...
          </div>
        ) : messages.length === 0 ? (
          <div className="p-8 text-center text-[#6B7280] dark:text-[#D1D5DB] border border-dashed border-[#E5E7EB] dark:border-[#374151] bg-[#F9FAFB] dark:bg-[#1F2937] rounded-xl">
            <ChatBubbleIcon className="w-8 h-8 mx-auto mb-2 text-[#6B7280] dark:text-[#D1D5DB]" />
            <p className="text-sm font-medium text-[#111827] dark:text-[#F9FAFB]">No messages yet</p>
            <p className="text-xs text-[#6B7280] dark:text-[#D1D5DB] mt-1">
              Ask a question, report additional details, or provide departmental clarifications below.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender.id === user?.id;
            const isSenderCitizen = msg.sender.role === 'CITIZEN';

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                <div className="flex items-center gap-1.5 mb-1 px-1 text-[11px]">
                  <span className="font-semibold text-[#374151] dark:text-[#D1D5DB]">
                    {isMe ? 'You' : msg.sender.name}
                  </span>
                  <span
                    className={`px-1.5 py-0.2 rounded text-[9px] font-bold border ${
                      isSenderCitizen
                        ? 'bg-[#F3F4F6] text-[#374151] border-[#D1D5DB] dark:bg-[#273548] dark:text-[#D1D5DB] dark:border-[#374151]'
                        : 'bg-[#E5ECE8] text-[#0B3D2E] border-[#0B3D2E]/20 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/40'
                    }`}
                  >
                    {isSenderCitizen ? 'CITIZEN' : 'OFFICIAL'}
                  </span>
                  {msg.isInternal && (
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20">
                      INTERNAL NOTE
                    </span>
                  )}
                  <span className="text-[#6B7280] dark:text-[#D1D5DB] ml-1">
                    {formatMessageTime(msg.createdAt)}
                  </span>
                </div>

                <div
                  className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-3.5 text-xs sm:text-sm leading-relaxed ${
                    msg.isInternal
                      ? 'bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-500/30 text-amber-900 dark:text-amber-200'
                      : isMe
                      ? 'bg-[#0B3D2E] dark:bg-[#0D7A58] text-white rounded-tr-none'
                      : 'bg-[#F9FAFB] dark:bg-[#273548] text-[#111827] dark:text-[#F9FAFB] border border-[#E5E7EB] dark:border-[#374151] rounded-tl-none'
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{msg.message}</p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Message Composer */}
      <form onSubmit={handleSendMessage} className="pt-3 border-t border-[#E5E7EB] dark:border-[#374151] space-y-3">
        <TextArea
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type your message or departmental update here..."
          rows={2}
          maxLength={2000}
          className="text-xs sm:text-sm bg-white dark:bg-[#1F2937]"
        />

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-3">
            {isStaff && (
              <label className="flex items-center gap-1.5 cursor-pointer text-[#6B7280] hover:text-[#111827] dark:text-[#D1D5DB] dark:hover:text-[#F9FAFB]">
                <input
                  type="checkbox"
                  checked={isInternal}
                  onChange={(e) => setIsInternal(e.target.checked)}
                  className="w-4 h-4 rounded bg-white dark:bg-[#1F2937] border-[#D1D5DB] dark:border-[#374151] text-[#0B3D2E] accent-[#0B3D2E] dark:accent-[#34D399] focus:ring-[#0B3D2E] dark:focus:ring-[#34D399]"
                />
                <span className="text-[11px]">Internal staff note only</span>
              </label>
            )}
            <span className="text-[11px] text-[#6B7280] dark:text-[#D1D5DB]">
              {newMessage.length} / 2000 characters
            </span>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={isSending || !newMessage.trim()}
          >
            {isSending ? 'Sending...' : 'Send Message'}
          </Button>
        </div>
      </form>
    </Card>
  );
}
