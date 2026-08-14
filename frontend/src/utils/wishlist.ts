import { addToWishlist } from "../services/api/customerWishlistService";

/**
 * Add a product to the wishlist. Silent errors to avoid interrupting UX,
 * but logs to console for debugging.
 */
export async function addProductToWishlist(productId?: string) {
  if (!productId) return;
  try {
    await addToWishlist(productId);
  } catch (err) {
    console.error("Failed to add to wishlist", err);
  }
}

