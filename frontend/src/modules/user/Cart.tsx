import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { useTranslation } from '../../hooks/useTranslation';
import Button from '../../components/ui/button';
import { appConfig } from '../../services/configService';
import { calculateProductPrice } from '../../utils/priceUtils';

export default function Cart() {
  const { cart, updateQuantity, removeFromCart, clearCart } = useCart();
  const { t } = useTranslation();
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

  const qcItems = cart.items.filter(
    (item) => !item.product?.productType || item.product?.productType === 'QUICK_COMMERCE'
  );
  const ecomItems = cart.items.filter(
    (item) => item.product?.productType === 'ECOMMERCE'
  );
  const isMixed = qcItems.length > 0 && ecomItems.length > 0;

  const handleCheckout = () => {
    if (!meetsMinimumOrder) return;
    navigate('/checkout');
  };

  if (cart.items.length === 0) {
    return (
      <div className="px-4 py-8 md:py-16 text-center">
        <div className="text-6xl md:text-8xl mb-4">🛒</div>
        <h2 className="text-xl md:text-2xl font-bold text-neutral-900 mb-2">{t("customer.emptyCart", "Your cart is empty")}</h2>
        <p className="text-neutral-600 mb-6 md:mb-8 md:text-lg">{t("customer.emptyCartPrompt", "Add some items to get started!")}</p>
        <Link to="/">
          <Button variant="default" size="lg" className="md:px-8 md:py-3 md:text-lg">
            {t("customer.startShopping", "Start Shopping")}
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
          <h1 className="text-xl md:text-2xl font-bold text-neutral-900">{t("customer.yourBasket", "Your Basket")}</h1>
          {cart.items.length > 0 && (
            <button
              onClick={clearCart}
              className="text-sm md:text-base text-red-600 font-medium hover:text-red-700 transition-colors"
            >
              {t("common.clearAll", "Clear All")}
            </button>
          )}
        </div>
        <p className="text-xs md:text-sm text-neutral-600">{t("customer.deliveredIn", "Delivered in")} {appConfig.estimatedDeliveryTime}</p>
      </div>

      {/* Mixed Basket Notice */}
      {isMixed && (
        <div className="mx-4 md:mx-6 lg:mx-8 mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2.5 text-xs text-amber-900">
          <span className="text-base">ℹ️</span>
          <span>
            <strong>Multi-Shipment Order:</strong> Your basket contains both Quick Delivery and Courier Delivery items. They will be delivered separately.
          </span>
        </div>
      )}

      {/* Cart Items Groups */}
      <div className="px-4 md:px-6 lg:px-8 space-y-6 mb-4 md:mb-6">
        {/* Quick Delivery Group */}
        {qcItems.length > 0 && (
          <div className="bg-white rounded-xl border border-emerald-200 overflow-hidden shadow-xs">
            <div className="px-4 py-3 bg-emerald-50/70 border-b border-emerald-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base">⚡</span>
                <span className="text-xs font-bold text-emerald-900 tracking-wide uppercase">
                  QUICK DELIVERY
                </span>
                <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                  {appConfig.estimatedDeliveryTime || '12–15 mins'}
                </span>
              </div>
              <span className="text-xs text-neutral-500 font-medium">
                {qcItems.length} {qcItems.length === 1 ? 'item' : 'items'}
              </span>
            </div>
            <div className="p-4 space-y-4 divide-y divide-neutral-100">
              {qcItems.map((item) => {
                const { displayPrice, mrp, hasDiscount } = calculateProductPrice(item.product, item.variant);
                const isItemWholesale = Boolean(item.isWholesale);
                const unitPrice = (isItemWholesale && item.wholesalePrice && item.wholesalePrice > 0)
                  ? item.wholesalePrice
                  : displayPrice;
                const moq = item.wholesaleMinimumQuantity || item.product.wholesaleMinimumQuantity || 1;
                const isBelowMoq = isItemWholesale && item.quantity < moq;

                return (
                  <div
                    key={item.product.id || item.product._id}
                    className="pt-4 first:pt-0 flex gap-4 md:gap-6"
                  >
                    <div className="w-16 h-16 md:w-20 md:h-20 bg-neutral-100 rounded-lg flex items-center justify-center flex-shrink-0 relative overflow-hidden">
                      {item.product.imageUrl ? (
                        <img
                          src={item.product.imageUrl}
                          alt={item.product.name}
                          className="w-full h-full object-cover rounded-lg"
                        />
                      ) : (
                        <span className="text-xl text-neutral-400">
                          {item.product.name?.charAt(0).toUpperCase()}
                        </span>
                      )}
                      <span className={`absolute bottom-0 left-0 right-0 text-white text-[9px] font-bold text-center py-0.5 ${
                        isItemWholesale ? 'bg-purple-700' : 'bg-emerald-700'
                      }`}>
                        {isItemWholesale ? '🏷️ Wholesale' : '⚡ Quick'}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap mb-1">
                        <h3 className="font-semibold text-neutral-900 text-sm md:text-base line-clamp-2">
                          {item.product.name}
                        </h3>
                        {isItemWholesale && (
                          <span className="text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-200 px-1.5 py-0.2 rounded">
                            Wholesale (MOQ: {moq})
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-neutral-500 mb-1">{item.product.pack}</p>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm md:text-base font-bold text-neutral-900">
                          ₹{unitPrice.toLocaleString('en-IN')}
                        </span>
                        {hasDiscount && !isItemWholesale && (
                          <span className="text-xs text-neutral-500 line-through">
                            ₹{mrp.toLocaleString('en-IN')}
                          </span>
                        )}
                      </div>

                      {isBelowMoq && (
                        <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 px-2 py-1 rounded mb-2 flex items-center gap-1">
                          <span>⚠️</span>
                          <span>Quantity ({item.quantity}) is below wholesale MOQ ({moq} units)</span>
                        </div>
                      )}

                      <div className="flex items-center gap-3">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => updateQuantity(item.product.id, item.quantity - 1, item.variant)}
                          className="w-7 h-7 md:w-8 md:h-8 p-0 border-neutral-300 text-neutral-600 hover:border-green-600 hover:text-green-600"
                        >
                          −
                        </Button>
                        <span className="text-sm font-semibold text-neutral-900 min-w-[1.5rem] text-center">
                          {item.quantity}
                        </span>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => updateQuantity(item.product.id, item.quantity + 1, item.variant)}
                          className="w-7 h-7 md:w-8 md:h-8 p-0 border-neutral-300 text-neutral-600 hover:border-green-600 hover:text-green-600"
                        >
                          +
                        </Button>
                        <div className="ml-auto text-right font-bold text-sm text-neutral-900">
                          ₹{(unitPrice * item.quantity).toFixed(0)}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => removeFromCart(item.product.id)}
                      className="text-neutral-400 hover:text-red-600 transition-colors self-start text-sm"
                      aria-label="Remove item"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Courier Delivery Group */}
        {ecomItems.length > 0 && (
          <div className="bg-white rounded-xl border border-blue-200 overflow-hidden shadow-xs">
            <div className="px-4 py-3 bg-blue-50/70 border-b border-blue-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base">📦</span>
                <span className="text-xs font-bold text-blue-900 tracking-wide uppercase">
                  COURIER DELIVERY
                </span>
                <span className="text-[11px] font-semibold text-blue-800 bg-blue-100 px-2 py-0.5 rounded-full">
                  Delivery estimate shown at checkout
                </span>
              </div>
              <span className="text-xs text-neutral-500 font-medium">
                {ecomItems.length} {ecomItems.length === 1 ? 'item' : 'items'}
              </span>
            </div>
            <div className="p-4 space-y-4 divide-y divide-neutral-100">
              {ecomItems.map((item) => {
                const { displayPrice, mrp, hasDiscount } = calculateProductPrice(item.product, item.variant);
                const isItemWholesale = Boolean(item.isWholesale);
                const unitPrice = (isItemWholesale && item.wholesalePrice && item.wholesalePrice > 0)
                  ? item.wholesalePrice
                  : displayPrice;
                const moq = item.wholesaleMinimumQuantity || item.product.wholesaleMinimumQuantity || 1;
                const isBelowMoq = isItemWholesale && item.quantity < moq;

                return (
                  <div
                    key={item.product.id || item.product._id}
                    className="pt-4 first:pt-0 flex gap-4 md:gap-6"
                  >
                    <div className="w-16 h-16 md:w-20 md:h-20 bg-neutral-100 rounded-lg flex items-center justify-center flex-shrink-0 relative overflow-hidden">
                      {item.product.imageUrl ? (
                        <img
                          src={item.product.imageUrl}
                          alt={item.product.name}
                          className="w-full h-full object-cover rounded-lg"
                        />
                      ) : (
                        <span className="text-xl text-neutral-400">
                          {item.product.name?.charAt(0).toUpperCase()}
                        </span>
                      )}
                      <span className={`absolute bottom-0 left-0 right-0 text-white text-[9px] font-bold text-center py-0.5 ${
                        isItemWholesale ? 'bg-purple-700' : 'bg-blue-700'
                      }`}>
                        {isItemWholesale ? '🏷️ Wholesale' : '📦 Courier'}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap mb-1">
                        <h3 className="font-semibold text-neutral-900 text-sm md:text-base line-clamp-2">
                          {item.product.name}
                        </h3>
                        {isItemWholesale && (
                          <span className="text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-200 px-1.5 py-0.2 rounded">
                            Wholesale (MOQ: {moq})
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-neutral-500 mb-1">{item.product.pack}</p>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm md:text-base font-bold text-neutral-900">
                          ₹{unitPrice.toLocaleString('en-IN')}
                        </span>
                        {hasDiscount && !isItemWholesale && (
                          <span className="text-xs text-neutral-500 line-through">
                            ₹{mrp.toLocaleString('en-IN')}
                          </span>
                        )}
                      </div>

                      {isBelowMoq && (
                        <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 px-2 py-1 rounded mb-2 flex items-center gap-1">
                          <span>⚠️</span>
                          <span>Quantity ({item.quantity}) is below wholesale MOQ ({moq} units)</span>
                        </div>
                      )}

                      <div className="flex items-center gap-3">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => updateQuantity(item.product.id, item.quantity - 1, item.variant)}
                          className="w-7 h-7 md:w-8 md:h-8 p-0 border-neutral-300 text-neutral-600 hover:border-green-600 hover:text-green-600"
                        >
                          −
                        </Button>
                        <span className="text-sm font-semibold text-neutral-900 min-w-[1.5rem] text-center">
                          {item.quantity}
                        </span>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => updateQuantity(item.product.id, item.quantity + 1, item.variant)}
                          className="w-7 h-7 md:w-8 md:h-8 p-0 border-neutral-300 text-neutral-600 hover:border-green-600 hover:text-green-600"
                        >
                          +
                        </Button>
                        <div className="ml-auto text-right font-bold text-sm text-neutral-900">
                          ₹{(unitPrice * item.quantity).toFixed(0)}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => removeFromCart(item.product.id)}
                      className="text-neutral-400 hover:text-red-600 transition-colors self-start text-sm"
                      aria-label="Remove item"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Order Summary */}
      <div className="px-4 md:px-6 lg:px-8 mb-24 md:mb-8">
        <div className="bg-white rounded-xl border border-neutral-200 p-4 md:p-6 shadow-sm md:max-w-md md:ml-auto">
          <h2 className="text-lg md:text-xl font-bold text-neutral-900 mb-4 md:mb-6">{t("customer.orderSummary", "Order Summary")}</h2>
          <div className="space-y-3 md:space-y-4 mb-4 md:mb-6">
            <div className="flex justify-between text-neutral-700 md:text-base">
              <span>{t("customer.subtotal", "Subtotal")}</span>
              <span className="font-medium">₹{cart.total.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between text-neutral-700 md:text-base">
              <span>{t("customer.platformFee", "Platform Fee")}</span>
              <span className="font-medium">₹{platformFee.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between text-neutral-700 md:text-base">
              <span>{t("customer.deliveryCharges", "Delivery Charges")}</span>
              <span className={`font-medium ${deliveryFee === 0 ? 'text-green-600' : ''}`}>
                {deliveryFee === 0 ? t("customer.free", "Free") : `₹${deliveryFee.toLocaleString('en-IN')}`}
              </span>
            </div>
          </div>
          <div className="border-t border-neutral-200 pt-4 md:pt-6">
            <div className="flex justify-between items-center mb-4 md:mb-6">
              <span className="text-lg md:text-xl font-bold text-neutral-900">{t("common.total", "Total")}</span>
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
                ? t("customer.proceedToCheckout", "Proceed to Checkout")
                : `Add ₹${amountNeededForMinimumOrder.toLocaleString('en-IN')} more`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

