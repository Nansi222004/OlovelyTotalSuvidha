import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useOrders } from '../../hooks/useOrders';
import { useCart } from '../../context/CartContext';
import { getProducts } from '../../services/api/customerProductService';
import WishlistButton from '../../components/WishlistButton';
import { calculateProductPrice } from '../../utils/priceUtils';

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'Delivered':
      return 'bg-green-100 text-green-700';
    case 'On the way':
      return 'bg-blue-100 text-blue-700';
    case 'Accepted':
      return 'bg-yellow-100 text-yellow-700';
    case 'Received':
      return 'bg-neutral-100 text-neutral-700';
    default:
      return 'bg-neutral-100 text-neutral-700';
  }
};

export default function OrderAgain() {
  const { orders } = useOrders();
  const { cart, addToCart, updateQuantity } = useCart();
  const navigate = useNavigate();
  const [addedOrders, setAddedOrders] = useState<Set<string>>(new Set());

  // Handle "Order Again" - Add all items from an order to cart
  const handleOrderAgain = (order: any, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Mark this order as added
    setAddedOrders(prev => new Set(prev).add(order.id));

    // Add each item from the order to the cart
    order.items
      .filter((item: any) => item?.product) // Filter out items with null/undefined products
      .forEach((item: any) => {
        // Check if product is already in cart
        const existingCartItem = cart.items.find(cartItem => cartItem?.product && cartItem.product.id === item.product.id);

        if (existingCartItem) {
          // If already in cart, add the order quantity to existing quantity
          updateQuantity(item.product.id, existingCartItem.quantity + item.quantity);
        } else {
          // If not in cart, add it first (adds 1)
          addToCart(item.product);
          // Then update to the correct quantity if needed
          if (item.quantity > 1) {
            // Use setTimeout to ensure the item is added first
            setTimeout(() => {
              updateQuantity(item.product.id, item.quantity);
            }, 10);
          }
        }
      });
  };

  // Get bestseller products
  const [bestsellerProducts, setBestsellerProducts] = useState<any[]>([]);

  useEffect(() => {
    const fetchBestsellers = async () => {
      try {
        const response = await getProducts({ sort: 'popular', limit: 6 });
        if (response.success && response.data) {
          const mapped = (response.data as any[]).map(p => {
            // Clean product name - remove description suffixes
            let productName = p.productName || p.name || '';
            productName = productName.replace(/\s*-\s*(Fresh|Quality|Assured|Premium|Best|Top|Hygienic|Carefully|Selected).*$/i, '').trim();

            return {
              ...p,
              id: p._id || p.id,
              name: productName,
              imageUrl: p.mainImage || p.imageUrl,
              mrp: p.mrp || p.price,
              pack: p.variations?.[0]?.title || p.smallDescription || 'Standard'
            };
          });
          setBestsellerProducts(mapped);
        }
      } catch (error) {
        console.error('Failed to fetch bestsellers:', error);
      }
    };
    fetchBestsellers();
  }, []);

  const hasOrders = orders && orders.length > 0;

  return (
    <div className="pb-24 md:pb-8 bg-neutral-50 min-h-screen">
      {/* Simple Clean Header */}
      <div className="bg-white border-b border-neutral-100 sticky top-0 z-30 px-4 py-3 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => navigate(-1)}
              className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-700 hover:bg-neutral-200 transition-colors"
              aria-label="Back"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <div>
              <h1 className="text-base md:text-lg font-bold text-neutral-900 leading-tight">Order Again</h1>
              <p className="text-[11px] text-neutral-500">Quickly reorder your past purchases</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/search')}
            className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-600 hover:bg-neutral-200 transition-colors"
            aria-label="Search"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"></circle>
              <path d="m21 21-4.3-4.3"></path>
            </svg>
          </button>
        </div>
      </div>

      {/* Orders Section - Show when orders exist */}
      {hasOrders && (
        <div className="px-4 mt-2 mb-2">
          <h2 className="text-sm font-semibold text-neutral-900 mb-2">Your Previous Orders</h2>
          <div className="space-y-1.5">
            {orders.map((order) => {
              const shortId = order.id.split('-').slice(-1)[0];
              const previewItems = order.items.slice(0, 3);

              return (
                <div
                  key={order.id}
                  onClick={() => navigate(`/orders/${order.id}`)}
                  className="bg-white rounded-lg border border-neutral-200 p-2 hover:shadow-sm transition-shadow cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <div className="text-xs font-semibold text-neutral-900">
                          Order #{shortId}
                        </div>
                        <span
                          className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0 ${getStatusColor(
                            order.status
                          )}`}
                        >
                          {order.status}
                        </span>
                      </div>
                      <div className="text-[10px] text-neutral-500 mb-1">{formatDate(order.createdAt)}</div>

                      {/* Product Images Preview - Compact */}
                      <div className="flex items-center gap-1">
                        {previewItems
                          .filter(item => item?.product) // Filter out items with null/undefined products
                          .map((item, idx) => (
                            <div
                              key={item.product.id}
                              className="w-6 h-6 bg-neutral-100 rounded flex items-center justify-center flex-shrink-0 overflow-hidden"
                              style={{ marginLeft: idx > 0 ? '-4px' : '0' }}
                            >
                              {item.product.imageUrl ? (
                                <img
                                  src={item.product.imageUrl}
                                  alt={item.product.name}
                                  className="w-full h-full object-contain"
                                />
                              ) : (
                                <span className="text-[8px] text-neutral-400">
                                  {(item.product.name || item.product.productName || '?').charAt(0).toUpperCase()}
                                </span>
                              )}
                            </div>
                          ))}
                        {order.items.length > 3 && (
                          <div className="w-6 h-6 bg-neutral-200 rounded flex items-center justify-center text-[8px] font-medium text-neutral-600">
                            +{order.items.length - 3}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <div className="text-xs font-bold text-neutral-900">
                        ₹{order.totalAmount.toFixed(0)}
                      </div>
                      <div className="text-[10px] text-neutral-500">
                        {order.totalItems} {order.totalItems === 1 ? 'item' : 'items'}
                      </div>
                      {/* Order Again Button */}
                      <button
                        onClick={(e) => handleOrderAgain(order, e)}
                        disabled={addedOrders.has(order.id)}
                        className={`mt-1 text-[10px] font-semibold px-3 py-1 rounded-md transition-colors shadow-sm ${addedOrders.has(order.id)
                          ? 'bg-orange-200 text-neutral-600 cursor-not-allowed'
                          : 'bg-green-600 text-white hover:bg-green-700 cursor-pointer'
                          }`}
                      >
                        {addedOrders.has(order.id) ? 'Added to Cart!' : 'Order Again'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Bestsellers Section - Using checkout-style cards */}
      <div className="px-4 py-2.5 border-b border-neutral-200">
        <h2 className="text-sm font-semibold text-neutral-900 mb-2">Bestsellers</h2>
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-3" style={{ scrollSnapType: 'x mandatory' }}>
          {bestsellerProducts.map((product) => {
            // Get Price and MRP using utility
            const { displayPrice, mrp, discount, hasDiscount } = calculateProductPrice(product);

            // Get quantity in cart
            const cartItem = cart.items.find(item => item?.product && item.product.id === product.id);
            const inCartQty = cartItem?.quantity || 0;

            return (
              <div
                key={product.id}
                className="flex-shrink-0 w-[140px]"
                style={{ scrollSnapAlign: 'start' }}
              >
                <div className="bg-white rounded-lg overflow-hidden flex flex-col relative h-full" style={{ boxShadow: '0 1px 1px rgba(0, 0, 0, 0.03)' }}>
                  {/* Product Image Area */}
                  <div
                    onClick={() => navigate(`/product/${product.id}`)}
                    className="relative block cursor-pointer"
                  >
                    <div className="w-full h-28 bg-neutral-100 flex items-center justify-center overflow-hidden relative">
                      {product.imageUrl ? (
                        <img
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
                      <WishlistButton
                        productId={product.id}
                        size="sm"
                        className="top-1 right-1 shadow-sm"
                      />

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
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                addToCart(product, e.currentTarget);
                              }}
                              className="bg-white/95 backdrop-blur-sm text-green-600 border-2 border-green-600 text-[10px] font-semibold px-2 py-1 rounded shadow-md hover:bg-white transition-colors"
                            >
                              ADD
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
                                  updateQuantity(product.id, inCartQty - 1);
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
                                whileTap={{ scale: 0.9 }}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  updateQuantity(product.id, inCartQty + 1);
                                }}
                                className="w-4 h-4 flex items-center justify-center text-white font-bold hover:bg-green-700 rounded transition-colors p-0 leading-none"
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
                  <div className="p-1.5 flex-1 flex flex-col bg-white">
                    {/* Product Name */}
                    <div
                      onClick={() => navigate(`/product/${product.id}`)}
                      className="mb-0.5 cursor-pointer"
                    >
                      <h3 className="text-[10px] font-bold text-neutral-900 line-clamp-2 leading-tight">
                        {(() => {
                          // Remove description suffixes like " - Fresh & Quality Assured", " - Premium Quality", etc.
                          const productName = product.name || product.productName || '';
                          return productName.replace(/\s*-\s*(Fresh|Quality|Assured|Premium|Best|Top|Hygienic|Carefully|Selected).*$/i, '').trim();
                        })()}
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
                    <div
                      onClick={() => navigate(`/category/${product.categoryId || 'all'}`)}
                      className="w-full bg-green-100 text-green-700 text-[8px] font-medium py-0.5 rounded-lg flex items-center justify-between px-1 hover:bg-green-200 transition-colors mt-auto cursor-pointer"
                    >
                      <span>See more like this</span>
                      <div className="flex items-center gap-0.5">
                        <div className="w-px h-2 bg-green-300"></div>
                        <svg width="6" height="6" viewBox="0 0 8 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M0 0L8 4L0 8Z" fill="#16a34a" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Empty State Illustration - Show when no orders */}
      {!hasOrders && (
        <div className="bg-stone-50 py-6 px-4">
          <div className="flex flex-col items-center justify-center max-w-md mx-auto">
            {/* Grocery Illustration */}
            <div className="relative w-full max-w-xs mb-4">
              <div className="relative flex items-center justify-center">
                {/* Yellow Shopping Bag */}
                <div className="relative w-40 h-48 bg-gradient-to-b from-yellow-400 via-yellow-300 to-yellow-500 rounded-b-2xl rounded-t-lg shadow-xl border-2 border-yellow-500/30 flex items-center justify-center">
                  {/* Enhanced bag opening/top with depth */}
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-36 h-8 bg-gradient-to-b from-yellow-500 to-yellow-400 rounded-t-lg shadow-inner"></div>

                  {/* Enhanced bag handle with 3D effect */}
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-20 h-7 border-[4px] border-yellow-600 rounded-full border-b-transparent shadow-lg">
                    <div className="absolute top-1 left-1/2 -translate-x-1/2 w-12 h-4 border-[2px] border-yellow-500/50 rounded-full border-b-transparent"></div>
                  </div>

                  {/* Decorative pattern/stitching on bag */}
                  <div className="absolute top-12 left-1/2 -translate-x-1/2 w-32 h-0.5 bg-yellow-600/30"></div>
                  <div className="absolute top-20 left-1/2 -translate-x-1/2 w-28 h-0.5 bg-yellow-600/20"></div>

                  {/* Olovely text inside basket */}
                  <div className="relative z-10 text-center px-4">
                    <span className="text-2xl font-extrabold text-neutral-900 tracking-tight drop-shadow-sm">Olovely</span>
                    <span className="inline-block w-2.5 h-2.5 bg-green-500 rounded-full ml-1.5 shadow-sm"></span>
                  </div>
                </div>
              </div>
            </div>

            {/* Reordering Message */}
            <h2 className="text-xl font-bold text-neutral-900 mb-1.5 text-center">
              Reordering will be easy
            </h2>
            <p className="text-xs text-neutral-600 text-center max-w-xs leading-snug">
              Items you order will show up here so you can buy them again easily
            </p>
          </div>
        </div>
      )}

    </div>
  );
}

