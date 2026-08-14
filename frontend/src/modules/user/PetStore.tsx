import { useNavigate, Link } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { useLocation } from '../../hooks/useLocation';
import { motion, AnimatePresence } from 'framer-motion';
import Button from '../../components/ui/button';
import { Product } from '../../types/domain';
import { useEffect, useState } from 'react';
import { getProducts } from '../../services/api/customerProductService';
import WishlistButton from '../../components/WishlistButton';
import { calculateProductPrice } from '../../utils/priceUtils';

export default function PetStore() {
  const navigate = useNavigate();
  const { cart, addToCart, updateQuantity } = useCart();
  const { location: userLocation } = useLocation();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        const response = await getProducts({ category: 'pet' });
        setProducts(response.data as unknown as Product[]);
      } catch (error) {
        console.error('Failed to fetch pet products:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <div className="relative w-full">
        <img
          src="/assets/shopbystore/pet.jpg"
          alt="Pet Store"
          className="w-full h-full object-cover"
        />

        <header className="absolute top-0 left-0 right-0 z-10">
          <div className="px-3 py-2 flex items-center justify-between gap-2">
            <button
              onClick={() => navigate(-1)}
              className="w-9 h-9 rounded-full flex items-center justify-center backdrop-blur-lg bg-white/70 shadow-sm hover:bg-white/80 transition-colors flex-shrink-0 border border-white/20"
              aria-label="Go back"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M15 18L9 12L15 6" stroke="#000000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            <div className="flex-1 min-w-0 px-2">
              <div className="text-[10px] text-neutral-600 leading-tight">Delivering to▾</div>
              <div className="text-[10px] text-neutral-700 font-medium leading-tight line-clamp-1">
                {userLocation?.address || 'Set your location'}
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                onClick={() => navigate('/search')}
                className="w-9 h-9 rounded-full flex items-center justify-center backdrop-blur-lg bg-white/70 shadow-sm hover:bg-white/80 transition-colors border border-white/20"
                aria-label="Search"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="11" cy="11" r="8" stroke="#000000" strokeWidth="2" />
                  <path d="m21 21-4.35-4.35" stroke="#000000" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
              <button
                className="w-9 h-9 rounded-full flex items-center justify-center backdrop-blur-lg bg-white/70 shadow-sm hover:bg-white/80 transition-colors border border-white/20"
                aria-label="Share"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M18 8A3 3 0 1 0 15 4.09M6 15a3 3 0 1 0 2.91-3M13 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0zm6 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" stroke="#000000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </div>
        </header>

        <div
          className="absolute bottom-0 left-0 right-0 h-20 pointer-events-none"
          style={{
            background: 'linear-gradient(to bottom, transparent 0%, rgba(255, 255, 255, 0.2) 50%, rgba(255, 255, 255, 0.6) 80%, rgba(255, 255, 255, 1) 100%)'
          }}
        />
      </div>

      <div className="px-4 py-4">
        <h3 className="text-lg font-semibold text-neutral-900 mb-4">Top buys</h3>

        {loading ? (
          <div className="flex justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {products.map((product) => {
              const cartItem = cart.items.find((item) => item?.product && item.product.id === product.id);
              const inCartQty = cartItem?.quantity || 0;
              const { displayPrice, mrp, discount, hasDiscount } = calculateProductPrice(product);

              return (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="bg-white rounded-lg overflow-hidden flex flex-col relative"
                  style={{ boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)' }}
                >
                  <Link to={`/product/${product.id}`} className="relative block">
                    <div className="w-full h-20 bg-neutral-100 flex items-center justify-center overflow-hidden relative">
                      {product.imageUrl ? (
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-neutral-100 text-neutral-400 text-2xl">
                          {product.name.charAt(0).toUpperCase()}
                        </div>
                      )}

                      <WishlistButton
                        productId={product.id}
                        size="sm"
                        className="top-1 right-1 shadow-sm"
                      />
                    </div>
                  </Link>

                  <div className="p-1.5 flex-1 flex flex-col" style={{ background: '#fef9e7' }}>
                    <div className="text-[8px] text-neutral-600 mb-0.5 line-clamp-1">
                      {product.pack}
                    </div>

                    <Link to={`/product/${product.id}`} className="mb-0.5">
                      <h3 className="text-[10px] font-bold text-neutral-900 line-clamp-2 leading-tight">
                        {product.name}
                      </h3>
                    </Link>

                    <div className="flex items-center gap-0.5 mb-0.5">
                      <div className="flex items-center">
                        {[...Array(5)].map((_, i) => (
                          <svg
                            key={i}
                            width="8"
                            height="8"
                            viewBox="0 0 24 24"
                            fill={i < Math.floor(product.rating || 0) ? '#fbbf24' : '#e5e7eb'}
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                          </svg>
                        ))}
                      </div>
                      <span className="text-[8px] text-neutral-500">({(product.reviews || 0).toLocaleString()})</span>
                    </div>

                    <div className="text-[9px] text-neutral-600 mb-0.5">
                      15 MINS
                    </div>

                    {hasDiscount && (
                      <div className="text-[9px] text-blue-600 font-semibold mb-0.5">
                        {discount}% OFF
                      </div>
                    )}

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

                    <AnimatePresence mode="wait">
                      {inCartQty === 0 ? (
                        <motion.div
                          key="add-button"
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          transition={{ duration: 0.2 }}
                          className="flex justify-center w-full"
                        >
                          <Button
                            variant="outline"
                            size="default"
                            onClick={(e) => {
                              e.stopPropagation();
                              addToCart(product);
                            }}
                            className="w-full border-2 border-green-600 text-green-600 bg-transparent hover:bg-green-50 rounded-full font-semibold text-[10px] h-7 px-2"
                          >
                            ADD
                          </Button>
                        </motion.div>
                      ) : (
                        <motion.div
                          key="stepper"
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          transition={{ duration: 0.2 }}
                          className="flex items-center justify-center gap-1.5 bg-white border-2 border-green-600 rounded-full px-1.5 py-1 w-full"
                        >
                          <motion.div whileTap={{ scale: 0.9 }}>
                            <Button
                              variant="default"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                updateQuantity(product.id, inCartQty - 1);
                              }}
                              className="w-6 h-6 p-0 text-xs"
                              aria-label="Decrease quantity"
                            >
                              −
                            </Button>
                          </motion.div>
                          <motion.span
                            key={inCartQty}
                            initial={{ scale: 1.2, y: -4 }}
                            animate={{ scale: 1, y: 0 }}
                            transition={{ type: 'spring', stiffness: 500, damping: 15 }}
                            className="text-xs font-bold text-green-600 min-w-[1rem] text-center"
                          >
                            {inCartQty}
                          </motion.span>
                          <motion.div whileTap={{ scale: 0.9 }}>
                            <Button
                              variant="default"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                updateQuantity(product.id, inCartQty + 1);
                              }}
                              className="w-6 h-6 p-0 text-xs"
                              aria-label="Increase quantity"
                            >
                              +
                            </Button>
                          </motion.div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <Link
                      to={`/category/pet`}
                      className="w-full bg-green-100 text-green-700 text-[8px] font-medium py-0.5 rounded-lg flex items-center justify-between px-1 hover:bg-green-200 transition-colors mt-1"
                    >
                      <span>See more like this</span>
                      <svg width="6" height="6" viewBox="0 0 8 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M0 0L8 4L0 8Z" fill="#16a34a" />
                      </svg>
                    </Link>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

