/**
 * R-15: financial test suites must never run against a shared/production database.
 *
 * Imported FIRST by every financial test script that connects via MONGODB_URI / MONGO_URI.
 * The process exits unless the URI points to a local MongoDB (localhost / 127.0.0.1 / ::1).
 * No override exists on purpose: point MONGODB_URI at a local or in-memory instance, or use
 * the isolated suite (npm run test:financial-audit, MongoMemoryReplSet).
 */
import dotenv from "dotenv";

dotenv.config();

const uri = process.env.MONGODB_URI || process.env.MONGO_URI || "";
const isLocal = /^mongodb:\/\/([^@/]*@)?(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/|$|\?)/i.test(uri);

if (!isLocal) {
  console.error(
    "\n[testDbGuard] REFUSED: this financial test would write to " +
      (uri ? `a non-local database (${uri.replace(/\/\/[^@]*@/, "//***@").split("?")[0]})` : "an unset MONGODB_URI") +
      ".\nFinancial tests may only run against a local MongoDB. Use `npm run test:financial-audit` (in-memory) " +
      "or set MONGODB_URI=mongodb://127.0.0.1:27017/<test-db> for this shell.\n",
  );
  process.exit(3);
}
