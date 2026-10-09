import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import path from "node:path";
import jwt from "jsonwebtoken";
import { io as createClient, Socket } from "socket.io-client";
import { initializeSocket } from "../socket/socketService";
import { authenticate } from "../middleware/auth";
import {
  notifyAdminsOfSupportEvent,
  notifyCustomerOfSupportEvent,
} from "../services/customerSupportService";
import { shouldTerminateCustomerSession } from "../../../frontend/src/services/api/authSessionPolicy";
import {
  persistPanelSession,
  readPanelToken,
  readPanelUser,
  type AuthStorageLike,
} from "../../../frontend/src/services/api/authStorage";
import { normalizeCustomerTicketsResponse } from "../../../frontend/src/services/api/supportResponseNormalizer";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "support-regression-test-secret";

const waitForConnection = (socket: Socket) =>
  new Promise<void>((resolve, reject) => {
    socket.once("connect", () => resolve());
    socket.once("connect_error", reject);
  });

async function run(): Promise<void> {
  class MemoryStorage implements AuthStorageLike {
    private readonly values = new Map<string, string>();
    getItem(key: string) { return this.values.get(key) ?? null; }
    setItem(key: string, value: string) { this.values.set(key, value); }
    removeItem(key: string) { this.values.delete(key); }
  }

  const storage = new MemoryStorage();
  assert.equal(persistPanelSession("customer", "valid-customer-token", { id: "customer-1" }, storage), true);
  assert.equal(persistPanelSession("customer", "   ", { id: "wrong-user" }, storage), false);
  assert.equal(readPanelToken("customer", storage), "valid-customer-token");
  assert.equal(readPanelUser("customer", storage).id, "customer-1");

  const legacyStorage = new MemoryStorage();
  legacyStorage.setItem("authToken", "legacy-customer-token");
  legacyStorage.setItem("userData", JSON.stringify({ id: "legacy-customer", userType: "Customer" }));
  assert.equal(readPanelToken("customer", legacyStorage), "legacy-customer-token");
  assert.equal(readPanelUser("customer", legacyStorage).id, "legacy-customer");
  assert.equal(legacyStorage.getItem("customer_authToken"), "legacy-customer-token");
  assert.ok(legacyStorage.getItem("customer_userData"));

  const legacyTicketList = normalizeCustomerTicketsResponse({
    success: true,
    data: [{ _id: "ticket-1", ticketNumber: "SUP-TEST-1" } as any],
  });
  assert.equal(legacyTicketList.data.tickets.length, 1);
  assert.equal(legacyTicketList.data.tickets[0].ticketNumber, "SUP-TEST-1");

  assert.equal(shouldTerminateCustomerSession(401, "TOKEN_EXPIRED"), true);
  assert.equal(shouldTerminateCustomerSession(401, "TOKEN_INVALID"), true);
  assert.equal(shouldTerminateCustomerSession(401, "CUSTOMER_DELETED"), true);
  for (const [status, code] of [
    [401, "TOKEN_MISSING"],
    [401, undefined],
    [403, "TOKEN_INVALID"],
    [404, undefined],
    [500, undefined],
  ] as Array<[number, string | undefined]>) {
    assert.equal(
      shouldTerminateCustomerSession(status, code),
      false,
      `${status}/${code || "no-code"} must preserve a valid customer session`
    );
  }

  const authenticateToken = async (token: string) => {
    let body: any;
    const req = { headers: { authorization: `Bearer ${token}` } } as any;
    const res = {
      statusCode: 200,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(value: any) {
        body = value;
        return this;
      },
    } as any;
    await authenticate(req, res, () => undefined);
    return { status: res.statusCode, body };
  };
  const expired = jwt.sign(
    { userId: "64b000000000000000000001", userType: "Customer" },
    process.env.JWT_SECRET as string,
    { expiresIn: -1 }
  );
  const expiredResult = await authenticateToken(expired);
  assert.equal(expiredResult.status, 401);
  assert.equal(expiredResult.body.code, "TOKEN_EXPIRED");
  const invalidResult = await authenticateToken("invalid.token.value");
  assert.equal(invalidResult.status, 401);
  assert.equal(invalidResult.body.code, "TOKEN_INVALID");

  const httpServer = createServer();
  const io = initializeSocket(httpServer);
  await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
  const address = httpServer.address();
  if (!address || typeof address === "string") throw new Error("Ephemeral server did not start");
  const url = `http://127.0.0.1:${address.port}`;

  const customerId = "64b000000000000000000001";
  const otherCustomerId = "64b000000000000000000002";
  const adminId = "64b000000000000000000003";
  const tokenFor = (userId: string, userType: string) =>
    jwt.sign({ userId, userType }, process.env.JWT_SECRET as string, { expiresIn: "5m" });

  const customer = createClient(url, { auth: { token: tokenFor(customerId, "Customer") } });
  const otherCustomer = createClient(url, { auth: { token: tokenFor(otherCustomerId, "Customer") } });
  const admin = createClient(url, { auth: { token: tokenFor(adminId, "Admin") } });
  const unauthenticated = createClient(url);

  try {
    const customerReady = new Promise<void>((resolve) => {
      customer.once("customer-support-ready", (ack) => {
        assert.equal(ack.success, true);
        resolve();
      });
    });
    const otherCustomerReady = new Promise<void>((resolve) => {
      otherCustomer.once("customer-support-ready", (ack) => {
        assert.equal(ack.success, true);
        resolve();
      });
    });
    await Promise.all([
      waitForConnection(customer),
      waitForConnection(otherCustomer),
      waitForConnection(admin),
      waitForConnection(unauthenticated),
      customerReady,
      otherCustomerReady,
    ]);
    const adminJoined = new Promise<void>((resolve) => {
      admin.once("joined-admin-room", () => resolve());
    });
    const unauthenticatedRejected = new Promise<void>((resolve) => {
      unauthenticated.once("joined-admin-room", () => resolve());
    });
    admin.emit("join-admin-room");
    unauthenticated.emit("join-admin-room");
    await Promise.all([adminJoined, unauthenticatedRejected]);

    const messageId = "64b000000000000000000099";
    const ticket = {
      _id: "64b000000000000000000010",
      customer: customerId,
      ticketNumber: "SUP-TEST-000001",
      name: "Test Customer",
      subject: "Test",
      message: "Initial",
      category: "General",
      priority: "Normal",
      status: "In Progress",
      messages: [
        {
          _id: messageId,
          clientMessageId: "message:realtime-test-0001",
          senderType: "ADMIN",
          senderId: adminId,
          senderName: "Support Team",
          message: "Persisted reply",
          createdAt: new Date(),
        },
      ],
    } as any;

    let authorizedEvents = 0;
    let unauthorizedEvents = 0;
    let adminEvents = 0;
    let unauthenticatedAdminEvents = 0;
    customer.on("customer-support-event", (event) => {
      authorizedEvents += 1;
      assert.equal(event.ticketId, ticket._id);
      assert.equal(event.messageId, messageId);
      assert.equal(event.message.clientMessageId, "message:realtime-test-0001");
      assert.equal(event.message._id, messageId);
      assert.equal(typeof event.message.createdAt, "string");
    });
    otherCustomer.on("customer-support-event", () => {
      unauthorizedEvents += 1;
    });
    admin.on("admin-support-event", () => {
      adminEvents += 1;
    });
    unauthenticated.on("admin-support-event", () => {
      unauthenticatedAdminEvents += 1;
    });

    await notifyCustomerOfSupportEvent(ticket, "REPLIED", "Persisted reply", io);
    await notifyAdminsOfSupportEvent(ticket, "REPLIED", "Persisted reply", io);
    await new Promise((resolve) => setTimeout(resolve, 150));

    assert.equal(authorizedEvents, 1, "Authorized customer receives one support event");
    assert.equal(unauthorizedEvents, 0, "Other customers never receive the private event");
    assert.equal(adminEvents, 1, "Authenticated admin room receives the admin event");
    assert.equal(unauthenticatedAdminEvents, 0, "Unauthenticated sockets cannot join the admin room");

    const ticketUi = readFileSync(
      path.resolve(process.cwd(), "../frontend/src/modules/user/TicketDetail.tsx"),
      "utf8"
    );
    const socketClient = readFileSync(
      path.resolve(process.cwd(), "../frontend/src/services/supportSocketService.ts"),
      "utf8"
    );
    const adminSocketClient = readFileSync(
      path.resolve(process.cwd(), "../frontend/src/modules/admin/hooks/useAdminSocket.ts"),
      "utf8"
    );
    const adminTicketUi = readFileSync(
      path.resolve(process.cwd(), "../frontend/src/modules/admin/pages/AdminTicketDetail.tsx"),
      "utf8"
    );
    assert.match(ticketUi, /alreadyRendered/);
    assert.match(ticketUi, /conversationMessages\.map/);
    assert.doesNotMatch(ticketUi, /\{ticket\.message\}[\s\S]{0,300}ticket\.messages\.map/);
    assert.match(socketClient, /socket\.off\("customer-support-event", listener\)/);
    assert.match(socketClient, /socket\.off\("connect", handleConnect\)/);
    assert.match(socketClient, /socket\.off\("customer-support-ready", handleSupportReady\)/);
    assert.match(socketClient, /getCustomerSocket\(token\)/);
    assert.equal((socketClient.match(/io\(getSocketBaseURL\(\)/g) || []).length, 1);
    assert.match(adminSocketClient, /newSocket\.on\('admin-support-event'/);
    assert.match(adminTicketUi, /window\.removeEventListener\(ADMIN_SUPPORT_BROWSER_EVENT, handleSupportEvent\)/);
    assert.match(adminTicketUi, /alreadyRendered/);

    console.log("Support realtime/auth regression suite passed");
  } finally {
    customer.disconnect();
    otherCustomer.disconnect();
    admin.disconnect();
    unauthenticated.disconnect();
    await new Promise<void>((resolve) => io.close(() => resolve()));
    if (httpServer.listening) {
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    }
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
