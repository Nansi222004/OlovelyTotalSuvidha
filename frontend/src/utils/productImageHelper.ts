import { resolveImageUrl } from "./imageUrl";

/**
 * Known missing frontend asset files identified during forensic audit.
 * These files do not exist on disk in frontend/public/assets, so attempting to load
 * them in production results in Nginx serving the SPA index.html (text/html).
 */
const KNOWN_MISSING_ASSETS = new Set([
  "/assets/fashion.jpg",
  "/assets/toy.jpg",
  "/assets/pet.jpg",
  "/assets/pharma.jpg",
  "/assets/sports.jpg",
  "/assets/spiritual.jpg",
  "fashion.jpg",
  "toy.jpg",
  "pet.jpg",
  "pharma.jpg",
  "sports.jpg",
  "spiritual.jpg",
]);

/**
 * Checks if a given URL or relative path refers to a known non-existent asset.
 */
export function isKnownMissingAsset(url?: string | null): boolean {
  if (!url) return false;
  const clean = url.trim().toLowerCase();
  if (KNOWN_MISSING_ASSETS.has(clean)) return true;
  for (const missing of KNOWN_MISSING_ASSETS) {
    if (clean.endsWith(missing)) return true;
  }
  return false;
}

/**
 * Dynamic fallback image resolver based on product name, category, and keywords.
 * If a product lacks an uploaded image from admin or its image is unreachable,
 * this returns a curated, high-quality, verified product image matching the product's keywords.
 */
export function getProductFallback(product?: any): string {
  if (!product) return "/assets/fallback-quick-commerce.jpg";

  const name = (
    (product.productName || product.name || "") +
    " " +
    (product.categoryName || product.category?.name || "") +
    " " +
    (product.smallDescription || "") +
    " " +
    (Array.isArray(product.tags) ? product.tags.join(" ") : "")
  ).toLowerCase();

  // 1. Pet Care (Check before generic food ingredients like rice/meat)
  if (
    name.includes("pet") ||
    name.includes("dog") ||
    name.includes("cat") ||
    name.includes("pedigree")
  ) {
    return "/assets/category-pet-care.png";
  }

  // 2. Pharmacy, Medicine & Wellness
  if (
    name.includes("pharma") ||
    name.includes("pain") ||
    name.includes("relief") ||
    name.includes("gel") ||
    name.includes("volini") ||
    name.includes("medicine") ||
    name.includes("wellness")
  ) {
    return "/assets/category-pharma-&-wellness.png";
  }

  // 3. Fashion & Apparel
  if (
    name.includes("kurti") ||
    name.includes("shirt") ||
    name.includes("cotton") ||
    name.includes("fashion") ||
    name.includes("dress") ||
    name.includes("saree") ||
    name.includes("wear") ||
    name.includes("shoes") ||
    name.includes("socks")
  ) {
    return "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&q=80&w=600";
  }

  // 4. Toys & Games
  if (
    name.includes("toy") ||
    name.includes("puzzle") ||
    name.includes("game") ||
    name.includes("block") ||
    name.includes("kid")
  ) {
    return "https://images.unsplash.com/photo-1587654780291-39c9404d746b?auto=format&fit=crop&q=80&w=600";
  }

  // 5. Sports & Fitness
  if (
    name.includes("sport") ||
    name.includes("fitness") ||
    name.includes("yoga") ||
    name.includes("mat") ||
    name.includes("gym")
  ) {
    return "https://images.unsplash.com/photo-1592432678016-e910b452f9a2?auto=format&fit=crop&q=80&w=600";
  }

  // 6. Spiritual & Puja Items
  if (
    name.includes("puja") ||
    name.includes("agarbatti") ||
    name.includes("incense") ||
    name.includes("diya") ||
    name.includes("spiritual") ||
    name.includes("temple") ||
    name.includes("yagna")
  ) {
    return "https://images.unsplash.com/photo-1608755728617-aefab37d2edd?auto=format&fit=crop&q=80&w=600";
  }

  // 7. Spices & Masala
  if (
    name.includes("masala") ||
    name.includes("spice") ||
    name.includes("chilli") ||
    name.includes("chili") ||
    name.includes("haldi") ||
    name.includes("mirch") ||
    name.includes("turmeric") ||
    name.includes("cumin") ||
    name.includes("jeera") ||
    name.includes("coriander")
  ) {
    return "/assets/product-bulk-masala.jpg";
  }

  // 8. Electronics & Gadgets
  if (
    name.includes("electronic") ||
    name.includes("gadget") ||
    name.includes("smart") ||
    name.includes("watch") ||
    name.includes("earbud") ||
    name.includes("headphone") ||
    name.includes("mobile") ||
    name.includes("phone") ||
    name.includes("charger") ||
    name.includes("cable") ||
    name.includes("table")
  ) {
    return "/assets/product-smart-electronics.jpg";
  }

  // 9. Flour / Atta / Grains
  if (
    name.includes("flour") ||
    name.includes("atta") ||
    name.includes("wheat") ||
    name.includes("besan") ||
    name.includes("maida") ||
    name.includes("sooji") ||
    name.includes("grain")
  ) {
    return "/assets/product-organic-flour.jpg";
  }

  // 10. Cookware & Kitchenware
  if (
    name.includes("cookware") ||
    name.includes("pan") ||
    name.includes("pot") ||
    name.includes("utensil") ||
    name.includes("kitchen") ||
    name.includes("kadai") ||
    name.includes("cooker") ||
    name.includes("tawa")
  ) {
    return "/assets/product-cookware-set.jpg";
  }

  // 11. Milk & Dairy
  if (
    name.includes("milk") ||
    name.includes("dairy") ||
    name.includes("butter") ||
    name.includes("cheese") ||
    name.includes("ghee") ||
    name.includes("curd") ||
    name.includes("dahi") ||
    name.includes("paneer")
  ) {
    return "https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&q=80&w=600";
  }

  // 12. Tomatoes & Fresh Vegetables
  if (
    name.includes("tomato") ||
    name.includes("potato") ||
    name.includes("onion") ||
    name.includes("vegetable") ||
    name.includes("sabzi") ||
    name.includes("veggie")
  ) {
    return "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&q=80&w=600";
  }

  // 13. Fruits
  if (
    name.includes("fruit") ||
    name.includes("mango") ||
    name.includes("apple") ||
    name.includes("banana") ||
    name.includes("orange")
  ) {
    return "https://images.unsplash.com/photo-1619566636858-adf3ef46400b?auto=format&fit=crop&q=80&w=600";
  }

  // 14. Rice & Grains
  if (
    name.includes("rice") ||
    name.includes("chawal") ||
    name.includes("poha") ||
    name.includes("basmati")
  ) {
    return "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&q=80&w=600";
  }

  // 15. Snacks & Namkeen
  if (
    name.includes("snack") ||
    name.includes("chip") ||
    name.includes("namkeen") ||
    name.includes("biscuit") ||
    name.includes("cookie") ||
    name.includes("rusk")
  ) {
    return "https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&q=80&w=600";
  }

  // 16. Beverages & Drinks
  if (
    name.includes("juice") ||
    name.includes("drink") ||
    name.includes("beverage") ||
    name.includes("soda") ||
    name.includes("cola") ||
    name.includes("tea") ||
    name.includes("coffee")
  ) {
    return "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&q=80&w=600";
  }

  // 17. Beauty & Personal Care
  if (
    name.includes("soap") ||
    name.includes("shampoo") ||
    name.includes("cream") ||
    name.includes("beauty") ||
    name.includes("skin") ||
    name.includes("hair") ||
    name.includes("lotion")
  ) {
    return "https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&q=80&w=600";
  }

  // 18. Detergent & Household Cleaning
  if (
    name.includes("detergent") ||
    name.includes("wash") ||
    name.includes("clean") ||
    name.includes("surf") ||
    name.includes("vim") ||
    name.includes("lizol")
  ) {
    return "https://images.unsplash.com/photo-1585421514738-01798e348b17?auto=format&fit=crop&q=80&w=600";
  }

  // Default grocery & general products
  return "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=600";
}

