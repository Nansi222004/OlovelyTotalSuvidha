import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import mongoose from "mongoose";
import dotenv from "dotenv";
import WebSocket from "ws";
import Customer from "../models/Customer";
import CustomerSupportRequest from "../models/CustomerSupportRequest";
import Admin from "../models/Admin";
import Seller from "../models/Seller";
import Delivery from "../models/Delivery";
import { generateToken } from "../services/jwtService";

dotenv.config({ path: path.join(__dirname, "../../.env") });

const delay = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

class CdpClient {
  private nextId = 1;
  private readonly pending = new Map<number, { resolve: (value: any) => void; reject: (reason: Error) => void }>();
  private readonly handlers = new Map<string, Array<(params: any) => void>>();

  constructor(private readonly socket: WebSocket) {
    socket.on("message", (raw) => {
      const message = JSON.parse(String(raw));
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(message.error.message));
        else pending.resolve(message.result);
        return;
      }
      for (const handler of this.handlers.get(message.method) || []) handler(message.params);
    });
  }

  send(method: string, params: Record<string, unknown> = {}): Promise<any> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  on(method: string, handler: (params: any) => void): void {
    const handlers = this.handlers.get(method) || [];
    handlers.push(handler);
    this.handlers.set(method, handlers);
  }
}

async function waitForDebugger(port: number): Promise<any> {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (response.ok) return response.json();
    } catch {
      // Chrome is still starting.
    }
    await delay(100);
  }
  throw new Error("Timed out waiting for the isolated Chrome debugger");
}

