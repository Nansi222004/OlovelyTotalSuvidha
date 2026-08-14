import { motion, AnimatePresence } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { Product } from '../types/domain';

interface AddToCartAnimationProps {
  /**
   * Bottom offset from the bottom of the viewport (in pixels)
   * Default: 96px
   */
  bottomOffset?: number;

  /**
   * Custom className for the cart pill button
   */
  pillClassName?: string;

  /**
   * Whether to hide the pill on specific pages
   * Default: true (hides on checkout, orders, account pages)
   */
  hideOnPages?: boolean;

  /**
   * Custom link destination
   * Default: '/checkout'
   */
  linkTo?: string;
}

/**
 * AddToCartAnimation Component
 * 
 * A self-contained component that handles:
 * - Fly-to-cart animation when products are added
 * - Bounce-out animation when products are removed
 * - Pulse animation on cart changes
 * - "View cart" button display at bottom center
 * 
 * This component automatically integrates with the CartContext and
 * listens for cart changes to trigger appropriate animations.
 */
export default function AddToCartAnimation({
  bottomOffset = 96,
  pillClassName = '',
  hideOnPages = true,
  linkTo = '/checkout',
}: AddToCartAnimationProps) {
  const { cart, lastAddEvent } = useCart();
  const location = useLocation();
  const linkRef = useRef<HTMLAnchorElement>(null);
  const [removedProduct, setRemovedProduct] = useState<Product | null>(null);
  const [flyingProduct, setFlyingProduct] = useState<{ product: Product; startPos: { x: number; y: number } } | null>(null);
  const removedThumbnailRef = useRef<HTMLDivElement>(null);
  const flyingThumbnailRef = useRef<HTMLDivElement>(null);
  const prevItemsRef = useRef(cart.items);

  // Hide pill on checkout pages, order pages, and account page (if enabled)
  const isCheckoutPage = location.pathname === '/checkout' || location.pathname.startsWith('/checkout/');
  const isOrderPage = location.pathname.startsWith('/orders/');
  const isAccountPage = location.pathname === '/account';
  const shouldHidePill = hideOnPages && (isCheckoutPage || isOrderPage || isAccountPage);

  // Detect removed products and trigger bounce-out animation
  useEffect(() => {
    const prevItems = prevItemsRef.current;
    const currentItems = cart.items;

    // Find removed product by comparing previous and current items
    if (prevItems.length > currentItems.length) {
      const removed = prevItems.find(
        (prevItem) => !currentItems.some((currItem) => currItem.product.id === prevItem.product.id)
      );

      if (removed) {
        setRemovedProduct(removed.product);

        // Animate the removed thumbnail bouncing out
        setTimeout(() => {
          if (removedThumbnailRef.current) {
            const pillRect = linkRef.current?.getBoundingClientRect();
            if (pillRect) {
              const thumbnail = removedThumbnailRef.current;

              // Position it at the pill location initially (at the first thumbnail position)
              gsap.set(thumbnail, {
                position: 'fixed',
                left: pillRect.left + 16,
                top: pillRect.top + 8,
                zIndex: 1000,
                scale: 1,
                rotation: 0,
                opacity: 1,
                width: '32px',
                height: '32px',
              });

              // Animation sequence: rocket goes up → pops (no smoke)
              const tl = gsap.timeline({
                onComplete: () => {
                  setRemovedProduct(null);
                },
              });

              // STEP 1: Rocket animation - thumbnail shoots up like a rocket
              tl.to(thumbnail, {
                y: -200, // Shoot up high
                scale: 1.2,
                rotation: -15,
                duration: 0.4,
                ease: 'power2.in',
              })
                // STEP 2: Pop/explode at the top (no particles, just scale and fade)
                .to(thumbnail, {
                  scale: 2.5,
                  opacity: 0,
                  rotation: -45,
                  duration: 0.15,
                  ease: 'power4.in',
                });
            }
          }
        }, 10);
      }
    }

    // Update previous items
    prevItemsRef.current = cart.items;
  }, [cart.items]);

  // Handle fly-to-cart animation when product is added
  useEffect(() => {
    if (lastAddEvent && lastAddEvent.sourcePosition && linkRef.current) {
      const { product, sourcePosition } = lastAddEvent;
      setFlyingProduct({ product, startPos: sourcePosition });

      // Wait a bit longer to ensure pill is fully rendered and in position
      setTimeout(() => {
        if (flyingThumbnailRef.current && linkRef.current) {
          const thumbnail = flyingThumbnailRef.current;
          // Get fresh position after pill animation completes
          const pillRect = linkRef.current.getBoundingClientRect();
          // Target position: center of the pill
          const endX = pillRect.left + pillRect.width / 2; // Horizontal center of pill
          const endY = pillRect.top + pillRect.height / 2; // Vertical center of pill

          // Calculate thumbnail center offset (16px = half of 32px thumbnail)
          const thumbnailCenterOffset = 16;

          // Position at source (center of button)
          // Set initial position so the center of thumbnail is at sourcePosition
          gsap.set(thumbnail, {
            position: 'fixed',
            left: sourcePosition.x - thumbnailCenterOffset,
            top: sourcePosition.y - thumbnailCenterOffset,
            zIndex: 1000,
            scale: 1,
            rotation: 0,
            opacity: 1,
            width: '32px',
            height: '32px',
            borderRadius: '50%', // Ensure circular
            x: 0,
            y: 0,
          });

          // Fly to cart animation with bounce
          const tl = gsap.timeline({
            onComplete: () => {
              setFlyingProduct(null);
            },
          });

          // Calculate relative movement from source center to target center
          // Both positions are centers, so delta is direct
          const deltaX = endX - sourcePosition.x;
          const deltaY = endY - sourcePosition.y;

          // Step 1: Pop out from button (scale up slightly)
          tl.to(thumbnail, {
            scale: 1.3,
            duration: 0.15,
            ease: 'power2.out',
          })
            // Step 2: Fly towards cart with rotation (no Y overshoot to prevent going below)
            .to(thumbnail, {
              x: deltaX * 0.98, // Slight X overshoot for bounce
              y: deltaY, // No overshoot on Y to prevent going below pill
              rotation: 360,
              scale: 1.1,
              duration: 0.4,
              ease: 'power2.inOut',
            })
            // Step 3: Bounce back slightly on X only (overshoot correction)
            .to(thumbnail, {
              x: deltaX,
              y: deltaY, // Keep Y at exact target
              scale: 0.9,
              duration: 0.15,
              ease: 'power2.out',
            })
            // Step 4: Final bounce into position
            .to(thumbnail, {
              scale: 0.85,
              duration: 0.1,
              ease: 'power2.in',
            })
            // Step 5: Fade out smoothly
            .to(thumbnail, {
              scale: 0.7,
              opacity: 0,
              duration: 0.15,
              ease: 'power2.in',
            });
        }
      }, 150); // Increased delay to ensure pill animation completes
    }
  }, [lastAddEvent]);

  // Enhanced GSAP pulse animation when cart changes (but not on removal or fly-to-cart)
  useEffect(() => {
    if ((cart.itemCount || 0) > 0 && linkRef.current && !removedProduct && !flyingProduct) {
      // Kill any existing animations first
      gsap.killTweensOf(linkRef.current);

      // Enhanced pulse animation with glow effect
      const tl = gsap.timeline();

      // Step 1: Scale up with glow
      tl.to(linkRef.current, {
        scale: 1.08,
        boxShadow: '0 10px 25px rgba(22, 163, 74, 0.4)',
        duration: 0.15,
        ease: 'power2.out',
        transformOrigin: 'center center',
        force3D: true,
      })
        // Step 2: Bounce back
        .to(linkRef.current, {
          scale: 1.0,
          boxShadow: '0 4px 12px rgba(22, 163, 74, 0.3)',
          duration: 0.2,
          ease: 'power2.inOut',
        })
        // Step 3: Subtle second pulse
        .to(linkRef.current, {
          scale: 1.04,
          duration: 0.1,
          ease: 'power1.out',
        })
        .to(linkRef.current, {
          scale: 1.0,
          duration: 0.15,
          ease: 'power1.in',
        });
    }
  }, [cart.itemCount, cart.total, removedProduct, flyingProduct]);

  // Get up to 3 most recently added items for thumbnails
  // Since items are added to the end of the array, we take the last 3
  const thumbnailItems = cart.items.slice(-3).reverse();

  return (
    <>
      {/* Removed product thumbnail - blasting out */}
      {removedProduct && (
        <div
          ref={removedThumbnailRef}
          className="w-8 h-8 rounded-full border-2 border-white overflow-hidden bg-white flex-shrink-0 shadow-lg"
        >
          {removedProduct.imageUrl || removedProduct.mainImage ? (
            <img
              src={removedProduct.imageUrl || removedProduct.mainImage}
              alt={removedProduct.name || removedProduct.productName || 'Product'}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-neutral-200 text-neutral-400 text-xs font-semibold">
              {(removedProduct.name || removedProduct.productName || 'P').charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      )}

      {/* Flying product thumbnail - going to cart */}
      {flyingProduct && (
        <div
          ref={flyingThumbnailRef}
          className="w-8 h-8 rounded-full border-2 border-white overflow-hidden bg-white flex-shrink-0 shadow-lg"
          style={{
            borderRadius: '50%',
            objectFit: 'cover',
          }}
        >
          {flyingProduct.product.imageUrl || flyingProduct.product.mainImage ? (
            <img
              src={flyingProduct.product.imageUrl || flyingProduct.product.mainImage}
              alt={flyingProduct.product.name || flyingProduct.product.productName || 'Product'}
              className="w-full h-full object-cover rounded-full"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-neutral-200 text-neutral-400 text-xs font-semibold rounded-full">
              {(flyingProduct.product.name || flyingProduct.product.productName || 'P').charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      )}

      <AnimatePresence>
        {(cart.itemCount || 0) > 0 && !shouldHidePill && (
          <motion.div
            initial={{ y: 60, opacity: 0, scale: 0.8 }}
            animate={{
              y: 0,
              opacity: 1,
              scale: 1,
            }}
            exit={{ y: 60, opacity: 0, scale: 0.8 }}
            transition={{
              type: 'spring',
              stiffness: 400,
              damping: 30,
              mass: 0.8,
            }}
            className="fixed left-0 right-0 z-40 flex justify-center px-4"
            style={{ bottom: `${bottomOffset}px` }}
          >
            <Link
              ref={linkRef}
              to={linkTo}
              className={`bg-gradient-to-r from-green-700 via-green-600 to-green-700 text-white rounded-full shadow-xl shadow-green-900/30 px-3 py-2 flex items-center gap-2 hover:from-green-800 hover:via-green-700 hover:to-green-800 transition-all duration-300 pointer-events-auto border border-green-800/30 backdrop-blur-sm ${pillClassName}`}
            >
              {/* Left: Product thumbnails */}
              <div className="flex items-center -space-x-4">
                {thumbnailItems.map((item, idx) => (
                  <motion.div
                    key={item.product._id || item.product.id || `item-${idx}`}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{
                      delay: idx * 0.1,
                      type: 'spring',
                      stiffness: 500,
                      damping: 25,
                    }}
                    className="w-7 h-7 rounded-full border-2 border-white/90 overflow-hidden bg-white flex-shrink-0 shadow-md"
                  >
                    {item.product.imageUrl || item.product.mainImage ? (
                      <img
                        src={item.product.imageUrl || item.product.mainImage}
                        alt={item.product.name || item.product.productName || 'Product'}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-neutral-200 text-neutral-400 text-xs font-semibold">
                        {(item.product.name || item.product.productName || 'P').charAt(0).toUpperCase()}
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>

              {/* Middle: Text */}
              <motion.div
                className="flex flex-col"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1, duration: 0.3 }}
              >
                <span className="text-xs font-bold leading-tight drop-shadow-sm">View cart</span>
                <span className="text-[10px] opacity-95 leading-tight font-medium">
                  {cart.itemCount} {cart.itemCount === 1 ? 'item' : 'items'}
                </span>
              </motion.div>

              {/* Right: Arrow icon */}
              <motion.div
                className="ml-auto bg-white/25 rounded-full p-1 backdrop-blur-sm"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15, duration: 0.3 }}
                whileHover={{ scale: 1.1, rotate: -5 }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 16 16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="text-white"
                >
                  <path
                    d="M6 12L10 8L6 4"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </motion.div>
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

