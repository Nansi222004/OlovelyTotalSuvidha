import AppSettings from "../models/AppSettings";

export interface CommerceChannelsState {
  quickCommerceEnabled: boolean;
  ecommerceEnabled: boolean;
}

// In-memory cache for fast lookups with short TTL
let cachedChannels: CommerceChannelsState | null = null;
let cacheExpiresAt = 0;
const CACHE_TTL_MS = 5000; // 5 seconds auto-refresh TTL

/**
 * Invalidate in-memory cache when settings are updated
 */
export function invalidateCommerceChannelCache(): void {
  cachedChannels = null;
  cacheExpiresAt = 0;
}

export interface GetCommerceChannelsOptions {
  bypassCache?: boolean;
}

/**
 * Authoritatively retrieves current global commerce channels state.
 * Defaults both to true if not configured.
 *
 * @param optionsOrBypass - Optional { bypassCache: boolean } or boolean flag.
 *                          When bypassCache is true, skips local in-memory cache and
 *                          reads directly from MongoDB (critical for transactions).
 */
export async function getCommerceChannels(
  optionsOrBypass?: GetCommerceChannelsOptions | boolean
): Promise<CommerceChannelsState> {
  const bypassCache =
    typeof optionsOrBypass === 'boolean'
      ? optionsOrBypass
      : optionsOrBypass?.bypassCache === true;

  const now = Date.now();
  if (!bypassCache && cachedChannels && now < cacheExpiresAt) {
    return cachedChannels;
  }

  try {
    const settings = await AppSettings.findOne().select("commerceChannels").lean();
    const channels = settings?.commerceChannels;

    const state: CommerceChannelsState = {
      quickCommerceEnabled: channels?.quickCommerceEnabled !== false, // default true
      ecommerceEnabled: channels?.ecommerceEnabled !== false,         // default true
    };

    // Ensure invariant: if somehow both were false, fallback to true
    if (!state.quickCommerceEnabled && !state.ecommerceEnabled) {
      state.quickCommerceEnabled = true;
      state.ecommerceEnabled = true;
    }

    cachedChannels = state;
    cacheExpiresAt = now + CACHE_TTL_MS;
    return state;
  } catch (err) {
    console.error("[commerceChannelService] Failed to load commerce channels, defaulting to both enabled:", err);
    return {
      quickCommerceEnabled: true,
      ecommerceEnabled: true,
    };
  }
}

/**
 * Check if Quick Commerce is globally enabled.
 */
export async function isQuickCommerceEnabled(
  optionsOrBypass?: GetCommerceChannelsOptions | boolean
): Promise<boolean> {
  const channels = await getCommerceChannels(optionsOrBypass);
  return channels.quickCommerceEnabled;
}

/**
 * Check if E-Commerce is globally enabled.
 */
export async function isEcommerceEnabled(
  optionsOrBypass?: GetCommerceChannelsOptions | boolean
): Promise<boolean> {
  const channels = await getCommerceChannels(optionsOrBypass);
  return channels.ecommerceEnabled;
}

/**
 * Check if a specific channel is enabled.
 */
export async function isChannelEnabled(
  channel: "QUICK_COMMERCE" | "ECOMMERCE" | string,
  optionsOrBypass?: GetCommerceChannelsOptions | boolean
): Promise<boolean> {
  const normalized = (channel || "").toUpperCase().trim();
  if (normalized === "QUICK_COMMERCE") {
    return isQuickCommerceEnabled(optionsOrBypass);
  }
  if (normalized === "ECOMMERCE") {
    return isEcommerceEnabled(optionsOrBypass);
  }
  return false;
}

/**
 * Validates whether a seller vendorType can be registered or operated under current global availability.
 * - QUICK_COMMERCE: requires quickCommerceEnabled
 * - ECOMMERCE: requires ecommerceEnabled
 * - HYBRID: requires BOTH quickCommerceEnabled AND ecommerceEnabled
 */
export async function isVendorTypeAllowed(
  vendorType: "QUICK_COMMERCE" | "ECOMMERCE" | "HYBRID" | string
): Promise<{ allowed: boolean; reason?: string }> {
  const channels = await getCommerceChannels();

  if (vendorType === "QUICK_COMMERCE") {
    if (!channels.quickCommerceEnabled) {
      return {
        allowed: false,
        reason: "Quick Commerce is currently unavailable for new seller registration or operation.",
      };
    }
    return { allowed: true };
  }

  if (vendorType === "ECOMMERCE") {
    if (!channels.ecommerceEnabled) {
      return {
        allowed: false,
        reason: "E-Commerce is currently unavailable for new seller registration or operation.",
      };
    }
    return { allowed: true };
  }

  if (vendorType === "HYBRID") {
    if (!channels.quickCommerceEnabled && !channels.ecommerceEnabled) {
      return {
        allowed: false,
        reason: "Both Quick Commerce and E-Commerce are currently unavailable.",
      };
    }
    if (!channels.quickCommerceEnabled) {
      return {
        allowed: false,
        reason: "Hybrid seller registration requires Quick Commerce, which is currently disabled.",
      };
    }
    if (!channels.ecommerceEnabled) {
      return {
        allowed: false,
        reason: "Hybrid seller registration requires E-Commerce, which is currently disabled.",
      };
    }
    return { allowed: true };
  }

  return { allowed: false, reason: `Unrecognized vendorType: "${vendorType}"` };
}

/**
 * Validates that an incoming partial or full update does NOT turn both channels OFF.
 */
export function validateChannelsState(
  incoming: { quickCommerceEnabled?: boolean; ecommerceEnabled?: boolean },
  current: CommerceChannelsState
): { valid: boolean; finalState: CommerceChannelsState; error?: string } {
  const finalState: CommerceChannelsState = {
    quickCommerceEnabled:
      incoming.quickCommerceEnabled !== undefined
        ? Boolean(incoming.quickCommerceEnabled)
        : current.quickCommerceEnabled,
    ecommerceEnabled:
      incoming.ecommerceEnabled !== undefined
        ? Boolean(incoming.ecommerceEnabled)
        : current.ecommerceEnabled,
  };

  if (!finalState.quickCommerceEnabled && !finalState.ecommerceEnabled) {
    return {
      valid: false,
      finalState,
      error: "At least one commerce channel must remain enabled.",
    };
  }

  return {
    valid: true,
    finalState,
  };
}