async function run(): Promise<void> {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!mongoUri) throw new Error("MongoDB connection is not configured");
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10000 });

  const ticket = await CustomerSupportRequest.findOne({ customer: { $exists: true, $ne: null } })
    .sort({ createdAt: -1 })
    .select("customer ticketNumber status createdAt")
    .lean();
  if (!ticket?.customer || !ticket.ticketNumber) throw new Error("No customer support ticket is available for read-only verification");
  const customer = await Customer.findById(ticket.customer).lean();
  if (!customer) throw new Error("The ticket customer no longer exists");

  const token = generateToken(String(customer._id), "Customer");
  const browserUser = {
    id: String(customer._id),
    _id: String(customer._id),
    name: customer.name,
    phone: customer.phone,
    email: customer.email,
    preferredLanguage: customer.preferredLanguage || "en",
    userType: "Customer",
  };

  const chromePath = "C:/Program Files/Google/Chrome/Application/chrome.exe";
  const debugPort = 9237;
  const profileDirectory = path.join(os.tmpdir(), `olovely-browser-auth-${process.pid}`);
  let chrome: ChildProcess | null = null;
  let socket: WebSocket | null = null;

  try {
    chrome = spawn(chromePath, [
      "--headless=new",
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${profileDirectory}`,
      "--no-first-run",
      "--disable-default-apps",
      "about:blank",
    ], { stdio: "ignore", windowsHide: true });
    await waitForDebugger(debugPort);

    const targetResponse = await fetch(
      `http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent("http://localhost:5173/")}`,
      { method: "PUT" }
    );
    const target = await targetResponse.json() as { webSocketDebuggerUrl: string };
    socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise<void>((resolve, reject) => {
      socket!.once("open", () => resolve());
      socket!.once("error", reject);
    });

    const cdp = new CdpClient(socket);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Network.enable");
    await cdp.send("Network.setBypassServiceWorker", { bypass: true });
    await delay(1500);

    await cdp.send("Runtime.evaluate", {
      expression: `localStorage.setItem('customer_authToken', ${JSON.stringify(token)}); localStorage.setItem('customer_userData', ${JSON.stringify(JSON.stringify(browserUser))});`,
    });

    const ticketPath = `/support/tickets/${encodeURIComponent(ticket.ticketNumber)}`;
    const ticketEndpoint = `/customer/support/tickets/${ticket.ticketNumber}`;
    const listEndpoint = "/customer/support/tickets?page=1&limit=10";
    let ticketRequestCount = 0;
    let ticketAuthorizationPresent = false;
    let ticketStatus: number | null = null;
    let socketCreated = false;
    let supportRoomReadyAckReceived = false;
    let trackAppTicketRequests = false;
    const ticketRequestIds = new Set<string>();

    cdp.on("Network.requestWillBeSent", ({ requestId, request }: any) => {
      if (trackAppTicketRequests && request.url.includes(ticketEndpoint)) {
        ticketRequestCount += 1;
        ticketRequestIds.add(requestId);
        ticketAuthorizationPresent ||= Boolean(request.headers?.Authorization || request.headers?.authorization);
      }
    });
    cdp.on("Network.requestWillBeSentExtraInfo", ({ requestId, headers }: any) => {
      if (ticketRequestIds.has(requestId)) {
        ticketAuthorizationPresent ||= Boolean(headers?.Authorization || headers?.authorization);
      }
    });
    cdp.on("Network.responseReceived", ({ response }: any) => {
      if (trackAppTicketRequests && response.url.includes(ticketEndpoint)) ticketStatus = response.status;
    });
    cdp.on("Network.webSocketCreated", ({ url }: any) => {
      if (String(url).includes("socket.io")) socketCreated = true;
    });
    cdp.on("Network.webSocketFrameReceived", ({ response }: any) => {
      if (String(response?.payloadData || "").includes("customer-support-ready")) {
        supportRoomReadyAckReceived = true;
      }
    });

    await cdp.send("Page.navigate", { url: "http://localhost:5173/account" });
    await delay(4500);
    await cdp.send("Page.reload", { ignoreCache: true });
    await delay(4500);
    const accountState = await cdp.send("Runtime.evaluate", {
      expression: `({ path: location.pathname, tokenPresent: !!localStorage.getItem('customer_authToken'), showsLoggedOutWelcome: document.body.innerText.includes('Welcome! Login to access your profile') })`,
      returnByValue: true,
    });

    ticketRequestCount = 0;
    ticketAuthorizationPresent = false;
    ticketStatus = null;
    const apiModuleState = await cdp.send("Runtime.evaluate", {
      expression: `import('/src/services/api/config.ts').then(module => ({ tokenVisibleToApiModule: !!module.getAuthToken('customer'), panel: module.getPanelFromContext(undefined, '/customer/support/tickets/test') }))`,
      awaitPromise: true,
      returnByValue: true,
    });
    const explicitAuthenticatedFetch = await cdp.send("Runtime.evaluate", {
      expression: `fetch(${JSON.stringify(`http://localhost:5000/api/v1${ticketEndpoint}`)}, { headers: { Authorization: 'Bearer ' + localStorage.getItem('customer_authToken') } }).then(async response => { const body = await response.json().catch(() => ({})); return { status: response.status, code: body.code || null }; })`,
      awaitPromise: true,
      returnByValue: true,
    });
    const listApiResult = await cdp.send("Runtime.evaluate", {
      expression: `fetch(${JSON.stringify(`http://localhost:5000/api/v1${listEndpoint}`)}, { headers: { Authorization: 'Bearer ' + localStorage.getItem('customer_authToken') } }).then(async response => { const body = await response.json().catch(() => ({})); return { status: response.status, success: body.success, dataIsArray: Array.isArray(body.data), nestedTicketCount: Array.isArray(body.data?.tickets) ? body.data.tickets.length : null, directTicketCount: Array.isArray(body.data) ? body.data.length : null, includesTicket: (Array.isArray(body.data?.tickets) ? body.data.tickets : Array.isArray(body.data) ? body.data : []).some(item => item.ticketNumber === ${JSON.stringify(ticket.ticketNumber)}), paginationKeys: body.data?.pagination ? Object.keys(body.data.pagination).sort() : [] }; })`,
      awaitPromise: true,
      returnByValue: true,
    });
    await cdp.send("Page.navigate", { url: "http://localhost:5173/support/tickets" });
    await delay(8000);
    const listPageState = await cdp.send("Runtime.evaluate", {
      expression: `({ path: location.pathname, showsEmptyState: document.body.innerText.includes('No Support Tickets Found'), showsTicket: document.body.innerText.includes(${JSON.stringify(ticket.ticketNumber)}), showsError: document.body.innerText.includes('Failed to load support tickets') })`,
      returnByValue: true,
    });
    ticketRequestCount = 0;
    ticketAuthorizationPresent = false;
    ticketStatus = null;
    ticketRequestIds.clear();
    trackAppTicketRequests = true;
    await cdp.send("Page.navigate", { url: `http://localhost:5173${ticketPath}` });
    await delay(5000);
    trackAppTicketRequests = false;
    const ticketState = await cdp.send("Runtime.evaluate", {
      expression: `({ path: location.pathname, tokenPresent: !!localStorage.getItem('customer_authToken'), bodyHasTicket: document.body.innerText.includes(${JSON.stringify(ticket.ticketNumber)}) })`,
      returnByValue: true,
    });
    const initialTicketNetwork = {
      authorizationHeaderPresent: ticketAuthorizationPresent,
      responseStatus: ticketStatus,
      requestCount: ticketRequestCount,
    };

    ticketRequestCount = 0;
    ticketAuthorizationPresent = false;
    ticketStatus = null;
    ticketRequestIds.clear();
    trackAppTicketRequests = true;
    await cdp.send("Page.reload", { ignoreCache: true });
    await delay(5000);
    trackAppTicketRequests = false;
    const refreshedTicketState = await cdp.send("Runtime.evaluate", {
      expression: `({ path: location.pathname, tokenPresent: !!localStorage.getItem('customer_authToken'), bodyHasTicket: document.body.innerText.includes(${JSON.stringify(ticket.ticketNumber)}) })`,
      returnByValue: true,
    });

    const unauthenticatedStatus = await cdp.send("Runtime.evaluate", {
      expression: `fetch(${JSON.stringify(`http://localhost:5000/api/v1${ticketEndpoint}`)}, { headers: {} }).then(response => response.status)`,
      awaitPromise: true,
      returnByValue: true,
    });

    const requestWithToken = async (roleToken: string | null) => {
      if (!roleToken) return null;
      const result = await cdp.send("Runtime.evaluate", {
        expression: `fetch(${JSON.stringify(`http://localhost:5000/api/v1${ticketEndpoint}`)}, { headers: { Authorization: 'Bearer ' + ${JSON.stringify(roleToken)} } }).then(response => response.status)`,
        awaitPromise: true,
        returnByValue: true,
      });
      return result.result.value as number;
    };
    const anotherCustomer = await Customer.findOne({ _id: { $ne: customer._id } }).select("_id").lean();
    const admin = await Admin.findOne({}).select("_id role").lean();
    const seller = await Seller.findOne({}).select("_id").lean();
    const delivery = await Delivery.findOne({}).select("_id").lean();
    const isolationStatuses = {
      anotherCustomer: await requestWithToken(
        anotherCustomer ? generateToken(String(anotherCustomer._id), "Customer") : null
      ),
      admin: await requestWithToken(admin ? generateToken(String(admin._id), "Admin", (admin as any).role) : null),
      seller: await requestWithToken(seller ? generateToken(String(seller._id), "Seller") : null),
      delivery: await requestWithToken(delivery ? generateToken(String(delivery._id), "Delivery") : null),
    };

    const account = accountState.result.value;
    const detail = ticketState.result.value;
    const refreshedDetail = refreshedTicketState.result.value;
    const report = {
      mode: "isolated-headless-browser-read-only",
      accountRefresh: {
        remainedOnAccount: account.path === "/account",
        tokenPresent: account.tokenPresent,
        loggedOutWelcomeVisible: account.showsLoggedOutWelcome,
      },
      auditedTicket: {
        ticketNumber: ticket.ticketNumber,
        customerReferenceSuffix: String(ticket.customer).slice(-6),
        authenticatedCustomerSuffix: String(customer._id).slice(-6),
        ownershipMatches: String(ticket.customer) === String(customer._id),
        status: ticket.status,
        createdAt: new Date(ticket.createdAt).toISOString(),
      },
      ticketListApi: listApiResult.result.value,
      ticketListPage: listPageState.result.value,
      ticketDetail: {
        remainedOnProtectedRoute: detail.path === ticketPath,
        tokenPresent: detail.tokenPresent,
        authorizationHeaderPresent: initialTicketNetwork.authorizationHeaderPresent,
        responseStatus: initialTicketNetwork.responseStatus,
        requestCount: initialTicketNetwork.requestCount,
        renderedTicketNumber: detail.bodyHasTicket,
        tokenVisibleToApiModule: apiModuleState.result.value?.tokenVisibleToApiModule,
        resolvedPanel: apiModuleState.result.value?.panel,
        explicitAuthenticatedFetchStatus: explicitAuthenticatedFetch.result.value?.status,
        explicitAuthenticatedFetchCode: explicitAuthenticatedFetch.result.value?.code,
      },
      ticketRefresh: {
        remainedOnProtectedRoute: refreshedDetail.path === ticketPath,
        tokenPresent: refreshedDetail.tokenPresent,
        authorizationHeaderPresent: ticketAuthorizationPresent,
        responseStatus: ticketStatus,
        requestCount: ticketRequestCount,
        renderedTicketNumber: refreshedDetail.bodyHasTicket,
      },
      socketTransportCreated: socketCreated,
      supportRoomReadyAckReceived,
      unauthenticatedTicketStatus: unauthenticatedStatus.result.value,
      isolationStatuses,
    };
    console.log(JSON.stringify(report, null, 2));

    assert.equal(account.path, "/account");
    assert.equal(account.tokenPresent, true);
    assert.equal(account.showsLoggedOutWelcome, false);
    assert.equal(listApiResult.result.value?.status, 200);
    assert.equal(listApiResult.result.value?.success, true);
    assert.equal(listApiResult.result.value?.includesTicket, true);
    assert.equal(listPageState.result.value?.path, "/support/tickets");
    assert.equal(listPageState.result.value?.showsEmptyState, false);
    assert.equal(listPageState.result.value?.showsTicket, true);
    assert.equal(detail.path, ticketPath);
    assert.equal(detail.tokenPresent, true);
    assert.equal(initialTicketNetwork.authorizationHeaderPresent, true);
    assert.equal(initialTicketNetwork.responseStatus, 200);
    assert.equal(initialTicketNetwork.requestCount, 1);
    assert.equal(detail.bodyHasTicket, true);
    assert.equal(refreshedDetail.path, ticketPath);
    assert.equal(refreshedDetail.tokenPresent, true);
    assert.equal(ticketAuthorizationPresent, true);
    assert.equal(ticketStatus, 200);
    assert.equal(ticketRequestCount, 1);
    assert.equal(refreshedDetail.bodyHasTicket, true);
    assert.equal(unauthenticatedStatus.result.value, 401);
    for (const status of Object.values(isolationStatuses)) {
      if (status !== null) assert.equal(status, 404);
    }

  } finally {
    socket?.close();
    chrome?.kill();
    await mongoose.disconnect();
    const resolvedProfile = path.resolve(profileDirectory);
    const resolvedTemp = `${path.resolve(os.tmpdir())}${path.sep}`;
    if (resolvedProfile.startsWith(resolvedTemp) && path.basename(resolvedProfile).startsWith("olovely-browser-auth-")) {
      await delay(300);
      await rm(resolvedProfile, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}

run().catch((error) => {
  console.error(`Browser auth verification failed: ${error.message}`);
  process.exitCode = 1;
});
