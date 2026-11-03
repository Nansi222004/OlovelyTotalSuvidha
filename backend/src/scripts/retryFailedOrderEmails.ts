import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import OrderEmailNotification from "../models/OrderEmailNotification";
import { retryFailedOrderEmail } from "../services/orderEmailService";

dotenv.config({ path: path.join(__dirname, "../../.env") });

export interface IRetryBatchOptions {
  batchSize?: number;
  staleMinutes?: number;
}

export interface IRetryBatchResult {
  totalEligible: number;
  processed: number;
  succeeded: number;
  failed: number;
  exhausted: number;
  skippedOrDuplicate: number;
  durationMs: number;
}

/**
 * Process a bounded batch of failed and stale pending order email notifications.
 * Uses atomic reservations and idempotent dispatch from retryFailedOrderEmail.
 */
export async function processFailedOrderEmailsBatch(
  options?: IRetryBatchOptions
): Promise<IRetryBatchResult> {
  const startTime = Date.now();
  const batchSize = Math.max(1, Math.min(options?.batchSize || 25, 100));
  const staleMinutes = options?.staleMinutes || 5;
  const staleBefore = new Date(Date.now() - staleMinutes * 60 * 1000);

  // Query eligible notifications bounded by batch size
  // Selects FAILED notifications under max attempts and abandoned PENDING leases
  const eligibleRecords = await OrderEmailNotification.find({
    $or: [
      { status: "FAILED", attempts: { $lt: 5 } },
      { status: "PENDING", attempts: { $lt: 5 }, lastAttemptAt: { $lt: staleBefore } },
    ],
  })
    .sort({ lastAttemptAt: 1, createdAt: 1 })
    .limit(batchSize)
    .lean();

  let succeeded = 0;
  let failed = 0;
  let exhausted = 0;
  let skippedOrDuplicate = 0;

  for (const record of eligibleRecords) {
    try {
      const result = await retryFailedOrderEmail(record._id.toString());
      if (result.sent) {
        succeeded++;
      } else if (result.skipped) {
        if (result.skippedReason?.includes("Maximum retry attempts exceeded")) {
          exhausted++;
        } else {
          skippedOrDuplicate++;
        }
      } else if (result.duplicate) {
        skippedOrDuplicate++;
      } else {
        failed++;
      }
    } catch (itemErr: any) {
      console.error(`[RETRY WORKER ERROR] Safe retry failed for record ${record._id}:`, itemErr?.message || itemErr);
      failed++;
    }
  }

  const durationMs = Date.now() - startTime;
  const summaryResult: IRetryBatchResult = {
    totalEligible: eligibleRecords.length,
    processed: eligibleRecords.length,
    succeeded,
    failed,
    exhausted,
    skippedOrDuplicate,
    durationMs,
  };

  console.log(
    `[RETRY WORKER BATCH COMPLETED] Processed ${summaryResult.processed}/${summaryResult.totalEligible} notifications in ${durationMs}ms: ` +
    `succeeded=${succeeded}, failed=${failed}, exhausted=${exhausted}, skippedOrDuplicate=${skippedOrDuplicate}`
  );

  return summaryResult;
}

/**
 * CLI Entry point for cron or scheduled tasks
 */
async function main() {
  console.log("======================================================================");
  console.log(" OLOVELY ORDER UPDATE EMAIL RETRY WORKER ");
  console.log("======================================================================");

  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!mongoUri) {
    console.error("❌ [RETRY WORKER] MONGODB_URI is not defined in environment variables. Exiting.");
    process.exit(1);
  }

  // Parse command line batch size if provided (--batch-size=50)
  let batchSize = 25;
  for (const arg of process.argv) {
    if (arg.startsWith("--batch-size=")) {
      const parsed = parseInt(arg.split("=")[1], 10);
      if (!isNaN(parsed) && parsed > 0) {
        batchSize = Math.min(parsed, 100);
      }
    }
  }

  try {
    await mongoose.connect(mongoUri);
    console.log("✓ [RETRY WORKER] Connected to MongoDB");

    await processFailedOrderEmailsBatch({ batchSize });

    await mongoose.disconnect();
    console.log("✓ [RETRY WORKER] Database disconnected. Worker exited cleanly.");
    process.exit(0);
  } catch (error: any) {
    console.error("❌ [RETRY WORKER FATAL ERROR]:", error?.message || error);
    try {
      await mongoose.disconnect();
    } catch (_) {}
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
