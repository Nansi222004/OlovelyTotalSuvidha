import { useRef, useState, useEffect, useMemo, memo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { getProducts } from '../../../services/api/customerProductService';
import LazyImage from '../../../components/LazyImage';

import { getTheme } from '../../../utils/themes';
import { useCart } from '../../../context/CartContext';
import { Product } from '../../../types/domain';
import { useWishlist } from '../../../hooks/useWishlist';
import { calculateProductPrice } from '../../../utils/priceUtils';

interface LowestPricesEverProps {
  activeTab?: string;
  products?: Product[]; // Admin-selected products from home data
}

// Helper function to truncate text to a maximum length
const truncateText = (text: string, maxLength: number = 60): string => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '...';
};

// Product Card Component - Defined outside to prevent recreation on every render
const ProductCard = memo(({
  product,
  cartQuantity,
  onAddToCart,
  onUpdateQuantity
}: {
  product: Product;
  cartQuantity: number;
  onAddToCart: (product: Product, element?: HTMLElement | null) => void;
  onUpdateQuantity: (productId: string, quantity: number) => void;
}) => {
  const navigate = useNavigate();
  const { isWishlisted, toggleWishlist } = useWishlist(product.id);

  // Get Price and MRP using utility
  const { displayPrice, mrp, discount, hasDiscount } = calculateProductPrice(product);

  // Use cartQuantity from props
  const inCartQty = cartQuantity;

  // Get product name, clean it (remove description suffixes), and truncate if needed
  let productName = product.name || product.productName || '';
  // Remove common description patterns like " - Fresh & Quality Assured", " - Premium Quality", etc.
  productName = productName.replace(/\s*-\s*(Fresh|Quality|Assured|Premium|Best|Top|Hygienic|Carefully|Selected).*$/i, '').trim();
  const displayName = truncateText(productName, 60);

  // Resolve shop/store name
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

  const isPackRedundant = useMemo(() => {
    const pack = product.pack || '';
    if (!pack || !productName) return false;
    const cleanPack = pack.trim().toLowerCase();
    const cleanName = productName.trim().toLowerCase();
    return cleanPack === cleanName || cleanName.startsWith(cleanPack);
  }, [product.pack, productName]);


  return (
    <div
      className="flex-shrink-0 w-[140px]"
      style={{ scrollSnapAlign: 'start' }}
    >
      <div
        onClick={() => navigate(`/product/${product.id}`)}
        className="bg-white rounded-lg overflow-hidden flex flex-col relative h-full max-h-full cursor-pointer"
        style={{ boxShadow: '0 1px 1px rgba(0, 0, 0, 0.03)' }}
      >
        {/* Product Image Area */}
        <div className="relative block">
          <div className="w-full h-28 bg-neutral-100 flex items-center justify-center overflow-hidden relative">
            {product.imageUrl ? (
              <LazyImage
                src={product.imageUrl}
                alt={product.name}
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-neutral-100 text-neutral-400 text-4xl">
                {(product.name || product.productName || '?').charAt(0).toUpperCase()}
              </div>
            )}

            {/* Red Discount Badge - Top Left */}
            {discount > 0 && (
              <div className="absolute top-1 left-1 z-10 bg-red-600 text-white text-[9px] font-bold px-1 py-0.5 rounded">
                {discount}% OFF
              </div>
            )}

            {/* Heart Icon - Top Right */}
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleWishlist(e);
              }}
              className="absolute top-1 right-1 z-30 w-7 h-7 rounded-full bg-white/95 backdrop-blur-sm flex items-center justify-center hover:bg-white transition-colors shadow-sm"
              aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill={isWishlisted ? "#ef4444" : "none"}
                xmlns="http://www.w3.org/2000/svg"
                className={isWishlisted ? "text-red-500" : "text-neutral-700"}
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

            {/* ADD Button or Quantity Stepper - Overlaid on bottom right of image */}
            <div className="absolute bottom-1.5 right-1.5 z-10">
              <AnimatePresence mode="wait">
                {inCartQty === 0 ? (
                  <motion.button
                    key="add-button"
                    type="button"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.2 }}
                    disabled={product.isAvailable === false}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onAddToCart(product, e.currentTarget);
                    }}
                    className={`bg-white/95 backdrop-blur-sm text-[10px] font-semibold px-2 py-1 rounded shadow-md transition-colors ${product.isAvailable === false
                        ? 'text-neutral-400 border-2 border-neutral-300 cursor-not-allowed'
                        : 'text-green-600 border-2 border-green-600 hover:bg-white'
                      }`}
                  >
                    {product.isAvailable === false ? 'Out of Range' : 'ADD'}
                  </motion.button>
                ) : (
                  <motion.div
                    key="stepper"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-center gap-1 bg-green-600 rounded px-1.5 py-1 shadow-md"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onUpdateQuantity(product.id, inCartQty - 1);
                      }}
                      className="w-4 h-4 flex items-center justify-center text-white font-bold hover:bg-green-700 rounded transition-colors p-0 leading-none"
                      style={{ lineHeight: 1, fontSize: '14px' }}
                    >
                      <span className="relative top-[-1px]">−</span>
                    </motion.button>
                    <motion.span
                      key={inCartQty}
                      initial={{ scale: 1.2, y: -2 }}
                      animate={{ scale: 1, y: 0 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 15 }}
                      className="text-white font-bold min-w-[0.75rem] text-center"
                      style={{ fontSize: '12px' }}
                    >
                      {inCartQty}
                    </motion.span>
                    <motion.button
                      whileTap={product.isAvailable === false ? {} : { scale: 0.9 }}
                      disabled={product.isAvailable === false}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onUpdateQuantity(product.id, inCartQty + 1);
                      }}
                      className={`w-4 h-4 flex items-center justify-center font-bold rounded transition-colors p-0 leading-none ${product.isAvailable === false
                          ? 'text-neutral-300 cursor-not-allowed'
                          : 'text-white hover:bg-green-700'
                        }`}
                      style={{ lineHeight: 1, fontSize: '14px' }}
                    >
                      <span className="relative top-[-1px]">+</span>
                    </motion.button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Product Details */}
        <div className="p-1.5 flex-1 flex flex-col min-h-0" style={{ background: '#fef9e7' }}>
          {/* Highlighted Shop Badge */}
          {shopName && (
            <div className="mb-0.5">
              <span className="inline-flex items-center gap-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200/70 px-1 py-0.5 rounded text-[8px] font-bold tracking-tight leading-none max-w-full truncate">
                <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600 flex-shrink-0">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
                <span className="truncate max-w-[85px] uppercase font-bold">{shopName}</span>
              </span>
            </div>
          )}

          {/* Light Grey Tags (only if not redundant) */}
          {product.pack && !isPackRedundant && (
            <div className="flex gap-0.5 mb-0.5">
              <div className="bg-neutral-200 text-neutral-700 text-[8px] font-medium px-1 py-0.5 rounded truncate">
                {product.pack}
              </div>
            </div>
          )}


          {/* Product Name */}
          <div className="mb-0.5">
            <h3 className="text-[10px] font-bold text-neutral-900 line-clamp-2 leading-tight min-h-[2rem] max-h-[2rem] overflow-hidden" title={productName}>
              {displayName}
            </h3>
          </div>

          {/* Rating and Reviews */}
          <div className="flex items-center gap-0.5 mb-0.5">
            <div className="flex items-center">
              {[...Array(5)].map((_, i) => (
                <svg
                  key={i}
                  width="8"
                  height="8"
                  viewBox="0 0 24 24"
                  fill={i < 4 ? '#fbbf24' : '#e5e7eb'}
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              ))}
            </div>
            <span className="text-[8px] text-neutral-500">(85)</span>
          </div>

          {/* Delivery Time */}
          <div className="text-[9px] text-neutral-600 mb-0.5">
            20 MINS
          </div>

          {/* Discount - Blue Text */}
          {discount > 0 && (
            <div className="text-[9px] text-blue-600 font-semibold mb-0.5">
              {discount}% OFF
            </div>
          )}

          {/* Price */}
          <div className="mb-1">
            <div className="flex items-baseline gap-1">
              <span className="text-[13px] font-bold text-neutral-900">
                ₹{displayPrice.toLocaleString('en-IN')}
              </span>
              {hasDiscount && (
                <span className="text-[10px] text-neutral-400 line-through">
                  ₹{mrp.toLocaleString('en-IN')}
                </span>
              )}
            </div>
          </div>

          {/* Bottom Link */}
          <Link
            to={`/category/${product.categoryId || 'all'}`}
            className="w-full bg-green-100 text-green-700 text-[8px] font-medium py-0.5 rounded-lg flex items-center justify-between px-1 hover:bg-green-200 transition-colors mt-auto"
          >
            <span>See more like this</span>
            <div className="flex items-center gap-0.5">
              <div className="w-px h-2 bg-green-300"></div>
              <svg width="6" height="6" viewBox="0 0 8 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M0 0L8 4L0 8Z" fill="#16a34a" />
              </svg>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison: only re-render if the product ID or cart quantity changes
  // Functions are stable references, so we don't need to compare them
  return (
    prevProps.product.id === nextProps.product.id &&
    prevProps.cartQuantity === nextProps.cartQuantity
  );
});

