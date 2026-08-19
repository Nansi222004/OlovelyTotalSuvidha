/**
 * migrateApprovedReturns.ts
 *
 * One-time migration: advances all "Approved" returns to "Pickup Pending".
 *
 * Background:
 *   The new state machine makes Approved → Pickup Pending an atomic transition.
 *   However, 31 existing returns are stuck at "Approved" from before this change.
 *   Per user confirmation: these returns must NOT be auto-settled.
 *   They should be advanced to "Pickup Pending" so admin can assign a DP.
 *
 * Safe to run multiple times (idempotent — only acts on status === "Approved").
 *
 * Run: node node_modules/tsx/dist/cli.mjs src/scripts/migrateApprovedReturns.ts
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(__dirname, "../../.env") });

import Return from "../models/Return";

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error("MONGODB_URI not set in .env");

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  console.log("✅ MongoDB connected");

  // Count first
  const total = await Return.countDocuments({ status: "Approved" });
  console.log(`\n📋 Found ${total} returns stuck in "Approved" state\n`);

  if (total === 0) {
    console.log("Nothing to migrate. Exiting.");
    await mongoose.disconnect();
    return;
  }

  // Preview IDs
  const approvedReturns = await Return.find({ status: "Approved" })
    .select("_id order customer createdAt")
    .limit(50);

  console.log("Returns to be migrated:");
  for (const r of approvedReturns) {
    console.log(`  ID: ${r._id} | Order: ${r.order} | Customer: ${r.customer} | Created: ${r.createdAt.toISOString()}`);
  }

  console.log(`\nMigrating ${total} returns: "Approved" → "Pickup Pending"...`);

  const result = await Return.updateMany(
    { status: "Approved" },
    {
      $set: {
        status: "Pickup Pending",
        // Add approvedAt timestamp if missing (best-effort using updatedAt)
      }
    }
  );

  console.log(`\n✅ Migration complete. Modified: ${result.modifiedCount} / ${result.matchedCount} records`);
  console.log("\nThese returns are now in 'Pickup Pending' state.");
  console.log("Admin should assign a delivery partner to each one to continue the lifecycle.\n");

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});