/**
 * Resolves a product's primary image URL.
 * Validates through resolveImageUrl(), strips unresolvable localhost URLs in live mode,
 * and intercepts known missing asset references to cleanly return high-quality keyword fallbacks.
 */
export function getProductImage(product?: any): string {
  if (!product) return getProductFallback();

  const existingImg =
    product.imageUrl ||
    product.mainImage ||
    (Array.isArray(product.images) && product.images[0]) ||
    (Array.isArray(product.galleryImages) && product.galleryImages[0]);

  if (
    !existingImg ||
    typeof existingImg !== "string" ||
    existingImg.trim() === "" ||
    existingImg === "/placeholder.png"
  ) {
    return getProductFallback(product);
  }

  const trimmed = existingImg.trim();
  if (isKnownMissingAsset(trimmed)) {
    return getProductFallback(product);
  }

  const resolved = resolveImageUrl(trimmed);
  if (!resolved) {
    return getProductFallback(product);
  }

  return resolved;
}

/**
 * Resolves an individual product image or gallery item URL safely.
 */
export function resolveProductImage(url?: string | null, product?: any): string {
  if (!url || typeof url !== "string" || !url.trim() || url === "/placeholder.png") {
    return getProductFallback(product);
  }
  const trimmed = url.trim();
  if (isKnownMissingAsset(trimmed)) {
    return getProductFallback(product);
  }
  const resolved = resolveImageUrl(trimmed);
  if (!resolved) {
    return getProductFallback(product);
  }
  return resolved;
}
