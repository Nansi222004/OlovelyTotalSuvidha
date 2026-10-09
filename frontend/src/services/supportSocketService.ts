import { io, Socket } from "socket.io-client";
import { getSocketBaseURL } from "./api/config";
import { SupportMessage, SupportStatus } from "./api/supportService";

export interface CustomerSupportEvent {
  eventType: "REPLIED" | "STATUS_CHANGED";
  ticketId: string;
  ticketNumber?: string;
  status?: SupportStatus;
  messageId?: string;
  message?: SupportMessage;
}

interface CustomerSupportReadyEvent {
  success: boolean;
}

let customerSocket: Socket | null = null;
let customerSocketToken: string | null = null;
let subscriberCount = 0;
let pendingDisconnect: ReturnType<typeof setTimeout> | null = null;

const getCustomerSocket = (token: string): Socket => {
  if (customerSocket && customerSocketToken !== token) {
    customerSocket.disconnect();
    customerSocket = null;
    customerSocketToken = null;
  }

  if (!customerSocket) {
    customerSocket = io(getSocketBaseURL(), {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnection: true,
    });
    customerSocketToken = token;
  }

  return customerSocket;
};

/**
 * Share one authenticated customer socket among support screens. Socket
 * failures remain transport errors and never mutate the HTTP auth session.
 */
export const subscribeToCustomerSupport = (
  token: string,
  listener: (event: CustomerSupportEvent) => void,
  onReconnect?: () => void
): (() => void) => {
  if (pendingDisconnect) {
    clearTimeout(pendingDisconnect);
    pendingDisconnect = null;
  }
  const socket = getCustomerSocket(token);
  let hasConnected = socket.connected;
  const handleConnect = () => {
    if (hasConnected) onReconnect?.();
    hasConnected = true;
  };
  const handleSupportReady = (ack: CustomerSupportReadyEvent) => {
    if (!ack?.success) return;
    // The acknowledgement proves authentication and the server-derived
    // customer room join completed. Event delivery remains primary; REST is
    // only used by handleConnect after a later transport reconnection.
  };

  subscriberCount += 1;
  socket.on("customer-support-event", listener);
  socket.on("connect", handleConnect);
  socket.on("customer-support-ready", handleSupportReady);

  return () => {
    socket.off("customer-support-event", listener);
    socket.off("connect", handleConnect);
    socket.off("customer-support-ready", handleSupportReady);
    subscriberCount = Math.max(0, subscriberCount - 1);
    if (subscriberCount === 0) {
      // React StrictMode replays effects synchronously in development. Deferring
      // teardown lets the replay reuse the same authenticated connection.
      pendingDisconnect = setTimeout(() => {
        if (subscriberCount === 0 && customerSocket) {
          customerSocket.disconnect();
          customerSocket = null;
          customerSocketToken = null;
        }
        pendingDisconnect = null;
      }, 0);
    }
  };
};
