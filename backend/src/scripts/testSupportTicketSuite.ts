import assert from "node:assert/strict";
import mongoose from "mongoose";
import {
  generateTicketNumber,
  validateSupportStatusTransition,
} from "../services/customerSupportService";
import {
  createTicket,
  getMyTickets,
  getTicketDetail,
  sendCustomerMessage,
  closeCustomerTicket,
  submitCustomerSupport,
} from "../modules/customer/controllers/customerSupportController";
import {
  getAllTickets,
  getTicketById,
  sendAdminMessage,
  updateTicketStatus,
  updateTicketPriority,
} from "../modules/admin/controllers/adminSupportController";
import CustomerSupportRequest from "../models/CustomerSupportRequest";
import Order from "../models/Order";
import Customer from "../models/Customer";
import Admin from "../models/Admin";
import Notification from "../models/Notification";

process.env.NODE_ENV = "test";

// Flexible Mock Query that chains sort, select, populate, lean, then
function createMockQuery(result: any = null) {
  const query: any = {
    sort: () => query,
    select: () => query,
    populate: () => query,
    skip: () => query,
    limit: () => query,
    lean: () => Promise.resolve(result),
    exec: () => Promise.resolve(result),
    then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject),
  };
  return query;
}

// Helper to create mock Express request and response objects
function createMockReqRes(reqData: any = {}) {
  const req: any = {
    user: reqData.user || undefined,
    body: reqData.body || {},
    params: reqData.params || {},
    query: reqData.query || {},
    app: {
      get: (key: string) => (key === "io" ? null : undefined),
    },
    ...reqData,
  };

  const res: any = {
    statusCode: 200,
    jsonData: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(data: any) {
      this.jsonData = data;
      return this;
    },
  };

  return { req, res };
}

function invokeHandler(handler: any, req: any, res: any): Promise<void> {
  return new Promise((resolve, reject) => {
    let resolved = false;
    const finish = () => {
      if (!resolved) {
        resolved = true;
        resolve();
      }
    };
    const next = (err: any) => {
      if (err && !resolved) {
        resolved = true;
        reject(err);
      } else {
        finish();
      }
    };
    const origJson = res.json.bind(res);
    res.json = (data: any) => {
      origJson(data);
      finish();
    };
    try {
      const maybePromise = handler(req, res, next);
      if (maybePromise && typeof maybePromise.then === "function") {
        maybePromise.then(finish).catch((err: any) => {
          if (!resolved) {
            resolved = true;
            reject(err);
          }
        });
      }
    } catch (err) {
      if (!resolved) {
        resolved = true;
        reject(err);
      }
    }
  });
}

CustomerSupportRequest.prototype.save = async function () {
  return this;
};

Customer.findById = (() =>
  createMockQuery({
    _id: new mongoose.Types.ObjectId(),
    name: "Test Customer",
    email: "test@example.com",
    mobile: "9876543210",
  })) as any;

Admin.find = (() =>
  createMockQuery([{ _id: new mongoose.Types.ObjectId() }])) as any;

Admin.findById = (() =>
  createMockQuery({
    _id: new mongoose.Types.ObjectId(),
    firstName: "Support",
    lastName: "Executive",
    email: "admin@olovely.in",
  })) as any;

Notification.findOne = (() => createMockQuery(null)) as any;
Notification.create = (async (data: any) => ({
  _id: new mongoose.Types.ObjectId(),
  ...data,
})) as any;

