import api from "./config";
import {
  normalizeCustomerTicketsResponse,
  type LegacyCustomerTicketsResponse,
} from "./supportResponseNormalizer";
export { normalizeCustomerTicketsResponse } from "./supportResponseNormalizer";

export type SupportCategory =
  | "General"
  | "Order"
  | "Order Issue"
  | "Payment"
  | "Delivery"
  | "Product"
  | "Return"
  | "Exchange"
  | "Account"
  | "Other";

export type SupportStatus = "Pending" | "In Progress" | "Resolved" | "Closed";

export type SupportPriority = "Low" | "Normal" | "High" | "Urgent";

export type SupportChannel = "QUICK_COMMERCE" | "ECOMMERCE" | "MIXED";

export interface SupportMessage {
  _id?: string;
  clientMessageId?: string;
  senderType: "CUSTOMER" | "ADMIN";
  senderId?: string;
  senderName?: string;
  message: string;
  createdAt: string;
  readAt?: string;
}

export interface SupportTicket {
  _id: string;
  ticketNumber?: string;
  customer?: {
    _id: string;
    name?: string;
    email?: string;
    phone?: string;
  } | string;
  name: string;
  email: string;
  mobile?: string;
  subject: string;
  message: string;
  category: SupportCategory;
  status: SupportStatus;
  priority: SupportPriority;
  order?: {
    _id: string;
    orderNumber?: string;
    status?: string;
    totalAmount?: number;
    channel?: string;
    createdAt?: string;
  } | string;
  orderNumber?: string;
  fulfillmentGroupId?: string;
  channel?: SupportChannel;
  fulfillmentContext?: {
    orderStatus?: string;
    channel?: string;
    fulfillmentType?: string;
    ownerType?: string;
    itemsCount?: number;
    totalAmount?: number;
    paymentMethod?: string;
    deliveryPartner?: string;
  };
  messages: SupportMessage[];
  customerUnread: boolean;
  adminUnread: boolean;
  resolvedAt?: string;
  closedAt?: string;
  lastMessageAt?: string;
  createdAt: string;
  updatedAt: string;
  isLegacyContact?: boolean;
}

export interface SupportPagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CustomerTicketsResponse {
  success: boolean;
  data: {
    tickets: SupportTicket[];
    pagination: SupportPagination;
  };
}

export interface AdminTicketsCounts {
  all: number;
  pending: number;
  inProgress: number;
  resolved: number;
  closed: number;
  unread: number;
}

export interface AdminTicketsResponse {
  success: boolean;
  data: {
    tickets: SupportTicket[];
    pagination: SupportPagination;
    counts: AdminTicketsCounts;
  };
}

export interface TicketDetailResponse {
  success: boolean;
  data: SupportTicket;
  message?: string;
  persistedMessage?: SupportMessage;
  idempotent?: boolean;
}

export const createSupportClientId = (prefix: "ticket" | "message"): string => {
  const randomPart =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}:${randomPart}`;
};

// ==========================================
// CUSTOMER SUPPORT APIS
// ==========================================

export interface CreateTicketPayload {
  category: SupportCategory;
  subject: string;
  message: string;
  orderId?: string;
  fulfillmentGroupId?: string;
  clientRequestId: string;
}

export const createCustomerTicket = async (
  payload: CreateTicketPayload
): Promise<TicketDetailResponse> => {
  const response = await api.post<TicketDetailResponse>(
    "/customer/support/tickets",
    payload
  );
  return response.data;
};

export const getCustomerTickets = async (params?: {
  page?: number;
  limit?: number;
  status?: string;
  category?: string;
}): Promise<CustomerTicketsResponse> => {
  const response = await api.get<CustomerTicketsResponse | LegacyCustomerTicketsResponse>(
    "/customer/support/tickets",
    { params }
  );
  return normalizeCustomerTicketsResponse(response.data, params?.page, params?.limit);
};

const customerTicketDetailRequests = new Map<string, Promise<TicketDetailResponse>>();
const adminTicketDetailRequests = new Map<string, Promise<TicketDetailResponse>>();

export const getCustomerTicketDetail = async (
  ticketNumberOrId: string
): Promise<TicketDetailResponse> => {
  const key = String(ticketNumberOrId);
  const existing = customerTicketDetailRequests.get(key);
  if (existing) return existing;

  const request = api
    .get<TicketDetailResponse>(`/customer/support/tickets/${encodeURIComponent(key)}`)
    .then((response) => response.data)
    .finally(() => {
      if (customerTicketDetailRequests.get(key) === request) {
        customerTicketDetailRequests.delete(key);
      }
    });
  customerTicketDetailRequests.set(key, request);
  return request;
};

export const sendCustomerTicketMessage = async (
  ticketNumberOrId: string,
  message: string,
  clientMessageId: string
): Promise<TicketDetailResponse> => {
  const response = await api.post<TicketDetailResponse>(
    `/customer/support/tickets/${encodeURIComponent(ticketNumberOrId)}/messages`,
    { message, clientMessageId }
  );
  return response.data;
};

export const closeCustomerTicket = async (
  ticketNumberOrId: string
): Promise<TicketDetailResponse> => {
  const response = await api.post<TicketDetailResponse>(
    `/customer/support/tickets/${encodeURIComponent(ticketNumberOrId)}/close`
  );
  return response.data;
};

// ==========================================
// ADMIN SUPPORT APIS
// ==========================================

export interface AdminTicketsQueryParams {
  page?: number;
  limit?: number;
  status?: string;
  category?: string;
  priority?: string;
  channel?: string;
  search?: string;
  unreadOnly?: boolean;
}

export const getAdminSupportTickets = async (
  params?: AdminTicketsQueryParams
): Promise<AdminTicketsResponse> => {
  const response = await api.get<AdminTicketsResponse>(
    "/admin/support/tickets",
    { params }
  );
  return response.data;
};

export const getAdminTicketById = async (
  idOrTicketNumber: string
): Promise<TicketDetailResponse> => {
  const key = String(idOrTicketNumber);
  const existing = adminTicketDetailRequests.get(key);
  if (existing) return existing;

  const request = api
    .get<TicketDetailResponse>(`/admin/support/tickets/${encodeURIComponent(key)}`)
    .then((response) => response.data)
    .finally(() => {
      if (adminTicketDetailRequests.get(key) === request) {
        adminTicketDetailRequests.delete(key);
      }
    });
  adminTicketDetailRequests.set(key, request);
  return request;
};

export const sendAdminTicketMessage = async (
  idOrTicketNumber: string,
  message: string,
  clientMessageId: string
): Promise<TicketDetailResponse> => {
  const response = await api.post<TicketDetailResponse>(
    `/admin/support/tickets/${encodeURIComponent(idOrTicketNumber)}/messages`,
    { message, clientMessageId }
  );
  return response.data;
};

export const updateAdminTicketStatus = async (
  idOrTicketNumber: string,
  status: SupportStatus
): Promise<TicketDetailResponse> => {
  const response = await api.patch<TicketDetailResponse>(
    `/admin/support/tickets/${encodeURIComponent(idOrTicketNumber)}/status`,
    { status }
  );
  return response.data;
};

export const updateAdminTicketPriority = async (
  idOrTicketNumber: string,
  priority: SupportPriority
): Promise<TicketDetailResponse> => {
  const response = await api.patch<TicketDetailResponse>(
    `/admin/support/tickets/${encodeURIComponent(idOrTicketNumber)}/priority`,
    { priority }
  );
  return response.data;
};
