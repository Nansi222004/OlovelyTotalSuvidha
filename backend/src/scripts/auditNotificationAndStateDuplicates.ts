import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import Notification from "../models/Notification";
import Customer from "../models/Customer";
import Seller from "../models/Seller";
import Delivery from "../models/Delivery";
import Admin from "../models/Admin";
import Order from "../models/Order";

dotenv.config({ path: path.join(__dirname, "../../.env") });

async function audit() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || "mongodb://localhost:27017/olovely";
  await mongoose.connect(mongoUri);
  console.log("Connected to MongoDB for read-only audit\n");

  // 1. Notification collection audit
  const totalNotifications = await Notification.countDocuments();
  console.log(`Total Notification records: ${totalNotifications}`);

  // Check for duplicate notifications by (recipientType, recipientId, title, message)
  const duplicateNotifs = await Notification.aggregate([
    {
      $group: {
        _id: {
          recipientType: "$recipientType",
          recipientId: "$recipientId",
          title: "$title",
          message: "$message",
        },
        count: { $sum: 1 },
        ids: { $push: "$_id" },
        createdAts: { $push: "$createdAt" },
        eventIds: { $push: "$eventId" },
      },
    },
    { $match: { count: { $gt: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 },
  ]);

  console.log(`\nDuplicate notification groups found: ${duplicateNotifs.length}`);
  for (const dup of duplicateNotifs) {
    console.log(` - [${dup._id.recipientType}] ID: ${dup._id.recipientId} | Title: "${dup._id.title}" | Count: ${dup.count}`);
    console.log(`   Event IDs: ${JSON.stringify(dup.eventIds.slice(0, 3))}`);
    console.log(`   Created: ${dup.createdAts.slice(0, 3).map((d: any) => new Date(d).toISOString()).join(", ")}`);
  }

  // 2. Token duplication audit
  const collectTokens = async (Model: any, role: string) => {
    const docs = await Model.find({}, "_id fcmTokens fcmTokenMobile").lean();
    const tokenMap = new Map<string, string[]>();
    for (const doc of docs) {
      const allTokens = [...(doc.fcmTokens || []), ...(doc.fcmTokenMobile || [])];
      for (const t of allTokens) {
        if (!tokenMap.has(t)) tokenMap.set(t, []);
        tokenMap.get(t)!.push(`${role}:${doc._id}`);
      }
    }
    return tokenMap;
  };

  const [custTokens, sellerTokens, deliveryTokens, adminTokens] = await Promise.all([
    collectTokens(Customer, "Customer"),
    collectTokens(Seller, "Seller"),
    collectTokens(Delivery, "Delivery"),
    collectTokens(Admin, "Admin"),
  ]);

  const allTokenMap = new Map<string, string[]>();
  for (const [map, role] of [
    [custTokens, "Customer"],
    [sellerTokens, "Seller"],
    [deliveryTokens, "Delivery"],
    [adminTokens, "Admin"],
  ] as const) {
    for (const [t, users] of map.entries()) {
      if (!allTokenMap.has(t)) allTokenMap.set(t, []);
      allTokenMap.get(t)!.push(...users);
    }
  }

  let multiUserTokens = 0;
  for (const [token, users] of allTokenMap.entries()) {
    const uniqueUsers = [...new Set(users)];
    if (uniqueUsers.length > 1) {
      multiUserTokens++;
      if (multiUserTokens <= 5) {
        console.log(`Token shared across users: ${token.substring(0, 15)}... -> ${uniqueUsers.join(", ")}`);
      }
    }
  }
  console.log(`Total distinct tokens: ${allTokenMap.size}, Tokens mapped to >1 user: ${multiUserTokens}`);

  // 3. Orders status distribution
  const orderStats = await Order.aggregate([
    { $group: { _id: "$status", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);
  console.log("\nOrder status breakdown:");
  for (const stat of orderStats) {
    console.log(` - ${stat._id}: ${stat.count}`);
  }

  await mongoose.disconnect();
}

audit().catch((err) => {
  console.error("Audit error:", err);
  process.exit(1);
});
