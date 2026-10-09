import type {
  CustomerTicketsResponse,
  SupportPagination,
  SupportTicket,
} from "./supportService";

export type LegacyCustomerTicketsResponse = {
  success: boolean;
  data: SupportTicket[];
  pagination?: Partial<SupportPagination>;
};

export const normalizeCustomerTicketsResponse = (
  payload: CustomerTicketsResponse | LegacyCustomerTicketsResponse,
  requestedPage = 1,
  requestedLimit = 15
): CustomerTicketsResponse => {
  if (!payload || payload.success !== true) {
    throw new Error("Support ticket list request was not successful");
  }

  if (Array.isArray(payload.data)) {
    const legacyPayload = payload as LegacyCustomerTicketsResponse;
    const pagination = legacyPayload.pagination || {};
    const total = pagination.total ?? payload.data.length;
    const limit = pagination.limit ?? requestedLimit;
    return {
      success: true,
      data: {
        tickets: payload.data,
        pagination: {
          total,
          page: pagination.page ?? requestedPage,
          limit,
          totalPages: pagination.totalPages ?? Math.max(1, Math.ceil(total / limit)),
        },
      },
    };
  }

  if (payload.data && Array.isArray(payload.data.tickets)) {
    return payload as CustomerTicketsResponse;
  }

  throw new Error("Support ticket list response has an invalid shape");
};
