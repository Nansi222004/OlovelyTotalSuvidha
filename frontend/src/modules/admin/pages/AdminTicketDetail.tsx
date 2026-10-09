import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  getAdminTicketById,
  sendAdminTicketMessage,
  updateAdminTicketStatus,
  updateAdminTicketPriority,
  SupportTicket,
  SupportStatus,
  SupportPriority,
  SupportMessage,
  createSupportClientId,
} from "../../../services/api/supportService";
import { ADMIN_SUPPORT_BROWSER_EVENT } from "../hooks/useAdminSocket";
import type { AdminSupportEvent } from "../hooks/useAdminSocket";

const STATUS_COLORS: Record<SupportStatus, { bg: string; text: string; border: string }> = {
  Pending: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  "In Progress": { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  Resolved: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  Closed: { bg: "bg-neutral-100", text: "text-neutral-600", border: "border-neutral-200" },
};

const PRIORITY_COLORS: Record<SupportPriority, { bg: string; text: string }> = {
  Low: { bg: "bg-neutral-100", text: "text-neutral-700" },
  Normal: { bg: "bg-blue-100", text: "text-blue-800" },
  High: { bg: "bg-orange-100", text: "text-orange-800" },
  Urgent: { bg: "bg-red-100", text: "text-red-800" },
};

// State Machine transitions for Admin
const VALID_TRANSITIONS: Record<SupportStatus, SupportStatus[]> = {
  Pending: ["In Progress", "Resolved", "Closed"],
  "In Progress": ["Resolved", "Closed"],
  Resolved: ["In Progress", "Closed"],
  Closed: [], // terminal
};

export default function AdminTicketDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replyMessage, setReplyMessage] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [updatingPriority, setUpdatingPriority] = useState(false);
  const [actionNotice, setActionNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sendAttemptRef = useRef<{ text: string; id: string } | null>(null);
  const sendInFlightRef = useRef(false);
  const loadSequenceRef = useRef(0);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const loadTicket = useCallback(async () => {
    if (!id) return;
    const sequence = ++loadSequenceRef.current;
    setLoading(true);
    setError(null);
    try {
      const res = await getAdminTicketById(id);
      if (sequence !== loadSequenceRef.current) return;
      if (res.success && res.data) {
        setTicket(res.data);
      } else {
        setError("Support ticket not found");
      }
    } catch (err: any) {
      if (sequence !== loadSequenceRef.current) return;
      console.error("Error loading ticket detail:", err);
      setError(err?.response?.data?.message || "Failed to load ticket");
    } finally {
      if (sequence === loadSequenceRef.current) setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadTicket();
    return () => {
      loadSequenceRef.current += 1;
    };
  }, [loadTicket]);

  useEffect(() => {
    const handleSupportEvent = (rawEvent: Event) => {
      const event = (rawEvent as CustomEvent<AdminSupportEvent>).detail;
      if (!event) return;

      setTicket((current) => {
        if (!current) return current;
        const matches = event.ticketId === current._id || event.ticketNumber === current.ticketNumber;
        if (!matches) return current;

        if (event.eventType === "REPLIED" && event.message?._id) {
          const alreadyRendered = current.messages?.some(
            (message) => message._id === event.messageId || message._id === event.message?._id
          );
          if (alreadyRendered) return current;
          return {
            ...current,
            messages: [...(current.messages || []), event.message as SupportMessage],
          };
        }

        void loadTicket();
        return current;
      });
    };

    window.addEventListener(ADMIN_SUPPORT_BROWSER_EVENT, handleSupportEvent);
    return () => window.removeEventListener(ADMIN_SUPPORT_BROWSER_EVENT, handleSupportEvent);
  }, [loadTicket]);

  useEffect(() => {
    scrollToBottom();
  }, [ticket?.messages]);

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticket || !replyMessage.trim() || sendInFlightRef.current) return;

    sendInFlightRef.current = true;
    setSendingReply(true);
    setActionNotice(null);
    const text = replyMessage.trim();
    const attempt =
      sendAttemptRef.current?.text === text
        ? sendAttemptRef.current
        : { text, id: createSupportClientId("message") };
    sendAttemptRef.current = attempt;
    try {
      const res = await sendAdminTicketMessage(ticket._id, text, attempt.id);
      if (res.success && res.data) {
        setTicket(res.data);
        setReplyMessage("");
        sendAttemptRef.current = null;
        setActionNotice({ type: "success", text: "Reply sent to customer successfully." });
      }
    } catch (err: any) {
      console.error("Failed to send admin reply:", err);
      setActionNotice({
        type: "error",
        text: err?.response?.data?.message || "Failed to send reply",
      });
    } finally {
      sendInFlightRef.current = false;
      setSendingReply(false);
    }
  };

  const handleStatusChange = async (newStatus: SupportStatus) => {
    if (!ticket || ticket.status === newStatus || updatingStatus) return;

    setUpdatingStatus(true);
    setActionNotice(null);
    try {
      const res = await updateAdminTicketStatus(ticket._id, newStatus);
      if (res.success && res.data) {
        setTicket(res.data);
        setActionNotice({
          type: "success",
          text: `Ticket status updated to ${newStatus}.`,
        });
      }
    } catch (err: any) {
      console.error("Failed to update status:", err);
      setActionNotice({
        type: "error",
        text: err?.response?.data?.message || "Failed to update status",
      });
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handlePriorityChange = async (newPriority: SupportPriority) => {
    if (!ticket || ticket.priority === newPriority || updatingPriority) return;

    setUpdatingPriority(true);
    setActionNotice(null);
    try {
      const res = await updateAdminTicketPriority(ticket._id, newPriority);
      if (res.success && res.data) {
        setTicket(res.data);
        setActionNotice({
          type: "success",
          text: `Priority updated to ${newPriority}.`,
        });
      }
    } catch (err: any) {
      console.error("Failed to update priority:", err);
      setActionNotice({
        type: "error",
        text: err?.response?.data?.message || "Failed to update priority",
      });
    } finally {
      setUpdatingPriority(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center min-h-[500px] flex flex-col items-center justify-center">
        <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs text-neutral-500 font-medium">Loading ticket details...</p>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="p-6 max-w-lg mx-auto">
        <div className="bg-white rounded-xl border border-neutral-200 p-8 text-center shadow-xs">
          <p className="text-sm font-bold text-neutral-900 mb-2">Ticket Not Found</p>
          <p className="text-xs text-neutral-500 mb-5">{error || "Unable to display this ticket."}</p>
          <button
            onClick={() => navigate("/admin/support/tickets")}
            className="px-4 py-2 bg-teal-600 text-white text-xs font-bold rounded-lg hover:bg-teal-700 transition-colors"
          >
            Back to Tickets List
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
  const prioCfg = PRIORITY_COLORS[ticket.priority] || {
    bg: "bg-neutral-100",
    text: "text-neutral-700",
  };

  const allowedTransitions = VALID_TRANSITIONS[ticket.status] || [];
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
    <div className="p-3 md:p-5 space-y-3 max-w-7xl mx-auto min-h-0">
      {/* Back button and Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/admin/support/tickets")}
            className="text-neutral-600 hover:text-teal-600 p-1.5 -ml-1 rounded-lg border border-neutral-200 hover:border-teal-400 bg-white transition-colors"
            title="Back to Tickets"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18L9 12L15 6" />
            </svg>
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              {ticket.ticketNumber ? (
                <span className="font-mono text-xs font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-100">
                  {ticket.ticketNumber}
                </span>
              ) : (
                <span className="font-mono text-xs text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded">
                  Legacy Contact Request
                </span>
              )}
              <span className="text-[11px] font-medium text-neutral-600 bg-neutral-100 px-2 py-0.5 rounded">
                {ticket.category}
              </span>
              <span
                className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}
              >
                {ticket.status}
              </span>
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${prioCfg.bg} ${prioCfg.text}`}>
                Priority: {ticket.priority}
              </span>
            </div>
            <h1 className="text-base md:text-lg font-bold text-neutral-900 mt-1">{ticket.subject}</h1>
          </div>
        </div>
      </div>

      {actionNotice && (
        <div
          className={`p-3 rounded-lg text-xs font-semibold flex items-center justify-between ${
            actionNotice.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          <span>{actionNotice.text}</span>
          <button onClick={() => setActionNotice(null)} className="text-neutral-400 hover:text-neutral-600">
            ✕
          </button>
        </div>
      )}

      {/* Main Grid: Chat + Right Info Panel */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-start">
        {/* Left Column: Conversation */}
        <div className="xl:col-span-2 bg-white rounded-xl border border-neutral-200 shadow-xs flex flex-col h-[min(68rem,calc(100dvh-12rem))] min-h-[32rem] overflow-hidden">
          {/* Conversation Header */}
          <div className="px-5 py-3 border-b border-neutral-200 bg-neutral-50 flex items-center justify-between">
            <span className="text-xs font-bold text-neutral-700 uppercase tracking-wider">
              Conversation Thread
            </span>
            <span className="text-[11px] text-neutral-400">
              {ticket.messages?.length ? `${ticket.messages.length} replies` : "1 initial inquiry"}
            </span>
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {conversationMessages.map((m, idx) => {
                const isAdmin = m.senderType === "ADMIN";
                return (
                  <div
                    key={m._id || m.clientMessageId || `legacy-${idx}`}
                    className={`flex items-start gap-3 ${isAdmin ? "flex-row-reverse" : "flex-row"}`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                        isAdmin ? "bg-neutral-900 text-white" : "bg-teal-600 text-white"
                      }`}
                    >
                      {isAdmin ? "AD" : ticket.name.charAt(0).toUpperCase()}
                    </div>

                    <div
                      className={`max-w-[85%] rounded-2xl p-4 shadow-2xs ${
                        isAdmin
                          ? "bg-neutral-900 text-white rounded-tr-xs"
                          : "bg-teal-50/60 border border-teal-100 rounded-tl-xs"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-xs font-bold ${isAdmin ? "text-neutral-100" : "text-neutral-900"}`}
                          >
                            {isAdmin ? m.senderName || "Support Team" : ticket.name}
                          </span>
                          <span
                            className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                              isAdmin ? "bg-neutral-700 text-neutral-200" : "bg-teal-100 text-teal-700"
                            }`}
                          >
                            {isAdmin ? "Support Agent" : "Customer"}
                          </span>
                        </div>
                        <span className={`text-[10px] ${isAdmin ? "text-neutral-400" : "text-neutral-400"}`}>
                          {new Date(m.createdAt).toLocaleString("en-IN", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <p
                        className={`text-xs whitespace-pre-wrap leading-relaxed ${
                          isAdmin ? "text-neutral-200" : "text-neutral-800"
                        }`}
                      >
                        {m.message}
                      </p>
                    </div>
                  </div>
                );
              })}
            <div ref={messagesEndRef} />
          </div>

          {/* Reply Form */}
          <div className="p-4 border-t border-neutral-200 bg-neutral-50/60">
            {ticket.status === "Closed" ? (
              <div className="p-3 text-center bg-neutral-200/50 rounded-lg text-xs text-neutral-600 font-medium">
                This ticket is marked as <strong>Closed</strong>. You cannot send replies to closed tickets.
              </div>
            ) : (
              <form onSubmit={handleSendReply} className="space-y-2">
                <textarea
                  rows={3}
                  placeholder="Type an official reply to the customer (they will be notified)..."
                  value={replyMessage}
                  onChange={(e) => {
                    setReplyMessage(e.target.value);
                    if (sendAttemptRef.current?.text !== e.target.value.trim()) {
                      sendAttemptRef.current = null;
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault();
                      handleSendReply(e);
                    }
                  }}
                  disabled={sendingReply}
                  className="w-full min-h-16 max-h-36 text-xs bg-white border border-neutral-300 rounded-lg p-3 focus:ring-2 focus:ring-teal-500 focus:outline-none resize-y disabled:opacity-60"
                />
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-neutral-400">Tip: Press Ctrl + Enter to send</span>
                  <button
                    type="submit"
                    disabled={!replyMessage.trim() || sendingReply}
                    className="px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs"
                  >
                    {sendingReply ? (
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="22" y1="2" x2="11" y2="13" />
                        <polygon points="22 2 15 22 11 13 2 9 22 2" />
                      </svg>
                    )}
                    Send Reply
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Right Column: Actions, Customer Info, Order Snapshot */}
        <div className="space-y-4">
          {/* Status State Machine Controller */}
          <div className="bg-white rounded-xl border border-neutral-200 p-4 shadow-xs">
            <h3 className="text-xs font-bold text-neutral-700 uppercase tracking-wider mb-3">
              Status State Machine
            </h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs py-1">
                <span className="text-neutral-500">Current Status:</span>
                <span
                  className={`px-2.5 py-0.5 rounded-full border text-xs font-bold ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}
                >
                  {ticket.status}
                </span>
              </div>

              {allowedTransitions.length > 0 ? (
                <div className="pt-2 border-t border-neutral-100">
                  <p className="text-[11px] text-neutral-500 mb-2 font-medium">Valid transitions:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {allowedTransitions.map((target) => (
                      <button
                        key={target}
                        disabled={updatingStatus}
                        onClick={() => handleStatusChange(target)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                          target === "Resolved"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100"
                            : target === "Closed"
                            ? "bg-neutral-100 text-neutral-700 border-neutral-300 hover:bg-neutral-200"
                            : "bg-blue-50 text-blue-700 border-blue-300 hover:bg-blue-100"
                        }`}
                      >
                        → Set {target}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-neutral-400 italic pt-1">
                  This ticket has reached terminal state ({ticket.status}).
                </p>
              )}
            </div>
          </div>

          {/* Priority Controller */}
          <div className="bg-white rounded-xl border border-neutral-200 p-4 shadow-xs">
            <h3 className="text-xs font-bold text-neutral-700 uppercase tracking-wider mb-2">
              Ticket Priority
            </h3>
            <div className="flex items-center gap-1.5">
              {(["Low", "Normal", "High", "Urgent"] as SupportPriority[]).map((p) => (
                <button
                  key={p}
                  disabled={updatingPriority || ticket.priority === p}
                  onClick={() => handlePriorityChange(p)}
                  className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all border ${
                    ticket.priority === p
                      ? `${PRIORITY_COLORS[p].bg} ${PRIORITY_COLORS[p].text} border-current shadow-xs`
                      : "bg-neutral-50 text-neutral-600 border-neutral-200 hover:bg-neutral-100"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Customer Details */}
          <div className="bg-white rounded-xl border border-neutral-200 p-4 shadow-xs">
            <h3 className="text-xs font-bold text-neutral-700 uppercase tracking-wider mb-3">
              Customer Information
            </h3>
            <div className="space-y-2 text-xs">
              <div>
                <span className="text-[11px] text-neutral-400 block">Name</span>
                <span className="font-bold text-neutral-900">{ticket.name}</span>
              </div>
              <div>
                <span className="text-[11px] text-neutral-400 block">Email</span>
                <a href={`mailto:${ticket.email}`} className="text-teal-600 hover:underline">
                  {ticket.email}
                </a>
              </div>
              {ticket.mobile && (
                <div>
                  <span className="text-[11px] text-neutral-400 block">Mobile</span>
                  <a href={`tel:${ticket.mobile}`} className="text-neutral-900 font-mono">
                    {ticket.mobile}
                  </a>
                </div>
              )}
              {ticket.customer && typeof ticket.customer === "object" && (
                <div className="pt-2 border-t border-neutral-100">
                  <span className="text-[11px] text-neutral-400 block">Customer ID</span>
                  <span className="font-mono text-[11px] text-neutral-600">
                    {ticket.customer._id}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Order Details snapshot if linked */}
          {ticket.orderNumber && (
            <div className="bg-white rounded-xl border border-neutral-200 p-4 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold text-neutral-700 uppercase tracking-wider">
                  Linked Order
                </h3>
                {ticket.order && typeof ticket.order === "object" && ticket.order._id && (
                  <Link
                    to={`/admin/orders/${ticket.order._id}`}
                    className="text-[11px] font-bold text-teal-600 hover:underline"
                  >
                    View Order Details →
                  </Link>
                )}
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-neutral-400">Order Number</span>
                  <span className="font-mono font-bold text-neutral-900">#{ticket.orderNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400">Channel</span>
                  <span className="font-semibold text-neutral-800">
                    {ticket.channel === "QUICK_COMMERCE" ? "Quick Commerce" : ticket.channel || "Ecommerce"}
                  </span>
                </div>
                {ticket.fulfillmentContext?.orderStatus && (
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Order Status</span>
                    <span className="font-medium text-neutral-700">
                      {ticket.fulfillmentContext.orderStatus}
                    </span>
                  </div>
                )}
                {ticket.fulfillmentContext?.totalAmount !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Total Amount</span>
                    <span className="font-bold text-neutral-900">
                      ₹{ticket.fulfillmentContext.totalAmount}
                    </span>
                  </div>
                )}
                {ticket.fulfillmentContext?.deliveryPartner && (
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Delivery Partner</span>
                    <span className="text-neutral-700">{ticket.fulfillmentContext.deliveryPartner}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Ticket Metadata */}
          <div className="bg-neutral-50 rounded-xl border border-neutral-200 p-3.5 text-[11px] text-neutral-500 space-y-1">
            <div className="flex justify-between">
              <span>Created:</span>
              <span className="font-medium text-neutral-700">
                {new Date(ticket.createdAt).toLocaleString("en-IN")}
              </span>
            </div>
            {ticket.resolvedAt && (
              <div className="flex justify-between">
                <span>Resolved:</span>
                <span className="font-medium text-emerald-700">
                  {new Date(ticket.resolvedAt).toLocaleString("en-IN")}
                </span>
              </div>
            )}
            {ticket.closedAt && (
              <div className="flex justify-between">
                <span>Closed:</span>
                <span className="font-medium text-neutral-700">
                  {new Date(ticket.closedAt).toLocaleString("en-IN")}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
