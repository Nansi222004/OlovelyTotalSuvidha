import { resolveImageUrl } from "../../../frontend/src/utils/imageUrl";
import { getProductImage, getProductFallback, resolveProductImage, isKnownMissingAsset } from "../../../frontend/src/utils/productImageHelper";

console.log("=== UNIT TEST: PRODUCT IMAGE RESOLUTION & FALLBACK ===");

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string) {
  if (condition) {
    console.log(`✓ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`✗ FAIL: ${testName}`);
    failed++;
  }
}

// Test 1: Cloudinary HTTPS URL returns directly
const cloudinaryUrl = "https://res.cloudinary.com/ecs53s8c/image/upload/v1790534091/olovely/categories/1790340591578_6309.jpg";
const resolvedCloudinary = resolveImageUrl(cloudinaryUrl);
assert(resolvedCloudinary === cloudinaryUrl, "Cloudinary HTTPS URL preserved verbatim");

// Test 2: External HTTPS URL returns directly
const unsplashUrl = "https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&q=80&w=600";
const resolvedUnsplash = resolveImageUrl(unsplashUrl);
assert(resolvedUnsplash === unsplashUrl, "External HTTPS URL preserved verbatim");

// Test 3: Valid relative asset URL resolves to /assets/...
const validAsset = "/assets/product-aashirvaad-atta.jpg";
const resolvedAsset = resolveImageUrl(validAsset);
assert(resolvedAsset === "/assets/product-aashirvaad-atta.jpg", "Valid /assets/ URL resolved correctly");

// Test 4: Known missing assets are detected
assert(isKnownMissingAsset("/assets/fashion.jpg"), "isKnownMissingAsset detects /assets/fashion.jpg");
assert(isKnownMissingAsset("/assets/toy.jpg"), "isKnownMissingAsset detects /assets/toy.jpg");
assert(isKnownMissingAsset("/assets/spiritual.jpg"), "isKnownMissingAsset detects /assets/spiritual.jpg");
assert(!isKnownMissingAsset("/assets/product-aashirvaad-atta.jpg"), "isKnownMissingAsset returns false for valid asset");

// Test 5: getProductImage intercepts known missing asset and returns keyword fallback
const spiritualProduct = {
  productName: "Cycle Pure Agarbathies Yagna Natural Fragrance Incense Sticks 250g",
  mainImage: "/assets/spiritual.jpg",
};
const resolvedSpiritual = getProductImage(spiritualProduct);
assert(
  resolvedSpiritual.startsWith("https://images.unsplash.com") || resolvedSpiritual.startsWith("/assets/"),
  `Known missing /assets/spiritual.jpg intercepted with fallback: ${resolvedSpiritual}`
);
assert(!resolvedSpiritual.includes("spiritual.jpg"), "Result does not contain broken spiritual.jpg");

// Test 6: Fashion product with missing asset resolves to fashion fallback
const fashionProduct = {
  productName: "Women Cotton Floral Printed Straight Kurti",
  mainImage: "/assets/fashion.jpg",
};
const resolvedFashion = getProductImage(fashionProduct);
assert(!resolvedFashion.includes("fashion.jpg"), "Result does not contain broken fashion.jpg");

// Test 7: Pet care product with missing asset resolves to pet fallback
const petProduct = {
  productName: "Pedigree Adult Dry Dog Food Meat & Rice 1.2kg",
  mainImage: "/assets/pet.jpg",
};
const resolvedPet = getProductImage(petProduct);
assert(resolvedPet === "/assets/category-pet-care.png", `Pet care product mapped to verified category-pet-care.png: ${resolvedPet}`);

// Test 8: Pharma product with missing asset resolves to pharma fallback
const pharmaProduct = {
  productName: "Volini Fast Pain Relief Gel Tube 30g",
  mainImage: "/assets/pharma.jpg",
};
const resolvedPharma = getProductImage(pharmaProduct);
assert(resolvedPharma === "/assets/category-pharma-&-wellness.png", `Pharma product mapped to verified category-pharma-&-wellness.png: ${resolvedPharma}`);

// Test 9: Empty product returns default quick commerce fallback
const emptyProduct = {};
const resolvedEmpty = getProductImage(emptyProduct);
assert(Boolean(resolvedEmpty && resolvedEmpty.length > 0), "Empty product returns non-empty fallback");

// Test 10: resolveProductImage handles gallery items
const galleryItem = "/assets/toy.jpg";
const resolvedGallery = resolveProductImage(galleryItem, { productName: "Classic Wooden Puzzle Set" });
assert(!resolvedGallery.includes("toy.jpg"), "Gallery item intercepted and resolved to fallback");

console.log(`\nTests Completed: ${passed} Passed, ${failed} Failed.`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log("ALL TESTS PASSED!\n");
}
