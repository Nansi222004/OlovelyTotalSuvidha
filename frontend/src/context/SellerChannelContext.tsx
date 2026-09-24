import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { useAuth } from "./AuthContext";
import { getSellerProfile } from "../services/api/auth/sellerAuthService";
import { invalidateCategoryCache } from "../services/api/categoryService";

export type SellerChannel = "QUICK_COMMERCE" | "ECOMMERCE";

export interface SellerChannelContextType {
  sellerVendorType?: "QUICK_COMMERCE" | "ECOMMERCE" | "HYBRID";
  activeChannel?: SellerChannel;
  setActiveChannel: (channel: SellerChannel) => void;
  isHybrid: boolean;
  isQuickCommerceOnly: boolean;
  isEcommerceOnly: boolean;
  isLegacy: boolean;
  sellerId?: string;
}

const SellerChannelContext = createContext<
  SellerChannelContextType | undefined
>(undefined);

function getSellerStorageKey(sellerId?: string): string | null {
  if (!sellerId) return null;
  return `olovely_seller_active_channel_${sellerId}`;
}

export function SellerChannelProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const sellerId = user?.id || (user as any)?._id;

  const [vendorType, setVendorType] = useState<
    "QUICK_COMMERCE" | "ECOMMERCE" | "HYBRID" | undefined
  >((user as any)?.vendorType);

  // Re-fetch profile if vendorType is not present on user object (e.g. legacy session or external change)
  useEffect(() => {
    let isMounted = true;

    if (sellerId && !(user as any)?.vendorType) {
      getSellerProfile()
        .then((res) => {
          if (isMounted && res && res.success && res.data) {
            setVendorType(res.data.vendorType);
          }
        })
        .catch((err) => {
          console.warn("Could not fetch seller profile for vendorType:", err);
        });
    } else if ((user as any)?.vendorType) {
      setVendorType((user as any).vendorType);
    }

    return () => {
      isMounted = false;
    };
  }, [sellerId, (user as any)?.vendorType]);

  const isHybrid = vendorType === "HYBRID";
  const isQuickCommerceOnly = vendorType === "QUICK_COMMERCE";
  const isEcommerceOnly = vendorType === "ECOMMERCE";
  const isLegacy = !vendorType;

  // Compute active channel state strictly tied to current sellerId
  const [activeChannel, setActiveChannelState] = useState<
    SellerChannel | undefined
  >(() => {
    if (vendorType === "QUICK_COMMERCE") return "QUICK_COMMERCE";
    if (vendorType === "ECOMMERCE") return "ECOMMERCE";
    if (vendorType === "HYBRID") {
      const key = getSellerStorageKey(sellerId);
      if (key && typeof window !== "undefined") {
        const stored = localStorage.getItem(key);
        if (stored === "ECOMMERCE" || stored === "QUICK_COMMERCE") {
          return stored;
        }
      }
      return "QUICK_COMMERCE";
    }
    return undefined; // Legacy sellers have no active channel configured
  });

  // Keep activeChannel synchronized when seller or vendorType transitions
  useEffect(() => {
    if (isQuickCommerceOnly) {
      setActiveChannelState("QUICK_COMMERCE");
    } else if (isEcommerceOnly) {
      setActiveChannelState("ECOMMERCE");
    } else if (isHybrid) {
      const key = getSellerStorageKey(sellerId);
      let nextChannel: SellerChannel = "QUICK_COMMERCE";
      if (key && typeof window !== "undefined") {
        const stored = localStorage.getItem(key);
        if (stored === "ECOMMERCE" || stored === "QUICK_COMMERCE") {
          nextChannel = stored;
        }
      }
      setActiveChannelState(nextChannel);
    } else {
      setActiveChannelState(undefined); // Legacy
    }
  }, [sellerId, vendorType, isHybrid, isQuickCommerceOnly, isEcommerceOnly]);

  const setActiveChannel = useCallback(
    (channel: SellerChannel) => {
      if (!isHybrid) {
        console.warn(
          "Cannot manually change channel for single-channel or legacy seller"
        );
        return;
      }
      setActiveChannelState(channel);
      const key = getSellerStorageKey(sellerId);
      if (key && typeof window !== "undefined") {
        localStorage.setItem(key, channel);
      }
      invalidateCategoryCache();
    },
    [isHybrid, sellerId]
  );

  return (
    <SellerChannelContext.Provider
      value={{
        sellerVendorType: vendorType,
        activeChannel,
        setActiveChannel,
        isHybrid,
        isQuickCommerceOnly,
        isEcommerceOnly,
        isLegacy,
        sellerId,
      }}
    >
      {children}
    </SellerChannelContext.Provider>
  );
}

export function useSellerChannel(): SellerChannelContextType {
  const context = useContext(SellerChannelContext);
  if (!context) {
    throw new Error(
      "useSellerChannel must be used within a SellerChannelProvider"
    );
  }
  return context;
}
