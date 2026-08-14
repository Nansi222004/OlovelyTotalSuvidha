import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "./AuthContext";
import { useLocation } from "../hooks/useLocation";
import {
  addToWishlist,
  getWishlist,
  removeFromWishlist,
} from "../services/api/customerWishlistService";
import { Product } from "../types/domain";

interface WishlistContextValue {
  wishlistProducts: Product[];
  loading: boolean;
  refreshWishlist: () => Promise<void>;
  isWishlisted: (productId?: string) => boolean;
  addWishlistProduct: (productId: string) => Promise<void>;
  removeWishlistProduct: (productId: string) => Promise<void>;
}

const WishlistContext = createContext<WishlistContextValue | undefined>(
  undefined,
);

const normalizeWishlistProducts = (products: any[]): Product[] =>
  products.map((product) => ({
    ...product,
    id: product._id || product.id,
    name: product.productName || product.name,
    imageUrl: product.mainImageUrl || product.mainImage || product.imageUrl,
    price: product.price || product.variations?.[0]?.price || 0,
    pack: product.pack || product.variations?.[0]?.name || "Standard",
  }));

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const { location } = useLocation();
  const [wishlistProducts, setWishlistProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  const latitude = location?.latitude;
  const longitude = location?.longitude;

  const refreshWishlist = useCallback(async () => {
    if (!isAuthenticated) {
      setWishlistProducts([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await getWishlist({
        latitude,
        longitude,
      });

      if (response.success && response.data?.products) {
        setWishlistProducts(normalizeWishlistProducts(response.data.products));
      } else {
        setWishlistProducts([]);
      }
    } catch (_error) {
      setWishlistProducts([]);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, latitude, longitude]);

  useEffect(() => {
    refreshWishlist();
  }, [refreshWishlist]);

  const wishlistIds = useMemo(() => {
    return new Set(
      wishlistProducts
        .map((product) => String(product.id || product._id || ""))
        .filter(Boolean),
    );
  }, [wishlistProducts]);

  const isWishlisted = useCallback(
    (productId?: string) => {
      if (!productId) return false;
      return wishlistIds.has(String(productId));
    },
    [wishlistIds],
  );

  const addWishlistProduct = useCallback(
    async (productId: string) => {
      const response = await addToWishlist(productId, latitude, longitude);
      if (response.success && response.data?.products) {
        setWishlistProducts(normalizeWishlistProducts(response.data.products));
      } else {
        await refreshWishlist();
      }
    },
    [latitude, longitude, refreshWishlist],
  );

  const removeWishlistProduct = useCallback(
    async (productId: string) => {
      const previousProducts = wishlistProducts;
      setWishlistProducts((current) =>
        current.filter(
          (product) =>
            String(product.id || product._id) !== String(productId),
        ),
      );

      try {
        const response = await removeFromWishlist(productId);
        if (response.success && response.data?.products) {
          setWishlistProducts(normalizeWishlistProducts(response.data.products));
          return;
        }
      } catch (error) {
        setWishlistProducts(previousProducts);
        throw error;
      }
    },
    [wishlistProducts],
  );

  return (
    <WishlistContext.Provider
      value={{
        wishlistProducts,
        loading,
        refreshWishlist,
        isWishlisted,
        addWishlistProduct,
        removeWishlistProduct,
      }}
    >
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlistContext() {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error("useWishlistContext must be used within a WishlistProvider");
  }
  return context;
}
