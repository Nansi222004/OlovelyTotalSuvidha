import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import {
  getCustomerTicketDetail,
  sendCustomerTicketMessage,
  closeCustomerTicket,
  SupportTicket,
  SupportStatus,
  SupportMessage,
  createSupportClientId,
} from "../../services/api/supportService";
import { subscribeToCustomerSupport } from "../../services/supportSocketService";

const STATUS_COLORS: Record<SupportStatus, { bg: string; text: string; border: string }> = {
  Pending: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  "In Progress": { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  Resolved: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  Closed: { bg: "bg-neutral-100", text: "text-neutral-600", border: "border-neutral-200" },
};

export default function TicketDetail() {
  const { ticketNumber } = useParams<{ ticketNumber: string }>();
  const navigate = useNavigate();
  const { token, isAuthReady, isAuthenticated } = useAuth();
  const { showToast } = useToast();

  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sendAttemptRef = useRef<{ text: string; id: string } | null>(null);
  const sendInFlightRef = useRef(false);
  const loadSequenceRef = useRef(0);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const loadTicket = useCallback(async () => {
    if (!ticketNumber || !isAuthReady || !isAuthenticated || !token) return;
    const sequence = ++loadSequenceRef.current;
    try {
      const res = await getCustomerTicketDetail(ticketNumber);
      if (sequence !== loadSequenceRef.current) return;
      if (res.success && res.data) {
        setTicket(res.data);
      } else {
        setError("Ticket not found");
      }
    } catch (err: any) {
      if (sequence !== loadSequenceRef.current) return;
      console.error("Error loading ticket:", err);
      setError(err?.response?.data?.message || "Failed to load ticket details");
    } finally {
      if (sequence === loadSequenceRef.current) setLoading(false);
    }
  }, [ticketNumber, isAuthReady, isAuthenticated, token]);

  useEffect(() => {
    void loadTicket();
    return () => {
      loadSequenceRef.current += 1;
    };
  }, [loadTicket]);

  useEffect(() => {
    if (!isAuthReady || !isAuthenticated || !token) return;
    return subscribeToCustomerSupport(token, (event) => {
      setTicket((current) => {
        if (!current) return current;
        const matchesTicket =
          event.ticketId === current._id ||
          (!!event.ticketNumber && event.ticketNumber === current.ticketNumber);
        if (!matchesTicket) return current;

        if (event.eventType === "STATUS_CHANGED" && event.status) {
          return { ...current, status: event.status };
        }

        if (event.eventType === "REPLIED" && event.message?._id) {
          const alreadyRendered = current.messages?.some(
            (item) => item._id === event.messageId || item._id === event.message?._id
          );
          if (alreadyRendered) return current;
          return {
            ...current,
            messages: [...(current.messages || []), event.message],
            status: event.status || current.status,
          };
        }

        // An incomplete event is a cache invalidation signal. Re-read through
        // the authorized ticket API rather than guessing at conversation state.
        return current;
      });
      if (event.eventType === "REPLIED" && !event.message?._id) {
        void loadTicket();
      }
    }, () => void loadTicket());
  }, [isAuthReady, isAuthenticated, token, loadTicket]);

  useEffect(() => {
    scrollToBottom();
  }, [ticket?.messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticket || !replyText.trim() || sendInFlightRef.current) return;

    if (ticket.status === "Closed") {
      showToast("This ticket is closed and cannot receive replies.", "error");
      return;
    }

    sendInFlightRef.current = true;
    setSending(true);
    setSendError(null);
    const text = replyText.trim();
    const attempt =
      sendAttemptRef.current?.text === text
        ? sendAttemptRef.current
        : { text, id: createSupportClientId("message") };
    sendAttemptRef.current = attempt;
    try {
      const res = await sendCustomerTicketMessage(
        ticket.ticketNumber || ticket._id,
        text,
        attempt.id
      );
      if (res.success && res.data) {
        setTicket(res.data);
        setReplyText("");
        sendAttemptRef.current = null;
        showToast("Reply sent successfully", "success");
      }
    } catch (err: any) {
      console.error("Error sending reply:", err);
      const message = err?.response?.data?.message || "Failed to send reply. You can retry safely.";
      setSendError(message);
      showToast(message, "error");
    } finally {
      sendInFlightRef.current = false;
      setSending(false);
    }
  };

  const handleCloseTicket = async () => {
    if (!ticket || ticket.status === "Closed") return;
    if (!window.confirm("Are you sure you want to close this support ticket?")) return;

    setClosing(true);
    try {
      const res = await closeCustomerTicket(ticket.ticketNumber || ticket._id);
      if (res.success && res.data) {
        setTicket(res.data);
        showToast("Ticket closed successfully", "success");
      }
    } catch (err: any) {
      console.error("Error closing ticket:", err);
      showToast(err?.response?.data?.message || "Failed to close ticket", "error");
    } finally {
      setClosing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs text-neutral-500 font-medium">Loading ticket conversation...</p>
        </div>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="min-h-screen bg-neutral-50 p-6 flex items-center justify-center">
        <div className="bg-white rounded-2xl border border-neutral-200 p-8 max-w-md w-full text-center shadow-xs">
          <div className="w-14 h-14 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h2 className="text-base font-bold text-neutral-900 mb-1">Ticket Not Found</h2>
          <p className="text-xs text-neutral-500 mb-6">{error || "Unable to display this ticket."}</p>
          <button
            onClick={() => navigate("/support/tickets")}
            className="px-4 py-2 bg-teal-600 text-white text-xs font-bold rounded-xl hover:bg-teal-700 transition-colors"
          >
            Back to Tickets
          </button>
        </div>
      </div>
    );
  }

  const statusCfg = STATUS_COLORS[ticket.status] || {
    bg: "bg-neutral-100",
    text: "text-neutral-700",
    border: "border-neutral-200",
  };

  const isClosed = ticket.status === "Closed";
  const conversationMessages: SupportMessage[] =
    ticket.messages?.length > 0
      ? ticket.messages
      : [
          {
            senderType: "CUSTOMER",
            senderName: ticket.name,
            message: ticket.message,
            createdAt: ticket.createdAt,
          },
        ];

  return (
    <div className="bg-neutral-50 h-[calc(100dvh-7.5rem)] min-h-[34rem] md:h-[calc(100dvh-6rem)] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-neutral-200 sticky top-0 z-20">
        <div className="px-4 md:px-6 max-w-4xl mx-auto py-3.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => navigate("/support/tickets")}
                className="text-neutral-700 hover:text-teal-600 p-1 -ml-1 rounded-lg transition-colors flex-shrink-0"
                aria-label="Back"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 18L9 12L15 6" />
                </svg>
              </button>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-100">
                    {ticket.ticketNumber || `#${ticket._id.slice(-6)}`}
                  </span>
                  <span className="text-[11px] font-medium text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded">
                    {ticket.category}
                  </span>
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}
                  >
                    {ticket.status}
                  </span>
                </div>
                <h1 className="text-sm md:text-base font-bold text-neutral-900 truncate mt-0.5">
                  {ticket.subject}
                </h1>
              </div>
            </div>

            {!isClosed && (
              <button
                onClick={handleCloseTicket}
                disabled={closing}
                className="px-3 py-1.5 text-xs font-medium text-neutral-600 hover:text-red-600 bg-neutral-100 hover:bg-red-50 border border-neutral-200 rounded-lg transition-colors flex-shrink-0"
              >
                {closing ? "Closing..." : "Close Ticket"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 max-w-4xl w-full mx-auto px-3 md:px-6 py-3 flex flex-col gap-3 overflow-hidden pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        {/* Linked Order Snapshot if applicable */}
        {ticket.orderNumber && (
          <div className="bg-blue-50/60 border border-blue-200/80 rounded-xl p-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center flex-shrink-0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <path d="M16 10a4 4 0 0 1-8 0" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-bold text-neutral-900">
                  Linked Order: #{ticket.orderNumber}
                </p>
                <p className="text-[11px] text-neutral-500">
                  Channel: {ticket.channel || "ECOMMERCE"} • Status: {ticket.fulfillmentContext?.orderStatus || "Active"}
                </p>
              </div>
            </div>

            {ticket.order && typeof ticket.order === "object" && ticket.order._id && (
              <Link
                to={`/order/${ticket.order._id}`}
                className="px-3 py-1 text-xs font-semibold text-blue-700 bg-white hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors flex-shrink-0"
              >
                View Order
              </Link>
            )}
          </div>
        )}

        {/* Conversation Stream */}
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-xs flex-1 min-h-0 flex flex-col p-3 md:p-5 overflow-hidden">
          <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1 overscroll-contain">
            {conversationMessages.map((m, idx) => {
                const isCustomer = m.senderType === "CUSTOMER";
                return (
                  <div
                      key={m._id || m.clientMessageId || `legacy-${idx}`}
                    className={`flex items-start gap-3 ${
                      isCustomer ? "flex-row-reverse" : "flex-row"
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                        isCustomer
                          ? "bg-teal-600 text-white"
                          : "bg-neutral-800 text-white"
                      }`}
                    >
                      {isCustomer ? "You" : "CS"}
                    </div>

                    <div
                      className={`max-w-[85%] rounded-2xl p-3.5 shadow-2xs ${
                        isCustomer
                          ? "bg-teal-50 border border-teal-100 rounded-tr-xs"
                          : "bg-neutral-100 border border-neutral-200 rounded-tl-xs"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-xs font-bold text-neutral-900">
                          {isCustomer ? "You" : m.senderName || "Support Team"}
                        </span>
                        <span className="text-[10px] text-neutral-400">
                          {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-800 whitespace-pre-wrap leading-relaxed">
                        {m.message}
                      </p>
                    </div>
                  </div>
                );
              })}

            <div ref={messagesEndRef} />
          </div>

          {/* Closed Banner or Reply Input */}
          <div className="pt-4 border-t border-neutral-100 mt-4">
            {isClosed ? (
              <div className="bg-neutral-100 rounded-xl p-3 text-center">
                <p className="text-xs text-neutral-600 font-medium">
                  This support ticket is marked as <strong className="font-bold">Closed</strong>.
                </p>
                <p className="text-[11px] text-neutral-400 mt-0.5">
                  If you require further assistance, please raise a new ticket from{" "}
                  <Link to="/support/tickets" className="text-teal-600 underline font-semibold">
                    My Tickets
                  </Link>.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSendMessage} className="space-y-2">
                {sendError && (
                  <p role="alert" className="text-[11px] text-red-700 bg-red-50 px-3 py-1.5 rounded-lg border border-red-200">
                    {sendError}
                  </p>
                )}
                {ticket.status === "Resolved" && (
                  <p className="text-[11px] text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200">
                    This ticket was marked as resolved. Sending a message will reopen it.
                  </p>
                )}
                <div className="flex items-end gap-2">
                  <textarea
                    rows={2}
                    placeholder="Type your message here..."
                    value={replyText}
                    onChange={(e) => {
                      setReplyText(e.target.value);
                      setSendError(null);
                      if (sendAttemptRef.current?.text !== e.target.value.trim()) {
                        sendAttemptRef.current = null;
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage(e);
                      }
                    }}
                    disabled={sending}
                    className="flex-1 min-h-12 max-h-28 text-xs bg-neutral-50 border border-neutral-300 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-y disabled:opacity-60"
                  />
                  <button
                    type="submit"
                    disabled={!replyText.trim() || sending}
                    className="px-4 py-3 bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white rounded-xl shadow-xs transition-colors flex items-center justify-center font-bold text-xs flex-shrink-0"
                  >
                    {sending ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="22" y1="2" x2="11" y2="13" />
                        <polygon points="22 2 15 22 11 13 2 9 22 2" />
                      </svg>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
