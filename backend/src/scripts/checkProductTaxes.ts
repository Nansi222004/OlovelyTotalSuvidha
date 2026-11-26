/**
 * READ-ONLY: which tax rate will each product actually be charged at checkout?
 * Lists products with NO tax (they get the default AppSettings GST rate) and products whose
 * selected tax was deleted/deactivated, plus a count per tax.
 *
 *   cd /root/olovelytotal/backend && npx tsx src/scripts/checkProductTaxes.ts
 */
import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import Product from "../models/Product";
import Tax from "../models/Tax";
import AppSettings from "../models/AppSettings";

(async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set");
  await mongoose.connect(uri);

  const settings: any = await (AppSettings as any).getSettings();
  const defaultRate = settings?.gstEnabled ? Number(settings.gstRate) || 0 : 0;
  console.log(`Default GST (used when a product has no active tax): ${settings?.gstEnabled ? `${defaultRate}%` : "GST disabled → 0%"}`);

  const taxes: any[] = await Tax.find().select("name percentage status").lean();
  const taxById = new Map(taxes.map((t) => [String(t._id), t]));

  const products: any[] = await Product.find({})
    .select("productName tax ownerType productType status createdAt")
    .sort({ createdAt: -1 })
    .lean();

  const noTax: any[] = [];
  const brokenTax: any[] = [];
  const perTax = new Map<string, number>();
  for (const p of products) {
    const raw = p.tax ? String(p.tax).trim() : "";
    if (!raw) {
      noTax.push(p);
      continue;
    }
    const t = taxById.get(raw);
    if (/^[0-9a-fA-F]{24}$/.test(raw) && (!t || t.status !== "Active")) {
      brokenTax.push({ ...p, reason: t ? `tax "${t.name}" is ${t.status}` : "tax was deleted" });
      continue;
    }
    const label = t ? `${t.name} (${t.percentage}%)` : `text "${raw}"`;
    perTax.set(label, (perTax.get(label) || 0) + 1);
  }

  console.log(`\nProducts: ${products.length}`);
  for (const [label, n] of perTax) console.log(`  ${n.toString().padStart(4)} × ${label}`);

  console.log(`\nNO TAX selected → charged default ${defaultRate}% (${noTax.length}):`);
  for (const p of noTax) {
    console.log(`  ${p._id} ${p.productName} [${p.ownerType || "-"} ${p.productType || "-"} ${p.status || "-"}]`);
  }

  console.log(`\nSelected tax deleted/inactive → charged default ${defaultRate}% (${brokenTax.length}):`);
  for (const p of brokenTax) console.log(`  ${p._id} ${p.productName} — ${p.reason}`);

  await mongoose.disconnect();
  process.exit(0);
})().catch(async (e) => {
  console.error("Error:", e?.message || e);
  try { await mongoose.disconnect(); } catch { /* ignore */ }
  process.exit(1);
});
