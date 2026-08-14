import { useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Product } from '../../types/domain';
import { useCart } from '../../context/CartContext';
import { useToast } from '../../context/ToastContext';
import { useWishlistContext } from '../../context/WishlistContext';
import Button from '../../components/ui/button';
import LazyImage from '../../components/LazyImage';
import { motion, AnimatePresence } from 'framer-motion';
import { calculateProductPrice } from '../../utils/priceUtils';

export default function Wishlist() {
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { showToast } = useToast();
  const { wishlistProducts, loading, removeWishlistProduct } = useWishlistContext();
  const products = useMemo(() => wishlistProducts as Product[], [wishlistProducts]);

  const handleRemove = async (productId: string) => {
    try {
      await removeWishlistProduct(productId);
    } catch (error: any) {
      console.error('Failed to remove from wishlist:', error);
      showToast(error.message || 'Failed to remove from wishlist', 'error');
    }
  };

  return (
    <div className="pb-24 md:pb-8 bg-white min-h-screen">
      <div className="px-4 py-4 bg-white border-b border-neutral-200 mb-4 sticky top-0 z-10 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <h1 className="text-xl font-bold text-neutral-900">My Wishlist</h1>
      </div>

      <div className="px-4">
        {loading ? (
          <div className="flex justify-center pt-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
          </div>
        ) : products.length > 0 ? (
          <div className="grid grid-cols-2 gap-4">
            {products.map((product) => (
              (() => {
                const productImage = product.imageUrl || product.mainImage || "";
                return (
              <motion.div
                key={product.id}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="bg-white rounded-xl border border-neutral-100 shadow-sm overflow-hidden flex flex-col relative"
              >
                <button
                  onClick={() => handleRemove(product.id)}
                  className="absolute top-2 right-2 z-10 w-8 h-8 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center text-red-500 shadow-sm"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg>
                </button>

                <Link to={`/product/${product.id}`} className="aspect-square bg-neutral-50 flex items-center justify-center p-4">
                  {product.imageUrl || product.mainImage ? (
                    <LazyImage
                      src={productImage}
                      alt={product.name}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <span className="text-4xl">📦</span>
                  )}
                </Link>

                <div className="p-3 flex-1 flex flex-col">
                  <h3 className="text-sm font-bold text-neutral-900 line-clamp-2 mb-1">{product.name}</h3>
                  <div className="text-[10px] text-neutral-500 mb-2">{product.pack}</div>
                  <div className="mt-auto flex flex-col gap-2">
                    {(() => {
                      const { displayPrice, mrp, hasDiscount } = calculateProductPrice(product);
                      return (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-bold text-neutral-900">₹{displayPrice.toLocaleString('en-IN')}</span>
                          {hasDiscount && (
                            <span className="text-xs text-neutral-500 line-through">₹{mrp.toLocaleString('en-IN')}</span>
                          )}
                        </div>
                      );
                    })()}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => addToCart(product)}
                      className="w-full border-green-600 text-green-600 hover:bg-green-50 rounded-lg h-8 text-xs font-bold"
                    >
                      ADD TO CART
                    </Button>
                  </div>
                </div>
              </motion.div>
                );
              })()
            ))}
          </div>
        ) : (
          <div className="text-center py-20 text-neutral-500">
            <div className="text-6xl mb-4">❤️</div>
            <h2 className="text-lg font-bold text-neutral-900 mb-2">Your wishlist is empty</h2>
            <p className="text-sm mb-6">Explore more and shortlist some items</p>
            <Button onClick={() => navigate('/')} className="bg-green-600 text-white rounded-full px-8">
              Start Shopping
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
