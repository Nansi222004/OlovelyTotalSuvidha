import mongoose from "mongoose";

export interface ResolvedStockInfo {
  availableStock: number;
  isSoldOut: boolean;
  variantNotFound?: boolean;
  selectedVariation?: any;
  resolvedVariationId?: string;
  variantLabel?: string;
}

/**
 * Authoritative variant & product stock resolver.
 * Consistently resolves stock across add-to-cart, cart updates, cart response, and order creation.
 *
 * Safeguards:
 * - If product or variant status === "Sold out", availableStock is 0.
 * - If an explicit variant ID is provided, matches strictly by ID and never falls back.
 * - If variant stock is finite (number), returns Math.max(0, stock).
 * - If variant stock is missing (null/undefined), checks product.stock.
 * - If simple product, checks product.status and product.stock.
 * - Never defaults missing variant stock to 999.
 */
export function resolveAvailableStock(
  product: any,
  variationIdentifier?: string | mongoose.Types.ObjectId | any | null
): ResolvedStockInfo {
  if (!product) {
    return { availableStock: 0, isSoldOut: true };
  }

  // If product status itself is Sold out
  if (product.status === "Sold out") {
    return { availableStock: 0, isSoldOut: true, variantLabel: product.pack || "Standard" };
  }

  let selectedVariation: any = null;
  let resolvedVariationId: string | undefined = undefined;
  let variantLabel: string | undefined = undefined;

  const hasVariations = product.variations && Array.isArray(product.variations) && product.variations.length > 0;

  if (hasVariations) {
    if (variationIdentifier !== undefined && variationIdentifier !== null && variationIdentifier !== "") {
      let varStr = "";
      let varId = "";

      if (typeof variationIdentifier === "object") {
        if (variationIdentifier instanceof mongoose.Types.ObjectId) {
          varId = variationIdentifier.toString();
          varStr = varId;
        } else {
          varId = (
            variationIdentifier._id ||
            variationIdentifier.id ||
            variationIdentifier.variationId ||
            ""
          ).toString();
          varStr = (
            variationIdentifier.title ||
            variationIdentifier.value ||
            variationIdentifier.name ||
            variationIdentifier.variantTitle ||
            variationIdentifier.pack ||
            ""
          ).toString();
        }
      } else {
        const rawStr = variationIdentifier.toString();
        // Check if raw string is an ObjectId hex string
        if (/^[0-9a-fA-F]{24}$/.test(rawStr)) {
          varId = rawStr;
        } else {
          varStr = rawStr;
        }
      }

      // Priority 1: Match strictly by ID if an explicit ID was supplied
      if (varId) {
        selectedVariation = product.variations.find((v: any) => v._id && v._id.toString() === varId);
        // If an explicit ID was supplied and not found, NEVER fall back to another variant or label!
        if (!selectedVariation) {
          return {
            availableStock: 0,
            isSoldOut: true,
            variantNotFound: true,
            resolvedVariationId: varId,
            variantLabel: varStr || "Selected Variant",
          };
        }
      } else if (varStr) {
        // Priority 2: Match by title/value/name/pack when no ID was provided
        const targetStr = varStr.toLowerCase();
        selectedVariation = product.variations.find((v: any) => {
          const vTitle = (v.title || "").toString().toLowerCase();
          const vValue = (v.value || "").toString().toLowerCase();
          const vName = (v.name || "").toString().toLowerCase();
          const vPack = (v.pack || "").toString().toLowerCase();
          return (
            (targetStr && vTitle === targetStr) ||
            (targetStr && vValue === targetStr) ||
            (targetStr && vName === targetStr) ||
            (targetStr && vPack === targetStr)
          );
        });

        if (!selectedVariation) {
          return {
            availableStock: 0,
            isSoldOut: true,
            variantNotFound: true,
            variantLabel: varStr,
          };
        }
      }
    } else {
      // No variation identifier was provided at all -> use first variation as default
      selectedVariation = product.variations[0];
    }

    if (selectedVariation) {
      if (selectedVariation._id) {
        resolvedVariationId = selectedVariation._id.toString();
      }
      variantLabel = selectedVariation.title || selectedVariation.value || selectedVariation.name || product.pack || "Standard";

      const isSoldOut = selectedVariation.status === "Sold out";
      if (isSoldOut) {
        return {
          availableStock: 0,
          isSoldOut: true,
          selectedVariation,
          resolvedVariationId,
          variantLabel,
        };
      }

      // Check variant-level numeric stock
      if (typeof selectedVariation.stock === "number") {
        const stockNum = Math.max(0, selectedVariation.stock);
        return {
          availableStock: stockNum,
          isSoldOut: stockNum <= 0,
          selectedVariation,
          resolvedVariationId,
          variantLabel,
        };
      }

      // If variant.stock is undefined/null, check product root stock
      if (typeof product.stock === "number") {
        const rootStock = Math.max(0, product.stock);
        return {
          availableStock: rootStock,
          isSoldOut: rootStock <= 0,
          selectedVariation,
          resolvedVariationId,
          variantLabel,
        };
      }

      return {
        availableStock: 0,
        isSoldOut: false,
        selectedVariation,
        resolvedVariationId,
        variantLabel,
      };
    }
  }

  // Simple product (no variations)
  variantLabel = product.pack || "Standard";
  const isSoldOut = product.status === "Sold out";
  if (isSoldOut) {
    return { availableStock: 0, isSoldOut: true, variantLabel };
  }

  const stockNum = typeof product.stock === "number" ? Math.max(0, product.stock) : 0;
  return {
    availableStock: stockNum,
    isSoldOut: stockNum <= 0,
    variantLabel,
  };
}
