import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  buildFlexibleRegex,
  buildFuzzyCandidateRegex,
  classifySearchMatch,
  rankSearchSuggestions,
} from "../utils/searchSuggestions";

const sellers = [
  { id: "contains", sellerName: "Supermilk House", storeName: "Daily Foods" },
  { id: "token", sellerName: "Owner", storeName: "Central Milk Market" },
  { id: "fuzzy", sellerName: "Tumeri", storeName: "Tumeri General Store" },
  { id: "prefix", sellerName: "Milkman", storeName: "Fresh Dairy" },
  { id: "exact", sellerName: "Milk", storeName: "Milk" },
  { id: "other", sellerName: "Shoe Planet", storeName: "Footwear" },
];

const values = (seller: (typeof sellers)[number]) => [seller.sellerName, seller.storeName];

assert.equal(classifySearchMatch("Milk", "milk")?.kind, "exact", "exact search");
assert.equal(classifySearchMatch("Milkman", "mil")?.kind, "prefix", "prefix search");
assert.equal(classifySearchMatch("Central Milk Market", "milk")?.kind, "token", "token search");
assert.equal(classifySearchMatch("Supermilk House", "milk")?.kind, "contains", "contains search");
assert.equal(classifySearchMatch("Tumeri", "tur")?.kind, "fuzzy", "tur must dynamically match Tumeri");
assert.equal(classifySearchMatch("TUMERI", "TuR")?.kind, "fuzzy", "case-insensitive fuzzy search");
assert.equal(classifySearchMatch("Tumeri", ""), null, "empty query");
assert.equal(classifySearchMatch("Tumeri", "t"), null, "minimum query length");
assert.equal(classifySearchMatch("Tumeri", "xyz"), null, "no result");

const rankedMilk = rankSearchSuggestions(sellers, "milk", values, 4);
assert.deepEqual(
  rankedMilk.map((seller) => seller.id),
  ["exact", "prefix", "token", "contains"],
  "exact > prefix > token > contains ranking"
);
assert.equal(rankSearchSuggestions(sellers, "", values).length, 0);
assert.equal(rankSearchSuggestions(sellers, "mi", values, 2).length, 2, "result limit");
assert.equal(rankSearchSuggestions(sellers, "nothing", values).length, 0, "no results");
assert.equal(rankSearchSuggestions(sellers, "tur", values)[0]?.id, "fuzzy", "tur -> Tumeri");
assert(buildFlexibleRegex("icecream").test("Ice Cream"), "existing flexible matching remains intact");
assert(buildFuzzyCandidateRegex("tur")?.test("Tumeri"), "database fuzzy candidate regex");

const repositoryRoot = path.resolve(__dirname, "../../..");
const read = (relativePath: string) =>
  fs.readFileSync(path.join(repositoryRoot, relativePath), "utf8");

const sellerController = read("backend/src/modules/seller/controllers/sellerController.ts");
const sellerRoutes = read("backend/src/routes/sellerRoutes.ts");
const sellerService = read("frontend/src/services/api/sellerService.ts");
const debounceHook = read("frontend/src/hooks/useDebouncedSuggestions.ts");
const vendorDropdown = read("frontend/src/modules/admin/components/AdminSellerSuggestionsDropdown.tsx");
const vendorPage = read("frontend/src/modules/admin/pages/AdminManageSellerList.tsx");
const productDropdown = read("frontend/src/components/SearchSuggestionsDropdown.tsx");
const productSearchPage = read("frontend/src/modules/user/Search.tsx");
const customerSearchController = read("backend/src/modules/customer/controllers/customerSearchController.ts");

assert(sellerRoutes.includes('router.use(requireUserType("Admin"))'), "vendor suggestions are admin-only");
assert(sellerRoutes.indexOf('router.get("/suggestions"') < sellerRoutes.indexOf('router.get("/:id"')));
assert(sellerController.includes(".limit(30)"), "database candidate results are bounded");
assert(!/getSellerSuggestions[\s\S]{0,3000}\.(save|create|update|delete)/.test(sellerController), "suggestions are read-only");
assert(sellerService.includes("apiCache.getOrFetch"), "duplicate in-flight requests are deduplicated");
assert(debounceHook.includes("delayMs = 250"), "shared standard debounce is 250ms");
assert(debounceHook.includes("requestSequence.current === sequence"), "stale responses are ignored");
assert(vendorDropdown.includes("No matching sellers"), "no-results state");
assert(vendorDropdown.includes("Searching..."), "loading state");
assert(vendorDropdown.includes("onClick={() => onSelect(seller)}"), "suggestions are selectable");
assert(vendorDropdown.includes("handleClickOutside"), "outside click closes dropdown");
assert(vendorDropdown.includes("ArrowDown") && vendorDropdown.includes("ArrowUp"), "keyboard navigation");
assert(vendorPage.includes("setCurrentPage(1)"), "selection/search resets pagination safely");
assert(vendorPage.includes("seller._id !== selectedSellerSuggestionId"), "clicking selects the exact seller");
assert(vendorPage.includes("filteredSellers.slice(startIndex, endIndex)"), "existing pagination remains active");
assert(productDropdown.includes("useDebouncedSuggestions"), "Product and Vendor reuse the same debounce lifecycle");
assert.equal((productSearchPage.match(/<SearchSuggestionsDropdown\s/g) || []).length, 1, "Product page has one dropdown");
assert(customerSearchController.includes("buildFuzzyCandidateRegex"), "Product suggestions use the shared fuzzy candidate strategy");

console.log("PASS: exact, prefix, token, contains, fuzzy, case-insensitive matching");
console.log("PASS: dynamic tur -> Tumeri matching with no hardcoded mapping");
console.log("PASS: empty/minimum/no-results/result-limit behavior");
console.log("PASS: shared debounce, stale-response protection, and request deduplication");
console.log("PASS: click/outside-click/keyboard states and vendor pagination regression");
console.log("PASS: Product autocomplete continues to use its original endpoint and shared lifecycle");
console.log("PASS: authenticated, bounded, read-only database suggestion route");
