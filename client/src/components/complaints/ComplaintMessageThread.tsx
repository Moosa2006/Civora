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
        <div className="flex items-center gap-2 text-[#54625A] dark:text-[#C5D4C9] text-sm">
          <ChatBubbleIcon className="w-5 h-5 text-[#54625A] dark:text-[#C5D4C9]" />
          <span>Sign in to view and participate in this complaint communication thread.</span>
        </div>
      </Card>
    );
  }

  return (
    <Card className={`p-5 sm:p-6 flex flex-col h-full ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-[#DED8CB] dark:border-[#283931] mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#E8F1F8] dark:bg-[#152733] border border-[#A8C9E3] dark:border-[#22445E] flex items-center justify-center text-[#1B5E8A] dark:text-[#78B4DD]">
            <ChatBubbleIcon className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#202522] dark:text-[#F5F2EA]">Direct Communication Thread</h3>
            <p className="text-xs text-[#54625A] dark:text-[#C5D4C9]">
              Official dialogue between citizen and department {trackingId ? `for ${trackingId}` : ''}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchMessages}
          className="text-[#54625A] hover:text-[#202522] dark:text-[#C5D4C9] dark:hover:text-[#E8F0EC]"
          title="Refresh messages"
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
          <div className="p-8 text-center text-[#54625A] dark:text-[#C5D4C9] text-xs">
            Loading communication history...
          </div>
        ) : messages.length === 0 ? (
          <div className="p-8 text-center text-[#54625A] dark:text-[#C5D4C9] border border-dashed border-[#DED8CB] dark:border-[#283931] rounded-xl">
            <ChatBubbleIcon className="w-8 h-8 mx-auto mb-2 text-[#54625A] dark:text-[#C5D4C9]" />
            <p className="text-sm font-medium text-[#202522] dark:text-[#F5F2EA]">No messages yet</p>
            <p className="text-xs text-[#54625A] dark:text-[#C5D4C9] mt-1">
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
                  <span className="font-semibold text-[#3E4B44] dark:text-[#C5D4C9]">
                    {isMe ? 'You' : msg.sender.name}
                  </span>
                  <span
                    className={`px-1.5 py-0.2 rounded text-[9px] font-bold border ${
                      isSenderCitizen
                        ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                        : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    }`}
                  >
                    {isSenderCitizen ? 'CITIZEN' : 'OFFICIAL'}
                  </span>
                  {msg.isInternal && (
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      INTERNAL NOTE
                    </span>
                  )}
                  <span className="text-[#54625A] dark:text-[#C5D4C9] ml-1">
                    {formatMessageTime(msg.createdAt)}
                  </span>
                </div>

                <div
                  className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-3.5 text-xs sm:text-sm leading-relaxed ${
                    msg.isInternal
                      ? 'bg-amber-950/40 border border-amber-500/30 text-amber-200'
                      : isMe
                      ? 'bg-[#173D32] text-[#F4F0E6] rounded-tr-none'
                      : 'bg-[#ECE7DB]/90 dark:bg-[#1D2A25]/90 text-[#202522] dark:text-[#F5F2EA] border border-[#DED8CB] dark:border-[#283931] rounded-tl-none'
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
      <form onSubmit={handleSendMessage} className="pt-3 border-t border-[#DED8CB] dark:border-[#283931] space-y-3">
        <TextArea
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type your message or departmental update here..."
          rows={2}
          maxLength={2000}
          className="text-xs sm:text-sm bg-white dark:bg-[#16201C]"
        />

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-3">
            {isStaff && (
              <label className="flex items-center gap-1.5 cursor-pointer text-[#54625A] hover:text-[#202522] dark:text-[#C5D4C9] dark:hover:text-[#F5F2EA]">
                <input
                  type="checkbox"
                  checked={isInternal}
                  onChange={(e) => setIsInternal(e.target.checked)}
                  className="w-4 h-4 rounded bg-white dark:bg-[#16201C] border-[#DED8CB] dark:border-[#283931] text-amber-600 focus:ring-amber-500"
                />
                <span className="text-[11px]">Internal staff note only</span>
              </label>
            )}
            <span className="text-[11px] text-[#54625A] dark:text-[#C5D4C9]">
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
