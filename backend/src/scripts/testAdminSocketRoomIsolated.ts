import assert from "node:assert/strict";
import { createServer } from "node:http";
import jwt from "jsonwebtoken";
import { io as createClient, Socket } from "socket.io-client";
import { initializeSocket } from "../socket/socketService";

function waitForEvent<T>(socket: Socket, event: string, timeoutMs = 5_000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${event}`)), timeoutMs);
    socket.once(event, (value: T) => {
      clearTimeout(timer);
      resolve(value);
    });
  });
}

async function run() {
  const previousSecret = process.env.JWT_SECRET;
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.JWT_SECRET = "isolated-admin-socket-test-secret";
  process.env.NODE_ENV = "test";

  const httpServer = createServer();
  const io = initializeSocket(httpServer);
  await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
  const address = httpServer.address();
  assert(address && typeof address === "object");
  const socketUrl = `http://127.0.0.1:${address.port}`;
  const token = jwt.sign(
    { userId: "admin-test-id", userType: "Admin", role: "Admin" },
    process.env.JWT_SECRET,
  );

  const client = createClient(socketUrl, {
    auth: { token },
    transports: ["websocket"],
    reconnection: false,
  });
  client.on("connect", () => client.emit("join-admin-room"));

  try {
    const firstJoin = await waitForEvent<{ success: boolean }>(client, "joined-admin-room");
    assert.equal(firstJoin.success, true);
    assert(io.sockets.adapter.rooms.get("admin")?.has(client.id));

    const firstAlertPromise = waitForEvent<{ orderId: string }>(client, "admin-notification");
    io.to("admin").emit("admin-notification", { orderId: "first-order" });
    assert.equal((await firstAlertPromise).orderId, "first-order");

    client.disconnect();
    const secondJoinPromise = waitForEvent<{ success: boolean }>(client, "joined-admin-room");
    client.connect();
    const secondJoin = await secondJoinPromise;
    assert.equal(secondJoin.success, true);
    assert(io.sockets.adapter.rooms.get("admin")?.has(client.id));

    const secondAlertPromise = waitForEvent<{ orderId: string }>(client, "admin-notification");
    io.to("admin").emit("admin-notification", { orderId: "after-reconnect" });
    assert.equal((await secondAlertPromise).orderId, "after-reconnect");

    const unauthorized = createClient(socketUrl, { transports: ["websocket"], reconnection: false });
    try {
      await waitForEvent(unauthorized, "connect");
      const rejectedJoinPromise = waitForEvent<{ success: boolean }>(unauthorized, "joined-admin-room");
      unauthorized.emit("join-admin-room");
      assert.equal((await rejectedJoinPromise).success, false);
      assert(!io.sockets.adapter.rooms.get("admin")?.has(unauthorized.id));
    } finally {
      unauthorized.disconnect();
    }

    console.log("PASS: authenticated Admin socket connects and joins room admin");
    console.log("PASS: canonical admin-notification is received");
    console.log("PASS: reconnect rejoins room admin and receives subsequent events");
    console.log("PASS: unauthenticated sockets cannot join room admin");
  } finally {
    client.disconnect();
    await io.close();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
