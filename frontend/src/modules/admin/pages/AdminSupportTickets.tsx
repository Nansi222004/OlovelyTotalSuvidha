import React, { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  getAdminSupportTickets,
  SupportTicket,
  SupportStatus,
  SupportPriority,
  SupportCategory,
  AdminTicketsCounts,
} from "../../../services/api/supportService";

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

export default function AdminSupportTickets() {
  const navigate = useNavigate();

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [counts, setCounts] = useState<AdminTicketsCounts>({
    all: 0,
    pending: 0,
    inProgress: 0,
    resolved: 0,
    closed: 0,
    unread: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [status, setStatus] = useState<string>("ALL");
  const [priority, setPriority] = useState<string>("ALL");
  const [category, setCategory] = useState<string>("ALL");
  const [channel, setChannel] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getAdminSupportTickets({
        page,
        limit: 15,
        status: status === "ALL" ? undefined : status,
        priority: priority === "ALL" ? undefined : priority,
        category: category === "ALL" ? undefined : category,
        channel: channel === "ALL" ? undefined : channel,
        search: search.trim() || undefined,
        unreadOnly: unreadOnly || undefined,
      });

      if (res.success && res.data) {
        setTickets(res.data.tickets || []);
        if (res.data.pagination) {
          setTotalPages(res.data.pagination.totalPages || 1);
          setTotalItems(res.data.pagination.total || 0);
        }
        if (res.data.counts) {
          setCounts(res.data.counts);
        }
      }
    } catch (err: any) {
      console.error("Error fetching admin support tickets:", err);
      setError(err?.response?.data?.message || "Failed to load support tickets");
    } finally {
      setLoading(false);
    }
  }, [page, status, priority, category, channel, search, unreadOnly]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchTickets();
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-neutral-900">Customer Support Tickets</h1>
          <p className="text-xs md:text-sm text-neutral-500 mt-0.5">
            Manage inquiries, resolve order issues, and chat directly with customers
          </p>
        </div>
        <button
          onClick={() => {
            setPage(1);
            fetchTickets();
          }}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-neutral-700 bg-white hover:bg-neutral-50 border border-neutral-300 rounded-lg shadow-xs transition-colors self-start sm:self-auto"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div
          onClick={() => {
            setStatus("ALL");
            setUnreadOnly(false);
            setPage(1);
          }}
          className={`p-4 rounded-xl border cursor-pointer transition-all ${
            status === "ALL" && !unreadOnly
              ? "bg-teal-50/60 border-teal-500 shadow-xs"
              : "bg-white border-neutral-200 hover:border-neutral-300"
          }`}
        >
          <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">All Tickets</p>
          <p className="text-xl font-bold text-neutral-900 mt-1">{counts.all}</p>
        </div>

        <div
          onClick={() => {
            setStatus("Pending");
            setUnreadOnly(false);
            setPage(1);
          }}
          className={`p-4 rounded-xl border cursor-pointer transition-all ${
            status === "Pending" && !unreadOnly
              ? "bg-amber-50 border-amber-500 shadow-xs"
              : "bg-white border-neutral-200 hover:border-neutral-300"
          }`}
        >
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider">Pending</p>
          <p className="text-xl font-bold text-amber-800 mt-1">{counts.pending}</p>
        </div>

        <div
          onClick={() => {
            setStatus("In Progress");
            setUnreadOnly(false);
            setPage(1);
          }}
          className={`p-4 rounded-xl border cursor-pointer transition-all ${
            status === "In Progress" && !unreadOnly
              ? "bg-blue-50 border-blue-500 shadow-xs"
              : "bg-white border-neutral-200 hover:border-neutral-300"
          }`}
        >
          <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider">In Progress</p>
          <p className="text-xl font-bold text-blue-800 mt-1">{counts.inProgress}</p>
        </div>

        <div
          onClick={() => {
            setStatus("Resolved");
            setUnreadOnly(false);
            setPage(1);
          }}
          className={`p-4 rounded-xl border cursor-pointer transition-all ${
            status === "Resolved" && !unreadOnly
              ? "bg-emerald-50 border-emerald-500 shadow-xs"
              : "bg-white border-neutral-200 hover:border-neutral-300"
          }`}
        >
          <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Resolved</p>
          <p className="text-xl font-bold text-emerald-800 mt-1">{counts.resolved}</p>
        </div>

        <div
          onClick={() => {
            setStatus("Closed");
            setUnreadOnly(false);
            setPage(1);
          }}
          className={`p-4 rounded-xl border cursor-pointer transition-all ${
            status === "Closed" && !unreadOnly
              ? "bg-neutral-100 border-neutral-500 shadow-xs"
              : "bg-white border-neutral-200 hover:border-neutral-300"
          }`}
        >
          <p className="text-xs font-semibold text-neutral-600 uppercase tracking-wider">Closed</p>
          <p className="text-xl font-bold text-neutral-800 mt-1">{counts.closed}</p>
        </div>

        <div
          onClick={() => {
            setUnreadOnly((prev) => !prev);
            setPage(1);
          }}
          className={`p-4 rounded-xl border cursor-pointer transition-all ${
            unreadOnly
              ? "bg-red-50 border-red-500 shadow-xs"
              : "bg-white border-neutral-200 hover:border-neutral-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-red-600 uppercase tracking-wider">Unread</p>
            {counts.unread > 0 && (
              <span className="w-2 h-2 rounded-full bg-red-600 animate-ping"></span>
            )}
          </div>
          <p className="text-xl font-bold text-red-700 mt-1">{counts.unread}</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl border border-neutral-200 p-4 shadow-xs space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder="Search by Ticket #, Order #, customer name, email, or subject..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-xs bg-neutral-50 border border-neutral-300 rounded-lg pl-9 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            <svg
              className="w-4 h-4 text-neutral-400 absolute left-3 top-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <circle cx="11" cy="11" r="8" strokeWidth="2" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" strokeWidth="2" />
            </svg>
          </div>
          <button
            type="submit"
            className="px-4 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors"
          >
            Search
          </button>
        </form>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-neutral-100">
          <div>
            <label className="block text-[11px] font-semibold text-neutral-500 mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              className="w-full text-xs bg-neutral-50 border border-neutral-300 rounded-lg p-2 focus:ring-2 focus:ring-teal-500 focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="In Progress">In Progress</option>
              <option value="Resolved">Resolved</option>
              <option value="Closed">Closed</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-neutral-500 mb-1">Priority</label>
            <select
              value={priority}
              onChange={(e) => {
                setPriority(e.target.value);
                setPage(1);
              }}
              className="w-full text-xs bg-neutral-50 border border-neutral-300 rounded-lg p-2 focus:ring-2 focus:ring-teal-500 focus:outline-none"
            >
              <option value="ALL">All Priorities</option>
              <option value="Low">Low</option>
              <option value="Normal">Normal</option>
              <option value="High">High</option>
              <option value="Urgent">Urgent</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-neutral-500 mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
              }}
              className="w-full text-xs bg-neutral-50 border border-neutral-300 rounded-lg p-2 focus:ring-2 focus:ring-teal-500 focus:outline-none"
            >
              <option value="ALL">All Categories</option>
              <option value="Order">Order</option>
              <option value="Delivery">Delivery</option>
              <option value="Payment">Payment</option>
              <option value="Product">Product</option>
              <option value="Return">Return</option>
              <option value="Exchange">Exchange</option>
              <option value="Account">Account</option>
              <option value="General">General</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-neutral-500 mb-1">Channel</label>
            <select
              value={channel}
              onChange={(e) => {
                setChannel(e.target.value);
                setPage(1);
              }}
              className="w-full text-xs bg-neutral-50 border border-neutral-300 rounded-lg p-2 focus:ring-2 focus:ring-teal-500 focus:outline-none"
            >
              <option value="ALL">All Channels</option>
              <option value="QUICK_COMMERCE">Quick Commerce</option>
              <option value="ECOMMERCE">Ecommerce</option>
              <option value="MIXED">Mixed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Ticket Table */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-8 text-center">
            <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-xs text-neutral-500">Loading support tickets...</p>
          </div>
        ) : error ? (
          <div className="p-6 text-center text-red-600 text-xs font-semibold">{error}</div>
        ) : tickets.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm font-bold text-neutral-900 mb-1">No Tickets Found</p>
            <p className="text-xs text-neutral-500">No support requests match the selected filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Ticket</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Subject & Issue</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Channel / Order</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Updated</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {tickets.map((t) => {
                  const statusCfg = STATUS_COLORS[t.status] || {
                    bg: "bg-neutral-100",
                    text: "text-neutral-700",
                    border: "border-neutral-200",
                  };
                  const prioCfg = PRIORITY_COLORS[t.priority] || {
                    bg: "bg-neutral-100",
                    text: "text-neutral-700",
                  };

                  return (
                    <tr
                      key={t._id}
                      className={`hover:bg-neutral-50/80 transition-colors ${
                        t.adminUnread ? "bg-teal-50/20 font-medium" : ""
                      }`}
                    >
                      {/* Ticket # */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {t.adminUnread && (
                            <span className="w-2 h-2 rounded-full bg-teal-600 flex-shrink-0 animate-pulse" />
                          )}
                          <div>
                            {t.ticketNumber ? (
                              <span className="font-mono text-xs font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-100">
                                {t.ticketNumber}
                              </span>
                            ) : (
                              <span className="font-mono text-[11px] text-neutral-500 bg-neutral-100 px-1.5 py-0.5 rounded">
                                Legacy Contact
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Customer */}
                      <td className="py-3.5 px-4">
                        <p className="font-semibold text-neutral-900 truncate max-w-[140px]">{t.name}</p>
                        <p className="text-[11px] text-neutral-400 truncate max-w-[140px]">{t.email}</p>
                        {t.mobile && (
                          <p className="text-[10px] text-neutral-400">{t.mobile}</p>
                        )}
                      </td>

                      {/* Subject & Issue */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <p className="font-bold text-neutral-900 truncate">{t.subject}</p>
                        <p className="text-[11px] text-neutral-500 truncate mt-0.5">
                          {t.messages && t.messages.length > 0
                            ? t.messages[t.messages.length - 1].message
                            : t.message}
                        </p>
                      </td>

                      {/* Category */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded bg-neutral-100 text-neutral-700 text-[11px] font-medium">
                          {t.category}
                        </span>
                      </td>

                      {/* Channel & Order */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {t.orderNumber ? (
                          <div>
                            <span className="font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 text-[11px]">
                              #{t.orderNumber}
                            </span>
                            {t.channel && (
                              <p className="text-[10px] text-neutral-400 mt-0.5 font-medium">
                                {t.channel === "QUICK_COMMERCE" ? "Quick Commerce" : t.channel}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-neutral-400 text-[11px]">—</span>
                        )}
                      </td>

                      {/* Priority */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${prioCfg.bg} ${prioCfg.text}`}>
                          {t.priority}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded-full border text-[11px] font-semibold ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}
                        >
                          {t.status}
                        </span>
                      </td>

                      {/* Updated */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-neutral-500 text-[11px]">
                        {new Date(t.lastMessageAt || t.updatedAt || t.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                        })}
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <Link
                          to={`/admin/support/tickets/${t._id}`}
                          className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg transition-colors"
                        >
                          Open
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 bg-neutral-50 border-t border-neutral-200 text-xs">
            <span className="text-neutral-500">
              Showing page {page} of {totalPages} ({totalItems} total tickets)
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1 bg-white border border-neutral-200 rounded-md hover:bg-neutral-50 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1 bg-white border border-neutral-200 rounded-md hover:bg-neutral-50 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
