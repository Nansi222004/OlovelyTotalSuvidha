import { motion } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import { useRef, useMemo, useCallback } from 'react';
import { Product } from '../../../types/domain';
import { useCart } from '../../../context/CartContext';
import { useWishlist } from '../../../hooks/useWishlist';
import { useTranslation } from '../../../hooks/useTranslation';
import Button from '../../../components/ui/button';
import Badge from '../../../components/ui/badge';
import StarRating from '../../../components/ui/StarRating';
import { useAppSettings } from '../../../context/AppSettingsContext';
import { useCustomerChannel } from '../../../context/CustomerChannelContext';

import { calculateProductPrice } from '../../../utils/priceUtils';

interface ProductCardProps {
  product: Product;
  showBadge?: boolean;
  badgeText?: string;
  showPackBadge?: boolean;
  showStockInfo?: boolean;
  showHeartIcon?: boolean;
  showRating?: boolean;
  showVegetarianIcon?: boolean;
  showOptionsText?: boolean;
  optionsCount?: number;
  compact?: boolean;
  categoryStyle?: boolean;
}

export default function ProductCard({
  product,
  showBadge = false,
  badgeText,
  showPackBadge = false,
  showStockInfo = false,
  showHeartIcon = false,
  showRating = true,
  showVegetarianIcon = false,
  showOptionsText = false,
  optionsCount = 2,
  compact = false,
  categoryStyle = false,
}: ProductCardProps) {
  const navigate = useNavigate();
  const { t, getTranslatedField } = useTranslation();
  const { cart, addToCart, updateQuantity } = useCart();
  const { settings } = useAppSettings();
  const { isWholesale } = useCustomerChannel();
  const imageRef = useRef<HTMLImageElement>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  // Single ref to track any cart operation in progress for this product
  const isOperationPendingRef = useRef(false);

  const isWholesaleActive = Boolean(isWholesale && product.wholesaleEnabled && (product.wholesalePrice || 0) > 0);
  const wholesaleMoq = product.wholesaleMinimumQuantity || settings.wholesaleSettings?.defaultWholesaleMinimumQuantity || 1;

  // Stabilize IDs
  const productId = useMemo(() => ((product as any).id || product._id) as string, [product.id, product._id]);
  const { isWishlisted, toggleWishlist } = useWishlist(productId);

  const cartItem = useMemo(() => {
    return cart.items.find((item) => {
      if (!item?.product) return false;
      const itemProdId = String(item.product.id || item.product._id);
      return itemProdId === productId;
    });
  }, [cart.items, productId]);

  const inCartQty = cartItem?.quantity || 0;

  // Get Price and MRP using utility - Memoized to prevent re-calc
  const priceDetails = useMemo(() => calculateProductPrice(product), [product]);
  const { displayPrice, mrp, discount } = priceDetails;
  const effectiveDisplayPrice = isWholesaleActive && product.wholesalePrice ? product.wholesalePrice : displayPrice;
  const effectiveMrp = isWholesaleActive ? (mrp || displayPrice) : mrp;

  const isEcommerce = useMemo(() => {
    return product.productType === 'ECOMMERCE';
  }, [product.productType]);

  // Resolve shop/store name cleanly
  const shopName = useMemo(() => {
    if ((product as any).showSellerDetails === false) return null;
    if (product.seller && typeof product.seller === 'object') {
      if ((product.seller as any).viewCustomerDetails === false) return null;
      if (product.seller.storeName) return product.seller.storeName;
      if (product.seller.sellerName) return product.seller.sellerName;
    }
    if ((product as any).viewCustomerDetails === false) return null;
    if (product.storeName) return product.storeName;
    if (product.shopName) return product.shopName;
    if (product.shop && typeof product.shop === 'object' && product.shop.name) {
      return product.shop.name;
    }
    if (typeof product.seller === 'string' && product.seller && !product.seller.match(/^[0-9a-fA-F]{24}$/)) {
      return product.seller;
    }
    return null;
  }, [product]);

  const packText = useMemo(() => {
    return product.variations?.[0]?.value || product.pack || '';
  }, [product]);

  const productName = useMemo(() => {
    return getTranslatedField(product, "name") || getTranslatedField(product, "productName") || product.name || product.productName || '';
  }, [product, getTranslatedField]);

  const isPackRedundant = useMemo(() => {
    if (!packText || !productName) return false;
    const cleanPack = packText.trim().toLowerCase();
    const cleanName = productName.trim().toLowerCase();
    return cleanPack === cleanName || cleanName.startsWith(cleanPack);
  }, [packText, productName]);

  const handleCardClick = useCallback(() => {
    navigate(`/product/${productId}`);
  }, [navigate, productId]);

  const handleAdd = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (isOperationPendingRef.current) {
      return;
    }

    isOperationPendingRef.current = true;

    try {
      const initialQty = isWholesaleActive ? wholesaleMoq : 1;
      await addToCart(product, addButtonRef.current, initialQty, isWholesaleActive);
    } finally {
      isOperationPendingRef.current = false;
    }
  }, [product, addToCart, isWholesaleActive, wholesaleMoq]);

  const handleDecrease = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (isOperationPendingRef.current || inCartQty <= 0) {
      return;
    }

    isOperationPendingRef.current = true;

    try {
      if (isWholesaleActive && inCartQty <= wholesaleMoq) {
        await updateQuantity(productId, 0);
      } else {
        await updateQuantity(productId, inCartQty - 1);
      }
    } finally {
      isOperationPendingRef.current = false;
    }
  }, [productId, inCartQty, updateQuantity, isWholesaleActive, wholesaleMoq]);

  const handleIncrease = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (isOperationPendingRef.current) {
      return;
    }

    isOperationPendingRef.current = true;

    try {
      if (inCartQty > 0) {
        await updateQuantity(productId, inCartQty + 1);
      } else {
        const initialQty = isWholesaleActive ? wholesaleMoq : 1;
        await addToCart(product, addButtonRef.current, initialQty, isWholesaleActive);
      }
    } finally {
      isOperationPendingRef.current = false;
    }
  }, [product, productId, inCartQty, updateQuantity, addToCart, isWholesaleActive, wholesaleMoq]);

  // Memoize class names
  const cardClassName = useMemo(() => 
    `bg-white rounded-xl border border-neutral-200/80 shadow-2xs hover:shadow-md transition-all duration-200 flex flex-col h-full overflow-hidden relative group`
  , []);

  const imageContainerClassName = useMemo(() => 
    `w-full aspect-square bg-neutral-50/70 flex items-center justify-center p-0 relative overflow-hidden flex-shrink-0 cursor-pointer`
  , []);

  const effectiveStock = useMemo(() => {
    if (product.variations && product.variations.length > 0) {
      return product.variations.reduce((sum: number, v: any) => sum + (Number(v.stock) || 0), 0);
    }
    return Number(product.stock) || 0;
  }, [product.variations, product.stock]);

  const isOutOfStock = product.status === "Sold out" || effectiveStock <= 0;

  const lowStockThreshold = settings.inventorySettings?.lowStockThreshold ?? 10;
  const lowStockDisplayQuantity = settings.inventorySettings?.lowStockDisplayQuantity ?? 2;
  const isLowStock = !isOutOfStock && effectiveStock > 0 && effectiveStock <= lowStockThreshold;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.2 }}
      className={cardClassName}
    >
      {/* 1. Product Image Section */}
      <div
        onClick={handleCardClick}
        className={imageContainerClassName}
      >
        {/* Top Badges - top left */}
        <div className="absolute top-2 left-2 z-10 flex flex-col gap-1 items-start pointer-events-none">
          {isWholesaleActive ? (
            <span className="text-[9px] font-black px-1.5 py-0.5 rounded shadow-2xs flex items-center gap-1 uppercase tracking-tight bg-purple-700 text-white">
              <span>🏷️</span>
              <span>Wholesale</span>
            </span>
          ) : (
            <span
              className={`text-[9px] font-black px-1.5 py-0.5 rounded shadow-2xs flex items-center gap-1 uppercase tracking-tight ${
                isEcommerce ? 'bg-blue-600 text-white' : 'bg-emerald-700 text-white'
              }`}
            >
              <span>{isEcommerce ? '📦' : '⚡'}</span>
              <span>{isEcommerce ? 'Courier' : 'Quick'}</span>
            </span>
          )}
          {showBadge && discount > 0 && !isWholesaleActive && (
            <div className="bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-2xs">
              {discount}% OFF
            </div>
          )}
          {isWholesaleActive && (
            <div className="bg-purple-900/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-2xs">
              MOQ: {wholesaleMoq}
            </div>
          )}
        </div>

        {/* Out of Stock Overlay */}
        {isOutOfStock && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-[1px] z-20 flex items-center justify-center">
            <span className="bg-neutral-800 text-white text-[11px] sm:text-xs font-black px-2.5 py-1 rounded shadow uppercase tracking-wider">
              Out of Stock
            </span>
          </div>
        )}

        {/* Wishlist Heart Icon */}
        {showHeartIcon && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleWishlist(e);
            }}
            className="absolute top-2 right-2 z-30 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/95 backdrop-blur-xs flex items-center justify-center hover:bg-white transition-all shadow-xs group/heart cursor-pointer"
            aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill={isWishlisted ? "#ef4444" : "none"}
              xmlns="http://www.w3.org/2000/svg"
              className={`transition-colors ${isWishlisted ? "text-red-500" : "text-neutral-400 group-hover/heart:text-red-400"}`}
            >
              <path
                d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}

        {/* Product Image */}
        {product.imageUrl || product.mainImage ? (
          <img
            ref={imageRef}
            src={product.imageUrl || product.mainImage}
            alt={productName || 'Product'}
            className="w-full h-full max-h-full max-w-full object-contain transition-transform duration-200 group-hover:scale-105"
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              const parent = target.parentElement;
              if (parent && !parent.querySelector('.fallback-icon')) {
                const fallback = document.createElement('div');
                fallback.className = 'w-full h-full flex items-center justify-center bg-neutral-100 text-neutral-400 text-3xl font-bold fallback-icon';
                fallback.textContent = (productName || '?').charAt(0).toUpperCase();
                parent.appendChild(fallback);
              }
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-neutral-100 text-neutral-400 text-3xl font-bold">
            {(productName || '?').charAt(0).toUpperCase()}
          </div>
        )}

        {(product.variations?.length || 0) >= 2 && (
          <div className="absolute bottom-1.5 left-2 z-10">
            <span className="text-[10px] font-bold text-neutral-700 bg-white/95 backdrop-blur-xs px-1.5 py-0.5 rounded border border-neutral-200 shadow-2xs">
              {product.variations?.length} Options
            </span>
          </div>
        )}
      </div>

      {/* 2. Product Info Section */}
      <div
        onClick={handleCardClick}
        className="flex-1 flex flex-col px-2.5 sm:px-3 pt-2 pb-1 cursor-pointer"
      >
        {/* Shop Name Badge (if available) */}
        {shopName && (
          <div className="mb-0.5">
            <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-200/70 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-tight truncate max-w-full">
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600 flex-shrink-0">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              <span className="truncate max-w-[90px]">{shopName}</span>
            </span>
          </div>
        )}

        {/* 3. Product Quantity / Pack Size */}
        <div className="text-xs font-semibold text-neutral-500 mb-0.5 truncate">
          {packText || '1 unit'}
        </div>

        {/* 4. Product Name (Max 2 lines) */}
        <h3
          className="text-sm sm:text-base font-bold text-neutral-900 line-clamp-2 leading-snug mb-1 min-h-[2.5rem]"
          title={productName}
        >
          {productName}
        </h3>

        {/* Rating (optional) */}
        {showRating && ((product.rating ?? 0) > 0 || (product.reviewsCount ?? product.reviews ?? 0) > 0) && (
          <div className="mb-1">
            <StarRating
              rating={product.rating || 0}
              reviewCount={product.reviewsCount ?? product.reviews ?? 0}
              size="sm"
            />
          </div>
        )}

        {/* 5. Delivery Information */}
        {isEcommerce ? (
          <div className="flex items-center gap-1 text-[11px] font-bold text-blue-700 mb-1 truncate">
            <span className="text-xs">📦</span>
            <span>Courier Delivery</span>
          </div>
        ) : (
          <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 mb-1 truncate">
            <span className="text-xs">⚡</span>
            <span>{product.deliveryTime ? `${product.deliveryTime} MINS` : '12–15 MINS'}</span>
          </div>
        )}

        {/* 6. Discount Text (Single Instance) */}
        {discount > 0 && !isWholesaleActive && (
          <div className="text-xs font-bold text-green-700 mb-0.5">
            {discount}% OFF
          </div>
        )}

        {/* Low Stock Alert */}
        {isLowStock && (
          <div className="text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200/80 px-2 py-0.5 rounded flex items-center gap-1 mb-1">
            <span>⚠️</span>
            <span>Only {lowStockDisplayQuantity} items left!</span>
          </div>
        )}

        {/* 7. Price Row */}
        <div className="mt-auto flex items-baseline gap-1.5 pt-1 mb-1 flex-wrap">
          <span className="text-base sm:text-lg font-black text-neutral-900">
            ₹{effectiveDisplayPrice.toLocaleString('en-IN')}
          </span>
          {isWholesaleActive && (
            <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.2 rounded border border-purple-200">
              Wholesale
            </span>
          )}
          {effectiveMrp && effectiveMrp > effectiveDisplayPrice && (
            <span className="text-xs sm:text-sm text-neutral-400 line-through font-normal">
              ₹{effectiveMrp.toLocaleString('en-IN')}
            </span>
          )}
        </div>
      </div>

      {/* 8. ADD Button (ALWAYS AT THE VERY BOTTOM OF THE CARD!) */}
      <div className="p-2.5 sm:p-3 pt-1 mt-auto">
        {inCartQty === 0 ? (
          <Button
            ref={addButtonRef}
            variant="outline"
            size="sm"
            disabled={isOutOfStock}
            onClick={(e) => {
              e.stopPropagation();
              handleAdd(e);
            }}
            className={`w-full border-2 rounded-lg font-bold text-xs sm:text-sm h-9 sm:h-10 uppercase tracking-wider transition-colors cursor-pointer ${
              isOutOfStock
                ? 'border-neutral-200 text-neutral-400 bg-neutral-100 cursor-not-allowed'
                : isWholesaleActive
                ? 'border-purple-600 text-purple-700 bg-white hover:bg-purple-50 active:bg-purple-100 shadow-2xs'
                : 'border-green-600 text-green-700 bg-white hover:bg-green-50 active:bg-green-100 shadow-2xs'
            }`}
          >
            {isOutOfStock ? 'Out of Stock' : isWholesaleActive ? `ADD (${wholesaleMoq})` : 'ADD'}
          </Button>
        ) : (
          <div className="flex items-center justify-between bg-green-600 text-white rounded-lg px-2 h-9 sm:h-10 w-full shadow-2xs">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDecrease(e);
              }}
              className="w-8 h-8 flex items-center justify-center font-bold text-white hover:bg-green-700 rounded transition-colors text-lg cursor-pointer"
              aria-label="Decrease quantity"
            >
              −
            </button>
            <span className="text-xs sm:text-sm font-bold text-white min-w-[1.5rem] text-center">
              {inCartQty}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleIncrease(e);
              }}
              className="w-8 h-8 flex items-center justify-center font-bold text-white hover:bg-green-700 rounded transition-colors text-lg cursor-pointer"
              aria-label="Increase quantity"
            >
              +
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

