import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import {
  getCustomerTickets,
  createCustomerTicket,
  SupportTicket,
  SupportCategory,
  SupportStatus,
  createSupportClientId,
} from "../../services/api/supportService";

const STATUS_COLORS: Record<SupportStatus, { bg: string; text: string; border: string }> = {
  Pending: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  "In Progress": { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  Resolved: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  Closed: { bg: "bg-neutral-100", text: "text-neutral-600", border: "border-neutral-200" },
};

const CATEGORIES: SupportCategory[] = [
  "General",
  "Order",
  "Payment",
  "Delivery",
  "Product",
  "Return",
  "Exchange",
  "Account",
  "Other",
];

export default function MyTickets() {
  const navigate = useNavigate();
  const { isAuthReady, isAuthenticated, token } = useAuth();
  const { showToast } = useToast();

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Modal for creating ticket
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newCategory, setNewCategory] = useState<SupportCategory>("General");
  const [newSubject, setNewSubject] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [submittingTicket, setSubmittingTicket] = useState(false);
  const [formErrors, setFormErrors] = useState<{ [k: string]: string }>({});
  const createAttemptRef = useRef<{ fingerprint: string; id: string } | null>(null);
  const createInFlightRef = useRef(false);

  const fetchTickets = useCallback(async () => {
    if (!isAuthReady || !isAuthenticated || !token) return;
    setLoading(true);
    setError(null);
    try {
      const response = await getCustomerTickets({
        page,
        limit: 10,
        status: selectedStatus === "ALL" ? undefined : selectedStatus,
      });
      if (response.success && response.data) {
        setTickets(response.data.tickets || []);
        setTotalPages(response.data.pagination?.totalPages || 1);
      } else {
        throw new Error("Support ticket list request was not successful");
      }
    } catch (err: any) {
      console.error("Failed to fetch tickets:", err);
      setError(err?.response?.data?.message || "Failed to load support tickets");
    } finally {
      setLoading(false);
    }
  }, [isAuthReady, isAuthenticated, token, page, selectedStatus]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (createInFlightRef.current) return;
    const errors: { [k: string]: string } = {};

    if (!newSubject.trim() || newSubject.trim().length < 3) {
      errors.subject = "Subject must be at least 3 characters";
    }
    if (!newMessage.trim() || newMessage.trim().length < 10) {
      errors.message = "Message must be at least 10 characters";
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    createInFlightRef.current = true;
    setSubmittingTicket(true);
    const fingerprint = JSON.stringify([
      newCategory,
      newSubject.trim(),
      newMessage.trim(),
    ]);
    const attempt =
      createAttemptRef.current?.fingerprint === fingerprint
        ? createAttemptRef.current
        : { fingerprint, id: createSupportClientId("ticket") };
    createAttemptRef.current = attempt;
    try {
      const res = await createCustomerTicket({
        category: newCategory,
        subject: newSubject.trim(),
        message: newMessage.trim(),
        clientRequestId: attempt.id,
      });
      if (res.success && res.data) {
        showToast(
          `Ticket #${res.data.ticketNumber || res.data._id} created successfully!`,
          "success"
        );
        setIsCreateModalOpen(false);
        setNewSubject("");
        setNewMessage("");
        setNewCategory("General");
        setFormErrors({});
        createAttemptRef.current = null;
        // Navigate directly to the new ticket conversation
        navigate(`/support/tickets/${res.data.ticketNumber || res.data._id}`);
      }
    } catch (err: any) {
      console.error("Error creating ticket:", err);
      showToast(err?.response?.data?.message || "Failed to create support ticket", "error");
    } finally {
      createInFlightRef.current = false;
      setSubmittingTicket(false);
    }
  };

  return (
    <div className="pb-24 md:pb-12 bg-neutral-50 min-h-screen">
      {/* Header */}
      <div className="bg-white border-b border-neutral-200 sticky top-0 z-10">
        <div className="px-4 md:px-6 lg:px-8 max-w-5xl mx-auto py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate("/support")}
                className="text-neutral-700 hover:text-teal-600 p-1 -ml-1 rounded-lg transition-colors"
                aria-label="Back"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 18L9 12L15 6" />
                </svg>
              </button>
              <div>
                <h1 className="text-xl font-bold text-neutral-900">My Support Tickets</h1>
                <p className="text-xs text-neutral-500">Track and respond to your active inquiries</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link
                to="/support"
                className="hidden sm:inline-flex px-3 py-1.5 text-xs font-medium text-neutral-600 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors"
              >
                Contact Form
              </Link>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow-sm transition-all"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Raise Ticket
              </button>
            </div>
          </div>

          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 mt-4 overflow-x-auto pb-1 scrollbar-none">
            {["ALL", "Pending", "In Progress", "Resolved", "Closed"].map((st) => (
              <button
                key={st}
                onClick={() => {
                  setSelectedStatus(st);
                  setPage(1);
                }}
                className={`px-3 py-1 text-xs font-medium rounded-full transition-colors whitespace-nowrap ${
                  selectedStatus === st
                    ? "bg-teal-600 text-white shadow-xs"
                    : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                }`}
              >
                {st === "ALL" ? "All Tickets" : st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="px-4 md:px-6 lg:px-8 py-6 max-w-5xl mx-auto">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="bg-white rounded-xl border border-neutral-200 p-5 animate-pulse">
                <div className="flex justify-between items-center mb-2">
                  <div className="h-4 bg-neutral-200 rounded w-24"></div>
                  <div className="h-4 bg-neutral-200 rounded w-16"></div>
                </div>
                <div className="h-5 bg-neutral-200 rounded w-3/4 mb-2"></div>
                <div className="h-4 bg-neutral-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <p className="text-sm text-red-600 font-medium mb-3">{error}</p>
            <button
              onClick={fetchTickets}
              className="px-4 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : tickets.length === 0 ? (
          <div className="bg-white rounded-2xl border border-neutral-200 p-12 text-center shadow-xs">
            <div className="w-16 h-16 bg-teal-50 text-teal-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <h2 className="text-base font-bold text-neutral-900 mb-1">No Support Tickets Found</h2>
            <p className="text-xs text-neutral-500 max-w-sm mx-auto mb-5">
              {selectedStatus === "ALL"
                ? "You haven't raised any support tickets yet. Need help with an order or product?"
                : `You don't have any tickets with status "${selectedStatus}".`}
            </p>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-xs transition-all"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Raise a Support Ticket
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {tickets.map((t) => {
              const statusCfg = STATUS_COLORS[t.status] || {
                bg: "bg-neutral-100",
                text: "text-neutral-700",
                border: "border-neutral-200",
              };
              const lastMsg =
                t.messages && t.messages.length > 0
                  ? t.messages[t.messages.length - 1]
                  : null;

              return (
                <Link
                  key={t._id}
                  to={`/support/tickets/${t.ticketNumber || t._id}`}
                  className="block bg-white rounded-xl border border-neutral-200 hover:border-teal-400 hover:shadow-md transition-all p-4 md:p-5 group"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-100">
                        {t.ticketNumber || `#${t._id.slice(-6)}`}
                      </span>
                      <span className="text-[11px] font-medium text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded">
                        {t.category}
                      </span>
                      {t.orderNumber && (
                        <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                          Order #{t.orderNumber}
                        </span>
                      )}
                      {t.customerUnread && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-full animate-pulse">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                          New Reply
                        </span>
                      )}
                    </div>

                    <span
                      className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}
                    >
                      {t.status}
                    </span>
                  </div>

                  <h3 className="text-sm md:text-base font-bold text-neutral-900 group-hover:text-teal-600 transition-colors mb-1 line-clamp-1">
                    {t.subject}
                  </h3>

                  <p className="text-xs text-neutral-500 line-clamp-2 mb-3">
                    {lastMsg ? `${lastMsg.senderType === "ADMIN" ? "Support: " : "You: "}${lastMsg.message}` : t.message}
                  </p>

                  <div className="flex items-center justify-between text-[11px] text-neutral-400 pt-2 border-t border-neutral-100">
                    <span>
                      Created: {new Date(t.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                    <span className="flex items-center gap-1 text-teal-600 font-semibold group-hover:translate-x-0.5 transition-transform">
                      View conversation
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    </span>
                  </div>
                </Link>
              );
            })}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-4">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 text-xs font-medium bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="text-xs text-neutral-500">
                  Page {page} of {totalPages}
                </span>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="px-3 py-1.5 text-xs font-medium bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create Ticket Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-neutral-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100 mb-4">
              <div>
                <h3 className="text-base font-bold text-neutral-900">Raise a Support Ticket</h3>
                <p className="text-xs text-neutral-500">Our customer support team will assist you shortly</p>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-600 p-1 rounded-lg"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreateTicket} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Category <span className="text-red-500">*</span>
                </label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as SupportCategory)}
                  className="w-full text-xs font-medium bg-neutral-50 border border-neutral-300 rounded-lg p-2.5 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Subject <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Brief summary of the issue"
                  value={newSubject}
                  onChange={(e) => {
                    setNewSubject(e.target.value);
                    if (formErrors.subject) setFormErrors({ ...formErrors, subject: "" });
                  }}
                  className={`w-full text-xs bg-neutral-50 border rounded-lg p-2.5 focus:ring-2 focus:ring-teal-500 focus:outline-none ${
                    formErrors.subject ? "border-red-500" : "border-neutral-300"
                  }`}
                />
                {formErrors.subject && (
                  <p className="text-[11px] text-red-500 mt-1">{formErrors.subject}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Description / Message <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={4}
                  placeholder="Provide complete details so our team can resolve it quickly..."
                  value={newMessage}
                  onChange={(e) => {
                    setNewMessage(e.target.value);
                    if (formErrors.message) setFormErrors({ ...formErrors, message: "" });
                  }}
                  className={`w-full text-xs bg-neutral-50 border rounded-lg p-2.5 focus:ring-2 focus:ring-teal-500 focus:outline-none resize-none ${
                    formErrors.message ? "border-red-500" : "border-neutral-300"
                  }`}
                />
                {formErrors.message && (
                  <p className="text-[11px] text-red-500 mt-1">{formErrors.message}</p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-neutral-600 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingTicket}
                  className="px-5 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
                >
                  {submittingTicket ? "Submitting..." : "Submit Ticket"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
