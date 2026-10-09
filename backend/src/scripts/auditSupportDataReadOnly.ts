import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "node:path";
import CustomerSupportRequest from "../models/CustomerSupportRequest";

dotenv.config({ path: path.join(__dirname, "../../.env") });

type MessageSnapshot = {
  _id?: unknown;
  clientMessageId?: string;
  senderType?: string;
  senderId?: unknown;
  message?: string;
  createdAt?: Date;
};

async function audit(): Promise<void> {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!mongoUri) throw new Error("MongoDB connection is not configured");

  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10000 });
  const tickets = await CustomerSupportRequest.find({})
    .select("_id customer email subject message createdAt messages clientRequestId")
    .lean();

  let mirroredInitialMessages = 0;
  let duplicateMessageIdTickets = 0;
  let duplicateClientMessageIdTickets = 0;
  let exactDuplicateMessageEntryTickets = 0;
  let rapidSameTextCandidateTickets = 0;
  let adminMessageCount = 0;

  for (const ticket of tickets) {
    const messages = (ticket.messages || []) as MessageSnapshot[];
    if (messages.some((item) => item.senderType === "CUSTOMER" && item.message === ticket.message)) {
      mirroredInitialMessages += 1;
    }
    adminMessageCount += messages.filter((item) => item.senderType === "ADMIN").length;

    const messageIds = messages.map((item) => String(item._id || "")).filter(Boolean);
    if (new Set(messageIds).size !== messageIds.length) duplicateMessageIdTickets += 1;

    const clientIds = messages.map((item) => item.clientMessageId).filter(Boolean) as string[];
    if (new Set(clientIds).size !== clientIds.length) duplicateClientMessageIdTickets += 1;

    const exactKeys = messages.map((item) =>
      [
        item.senderType || "",
        String(item.senderId || ""),
        item.message || "",
        item.createdAt ? new Date(item.createdAt).toISOString() : "",
      ].join("|")
    );
    if (new Set(exactKeys).size !== exactKeys.length) exactDuplicateMessageEntryTickets += 1;

    const chronological = [...messages].sort(
      (a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
    );
    if (
      chronological.some((item, index) => {
        if (index === 0) return false;
        const previous = chronological[index - 1];
        return (
          item.senderType === previous.senderType &&
          String(item.senderId || "") === String(previous.senderId || "") &&
          item.message === previous.message &&
          Math.abs(
            new Date(item.createdAt || 0).getTime() -
              new Date(previous.createdAt || 0).getTime()
          ) <= 30000
        );
      })
    ) {
      rapidSameTextCandidateTickets += 1;
    }
  }

  const ticketGroups = new Map<string, number[]>();
  for (const ticket of tickets) {
    const key = [
      String(ticket.customer || ticket.email || "guest"),
      ticket.subject || "",
      ticket.message || "",
    ].join("|");
    const times = ticketGroups.get(key) || [];
    times.push(new Date(ticket.createdAt).getTime());
    ticketGroups.set(key, times);
  }
  let rapidDuplicateTicketCandidateGroups = 0;
  for (const times of ticketGroups.values()) {
    const sorted = times.sort((a, b) => a - b);
    if (sorted.some((time, index) => index > 0 && time - sorted[index - 1] <= 30000)) {
      rapidDuplicateTicketCandidateGroups += 1;
    }
  }

  console.log(
    JSON.stringify(
      {
        mode: "read-only",
        totalTicketDocuments: tickets.length,
        rapidDuplicateTicketCandidateGroups,
        ticketsWhoseTopLevelMessageMirrorsInitialArrayMessage: mirroredInitialMessages,
        ticketsWithDuplicateMongoMessageIds: duplicateMessageIdTickets,
        ticketsWithDuplicateClientMessageIds: duplicateClientMessageIdTickets,
        ticketsWithExactDuplicateMessageEntries: exactDuplicateMessageEntryTickets,
        ticketsWithRapidSameSenderAndTextCandidates: rapidSameTextCandidateTickets,
        persistedAdminMessages: adminMessageCount,
      },
      null,
      2
    )
  );
}

audit()
  .catch((error) => {
    console.error(`Read-only support audit failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });

