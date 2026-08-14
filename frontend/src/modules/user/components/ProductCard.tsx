import { motion } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import { useRef, useMemo, useCallback } from 'react';
import { Product } from '../../../types/domain';
import { useCart } from '../../../context/CartContext';
import { useWishlist } from '../../../hooks/useWishlist';
import Button from '../../../components/ui/button';
import Badge from '../../../components/ui/badge';
import StarRating from '../../../components/ui/StarRating';

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
  const { cart, addToCart, updateQuantity } = useCart();
  const imageRef = useRef<HTMLImageElement>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  // Single ref to track any cart operation in progress for this product
  const isOperationPendingRef = useRef(false);

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
    return product.name || product.productName || '';
  }, [product]);

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

    // Check if product is available in user's location
    if (product.isAvailable === false) {
      return;
    }

    // Prevent any operation while another is in progress
    if (isOperationPendingRef.current) {
      return;
    }

    isOperationPendingRef.current = true;

    try {
      await addToCart(product, addButtonRef.current);
    } finally {
      // Reset the flag after the operation truly completes
      isOperationPendingRef.current = false;
    }
  }, [product, addToCart]);

  const handleDecrease = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    // Prevent any operation while another is in progress
    if (isOperationPendingRef.current || inCartQty <= 0) {
      return;
    }

    isOperationPendingRef.current = true;

    try {
      await updateQuantity(productId, inCartQty - 1);
    } finally {
      // Reset the flag after the operation truly completes
      isOperationPendingRef.current = false;
    }
  }, [productId, inCartQty, updateQuantity]);

  const handleIncrease = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    // Check if product is available in user's location
    if (product.isAvailable === false) {
      return;
    }

    // Prevent any operation while another is in progress
    if (isOperationPendingRef.current) {
      return;
    }

    isOperationPendingRef.current = true;

    try {
      if (inCartQty > 0) {
        await updateQuantity(productId, inCartQty + 1);
      } else {
        await addToCart(product, addButtonRef.current);
      }
    } finally {
      // Reset the flag after the operation truly completes
      isOperationPendingRef.current = false;
    }
  }, [product, productId, inCartQty, updateQuantity, addToCart]);

  // Memoize class names
  const cardClassName = useMemo(() => 
    `${categoryStyle ? 'bg-green-50' : 'bg-white'} rounded-lg shadow-sm overflow-hidden flex flex-col relative`
  , [categoryStyle]);

  const imageContainerClassName = useMemo(() => 
    `w-full ${compact ? 'h-32 md:h-40' : categoryStyle ? 'h-28 md:h-36' : 'h-40 md:h-48'} bg-neutral-100 flex items-center justify-center overflow-hidden relative`
  , [compact, categoryStyle]);

  const infoContainerClassName = useMemo(() => 
    `${compact ? 'p-3 md:p-4' : categoryStyle ? 'px-2.5 md:px-3 pt-1.5 md:pt-2 pb-2 md:pb-3' : 'p-4 md:p-5'} flex-1 flex flex-col`
  , [compact, categoryStyle]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.2 }}
      className={cardClassName}
    >
      <div
        onClick={handleCardClick}
        className="cursor-pointer flex-1 flex flex-col"
      >
        <div className={imageContainerClassName}>
          {product.imageUrl || product.mainImage ? (
            <img
              ref={imageRef}
              src={product.imageUrl || product.mainImage}
              alt={product.name || product.productName || 'Product'}
              className="w-full h-full object-cover"
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={(e) => {
                // Hide broken image and show fallback
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                const parent = target.parentElement;
                if (parent && !parent.querySelector('.fallback-icon')) {
                  const fallback = document.createElement('div');
                  fallback.className = 'w-full h-full flex items-center justify-center bg-neutral-100 text-neutral-400 text-4xl fallback-icon';
                  fallback.textContent = (product.name || product.productName || '?').charAt(0).toUpperCase();
                  parent.appendChild(fallback);
                }
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-neutral-100 text-neutral-400 text-4xl">
              {(product.name || product.productName || '?').charAt(0).toUpperCase()}
            </div>
          )}

          {categoryStyle && showBadge && discount > 0 && (
            <div className="absolute top-2 left-2 z-10 bg-green-600 text-white text-[10px] font-semibold px-2 py-0.5 rounded">
              {discount}% off
            </div>
          )}

          {!categoryStyle && showBadge && (badgeText || discount > 0) && (
            <Badge
              variant="destructive"
              className="absolute top-2 left-2 z-10 text-xs px-2 py-1"
            >
              {badgeText || `${discount}% OFF`}
            </Badge>
          )}

          {showPackBadge && (
            <Badge
              variant="outline"
              className="absolute top-2 right-2 z-10 text-xs px-2 py-1 font-medium"
            >
              {product.variations?.[0]?.value || product.pack}
            </Badge>
          )}

          {showHeartIcon && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleWishlist(e);
              }}
              className="absolute top-2 right-2 z-30 w-9 h-9 rounded-full bg-white/95 backdrop-blur-sm flex items-center justify-center hover:bg-white transition-all shadow-md group/heart"
              aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
            >
              <svg
                width="20"
                height="20"
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

          {(product.variations?.length || 0) >= 2 && (
            <div className="absolute bottom-2 left-2 z-10">
              <span className="text-[10px] font-bold text-neutral-700 bg-white/95 backdrop-blur-sm px-2 py-1 rounded shadow-sm border border-neutral-200">
                {product.variations?.length} Options
              </span>
            </div>
          )}
        </div>

        {categoryStyle && (
          <div className="px-2.5 pt-1.5 pb-0">
            {inCartQty === 0 ? (
              <div className="flex flex-col items-center w-full">
                <div className="flex justify-center w-full">
                  <Button
                    ref={addButtonRef}
                    variant="outline"
                    size="sm"
                    disabled={product.isAvailable === false || ((product.stock !== undefined && product.stock <= 0) || product.status === "Sold out")}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAdd(e);
                    }}
                    className={`w-full border rounded-full font-semibold text-xs h-7 px-3 flex items-center justify-center uppercase tracking-wide ${product.isAvailable === false || ((product.stock !== undefined && product.stock <= 0) || product.status === "Sold out")
                      ? 'border-neutral-300 text-neutral-400 bg-neutral-50 cursor-not-allowed'
                      : 'border-green-600 text-green-600 bg-transparent hover:bg-green-50'
                      }`}
                  >
                    {product.isAvailable === false ? 'Out of Range' : ((product.stock !== undefined && product.stock <= 0) || product.status === "Sold out") ? 'Out of Stock' : 'ADD'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-1.5 bg-white border border-green-600 rounded-full px-1.5 py-0.5 h-7 w-full">
                <Button
                  variant="default"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDecrease(e);
                  }}
                  className="w-5 h-5 p-0 bg-transparent text-green-600 hover:bg-green-50 shadow-none"
                  aria-label="Decrease quantity"
                >
                  −
                </Button>
                <span className="text-xs font-bold text-green-600 min-w-[1rem] text-center">
                  {inCartQty}
                </span>
                <Button
                  variant="default"
                  size="icon"
                  disabled={product.isAvailable === false}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleIncrease(e);
                  }}
                  className={`w-5 h-5 p-0 bg-transparent text-green-600 shadow-none ${product.isAvailable === false ? 'text-neutral-300 cursor-not-allowed' : 'hover:bg-green-50'
                    }`}
                  aria-label="Increase quantity"
                >
                  +
                </Button>
              </div>
            )}
          </div>
        )}

        <div className={infoContainerClassName}>
          {categoryStyle ? (
            // Category Style Layout: Shop Name, Pack, Name, Time, % off, Price
            <>
              {/* 1. Highlighted Shop Name Badge */}
              {shopName && (
                <div className="mb-0.5">
                  <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-200/70 px-1.5 py-0.5 rounded text-[9px] font-bold tracking-tight leading-none max-w-full truncate shadow-2xs">
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600 flex-shrink-0">
                      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                      <polyline points="9 22 9 12 15 12 15 22" />
                    </svg>
                    <span className="truncate max-w-[95px] uppercase font-bold">{shopName}</span>
                  </span>
                </div>
              )}

              {/* 2. Quantity / Pack (only if not redundant with name) */}
              {!showPackBadge && packText && !isPackRedundant && (
                <p className="text-[9px] text-neutral-500 mb-0.5 leading-tight truncate">
                  {packText}
                </p>
              )}

              {/* 3. Name */}
              <h3 className="text-[10px] font-bold text-neutral-900 mb-0.5 line-clamp-2 leading-tight min-h-[1.75rem] max-h-[1.75rem] overflow-hidden" title={productName}>
                {productName}
              </h3>

              {showRating && ((product.rating ?? 0) > 0 || (product.reviewsCount ?? product.reviews ?? 0) > 0) && (
                <div className="mb-0.5">
                  <StarRating
                    rating={product.rating || 0}
                    reviewCount={product.reviewsCount ?? product.reviews ?? 0}
                    size="sm"
                  />
                </div>
              )}

              {/* 4. Time */}
              <p className="text-[9px] text-neutral-600 mb-0.5 flex items-center gap-0.5 leading-tight">
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                  <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <span>14 MINS</span>
              </p>

              {/* 5. % OFF */}
              {discount > 0 && (
                <p className="text-[10px] font-semibold text-green-600 mb-0.5 leading-tight">
                  {discount}% OFF
                </p>
              )}

              {/* 6. Price with discount */}
              <div className="mt-auto">
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-baseline gap-1.5 flex-wrap">
                    <span className="text-[14px] font-bold text-neutral-900 leading-tight">
                      ₹{displayPrice.toLocaleString('en-IN')}
                    </span>
                    {mrp && mrp > displayPrice && (
                      <span className="text-[11px] text-neutral-500 line-through leading-tight font-medium">
                        ₹{mrp.toLocaleString('en-IN')}
                      </span>
                    )}
                  </div>
                  {discount > 0 && (
                    <span className="text-[10px] font-bold text-green-600 leading-tight">
                      {discount}% OFF
                    </span>
                  )}
                </div>
              </div>
            </>
          ) : (
            // Non-category style layout (original)
            <>
              {/* 1. Highlighted Shop Name Badge */}
              {shopName && (
                <div className="mb-1">
                  <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-200/70 px-2 py-0.5 rounded-md text-[10px] md:text-xs font-semibold tracking-wide leading-none max-w-full truncate shadow-2xs">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600 flex-shrink-0">
                      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                      <polyline points="9 22 9 12 15 12 15 22" />
                    </svg>
                    <span className="truncate">{shopName}</span>
                  </span>
                </div>
              )}

              {/* 2. Pack Size (if distinct from product name) */}
              {!showPackBadge && packText && !isPackRedundant && (
                <p className={`${compact ? 'text-[10px] md:text-xs' : 'text-xs md:text-sm'} text-neutral-500 mb-1 truncate`}>
                  {packText}
                </p>
              )}

              {/* 3. Product Name */}
              <h3 className={`${compact ? 'text-xs md:text-sm' : 'text-sm md:text-base'} font-semibold text-neutral-900 ${compact ? 'mb-1' : 'mb-2'} line-clamp-2 ${compact ? 'min-h-[2rem]' : 'min-h-[2.5rem]'}`} title={productName}>
                {productName}
              </h3>

              {showRating && ((product.rating ?? 0) > 0 || (product.reviewsCount ?? product.reviews ?? 0) > 0) && (
                <div className={`${compact ? 'mb-1' : 'mb-2'}`}>
                  <StarRating
                    rating={product.rating || 0}
                    reviewCount={product.reviewsCount ?? product.reviews ?? 0}
                    size="sm"
                  />
                </div>
              )}

              {showStockInfo && (
                <p className="text-xs text-green-600 mb-2 font-medium">
                  Fast delivery
                </p>
              )}

              {showVegetarianIcon && (
                <div className="flex items-center gap-1 mb-2">
                  <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                    <div className="w-2 h-2 bg-white rounded-full"></div>
                  </div>
                  <span className="text-xs text-neutral-600">Vegetarian</span>
                </div>
              )}

              <div className="mt-auto mb-2">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-lg font-bold text-neutral-900">
                      ₹{displayPrice.toLocaleString('en-IN')}
                    </span>
                    {mrp && mrp > displayPrice && (
                      <span className="text-sm text-neutral-500 line-through font-medium">
                        ₹{mrp.toLocaleString('en-IN')}
                      </span>
                    )}
                  </div>
                  {discount > 0 && (
                    <span className="text-xs font-bold text-green-600">
                      You save ₹{(mrp - displayPrice).toLocaleString('en-IN')} ({discount}% OFF)
                    </span>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {!categoryStyle && (
        <div className={`${compact ? 'px-3 pb-3' : 'px-4 pb-4'}`}>
          <div className="mt-auto">
            {inCartQty === 0 ? (
              <div>
                <Button
                  ref={addButtonRef}
                  variant="outline"
                  size="sm"
                  disabled={product.isAvailable === false || ((product.stock !== undefined && product.stock <= 0) || product.status === "Sold out")}
                  onClick={handleAdd}
                  className={`w-full border h-8 text-xs font-semibold uppercase tracking-wide ${product.isAvailable === false || ((product.stock !== undefined && product.stock <= 0) || product.status === "Sold out")
                    ? 'border-neutral-300 text-neutral-400 bg-neutral-50 cursor-not-allowed'
                    : 'border-green-600 text-green-600 hover:bg-green-50'
                    }`}
                >
                  {product.isAvailable === false ? 'Out of Range' : ((product.stock !== undefined && product.stock <= 0) || product.status === "Sold out") ? 'Out of Stock' : 'Add'}
                </Button>
                <div className="h-4 mt-1">
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2 bg-white border border-green-600 rounded-full px-2 py-0.5 h-8">
                <Button
                  variant="default"
                  size="icon"
                  onClick={handleDecrease}
                  className="w-6 h-6 p-0 bg-transparent text-green-600 hover:bg-green-50 shadow-none"
                  aria-label="Decrease quantity"
                >
                  −
                </Button>
                <span className="text-xs font-bold text-green-600 min-w-[1.5rem] text-center">
                  {inCartQty}
                </span>
                <Button
                  variant="default"
                  size="icon"
                  disabled={product.isAvailable === false}
                  onClick={handleIncrease}
                  className={`w-6 h-6 p-0 bg-transparent text-green-600 shadow-none ${product.isAvailable === false ? 'text-neutral-300 cursor-not-allowed' : 'hover:bg-green-50'
                    }`}
                  aria-label="Increase quantity"
                >
                  +
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}