ProductCard.displayName = 'ProductCard';

export default function LowestPricesEver({ activeTab = 'all', products: adminProducts }: LowestPricesEverProps) {
  const theme = getTheme(activeTab);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const { cart } = useCart();
  const [fontLoaded, setFontLoaded] = useState(false);

  // Preload and wait for font to load to prevent FOUT
  useEffect(() => {
    if (document.fonts && document.fonts.check) {
      // Check if font is already loaded
      if (document.fonts.check('1em "Poppins"')) {
        setFontLoaded(true);
        return;
      }

      // Wait for font to load
      const checkFont = async () => {
        try {
          await document.fonts.load('1em "Poppins"');
          setFontLoaded(true);
        } catch (e) {
          // Fallback: show after timeout
          setTimeout(() => setFontLoaded(true), 300);
        }
      };

      checkFont();
    } else {
      // Fallback for browsers without Font Loading API
      setTimeout(() => setFontLoaded(true), 300);
    }
  }, []);

  // Memoize cart items lookup for performance
  const cartItemsMap = useMemo(() => {
    const map = new Map();
    cart.items.forEach(item => {
      if (item?.product) {
        const id = String(item.product.id || item.product._id);
        map.set(id, (map.get(id) || 0) + item.quantity);
      }
    });
    return map;
  }, [cart.items]);

  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    // Use admin-selected products if provided, otherwise fallback to fetching
    if (adminProducts && adminProducts.length > 0) {
      const mappedProducts = adminProducts.map((p: any) => {
        // Get product name and remove any description-like suffixes
        let productName = p.productName || p.name || '';
        // Remove common description patterns like " - Fresh & Quality Assured"
        productName = productName.replace(/\s*-\s*(Fresh|Quality|Assured|Premium|Best|Top|Hygienic|Carefully|Selected).*$/i, '').trim();

        // Get pack without description
        let packValue = p.variations?.[0]?.title || p.pack || 'Standard';
        // Remove description from pack if it contains it
        if (packValue && packValue.includes(' - ')) {
          packValue = packValue.split(' - ')[0].trim();
        }

        return {
          ...p,
          id: p._id || p.id || p.id,
          name: productName,
          imageUrl: p.mainImage || p.imageUrl || p.mainImage,
          mrp: p.mrp || p.price,
          pack: packValue
        };
      });
      setProducts(mappedProducts);
    } else {
      // Fallback: fetch products if admin hasn't configured any
      const fetchDiscountedProducts = async () => {
        try {
          const response = await getProducts({ limit: 50 });
          if (response.success && response.data) {
            const mappedProducts = (response.data as any[]).map(p => {
              let productName = p.productName || p.name || '';
              productName = productName.replace(/\s*-\s*(Fresh|Quality|Assured|Premium|Best|Top|Hygienic|Carefully|Selected).*$/i, '').trim();

              let packValue = p.variations?.[0]?.title || p.pack || 'Standard';
              if (packValue && packValue.includes(' - ')) {
                packValue = packValue.split(' - ')[0].trim();
              }

              return {
                ...p,
                id: p._id || p.id,
                name: productName,
                imageUrl: p.mainImage || p.imageUrl,
                mrp: p.mrp || p.price,
                pack: packValue
              };
            });
            setProducts(mappedProducts);
          }
        } catch (err) {
          console.error("Failed to fetch products for LowestPricesEver", err);
        }
      };
      fetchDiscountedProducts();
    }
  }, [adminProducts]);

  // Get products for this section
  // If using admin-selected products, use them directly (already filtered and ordered)
  // Otherwise, filter by activeTab and discount
  const getFilteredProducts = () => {
    // If admin has selected products, use them directly (already ordered)
    if (adminProducts && adminProducts.length > 0) {
      return products.slice(0, 20); // Show up to 20 admin-selected products
    }

    // Fallback: filter by activeTab and discount
    let filtered = products;

    if (activeTab !== 'all') {
      if (activeTab === 'grocery') {
        filtered = products.filter((p) =>
          ['snacks', 'atta-rice', 'dairy-breakfast', 'masala-oil', 'biscuits-bakery', 'cold-drinks', 'fruits-veg'].includes(p.categoryId)
        );
      } else {
        filtered = products.filter((p) => p.categoryId === activeTab);
      }
    }

    return filtered
      .filter((product) => {
        if (!product.mrp) return false;
        const discount = Math.round(((product.mrp - product.price) / product.mrp) * 100);
        return discount > 0;
      })
      .slice(0, 10); // Show top 10 discounted products
  };

  const discountedProducts = getFilteredProducts();

  // Get cart functions once at parent level
  const { addToCart, updateQuantity } = useCart();

  // Memoize callbacks to prevent ProductCard re-renders
  const handleAddToCart = useCallback((product: Product, element?: HTMLElement | null) => {
    addToCart(product, element);
  }, [addToCart]);

  const handleUpdateQuantity = useCallback((productId: string, quantity: number) => {
    updateQuantity(productId, quantity);
  }, [updateQuantity]);

  return (
    <div
      className="relative"
      style={{
        background: `linear-gradient(to bottom, ${theme.primary[3]}, ${theme.primary[3]}, ${theme.secondary[1]}, ${theme.secondary[2]})`,
        marginTop: '0px', // No gap for seamless blend
        paddingTop: '12px',
        paddingBottom: '16px',
      }}
    >
      {/* White Zip/Scalloped Divider at Top - Upward-pointing semicircles */}
      <div className="absolute top-0 left-0 right-0" style={{ height: '30px', zIndex: 10, opacity: 0.95 }}>
        <svg
          viewBox="0 0 1200 30"
          preserveAspectRatio="none"
          className="w-full h-full"
          style={{ display: 'block' }}
        >
          {/* White scalloped pattern with upward semicircles - clearly visible */}
          <path
            d="M0,30 L0,15
               Q25,0 50,15
               T100,15
               T150,15
               T200,15
               T250,15
               T300,15
               T350,15
               T400,15
               T450,15
               T500,15
               T550,15
               T600,15
               T650,15
               T700,15
               T750,15
               T800,15
               T850,15
               T900,15
               T950,15
               T1000,15
               T1050,15
               T1100,15
               T1150,15
               L1200,15
               L1200,30 Z"
            fill="white"
            stroke="white"
            strokeWidth="0"
          />
        </svg>
      </div>

      {/* LOWEST PRICES EVER Banner */}
      <div className="px-4 relative z-10" style={{ marginTop: '30px', marginBottom: '12px' }} data-section="lowest-prices">
        <div className="flex items-center justify-center gap-2 mb-1">
          {/* Left horizontal line */}
          <div className="flex-1 h-px bg-neutral-300"></div>

          <h2
            className="font-black text-center whitespace-nowrap"
            style={{
              fontFamily: '"Poppins", sans-serif',
              fontSize: '28px',
              color: '#000000',
              opacity: fontLoaded ? 1 : 0,
              transition: 'opacity 0.2s ease-in',
              textShadow:
                '-1.5px -1.5px 0 white, 1.5px -1.5px 0 white, -1.5px 1.5px 0 white, 1.5px 1.5px 0 white, ' +
                '-1.5px 0px 0 white, 1.5px 0px 0 white, 0px -1.5px 0 white, 0px 1.5px 0 white, ' +
                '-1px -1px 0 white, 1px -1px 0 white, -1px 1px 0 white, 1px 1px 0 white, ' +
                '3px 3px 4px rgba(0, 0, 0, 0.5), ' +
                '2px 2px 3px rgba(0, 0, 0, 0.6), ' +
                '1px 1px 2px rgba(0, 0, 0, 0.7), ' +
                '0px 2px 1px rgba(0, 0, 0, 0.4)',
              letterSpacing: '0.8px',
              fontWeight: 900,
              lineHeight: '1.1',
              transform: 'perspective(500px) rotateX(2deg) rotateY(-1deg)',
              transformStyle: 'preserve-3d',
            } as React.CSSProperties}
          >
            LOWEST PRICES EVER
          </h2>

          {/* Right horizontal line */}
          <div className="flex-1 h-px bg-neutral-300"></div>
        </div>
      </div>

      {/* Horizontal Scrollable Product Cards */}
      <div
        ref={scrollContainerRef}
        className="flex gap-2 overflow-x-auto scrollbar-hide px-4"
        style={{ scrollSnapType: 'x mandatory' }}
      >
        {discountedProducts.map((product) => {
          const cartQuantity = cartItemsMap.get(product.id) || 0;
          return (
            <ProductCard
              key={product.id}
              product={product}
              cartQuantity={cartQuantity}
              onAddToCart={handleAddToCart}
              onUpdateQuantity={handleUpdateQuantity}
            />
          );
        })}
      </div>
    </div>
  );
}

