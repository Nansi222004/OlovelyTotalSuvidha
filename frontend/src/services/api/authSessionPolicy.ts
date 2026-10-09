const TERMINAL_CUSTOMER_AUTH_CODES = new Set([
  "CUSTOMER_DELETED",
  "TOKEN_EXPIRED",
  "TOKEN_INVALID",
]);

/** Only backend-authenticated terminal failures are allowed to destroy a session. */
export const shouldTerminateCustomerSession = (
  status: number | undefined,
  code: string | undefined
): boolean => status === 401 && !!code && TERMINAL_CUSTOMER_AUTH_CODES.has(code);

