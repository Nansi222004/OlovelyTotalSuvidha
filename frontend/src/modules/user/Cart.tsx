import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import Button from '../../components/ui/button';
import { appConfig } from '../../services/configService';
import { calculateProductPrice } from '../../utils/priceUtils';

export default function Cart() {
  const { cart, updateQuantity, removeFromCart, clearCart } = useCart();
  const navigate = useNavigate();

  useEffect(() => {
    if (cart.items.length > 0) {
      navigate('/checkout', { replace: true });
    }
  }, [cart.items.length, navigate]);

  const freeDeliveryThreshold = cart.freeDeliveryThreshold ?? appConfig.freeDeliveryThreshold;
  const platformFee = cart.platformFee ?? appConfig.platformFee;
  const deliveryFee = cart.estimatedDeliveryFee ??
    (cart.total >= freeDeliveryThreshold ? 0 : appConfig.deliveryFee);
  const totalAmount = cart.total + deliveryFee + platformFee;
  const minimumOrderValue = cart.minimumOrderValue ?? 0;
  const meetsMinimumOrder = minimumOrderValue <= 0 || cart.total >= minimumOrderValue;
  const amountNeededForMinimumOrder = Math.max(0, minimumOrderValue - cart.total);

  const handleCheckout = () => {
    if (!meetsMinimumOrder) return;
    navigate('/checkout');
  };

  if (cart.items.length === 0) {
    return (
      <div className="px-4 py-8 md:py-16 text-center">
        <div className="text-6xl md:text-8xl mb-4">🛒</div>
        <h2 className="text-xl md:text-2xl font-bold text-neutral-900 mb-2">Your cart is empty</h2>
        <p className="text-neutral-600 mb-6 md:mb-8 md:text-lg">Add some items to get started!</p>
        <Link to="/">
          <Button variant="default" size="lg" className="md:px-8 md:py-3 md:text-lg">
            Start Shopping
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="pb-4 md:pb-8">
      {/* Header */}
      <div className="px-4 md:px-6 lg:px-8 py-4 md:py-6 bg-white border-b border-neutral-200 mb-4 md:mb-6 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-xl md:text-2xl font-bold text-neutral-900">Your Basket</h1>
          {cart.items.length > 0 && (
            <button
              onClick={clearCart}
              className="text-sm md:text-base text-red-600 font-medium hover:text-red-700 transition-colors"
            >
              Clear All
            </button>
          )}
        </div>
        <p className="text-xs md:text-sm text-neutral-600">Delivered in {appConfig.estimatedDeliveryTime}</p>
      </div>

      {/* Cart Items */}
      <div className="px-4 md:px-6 lg:px-8 space-y-4 md:space-y-6 mb-4 md:mb-6">
        {cart.items.map((item) => {
          const { displayPrice, mrp, hasDiscount } = calculateProductPrice(item.product, item.variant);
          return (
            <div
              key={item.product.id}
              className="bg-white rounded-lg border border-neutral-200 p-4 md:p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex gap-4 md:gap-6">
                {/* Product Image */}
                <div className="w-20 h-20 md:w-24 md:h-24 bg-neutral-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  {item.product.imageUrl ? (
                    <img
                      src={item.product.imageUrl}
                      alt={item.product.name}
                      className="w-full h-full object-cover rounded-lg"
                    />
                  ) : (
                    <span className="text-2xl text-neutral-400">
                      {item.product.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>

                {/* Product Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-neutral-900 mb-1 md:mb-2 line-clamp-2 md:text-lg">
                    {item.product.name}
                  </h3>
                  <p className="text-xs md:text-sm text-neutral-500 mb-2">{item.product.pack}</p>
                  <div className="flex items-center gap-2 mb-3 md:mb-4">
                    <span className="text-base md:text-lg font-bold text-neutral-900">
                      ₹{displayPrice.toLocaleString('en-IN')}
                    </span>
                    {hasDiscount && (
                      <span className="text-xs md:text-sm text-neutral-500 line-through">
                        ₹{mrp.toLocaleString('en-IN')}
                      </span>
                    )}
                  </div>

                  {/* Quantity Controls */}
                  <div className="flex items-center gap-3 md:gap-4">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => updateQuantity(item.product.id, item.quantity - 1, item.variant)}
                      className="w-8 h-8 md:w-10 md:h-10 p-0 border-neutral-300 text-neutral-600 hover:border-green-600 hover:text-green-600 md:text-lg"
                    >
                      −
                    </Button>
                    <span className="text-base md:text-lg font-semibold text-neutral-900 min-w-[2rem] md:min-w-[2.5rem] text-center">
                      {item.quantity}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => updateQuantity(item.product.id, item.quantity + 1, item.variant)}
                      className="w-8 h-8 md:w-10 md:h-10 p-0 border-neutral-300 text-neutral-600 hover:border-green-600 hover:text-green-600 md:text-lg"
                    >
                      +
                    </Button>
                    <div className="ml-auto text-right">
                      <div className="text-sm md:text-base font-bold text-neutral-900">
                        ₹{(displayPrice * item.quantity).toFixed(0)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Remove Button */}
                <button
                  onClick={() => removeFromCart(item.product.id)}
                  className="text-neutral-400 hover:text-red-600 transition-colors self-start"
                  aria-label="Remove item"
                >
                  ✕
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Order Summary */}
      <div className="px-4 md:px-6 lg:px-8 mb-24 md:mb-8">
        <div className="bg-white rounded-xl border border-neutral-200 p-4 md:p-6 shadow-sm md:max-w-md md:ml-auto">
          <h2 className="text-lg md:text-xl font-bold text-neutral-900 mb-4 md:mb-6">Order Summary</h2>
          <div className="space-y-3 md:space-y-4 mb-4 md:mb-6">
            <div className="flex justify-between text-neutral-700 md:text-base">
              <span>Subtotal</span>
              <span className="font-medium">₹{cart.total.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between text-neutral-700 md:text-base">
              <span>Platform Fee</span>
              <span className="font-medium">₹{platformFee.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between text-neutral-700 md:text-base">
              <span>Delivery Charges</span>
              <span className={`font-medium ${deliveryFee === 0 ? 'text-green-600' : ''}`}>
                {deliveryFee === 0 ? 'Free' : `₹${deliveryFee.toLocaleString('en-IN')}`}
              </span>
            </div>
            {freeDeliveryThreshold > 0 && cart.total < freeDeliveryThreshold && (
              <div className="text-xs md:text-sm text-green-600 bg-green-50 px-2 py-1 rounded">
                Add ₹{(freeDeliveryThreshold - cart.total).toLocaleString('en-IN')} more for free delivery
              </div>
            )}
            {minimumOrderValue > 0 && !meetsMinimumOrder && (
              <div className="text-xs md:text-sm text-amber-700 bg-amber-50 px-2 py-1 rounded">
                Minimum order ₹{minimumOrderValue.toLocaleString('en-IN')}. Add ₹{amountNeededForMinimumOrder.toLocaleString('en-IN')} more to checkout.
              </div>
            )}
          </div>
          <div className="border-t border-neutral-200 pt-4 md:pt-6">
            <div className="flex justify-between items-center mb-4 md:mb-6">
              <span className="text-lg md:text-xl font-bold text-neutral-900">Total</span>
              <span className="text-xl md:text-2xl font-bold text-neutral-900">
                ₹{totalAmount.toLocaleString('en-IN')}
              </span>
            </div>
            <Button
              variant="default"
              size="lg"
              onClick={handleCheckout}
              disabled={!meetsMinimumOrder}
              className="w-full md:py-3 md:text-lg"
            >
              {meetsMinimumOrder
                ? 'Proceed to Checkout'
                : `Add ₹${amountNeededForMinimumOrder.toLocaleString('en-IN')} more`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