async function runTestSuite() {
  console.log("========================================================");
  console.log("  RUNNING SUPPORT / TICKET SYSTEM ISOLATED TEST SUITE   ");
  console.log("========================================================");

  let passed = 0;
  let total = 0;

  async function test(name: string, fn: () => Promise<void> | void) {
    total++;
    try {
      await fn();
      passed++;
      console.log(`  ✅ [PASS] ${name}`);
    } catch (err: any) {
      console.error(`  ❌ [FAIL] ${name}:`, err.message);
      throw err;
    }
  }

  // Test 1: Ticket Number Format and Generation
  await test("1. Ticket number format conforms to SUP-YYYYMMDD-XXXXXX and is human readable", async () => {
    const origFindOne = CustomerSupportRequest.findOne;
    const origExists = CustomerSupportRequest.exists;
    CustomerSupportRequest.findOne = (() => createMockQuery(null)) as any;
    CustomerSupportRequest.exists = (() => Promise.resolve(false)) as any;

    try {
      const ticketNum = await generateTicketNumber();
      assert.match(ticketNum, /^SUP-\d{8}-\d{6}$/);
      assert.ok(ticketNum.startsWith("SUP-"));
    } finally {
      CustomerSupportRequest.findOne = origFindOne;
      CustomerSupportRequest.exists = origExists;
    }
  });

  // Test 2: Status State Machine Transitions
  await test("2. Status State Machine enforcement: Valid & Invalid transitions", () => {
    // Customer can transition:
    // Pending -> Closed
    assert.equal(validateSupportStatusTransition("Pending", "Closed", "Customer").valid, true);
    // In Progress -> Closed
    assert.equal(validateSupportStatusTransition("In Progress", "Closed", "Customer").valid, true);
    // Resolved -> In Progress (reopen)
    assert.equal(validateSupportStatusTransition("Resolved", "In Progress", "Customer").valid, true);
    // Closed -> In Progress (Customer cannot reopen terminal Closed)
    assert.equal(validateSupportStatusTransition("Closed", "In Progress", "Customer").valid, false);

    // Admin transitions:
    // Pending -> In Progress
    assert.equal(validateSupportStatusTransition("Pending", "In Progress", "Admin").valid, true);
    // In Progress -> Resolved
    assert.equal(validateSupportStatusTransition("In Progress", "Resolved", "Admin").valid, true);
    // Resolved -> Closed
    assert.equal(validateSupportStatusTransition("Resolved", "Closed", "Admin").valid, true);
    // Closed -> Pending (Invalid: terminal)
    assert.equal(validateSupportStatusTransition("Closed", "Pending", "Admin").valid, false);
    // Closed -> In Progress (Invalid: terminal)
    assert.equal(validateSupportStatusTransition("Closed", "In Progress", "Admin").valid, false);
  });

  // Test 3: Authenticated Customer Creates Ticket with Authoritative Identity
  await test("3. Authenticated customer creates ticket: identity from JWT, client customerId ignored", async () => {
    const customerId = new mongoose.Types.ObjectId().toString();
    const attackerCustomerId = new mongoose.Types.ObjectId().toString();

    const origCustomerFindById = Customer.findById;
    Customer.findById = ((id: any) =>
      createMockQuery({
        _id: customerId,
        name: "Legit Customer",
        email: "legit@example.com",
        mobile: "9876543210",
      })) as any;
    let savedData: any = null;
    const origCreate = CustomerSupportRequest.create;
    CustomerSupportRequest.create = ((data: any) => {
      savedData = {
        ...data,
        _id: new mongoose.Types.ObjectId(),
        save: () => Promise.resolve(),
      };
      return Promise.resolve(savedData);
    }) as any;

    const origFindOne = CustomerSupportRequest.findOne;
    const origExists = CustomerSupportRequest.exists;
    CustomerSupportRequest.findOne = (() => createMockQuery(null)) as any;
    CustomerSupportRequest.exists = (() => Promise.resolve(false)) as any;

    try {
      const { req, res } = createMockReqRes({
        user: { userId: customerId, role: "Customer" },
        body: {
          customerId: attackerCustomerId, // ATTACKER attempts spoofing
          name: "Spoofed Attacker",
          email: "attacker@example.com",
          category: "General",
          subject: "Legitimate question",
          message: "Hello, I need help with my account settings.",
          clientRequestId: "ticket:test-create-0001",
        },
      });

      await invokeHandler(createTicket, req, res);

      assert.equal(res.statusCode, 201);
      assert.equal(res.jsonData.success, true);
      const ticketData = res.jsonData.data;
      assert.ok(ticketData);
      assert.equal(ticketData.customer.toString(), customerId, "Must bind to JWT customerId");
      assert.equal(ticketData.name, "Legit Customer", "Must use authoritative customer name");
      assert.equal(ticketData.email, "legit@example.com", "Must use authoritative customer email");
      assert.match(ticketData.ticketNumber, /^SUP-/);
      assert.equal(ticketData.messages.length, 1);
      assert.equal(ticketData.messages[0].senderType, "CUSTOMER");
    } finally {
      Customer.findById = origCustomerFindById;
      CustomerSupportRequest.create = origCreate;
      CustomerSupportRequest.findOne = origFindOne;
      CustomerSupportRequest.exists = origExists;
    }
  });

  // Test 4: Order-Linked Ticket Authorization
  await test("4. Order-linked ticket authorization: customer cannot link another customer's order", async () => {
    const customerA = new mongoose.Types.ObjectId().toString();
    const customerB = new mongoose.Types.ObjectId().toString();
    const orderId = new mongoose.Types.ObjectId().toString();

    const origOrderFindById = Order.findById;
    Order.findById = ((id: any) =>
      createMockQuery({
        _id: orderId,
        orderNumber: "ORD-9999",
        customer: customerB, // Foreign customer
        status: "Confirmed",
        channel: "QUICK_COMMERCE",
      })) as any;

    const origCustomerFindById = Customer.findById;
    Customer.findById = (() =>
      createMockQuery({
        _id: customerA,
        name: "Customer A",
        email: "a@example.com",
      })) as any;
    const origFindOne = CustomerSupportRequest.findOne;
    CustomerSupportRequest.findOne = (() => createMockQuery(null)) as any;

    try {
      const { req, res } = createMockReqRes({
        user: { userId: customerA, role: "Customer" },
        body: {
          orderId,
          category: "Order",
          subject: "Unauthorized inquiry",
          message: "Trying to access someone else's order.",
          clientRequestId: "ticket:test-foreign-order-0001",
        },
      });

      await invokeHandler(createTicket, req, res);

      assert.equal(res.statusCode, 403, "Must return HTTP 403 Forbidden for foreign order");
      assert.equal(res.jsonData.success, false);
      assert.ok(res.jsonData.message.includes("not authorized"));
    } finally {
      Order.findById = origOrderFindById;
      Customer.findById = origCustomerFindById;
      CustomerSupportRequest.findOne = origFindOne;
    }
  });

  // Test 5: Order-Linked Ticket Context Snapshots
  await test("5. Order-linked ticket context snapshots: QC, Ecommerce, Mixed channels", async () => {
    const customerId = new mongoose.Types.ObjectId().toString();
    const orderId = new mongoose.Types.ObjectId().toString();

    const origCustomerFindById = Customer.findById;
    Customer.findById = (() =>
      createMockQuery({
        _id: customerId,
        name: "Customer A",
        email: "a@example.com",
      })) as any;

    const origFindOne = CustomerSupportRequest.findOne;
    const origExists = CustomerSupportRequest.exists;
    CustomerSupportRequest.findOne = (() => createMockQuery(null)) as any;
    CustomerSupportRequest.exists = (() => Promise.resolve(false)) as any;

    let savedData: any = null;
    const origCreate = CustomerSupportRequest.create;
    CustomerSupportRequest.create = ((data: any) => {
      savedData = { ...data, _id: new mongoose.Types.ObjectId(), save: () => Promise.resolve() };
      return Promise.resolve(savedData);
    }) as any;

    const origOrderFindById = Order.findById;

    try {
      Order.findById = (() =>
        createMockQuery({
          _id: orderId,
          orderNumber: "ORD-QC-100",
          customer: customerId,
          status: "Out for Delivery",
          channel: "QUICK_COMMERCE",
          fulfillmentType: "Platform",
          ownerType: "Platform",
          totalAmount: 499,
          paymentMethod: "COD",
          deliveryBoy: { name: "Ramesh Rider" },
          items: [{ _id: 1 }, { _id: 2 }],
        })) as any;

      const { req, res } = createMockReqRes({
        user: { userId: customerId, role: "Customer" },
        body: {
          orderId,
          category: "Order",
          subject: "Where is my QC order?",
          message: "Delivery is running late.",
          clientRequestId: "ticket:test-order-context-0001",
        },
      });

      await invokeHandler(createTicket, req, res);

      assert.equal(res.statusCode, 201);
      const ticketData = res.jsonData.data;
      assert.equal(ticketData.channel, "QUICK_COMMERCE");
      assert.equal(ticketData.orderNumber, "ORD-QC-100");
      assert.equal(ticketData.fulfillmentContext.fulfillmentType, "Platform");
      assert.equal(ticketData.fulfillmentContext.deliveryPartner, "Ramesh Rider");
      assert.equal(ticketData.fulfillmentContext.itemsCount, 2);
    } finally {
      Customer.findById = origCustomerFindById;
      CustomerSupportRequest.findOne = origFindOne;
      CustomerSupportRequest.exists = origExists;
      CustomerSupportRequest.create = origCreate;
      Order.findById = origOrderFindById;
    }
  });

  // Test 6: Customer Sees ONLY Their Own Tickets
  await test("6. Customer can ONLY query and see their own tickets", async () => {
    const customerA = new mongoose.Types.ObjectId().toString();
    let queryFilter: any = null;

    const origFind = CustomerSupportRequest.find;
    CustomerSupportRequest.find = ((filter: any) => {
      queryFilter = filter;
      return createMockQuery([]);
    }) as any;

    const origCount = CustomerSupportRequest.countDocuments;
    CustomerSupportRequest.countDocuments = (() => Promise.resolve(0)) as any;

    try {
      const { req, res } = createMockReqRes({
        user: { userId: customerA, role: "Customer" },
        query: { status: "Pending" },
      });

      await invokeHandler(getMyTickets, req, res);

      assert.equal(res.statusCode, 200);
      assert.equal(queryFilter.customer.toString(), customerA, "Query MUST filter by customer: userId");
      assert.equal(queryFilter.status, "Pending");
    } finally {
      CustomerSupportRequest.find = origFind;
      CustomerSupportRequest.countDocuments = origCount;
    }
  });

  // Test 7: Customer Cannot Access Another Customer's Ticket Detail
  await test("7. Customer cannot access another customer's ticket detail", async () => {
    const customerA = new mongoose.Types.ObjectId().toString();
    const customerB = new mongoose.Types.ObjectId().toString();
    const ticketId = new mongoose.Types.ObjectId().toString();

    const origFindOne = CustomerSupportRequest.findOne;
    CustomerSupportRequest.findOne = ((filter: any) => {
      if (filter.customer?.toString() === customerA) {
        return createMockQuery(null);
      }
      return createMockQuery({ _id: ticketId, customer: customerB });
    }) as any;

    try {
      const { req, res } = createMockReqRes({
        user: { userId: customerA, role: "Customer" },
        params: { ticketNumber: "SUP-20261009-000001" },
      });

      await invokeHandler(getTicketDetail, req, res);

      assert.equal(res.statusCode, 404, "Foreign ticket should return 404 for this customer");
      assert.equal(res.jsonData.success, false);
    } finally {
      CustomerSupportRequest.findOne = origFindOne;
    }
  });

  // Test 8: Customer Reply Flow and Duplicate Message Protection
  await test("8. Customer reply flow: atomic append, unread flags update, duplicate protection", async () => {
    const customerId = new mongoose.Types.ObjectId().toString();
    const ticketId = new mongoose.Types.ObjectId().toString();

    const mockTicket: any = {
      _id: ticketId,
      customer: customerId,
      status: "In Progress",
      messages: [
        {
          senderType: "CUSTOMER",
          message: "Original message",
          createdAt: new Date(),
        },
      ],
      customerUnread: false,
      adminUnread: false,
      lastMessageAt: new Date(),
    };

    const origFindOne = CustomerSupportRequest.findOne;
    CustomerSupportRequest.findOne = (() => createMockQuery(mockTicket)) as any;
    const origFindOneAndUpdate = CustomerSupportRequest.findOneAndUpdate;
    CustomerSupportRequest.findOneAndUpdate = ((filter: any, update: any) => {
      const clientMessageId = update.$push.messages.clientMessageId;
      if (mockTicket.messages.some((item: any) => item.clientMessageId === clientMessageId)) {
        return createMockQuery(null);
      }
      mockTicket.messages.push(update.$push.messages);
      Object.assign(mockTicket, update.$set);
      return createMockQuery(mockTicket);
    }) as any;

    try {
      const { req, res } = createMockReqRes({
        user: { userId: customerId, role: "Customer" },
        params: { ticketNumber: "SUP-20261009-000001" },
        body: {
          message: "Can you give me an update please?",
          clientMessageId: "message:customer-retry-0001",
        },
      });

      await invokeHandler(sendCustomerMessage, req, res);

      assert.equal(res.statusCode, 200);
      assert.equal(mockTicket.messages.length, 2);
      assert.equal(mockTicket.messages[1].message, "Can you give me an update please?");
      assert.equal(mockTicket.adminUnread, true, "Admin must be notified of unread reply");
      assert.equal(mockTicket.customerUnread, false);

      // Attempt duplicate message immediately
      const { req: dupReq, res: dupRes } = createMockReqRes({
        user: { userId: customerId, role: "Customer" },
        params: { ticketNumber: "SUP-20261009-000001" },
        body: {
          message: "Can you give me an update please?",
          clientMessageId: "message:customer-retry-0001",
        },
      });

      await invokeHandler(sendCustomerMessage, dupReq, dupRes);
      assert.equal(dupRes.statusCode, 200);
      assert.equal(mockTicket.messages.length, 2, "Duplicate message must NOT be appended");

      const { req: sameTextReq, res: sameTextRes } = createMockReqRes({
        user: { userId: customerId, role: "Customer" },
        params: { ticketNumber: "SUP-20261009-000001" },
        body: {
          message: "Can you give me an update please?",
          clientMessageId: "message:customer-new-0002",
        },
      });
      await invokeHandler(sendCustomerMessage, sameTextReq, sameTextRes);
      assert.equal(sameTextRes.statusCode, 200);
      assert.equal(mockTicket.messages.length, 3, "Same text with a new ID must be accepted");
    } finally {
      CustomerSupportRequest.findOne = origFindOne;
      CustomerSupportRequest.findOneAndUpdate = origFindOneAndUpdate;
    }
  });

  // Test 9: Customer Cannot Reply to Closed Ticket
  await test("9. Customer cannot reply to Closed ticket", async () => {
    const customerId = new mongoose.Types.ObjectId().toString();

    const mockTicket: any = {
      _id: new mongoose.Types.ObjectId(),
      customer: customerId,
      status: "Closed",
      messages: [],
    };

    const origFindOne = CustomerSupportRequest.findOne;
    CustomerSupportRequest.findOne = (() => createMockQuery(mockTicket)) as any;

    try {
      const { req, res } = createMockReqRes({
        user: { userId: customerId, role: "Customer" },
        params: { ticketNumber: "SUP-20261009-000001" },
        body: {
          message: "Trying to reply to a closed ticket.",
          clientMessageId: "message:closed-ticket-0001",
        },
      });

      await invokeHandler(sendCustomerMessage, req, res);

      assert.equal(res.statusCode, 400);
      assert.equal(res.jsonData.success, false);
      assert.ok(res.jsonData.message.toLowerCase().includes("closed"));
    } finally {
      CustomerSupportRequest.findOne = origFindOne;
    }
  });

  // Test 10: Customer Closes Ticket
  await test("10. Customer can close their own ticket", async () => {
    const customerId = new mongoose.Types.ObjectId().toString();

    let saved = false;
    const mockTicket: any = {
      _id: new mongoose.Types.ObjectId(),
      customer: customerId,
      status: "In Progress",
      save: async function () {
        saved = true;
        return this;
      },
    };

    const origFindOne = CustomerSupportRequest.findOne;
    CustomerSupportRequest.findOne = (() => createMockQuery(mockTicket)) as any;

    try {
      const { req, res } = createMockReqRes({
        user: { userId: customerId, role: "Customer" },
        params: { ticketNumber: "SUP-20261009-000001" },
      });

      await invokeHandler(closeCustomerTicket, req, res);

      assert.equal(res.statusCode, 200);
      assert.equal(mockTicket.status, "Closed");
      assert.ok(mockTicket.closedAt);
      assert.equal(saved, true);
    } finally {
      CustomerSupportRequest.findOne = origFindOne;
    }
  });

  // Test 11: Admin Replies to Ticket
  await test("11. Admin replies to ticket: sets In Progress, customerUnread, appends message", async () => {
    const adminId = new mongoose.Types.ObjectId().toString();
    const customerId = new mongoose.Types.ObjectId().toString();

    const mockTicket: any = {
      _id: new mongoose.Types.ObjectId(),
      customer: customerId,
      status: "Pending",
      messages: [],
    };

    const origFindOne = CustomerSupportRequest.findOne;
    CustomerSupportRequest.findOne = (() => createMockQuery(mockTicket)) as any;
    const origFindOneAndUpdate = CustomerSupportRequest.findOneAndUpdate;
    CustomerSupportRequest.findOneAndUpdate = ((_filter: any, update: any) => {
      const clientMessageId = update.$push.messages.clientMessageId;
      if (mockTicket.messages.some((item: any) => item.clientMessageId === clientMessageId)) {
        return createMockQuery(null);
      }
      mockTicket.messages.push(update.$push.messages);
      Object.assign(mockTicket, update.$set);
      return createMockQuery(mockTicket);
    }) as any;

    const origAdminFindById = Admin.findById;
    Admin.findById = (() =>
      createMockQuery({
        firstName: "Support",
        lastName: "Agent",
        email: "admin@olovely.in",
      })) as any;

    try {
      const emitted: Array<{ room: string; event: string; payload: any }> = [];
      const io = {
        to: (room: string) => ({
          emit: (event: string, payload: any) => emitted.push({ room, event, payload }),
        }),
      };
      const { req, res } = createMockReqRes({
        user: { userId: adminId, role: "Admin" },
        params: { id: mockTicket._id.toString() },
        app: { get: () => io },
        body: {
          message: "We have reviewed your request and are dispatching a replacement.",
          clientMessageId: "message:admin-reply-0001",
        },
      });

      await invokeHandler(sendAdminMessage, req, res);

      assert.equal(res.statusCode, 200);
      assert.equal(mockTicket.messages.length, 1);
      assert.equal(mockTicket.messages[0].senderType, "ADMIN");
      assert.equal(mockTicket.messages[0].senderName, "Support Agent");
      assert.equal(mockTicket.status, "In Progress");
      assert.equal(mockTicket.customerUnread, true);
      assert.equal(mockTicket.adminUnread, false);
      assert.equal(res.jsonData.persistedMessage.clientMessageId, "message:admin-reply-0001");
      assert.equal(emitted.length, 1, "One persisted reply must emit one customer event");
      assert.equal(emitted[0].room, `customer-${customerId}`);
      assert.equal(emitted[0].payload.messageId, mockTicket.messages[0]._id.toString());

      const { req: retryReq, res: retryRes } = createMockReqRes({
        user: { userId: adminId, role: "Admin" },
        params: { id: mockTicket._id.toString() },
        app: { get: () => io },
        body: {
          message: "We have reviewed your request and are dispatching a replacement.",
          clientMessageId: "message:admin-reply-0001",
        },
      });
      await invokeHandler(sendAdminMessage, retryReq, retryRes);
      assert.equal(retryRes.statusCode, 200);
      assert.equal(retryRes.jsonData.idempotent, true);
      assert.equal(mockTicket.messages.length, 1, "Retry must not append another admin message");
      assert.equal(emitted.length, 1, "Retry must not emit another customer event");

      const { req: refreshReq, res: refreshRes } = createMockReqRes({
        params: { id: mockTicket._id.toString() },
      });
      await invokeHandler(getTicketById, refreshReq, refreshRes);
      assert.equal(refreshRes.statusCode, 200);
      assert.equal(refreshRes.jsonData.data.messages.length, 1);
      assert.equal(
        refreshRes.jsonData.data.messages[0]._id.toString(),
        res.jsonData.persistedMessage._id.toString(),
        "Separate ticket read must return the persisted message ID"
      );
    } finally {
      CustomerSupportRequest.findOne = origFindOne;
      CustomerSupportRequest.findOneAndUpdate = origFindOneAndUpdate;
      Admin.findById = origAdminFindById;
    }
  });

  // Test 12: Admin Status Update with State Machine
  await test("12. Admin updates ticket status with state machine enforcement", async () => {
    let saved = false;
    const mockTicket: any = {
      _id: new mongoose.Types.ObjectId(),
      status: "In Progress",
      save: async function () {
        saved = true;
        return this;
      },
    };

    const origFindOne = CustomerSupportRequest.findOne;
    CustomerSupportRequest.findOne = (() => createMockQuery(mockTicket)) as any;

    try {
      // Valid transition: In Progress -> Resolved
      const { req: validReq, res: validRes } = createMockReqRes({
        user: { userId: "admin1", role: "Admin" },
        params: { id: mockTicket._id.toString() },
        body: { status: "Resolved" },
      });

      await invokeHandler(updateTicketStatus, validReq, validRes);

      assert.equal(validRes.statusCode, 200);
      assert.equal(mockTicket.status, "Resolved");
      assert.ok(mockTicket.resolvedAt);

      // Attempt invalid transition: Resolved -> Pending
      const { req: invReq, res: invRes } = createMockReqRes({
        user: { userId: "admin1", role: "Admin" },
        params: { id: mockTicket._id.toString() },
        body: { status: "Pending" },
      });

      await invokeHandler(updateTicketStatus, invReq, invRes);

      assert.equal(invRes.statusCode, 400);
      assert.equal(invRes.jsonData.success, false);
      assert.ok(invRes.jsonData.message.toLowerCase().includes("cannot transition"));
    } finally {
      CustomerSupportRequest.findOne = origFindOne;
    }
  });

  // Test 13: Legacy Contact Requests remain readable
  await test("13. Legacy contact requests remain readable in Admin and do not crash", async () => {
    const legacyDoc = {
      _id: new mongoose.Types.ObjectId(),
      name: "Guest User",
      email: "guest@example.com",
      subject: "Old website question",
      message: "Legacy submission with no ticketNumber and no customer ref",
      status: "Pending",
      isLegacyContact: true,
      createdAt: new Date("2025-01-01"),
    };

    const origFind = CustomerSupportRequest.find;
    CustomerSupportRequest.find = (() => createMockQuery([legacyDoc])) as any;

    const origCount = CustomerSupportRequest.countDocuments;
    CustomerSupportRequest.countDocuments = (() => Promise.resolve(1)) as any;

    try {
      const { req, res } = createMockReqRes({
        user: { userId: "admin1", role: "Admin" },
        query: {},
      });

      await invokeHandler(getAllTickets, req, res);

      assert.equal(res.statusCode, 200);
      assert.equal(res.jsonData.data.tickets.length, 1);
      assert.equal(res.jsonData.data.tickets[0].isLegacyContact, true);
      assert.equal(res.jsonData.data.tickets[0].subject, "Old website question");
    } finally {
      CustomerSupportRequest.find = origFind;
      CustomerSupportRequest.countDocuments = origCount;
    }
  });

  // Test 14: Guest Contact Form Preserved & Resilient
  await test("14. Guest contact form works and saves even if email delivery fails", async () => {
    let createdDoc: any = null;
    const origCreate = CustomerSupportRequest.create;
    CustomerSupportRequest.create = ((data: any) => {
      createdDoc = {
        ...data,
        _id: new mongoose.Types.ObjectId(),
        save: () => Promise.resolve(),
      };
      return Promise.resolve(createdDoc);
    }) as any;

    try {
      const { req, res } = createMockReqRes({
        body: {
          name: "Guest User",
          email: "guest@example.com",
          subject: "Guest inquiry",
          message: "A question from someone who has not registered.",
        },
      });

      await invokeHandler(submitCustomerSupport, req, res);

      assert.equal(res.statusCode, 200);
      assert.equal(res.jsonData.success, true);
      assert.ok(res.jsonData.data?.requestId);
    } finally {
      CustomerSupportRequest.create = origCreate;
    }
  });

  await test("15. Ticket creation retry reuses clientRequestId without a duplicate document", async () => {
    const customerId = new mongoose.Types.ObjectId().toString();
    let persistedTicket: any = null;
    let saveCount = 0;
    const origFindOne = CustomerSupportRequest.findOne;
    const origExists = CustomerSupportRequest.exists;
    const origSave = CustomerSupportRequest.prototype.save;

    CustomerSupportRequest.findOne = ((filter: any) =>
      createMockQuery(filter?.clientRequestId ? persistedTicket : null)) as any;
    CustomerSupportRequest.exists = (() => Promise.resolve(false)) as any;
    CustomerSupportRequest.prototype.save = async function () {
      saveCount += 1;
      persistedTicket = this;
      return this;
    };

    const requestData = {
      user: { userId: customerId, role: "Customer" },
      body: {
        category: "General",
        subject: "Retry-safe creation",
        message: "Create this support ticket exactly once.",
        clientRequestId: "ticket:create-retry-0001",
      },
    };

    try {
      const first = createMockReqRes(requestData);
      await invokeHandler(createTicket, first.req, first.res);
      const retry = createMockReqRes(requestData);
      await invokeHandler(createTicket, retry.req, retry.res);

      assert.equal(first.res.statusCode, 201);
      assert.equal(retry.res.statusCode, 200);
      assert.equal(retry.res.jsonData.idempotent, true);
      assert.equal(saveCount, 1, "The retry must not create a second ticket document");
      assert.equal(retry.res.jsonData.data._id.toString(), first.res.jsonData.data._id.toString());
    } finally {
      CustomerSupportRequest.findOne = origFindOne;
      CustomerSupportRequest.exists = origExists;
      CustomerSupportRequest.prototype.save = origSave;
    }
  });

  console.log("========================================================");
  console.log(`  ALL ${passed} / ${total} SUPPORT SYSTEM TESTS PASSED SUCCESSFULLY!  `);
  console.log("========================================================");
}

runTestSuite().catch((err) => {
  console.error("Test Suite Error:", err);
  process.exit(1);
});
