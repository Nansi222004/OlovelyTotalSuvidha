/**
 * R-07: commission uniqueness.
 *
 *   SELLER       one record per order item          { orderItem: 1, type: 1 }  (type = SELLER)
 *   DELIVERY_BOY one record per order               { order: 1, type: 1 }      (type = DELIVERY_BOY)
 *
 * Legitimate data never has two SELLER records for one order item: a partial return SHRINKS
 * the existing record and a full return CANCELS it; nothing re-creates it. Cancelled records
 * are therefore included in the uniqueness check on purpose.
 *
 * Usage (run against the target DB explicitly; nothing is changed without --apply):
 *   npx ts-node src/scripts/migrations/createCommissionUniqueIndexes.ts --uri "<mongodb-uri>"           # report only
 *   npx ts-node src/scripts/migrations/createCommissionUniqueIndexes.ts --uri "<mongodb-uri>" --apply   # create indexes
 *
 * --apply refuses to run while duplicates exist. Duplicates are NEVER deleted or merged by this
 * script: they are listed for Finance (see docs/OLOVELY_FINANCIAL_RECONCILIATION.md, query Q3).
 */
import mongoose from "mongoose";

export const SELLER_INDEX_NAME = "uniq_seller_commission_per_item";
export const RIDER_INDEX_NAME = "uniq_rider_commission_per_order";

export const findDuplicateCommissions = async (db = mongoose.connection.db!) => {
  const col = db.collection("commissions");
  const seller = await col
    .aggregate([
      { $match: { type: "SELLER", orderItem: { $exists: true, $ne: null } } },
      { $group: { _id: "$orderItem", n: { $sum: 1 }, ids: { $push: "$_id" }, statuses: { $push: "$status" }, order: { $first: "$order" } } },
      { $match: { n: { $gt: 1 } } },
    ])
    .toArray();
  const rider = await col
    .aggregate([
      { $match: { type: "DELIVERY_BOY" } },
      { $group: { _id: "$order", n: { $sum: 1 }, ids: { $push: "$_id" }, statuses: { $push: "$status" } } },
      { $match: { n: { $gt: 1 } } },
    ])
    .toArray();
  return { seller, rider };
};

export const createCommissionUniqueIndexes = async (db = mongoose.connection.db!) => {
  const dups = await findDuplicateCommissions(db);
  if (dups.seller.length || dups.rider.length) {
    throw new Error(
      `Refusing to create unique indexes: ${dups.seller.length} order item(s) with duplicate SELLER commissions, ` +
        `${dups.rider.length} order(s) with duplicate DELIVERY_BOY commissions. Resolve with Finance first.`,
    );
  }
  const col = db.collection("commissions");
  await col.createIndex(
    { orderItem: 1, type: 1 },
    { name: SELLER_INDEX_NAME, unique: true, partialFilterExpression: { type: "SELLER", orderItem: { $exists: true } } },
  );
  await col.createIndex(
    { order: 1, type: 1 },
    { name: RIDER_INDEX_NAME, unique: true, partialFilterExpression: { type: "DELIVERY_BOY" } },
  );
  return { created: [SELLER_INDEX_NAME, RIDER_INDEX_NAME] };
};

const main = async () => {
  const args = process.argv.slice(2);
  const uriIdx = args.indexOf("--uri");
  const uri = uriIdx >= 0 ? args[uriIdx + 1] : undefined;
  const apply = args.includes("--apply");
  if (!uri) {
    console.error("Pass the target database explicitly: --uri <mongodb-uri>  (MONGODB_URI is intentionally NOT read)");
    process.exit(2);
  }
  await mongoose.connect(uri);
  try {
    const dups = await findDuplicateCommissions();
    console.log(JSON.stringify({ sellerDuplicates: dups.seller, riderDuplicates: dups.rider }, null, 2));
    if (!apply) {
      console.log("Dry run only. Re-run with --apply to create the indexes (requires zero duplicates).");
      return;
    }
    console.log(await createCommissionUniqueIndexes());
  } finally {
    await mongoose.disconnect();
  }
};

if (require.main === module) {
  main().catch((e) => {
    console.error(e?.message || e);
    process.exit(1);
  });
}
