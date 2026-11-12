/**
 * R-03: scheduled financial jobs.
 *
 * escrow-release (default every 15 min): moves OnHold seller earnings whose return window
 * ended to the withdrawable balance (commissionService.releaseExpiredEscrow).
 *
 * Safety:
 *  - a JobLock lease ensures one instance runs a job at a time (several API replicas may start
 *    the scheduler); the lease expires on its own if the holder crashes
 *  - the job itself is idempotent (atomic per-commission claim + unique ledger reference), so
 *    even an overlapping run cannot double-credit
 *  - disabled with FINANCE_SCHEDULER_ENABLED=false (tests, one-off scripts)
 */
import os from "os";
import JobLock from "../models/JobLock";

const HOLDER = `${os.hostname()}:${process.pid}`;
const timers: NodeJS.Timeout[] = [];

/** Acquire (or renew) a lease. Returns false if another holder owns an unexpired lease. */
export const acquireJobLock = async (name: string, leaseMs: number, holder = HOLDER): Promise<boolean> => {
  const now = new Date();
  try {
    const doc = await JobLock.findOneAndUpdate(
      { name, $or: [{ lockedUntil: { $lte: now } }, { holder }] },
      { $set: { holder, lockedUntil: new Date(now.getTime() + leaseMs) } },
      { upsert: true, new: true },
    );
    return !!doc && doc.holder === holder;
  } catch (e: any) {
    if (e?.code === 11000) return false; // lease held by someone else (upsert collided)
    throw e;
  }
};

export const releaseJobLock = async (name: string, result: any, holder = HOLDER) => {
  await JobLock.updateOne(
    { name, holder },
    { $set: { lockedUntil: new Date(0), lastRunAt: new Date(), lastResult: result } },
  );
};

/** Run one escrow-release pass under the lock. Exported for tests and manual runs. */
export const runEscrowReleaseJob = async (holder = HOLDER) => {
  const name = "escrow-release";
  if (!(await acquireJobLock(name, 10 * 60 * 1000, holder))) {
    return { ran: false, reason: "locked by another instance" };
  }
  let result: any = null;
  try {
    const { releaseExpiredEscrow } = await import("./commissionService");
    result = await releaseExpiredEscrow({ limit: 1000 });
    console.log(
      `[FinanceScheduler] escrow-release: released ${result.releasedCount} (₹${result.releasedAmount}), ` +
        `skipped (open return) ${result.skippedOpenReturn}, failed ${result.failed}`,
    );
    return { ran: true, ...result };
  } catch (e: any) {
    result = { error: e?.message || String(e) };
    console.error("[FinanceScheduler] escrow-release failed:", e);
    return { ran: true, ...result };
  } finally {
    await releaseJobLock(name, result, holder).catch(() => undefined);
  }
};

export const startFinanceScheduler = () => {
  if (String(process.env.FINANCE_SCHEDULER_ENABLED || "true").toLowerCase() === "false") {
    console.log("[FinanceScheduler] disabled (FINANCE_SCHEDULER_ENABLED=false)");
    return;
  }
  const minutes = Math.max(1, Number(process.env.ESCROW_RELEASE_INTERVAL_MINUTES) || 15);
  // First pass shortly after start-up, then on the interval
  timers.push(setTimeout(() => runEscrowReleaseJob().catch(() => undefined), 30 * 1000).unref());
  timers.push(setInterval(() => runEscrowReleaseJob().catch(() => undefined), minutes * 60 * 1000).unref());
  console.log(`[FinanceScheduler] escrow-release every ${minutes} min (holder ${HOLDER})`);
};

export const stopFinanceScheduler = () => {
  while (timers.length) clearTimeout(timers.pop() as any);
};
