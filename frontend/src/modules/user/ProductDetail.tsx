import {
  useParams,
  useNavigate,
  useLocation as useRouterLocation,
} from "react-router-dom";
import { useRef, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
// import { products } from '../../data/products'; // REMOVED
// import { categories } from '../../data/categories'; // REMOVED
import { useCart } from '../../context/CartContext';
import { useToast } from '../../context/ToastContext';
import { useLocation } from '../../hooks/useLocation';
import { useLoading } from '../../context/LoadingContext';
import { useAppSettings } from '../../context/AppSettingsContext';
import Button from '../../components/ui/button';
import Badge from '../../components/ui/badge';
import { getProductById } from '../../services/api/customerProductService';
import WishlistButton from '../../components/WishlistButton';
import StarRating from '../../components/ui/StarRating';
import {
  getProductReviews,
  Review,
  ReviewStats,
} from '../../services/api/customerReviewService';
import { useTranslation } from '../../hooks/useTranslation';
import PageLoader from '../../components/PageLoader';

import { calculateProductPrice } from '../../utils/priceUtils';

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const routerLocation = useRouterLocation();
  const { t, getTranslatedField } = useTranslation();
  const { cart, addToCart, updateQuantity } = useCart();
  const { showToast } = useToast();
  const { location } = useLocation();
  const { startLoading, stopLoading } = useLoading();
  const { settings: appSettings } = useAppSettings();
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const [isProductDetailsExpanded, setIsProductDetailsExpanded] =
    useState(false);
  const [isHighlightsExpanded, setIsHighlightsExpanded] = useState(false);
  const [isInfoExpanded, setIsInfoExpanded] = useState(false);

  const [product, setProduct] = useState<any>(null);
  const [similarProducts, setSimilarProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAvailableAtLocation, setIsAvailableAtLocation] =
    useState<boolean>(true);

  const [selectedVariantIndex, setSelectedVariantIndex] = useState<number>(0);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number>(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewStats, setReviewStats] = useState<ReviewStats>({
    avgRating: 0,
    totalReviews: 0,
  });
  const [reviewPage, setReviewPage] = useState(1);
  const [reviewPages, setReviewPages] = useState(1);
  const [reviewsLoading, setReviewsLoading] = useState(false);

  useEffect(() => {
    const fetchProduct = async () => {
      if (!id) return;
      setLoading(true);
      setError(null);
      startLoading();
      try {
        // Check if navigation came from store page
        const fromStore = (routerLocation.state as any)?.fromStore === true;

        // Fetch product details with location
        const response = await getProductById(
          id,
          location?.latitude,
          location?.longitude
        );
        if (response.success && response.data) {
          const productData = response.data as any;

          // Set location availability flag
          setIsAvailableAtLocation(productData.isAvailableAtLocation !== false);

          // Get all images (main + gallery)
          const allImages = [
            productData.mainImage || productData.imageUrl || "",
            ...(productData.galleryImages || productData.galleryImageUrls || []),
          ].filter(Boolean);

          setProduct({
            ...productData,
            // Ensure all critical fields have safe defaults
            id: productData._id || productData.id,
            name: productData.productName || productData.name || "Product",
            imageUrl: productData.mainImage || productData.imageUrl || "",
            allImages: allImages,
            price: productData.price || 0,
            mrp: productData.mrp || productData.price || 0,
            pack:
              productData.variations?.[0]?.title ||
              productData.variations?.[0]?.value ||
              productData.smallDescription ||
              "Standard",
            sellerId: productData.sellerId || (productData.seller && typeof productData.seller === 'object' ? productData.seller._id : productData.seller),
          });

          // Reset selected variant and image when product changes
          setSelectedVariantIndex(0);
          setSelectedImageIndex(0);
          setSimilarProducts(response.data.similarProducts || []);


        } else {
          setProduct(null);
          setError(response.message || "Product not found");
        }
      } catch (error: any) {
        console.error("Failed to fetch product", error);
        setProduct(null);
        setError(error.message || "Something went wrong while fetching product details");
      } finally {
        setLoading(false);
        stopLoading();
      }
    };



    fetchProduct();
  }, [id, location?.latitude, location?.longitude]);

  useEffect(() => {
    const fetchReviews = async () => {
      if (!id) return;
      setReviewsLoading(true);
      try {
        const response = await getProductReviews(id, 1, 5);
        if (response.success && response.data) {
          setReviews(response.data.reviews || []);
          setReviewStats(
            response.data.stats || { avgRating: 0, totalReviews: 0 }
          );
          setReviewPage(response.data.pagination?.page || 1);
          setReviewPages(response.data.pagination?.pages || 1);
        }
      } catch (err) {
        console.error('Failed to fetch reviews', err);
      } finally {
        setReviewsLoading(false);
      }
    };

    fetchReviews();
  }, [id]);

  const loadMoreReviews = async () => {
    if (!id || reviewPage >= reviewPages || reviewsLoading) return;
    const nextPage = reviewPage + 1;
    setReviewsLoading(true);
    try {
      const response = await getProductReviews(id, nextPage, 5);
      if (response.success && response.data) {
        setReviews((prev) => [...prev, ...(response.data.reviews || [])]);
        setReviewPage(response.data.pagination?.page || nextPage);
        setReviewPages(response.data.pagination?.pages || reviewPages);
      }
    } catch (err) {
      console.error('Failed to load more reviews', err);
    } finally {
      setReviewsLoading(false);
    }
  };

  // Get selected variant
  const selectedVariant = product?.variations?.[selectedVariantIndex] || null;
  const { displayPrice: variantPrice, mrp: variantMrp, discount, hasDiscount } = calculateProductPrice(product, selectedVariantIndex);

  const variantStock = selectedVariant?.stock !== undefined ? selectedVariant.stock : (product?.stock || 0);
  const variantTitle = selectedVariant?.title || selectedVariant?.value || product?.pack || "Standard";
  const isVariantAvailable = selectedVariant?.status !== "Sold out" && (variantStock > 0);

  // Get all images for gallery
  const allImages = product?.allImages || [product?.imageUrl || ""].filter(Boolean);
  const currentImage = allImages[selectedImageIndex] || product?.imageUrl || "";

  // Minimum swipe distance (in pixels)
  const minSwipeDistance = 50;

  // Handle touch start
  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  // Handle touch move
  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  // Handle touch end - perform swipe
  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe && selectedImageIndex < allImages.length - 1) {
      setIsTransitioning(true);
      setSelectedImageIndex(selectedImageIndex + 1);
      setTimeout(() => setIsTransitioning(false), 300);
    }

    if (isRightSwipe && selectedImageIndex > 0) {
      setIsTransitioning(true);
      setSelectedImageIndex(selectedImageIndex - 1);
      setTimeout(() => setIsTransitioning(false), 300);
    }
  };

  // Get quantity in cart - check by product ID and variant if available
  const cartItem = product
    ? cart.items.find(
      (item) => {
        if (!item?.product) return false;
        const itemProductId = String(item.product.id || item.product._id);
        const productId = String(product.id || product._id);

        if (itemProductId !== productId) return false;

        // Normalize titles for comparison (remove whitespace, lowercase)
        const normalize = (s: any) => String(s || "").toLowerCase().trim().replace(/\s+/g, "");
        const currentVariantTitle = normalize(variantTitle);

        // If variant exists in current view, match by variant
        if (selectedVariant) {
          const itemVariantId = (item.product as any).variantId || (item.product as any).selectedVariant?._id;
          const itemVariantTitle = normalize((item.product as any).variantTitle || (item.product as any).pack || item.variant);

          const selectedVariantId = String(selectedVariant._id || "");

          // Match by ID if available
          if (itemVariantId && selectedVariantId && String(itemVariantId) === selectedVariantId) {
            return true;
          }

          // Fallback to Title match
          return itemVariantTitle === currentVariantTitle;
        }

        // If no variant in current view, match items that also have no variant info
        const itemVariantId = (item.product as any).variantId || (item.product as any).selectedVariant?._id;
        const itemVariantTitle = (item.product as any).variantTitle;

        // If the item in cart HAS a variant but we don't have variants here, it's still the same product
        // and we might want to show it as "In Cart" (at least in summary).
        // For ProductDetail, if there's ONLY one type of item for this product, match it.
        return !itemVariantId && !itemVariantTitle;
      }
    )
    : null;
  const inCartQty = cartItem?.quantity || 0;

  if (loading && !product) {
    return <PageLoader />;
  }

  if (error && !product) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-4 text-center bg-white">
        <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-4">
          <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Oops! Something went wrong</h3>
        <p className="text-gray-600 mb-6 max-w-xs">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-2 bg-green-600 text-white rounded-full font-medium hover:bg-green-700 transition-colors"
        >
          Try Refreshing
        </button>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-4 md:px-6 lg:px-8">
        <div className="text-center">
          <p className="text-lg md:text-xl font-semibold text-neutral-900 mb-4">
            Product not found
          </p>
          <Button onClick={() => navigate(-1)}>Go Back</Button>
        </div>
      </div>
    );
  }

  // Get category info - safe access
  const category =
    product.category && product.category.name
      ? { name: product.category.name, id: product.category._id }
      : null;

  const handleAddToCart = () => {
    if (!isAvailableAtLocation) {
      // Show toast if trying to add item outside delivery area
      showToast("This product is not available for delivery at your location.", "info");
      return;
    }
    if (!isVariantAvailable && variantStock !== 0) {
      showToast("This variant is currently out of stock.", "info");
      return;
    }
    // Create product with selected variant info
    const productWithVariant = {
      ...product,
      price: variantPrice,
      mrp: variantMrp,
      pack: variantTitle,
      selectedVariant: selectedVariant,
      variantId: selectedVariant?._id,
      variantTitle: variantTitle,
    };
    addToCart(productWithVariant, addButtonRef.current);
  };

  const handleBuyNow = async () => {
    if (!isAvailableAtLocation) {
      showToast("This product is not available for delivery at your location.", "info");
      return;
    }
    if (!isVariantAvailable && variantStock !== 0) {
      showToast("This variant is currently out of stock.", "info");
      return;
    }
    const productWithVariant = {
      ...product,
      price: variantPrice,
      mrp: variantMrp,
      pack: variantTitle,
      selectedVariant: selectedVariant,
      variantId: selectedVariant?._id,
      variantTitle: variantTitle,
    };
    if (inCartQty === 0) {
      await addToCart(productWithVariant, addButtonRef.current);
    }
    navigate('/checkout');
  };

  return (
    <div className="min-h-screen bg-white pb-24">
      {/* Header with back button and action icons */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-transparent">
        <div className="flex items-center justify-between px-4 md:px-6 lg:px-8 py-3 md:py-4">
          {/* Back button - top left */}
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 flex items-center justify-center bg-white rounded-full shadow-sm hover:bg-neutral-50 transition-colors"
            aria-label="Go back">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg">
              <path
                d="M6 9l6 6 6-6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          {/* Action icons - top right */}
          <div className="flex items-center gap-2">
            {/* Heart icon */}
            {product?.id && (
              <WishlistButton
                productId={product.id}
                size="md"
                className="bg-white rounded-full shadow-sm"
              />
            )}
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="pt-16">
        {/* Location Availability Banner */}
        {!isAvailableAtLocation && (
          <div className="bg-amber-50 border-l-4 border-amber-500 px-4 py-3 mx-4 mt-4 rounded-r-lg">
            <div className="flex items-start gap-2">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                className="flex-shrink-0 mt-0.5">
                <path d="M12 2L2 7l10 5 10-5-10-5z" fill="#f59e0b" />
                <path
                  d="M2 17l10 5 10-5M2 12l10 5 10-5"
                  stroke="#f59e0b"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-900">
                  Not available at your location
                </p>
                <p className="text-xs text-amber-800 mt-1">
                  This product cannot be delivered to your current location. You
                  can browse but cannot add to cart.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Product Image Gallery */}
        <div className="relative w-full bg-gradient-to-br from-neutral-100 to-neutral-200 overflow-hidden">
          {/* Main Product Image - Swipeable on mobile */}
          <div
            className="w-full aspect-square relative overflow-hidden"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            style={{
              touchAction: allImages.length > 1 ? 'pan-x' : 'pan-y pinch-zoom',
              cursor: allImages.length > 1 ? 'grab' : 'default',
            }}
          >
            {/* Image Container with swipe animation - Mobile swipe carousel */}
            <div
              className="w-full h-full flex transition-transform duration-300 ease-out md:hidden"
              style={{
                transform: `translateX(-${selectedImageIndex * 100}%)`,
              }}
            >
              {allImages.map((image: string, index: number) => (
                <div
                  key={index}
                  className="w-full h-full flex-shrink-0 flex items-center justify-center relative"
                  style={{ minWidth: '100%' }}
                >
                  {image ? (
                    <img
                      src={image}
                      alt={`${product.name} - Image ${index + 1}`}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                      draggable={false}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-neutral-400 text-6xl">
                      {(product.name || product.productName || "?")
                        .charAt(0)
                        .toUpperCase()}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Desktop: Single image display */}
            <div className="hidden md:flex w-full h-full items-center justify-center">
              {currentImage ? (
                <img
                  src={currentImage}
                  alt={product.name}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-neutral-400 text-6xl">
                  {(product.name || product.productName || "?")
                    .charAt(0)
                    .toUpperCase()}
                </div>
              )}
            </div>

            {/* Image Gallery Navigation - Only show if multiple images */}
            {allImages.length > 1 && (
              <>
                {/* Previous Image Button - Desktop only */}
                {selectedImageIndex > 0 && (
                  <button
                    onClick={() => {
                      setIsTransitioning(true);
                      setSelectedImageIndex(selectedImageIndex - 1);
                      setTimeout(() => setIsTransitioning(false), 300);
                    }}
                    className="hidden md:flex absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full items-center justify-center shadow-md hover:bg-white transition-colors z-10"
                    aria-label="Previous image">
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg">
                      <path
                        d="M15 18l-6-6 6-6"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                )}

                {/* Next Image Button - Desktop only */}
                {selectedImageIndex < allImages.length - 1 && (
                  <button
                    onClick={() => {
                      setIsTransitioning(true);
                      setSelectedImageIndex(selectedImageIndex + 1);
                      setTimeout(() => setIsTransitioning(false), 300);
                    }}
                    className="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full items-center justify-center shadow-md hover:bg-white transition-colors z-10"
                    aria-label="Next image">
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg">
                      <path
                        d="M9 18l6-6-6-6"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                )}

                {/* Image Indicators - Show on both mobile and desktop */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
                  {allImages.map((_: string, index: number) => (
                    <button
                      key={index}
                      onClick={() => {
                        setIsTransitioning(true);
                        setSelectedImageIndex(index);
                        setTimeout(() => setIsTransitioning(false), 300);
                      }}
                      className={`w-2 h-2 rounded-full transition-all ${index === selectedImageIndex
                        ? "bg-white w-6"
                        : "bg-white/50 hover:bg-white/75"
                        }`}
                      aria-label={`Go to image ${index + 1}`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Thumbnail Gallery - Show below main image if multiple images */}
          {allImages.length > 1 && (
            <div className="px-4 py-2 bg-white/50 backdrop-blur-sm mb-4">
              {/* Mobile swipe hint */}
              <div className="md:hidden flex items-center justify-center gap-1 mb-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-neutral-500">
                  <path d="M7 12l5-5M17 12l-5-5M12 7l-5 5M12 17l5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="text-xs text-neutral-500">Swipe to view more</span>
              </div>
              <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2 scroll-smooth">
                {allImages.map((image: string, index: number) => (
                  <button
                    key={index}
                    onClick={() => {
                      setIsTransitioning(true);
                      setSelectedImageIndex(index);
                      setTimeout(() => setIsTransitioning(false), 300);
                    }}
                    className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${index === selectedImageIndex
                      ? "border-green-600 ring-2 ring-green-200"
                      : "border-neutral-200 hover:border-neutral-300"
                      }`}>
                    <img
                      src={image}
                      alt={`${product.name} - Image ${index + 1}`}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Product Details Card - White section */}
        <div className="bg-white rounded-t-3xl -mt-6 relative z-10 px-4 md:px-6 lg:px-8 pt-2.5 md:pt-4 pb-2 md:pb-4">
          {/* Delivery time */}
          <div className="flex items-center gap-0.5 mb-1">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg">
              <circle
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="2"
              />
              <path
                d="M12 6v6l4 2"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            <span className="text-sm text-neutral-700 font-medium">
              17 MINS
            </span>
          </div>

          {/* Product name */}
          <h2 className="text-lg md:text-2xl font-bold text-neutral-900 mb-0 leading-tight">
            {getTranslatedField(product, "name")}
          </h2>

          {/* Aggregate rating */}
          <div className="mt-1.5 mb-1">
            <StarRating
              rating={
                reviewStats.avgRating ||
                product.rating ||
                0
              }
              reviewCount={
                reviewStats.totalReviews ||
                product.reviewsCount ||
                product.reviews ||
                0
              }
              size="md"
            />
          </div>

          {/* Variant Selection - Only show if multiple variants */}
          {product.variations && product.variations.length > 1 && (
            <div className="mb-2">
              <label className="block text-xs md:text-sm font-medium text-neutral-700 mb-1.5">
                Select {product.variationType || "Variant"}:
              </label>
              <div className="flex flex-wrap gap-2">
                {product.variations.map((variant: any, index: number) => {
                  const variantTitle = variant.title || variant.value || `Variant ${index + 1}`;
                  const isOutOfStock = variant.status === "Sold out" || (variant.stock === 0 && variant.stock !== undefined && variant.stock !== null);
                  const isSelected = index === selectedVariantIndex;

                  return (
                    <button
                      key={index}
                      onClick={() => setSelectedVariantIndex(index)}
                      disabled={isOutOfStock}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all border-2 ${isSelected
                        ? "border-green-600 bg-green-50 text-green-700"
                        : isOutOfStock
                          ? "border-neutral-200 bg-neutral-100 text-neutral-400 cursor-not-allowed"
                          : "border-neutral-300 bg-white text-neutral-700 hover:border-green-500 hover:bg-green-50"
                        }`}>
                      {variantTitle}
                      {isOutOfStock && (
                        <span className="ml-1 text-xs">(Out of Stock)</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quantity/Pack */}
          <p className="text-sm md:text-base text-neutral-600 mb-1">
            {variantTitle}
          </p>

          {/* Price section */}
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="text-xl font-bold text-neutral-900">
              ₹{variantPrice.toLocaleString('en-IN')}
            </span>
            {hasDiscount && (
              <>
                <span className="text-sm text-neutral-500 line-through">
                  ₹{variantMrp.toLocaleString('en-IN')}
                </span>
                {discount > 0 && (
                  <Badge className="!bg-blue-500 !text-white !border-blue-500 text-xs px-1.5 py-0.5 rounded-full font-semibold">
                    {discount}% OFF
                  </Badge>
                )}
              </>
            )}
          </div>

          {/* Stock Status */}
          {variantStock !== 0 && variantStock !== undefined && variantStock !== null && (
            <p className="text-sm text-neutral-600 mb-1">
              {variantStock > 0 ? `${variantStock} in stock` : "Out of stock"}
            </p>
          )}

          {/* Divider line */}
          <div className="border-t border-neutral-200 mb-1.5"></div>

          {/* View product details link */}
          <button
            onClick={() =>
              setIsProductDetailsExpanded(!isProductDetailsExpanded)
            }
            className="flex items-center gap-0.5 text-sm text-green-600 font-medium">
            View product details
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className={`transition-transform ${isProductDetailsExpanded ? "rotate-180" : ""
                }`}>
              <path
                d="M6 9l6 6 6-6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        {/* Expanded Product Details Section */}
        {isProductDetailsExpanded && (
          <div className="mt-1.5">
            {/* Service Guarantees Card */}
            <div className="bg-white rounded-lg p-3 mb-2">
              <div className="grid grid-cols-3 gap-2">
                {/* Replacement */}
                <div className="flex flex-col items-center">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="mb-1">
                    <path
                      d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3M20.49 15a9 9 0 0 1-14.85 3"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span className="text-sm font-bold text-neutral-900">
                    48 hours
                  </span>
                  <span className="text-xs text-neutral-600">
                    Replacement
                  </span>
                </div>

                {/* Support */}
                <div className="flex flex-col items-center">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="mb-1">
                    <path
                      d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M13 8H7M17 12H7"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="text-sm font-bold text-neutral-900">
                    24/7
                  </span>
                  <span className="text-xs text-neutral-600">Support</span>
                </div>

                {/* Delivery */}
                <div className="flex flex-col items-center">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="mb-1">
                    <path
                      d="M5 17H2l1-7h18l1 7h-3M5 17l-1-5h20l-1 5M5 17v5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5M9 22h6"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span className="text-sm font-bold text-neutral-900">
                    Fast
                  </span>
                  <span className="text-xs text-neutral-600">Delivery</span>
                </div>
              </div>
            </div>

            {/* Highlights Section */}
            <div className="bg-neutral-100 rounded-lg mb-2 overflow-hidden">
              <button
                onClick={() => setIsHighlightsExpanded(!isHighlightsExpanded)}
                className="w-full px-2 py-2.5 flex items-center justify-between bg-neutral-100">
                <span className="text-sm font-semibold text-neutral-700">
                  Highlights
                </span>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className={`transition-transform ${isHighlightsExpanded ? "rotate-180" : ""
                    }`}>
                  <path
                    d="M6 9l6 6 6-6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              {isHighlightsExpanded && (
                <div className="bg-white px-2 py-2">
                  <div className="space-y-1.5">
                    {product.tags && product.tags.length > 0 && (
                      <div className="flex items-start">
                        <span className="text-xs font-semibold text-neutral-800 w-[180px] flex-shrink-0">
                          Key Features:
                        </span>
                        <span className="text-xs text-neutral-600">
                          {product.tags.map((tag: string, index: number) => (
                            <span key={tag}>
                              {tag
                                .replace(/-/g, " ")
                                .split(" ")
                                .map(
                                  (word: string) =>
                                    word.charAt(0).toUpperCase() + word.slice(1)
                                )
                                .join(" ")}
                              {index < (product.tags?.length || 0) - 1
                                ? ", "
                                : ""}
                            </span>
                          ))}
                        </span>
                      </div>
                    )}
                    <div className="flex items-start">
                      <span className="text-xs font-semibold text-neutral-800 w-[180px] flex-shrink-0">
                        Source:
                      </span>
                      <span className="text-xs text-neutral-600">
                        {product.madeIn || "From India"}
                      </span>
                    </div>
                    {category && (
                      <div className="flex items-start">
                        <span className="text-xs font-semibold text-neutral-800 w-[180px] flex-shrink-0">
                          Category:
                        </span>
                        <span className="text-xs text-neutral-600">
                          {category.name}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Info Section */}
            <div className="bg-neutral-100 rounded-lg overflow-hidden">
              <button
                onClick={() => setIsInfoExpanded(!isInfoExpanded)}
                className="w-full px-2 py-2.5 flex items-center justify-between bg-neutral-100">
                <span className="text-sm font-semibold text-neutral-700">
                  Info
                </span>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className={`transition-transform ${isInfoExpanded ? "rotate-180" : ""
                    }`}>
                  <path
                    d="M6 9l6 6 6-6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              {isInfoExpanded && (
                <div className="bg-white px-2 py-2">
                  <div className="space-y-1.5">
                    {product.description && (
                      <div className="flex items-start">
                        <span className="text-xs font-semibold text-neutral-800 w-[180px] flex-shrink-0">
                          {t("common.description", "Description:")}
                        </span>
                        <span className="text-xs text-neutral-600 leading-relaxed flex-1">
                          {getTranslatedField(product, "description")}
                        </span>
                      </div>
                    )}
                    <div className="flex items-start">
                      <span className="text-xs font-semibold text-neutral-800 w-[180px] flex-shrink-0">
                        Unit:
                      </span>
                      <span className="text-xs text-neutral-600">
                        {product.pack}
                      </span>
                    </div>
                    {product.fssaiLicNo && (
                      <div className="flex items-start">
                        <span className="text-xs font-semibold text-neutral-800 w-[180px] flex-shrink-0">
                          FSSAI License:
                        </span>
                        <span className="text-xs text-neutral-600">
                          {product.fssaiLicNo}
                        </span>
                      </div>
                    )}
                    <div className="flex items-start">
                      <span className="text-xs font-semibold text-neutral-800 w-[180px] flex-shrink-0">
                        Shelf Life:
                      </span>
                      <span className="text-xs text-neutral-600">
                        Refer to package
                      </span>
                    </div>
                    <div className="flex items-start">
                      <span className="text-xs font-semibold text-neutral-800 w-[180px] flex-shrink-0">
                        Disclaimer:
                      </span>
                      <span className="text-xs text-neutral-600 leading-relaxed flex-1">
                        Every effort is made to maintain accuracy of all
                        Information. However, actual product packaging and
                        materials may contain more and/or different information.
                        It is recommended not to solely rely on the information
                        presented.
                      </span>
                    </div>
                    <div className="flex items-start">
                      <span className="text-xs font-semibold text-neutral-800 w-[180px] flex-shrink-0">
                        Customer Care Details:
                      </span>
                      <span className="text-xs text-neutral-600">
                        Email: {appSettings?.supportEmail || appSettings?.contactEmail || 'OLOVELYTOTALSUVIDHA@GMAIL.COM'} | Phone: +91 {appSettings?.supportPhone || appSettings?.contactPhone || '9601715367'}
                      </span>
                    </div>
                    <div className="flex items-start">
                      <span className="text-xs font-semibold text-neutral-800 w-[180px] flex-shrink-0">
                        Country of Origin:
                      </span>
                      <span className="text-xs text-neutral-600">
                        {product.madeIn || "India"}
                      </span>
                    </div>
                    {product.manufacturer && (
                      <div className="flex items-start">
                        <span className="text-xs font-semibold text-neutral-800 w-[180px] flex-shrink-0">
                          Manufacturer:
                        </span>
                        <span className="text-xs text-neutral-600 leading-relaxed flex-1">
                          {product.manufacturer}
                        </span>
                      </div>
                    )}
                    {/* Marketer same as manufacturer if not present, or hidden */}

                    <div className="flex items-start">
                      <span className="text-xs font-semibold text-neutral-800 w-[180px] flex-shrink-0">
                        Return Policy:
                      </span>
                      <span className="text-xs text-neutral-600 leading-relaxed flex-1">
                        {product.isReturnable
                          ? `This product is returnable within ${product.maxReturnDays || 2
                          } days.`
                          : "This product is non-returnable."}
                      </span>
                    </div>
                    {product.showSellerDetails !== false && (product.seller || product.sellerId) && (typeof product.seller !== 'object' || (product.seller as any).viewCustomerDetails !== false) && (
                      <>
                        <div className="flex items-start">
                          <span className="text-xs font-semibold text-neutral-800 w-[180px] flex-shrink-0">
                            Seller:
                          </span>
                          <span className="text-xs text-neutral-600 leading-relaxed flex-1">
                            {product.seller && typeof product.seller === 'object' ? (
                              product.seller.sellerName || product.seller.storeName
                            ) : (
                              `Olovely Partner (${String(product.sellerId || product.seller || '').slice(-6).toUpperCase()})`
                            )}
                          </span>
                        </div>
                        {product.seller && typeof product.seller === 'object' && product.seller.city && (
                          <div className="flex items-start">
                            <span className="text-xs font-semibold text-neutral-800 w-[180px] flex-shrink-0">
                              Seller Location:
                            </span>
                            <span className="text-xs text-neutral-600 leading-relaxed flex-1">
                              {product.seller.city}
                            </span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}



        {/* Customer Reviews */}
        <div className="mt-4 mb-4 px-4 md:px-6 lg:px-8">
          <div className="bg-white rounded-xl border border-neutral-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base md:text-lg font-semibold text-neutral-900">
                {t("product.ratingsAndReviews", "Ratings & Reviews")}
              </h3>
              {(reviewStats.totalReviews > 0 || product.rating > 0) && (
                <StarRating
                  rating={reviewStats.avgRating || product.rating || 0}
                  reviewCount={
                    reviewStats.totalReviews ||
                    product.reviewsCount ||
                    product.reviews ||
                    0
                  }
                  size="sm"
                />
              )}
            </div>

            {reviewsLoading && reviews.length === 0 ? (
              <p className="text-sm text-neutral-500 py-4 text-center">
                {t("product.loadingReviews", "Loading reviews...")}
              </p>
            ) : reviews.length === 0 ? (
              <p className="text-sm text-neutral-500 py-4 text-center">
                {t("product.noReviewsYet", "No reviews yet. Be the first to review after your order is delivered.")}
              </p>
            ) : (
              <div className="space-y-4">
                {reviews.map((review) => (
                  <div
                    key={review._id}
                    className="border-b border-neutral-100 last:border-0 pb-3 last:pb-0"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="text-sm font-medium text-neutral-900">
                        {review.customer?.name || 'Customer'}
                      </p>
                      <span className="text-[11px] text-neutral-400">
                        {new Date(review.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                    <StarRating
                      rating={review.rating}
                      showCount={false}
                      size="sm"
                      className="mb-1"
                    />
                    {review.title && (
                      <p className="text-sm font-semibold text-neutral-800">
                        {review.title}
                      </p>
                    )}
                    {review.comment && (
                      <p className="text-sm text-neutral-600 mt-0.5">
                        {review.comment}
                      </p>
                    )}
                  </div>
                ))}

                {reviewPage < reviewPages && (
                  <button
                    type="button"
                    onClick={loadMoreReviews}
                    disabled={reviewsLoading}
                    className="w-full text-sm font-medium text-green-700 py-2 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {reviewsLoading ? 'Loading...' : 'Load more reviews'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Top products in this category */}
        {similarProducts.length > 0 && (
          <div className="mt-6 mb-24">
            <div className="bg-neutral-100/50 border-t border-b border-neutral-200/50 py-4 px-3">
              <h3 className="text-lg font-semibold text-neutral-900 mb-4 px-1">
                Top products in this category
              </h3>
              <div className="flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth pb-2 px-1">
                {similarProducts.map((similarProduct) => {
                  const similarCartItem = cart.items.find(
                    (item) =>
                      item?.product &&
                      (item.product.id === similarProduct.id ||
                        item.product.id === similarProduct._id)
                  );
                  const similarInCartQty = similarCartItem?.quantity || 0;

                  return (
                    <div
                      key={similarProduct.id}
                      className="flex-shrink-0 w-40 bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden relative">
                      {/* Heart icon - top right */}
                      <WishlistButton
                        productId={similarProduct.id || similarProduct._id}
                        size="sm"
                        className="absolute top-2 right-2 shadow-md"
                      />

                      {/* Image */}
                      <div
                        onClick={() =>
                          navigate(
                            `/product/${similarProduct.id || similarProduct._id
                            }`,
                            { state: { fromStore: true } }
                          )
                        }
                        className="w-full h-32 bg-neutral-100 flex items-center justify-center overflow-hidden cursor-pointer">
                        {similarProduct.imageUrl || similarProduct.mainImage ? (
                          <img
                            src={
                              similarProduct.imageUrl ||
                              similarProduct.mainImage
                            }
                            alt={
                              similarProduct.name || similarProduct.productName
                            }
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-neutral-100 text-neutral-400 text-2xl">
                            {(
                              similarProduct.name ||
                              similarProduct.productName ||
                              "P"
                            )
                              .charAt(0)
                              .toUpperCase()}
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="p-3">
                        <h4 className="text-sm font-semibold text-neutral-900 mb-1 line-clamp-2 min-h-[2.5rem]">
                          {similarProduct.name || similarProduct.productName}
                        </h4>
                        <p className="text-[10px] text-neutral-600 flex items-center gap-1">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                            <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                          </svg>
                          <span>{similarProduct.deliveryTime || 15} MINS</span>
                        </p>


                        {/* Price display for similar products */}
                        <div className="mb-2">
                          {(() => {
                            const { displayPrice, mrp, discount: sDiscount, hasDiscount: sHasDiscount } = calculateProductPrice(similarProduct);
                            return (
                              <div className="flex flex-col">
                                {sHasDiscount && (
                                  <Badge className="!bg-blue-500 !text-white !border-blue-500 text-[10px] px-1.5 py-0.5 rounded-full font-semibold mb-1 w-fit">
                                    {sDiscount}% OFF
                                  </Badge>
                                )}
                                <div className="flex items-center gap-1.5">
                                  <span className="text-sm font-bold text-neutral-900">
                                    ₹{displayPrice.toLocaleString('en-IN')}
                                  </span>
                                  {sHasDiscount && (
                                    <span className="text-[10px] text-neutral-500 line-through">
                                      ₹{mrp.toLocaleString('en-IN')}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })()}
                        </div>

                        {/* ADD button or Quantity stepper */}
                        <AnimatePresence mode="wait">
                          {similarInCartQty === 0 ? (
                            <motion.div
                              key="add-button"
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.8 }}
                              transition={{ duration: 0.2 }}
                              className="flex justify-center w-full">
                              <Button
                                variant="outline"
                                size="default"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  addToCart(similarProduct);
                                }}
                                className="w-full border-2 border-green-600 text-green-600 bg-transparent hover:bg-green-50 rounded-full font-semibold text-sm h-9">
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
                              className="flex items-center justify-center gap-2 bg-white border-2 border-green-600 rounded-full px-2 py-1.5 w-full">
                              <motion.div whileTap={{ scale: 0.9 }}>
                                <Button
                                  variant="default"
                                  size="icon"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    updateQuantity(
                                      similarProduct.id,
                                      similarInCartQty - 1
                                    );
                                  }}
                                  className="w-7 h-7 p-0"
                                  aria-label="Decrease quantity">
                                  −
                                </Button>
                              </motion.div>
                              <motion.span
                                key={similarInCartQty}
                                initial={{ scale: 1.2, y: -4 }}
                                animate={{ scale: 1, y: 0 }}
                                transition={{
                                  type: "spring",
                                  stiffness: 500,
                                  damping: 15,
                                }}
                                className="text-sm font-bold text-green-600 min-w-[1.5rem] text-center">
                                {similarInCartQty}
                              </motion.span>
                              <motion.div whileTap={{ scale: 0.9 }}>
                                <Button
                                  variant="default"
                                  size="icon"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    updateQuantity(
                                      similarProduct.id,
                                      similarInCartQty + 1
                                    );
                                  }}
                                  className="w-7 h-7 p-0"
                                  aria-label="Increase quantity">
                                  +
                                </Button>
                              </motion.div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sticky Footer */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-neutral-200 shadow-lg">
        <div className="px-4 py-2.5 flex items-center justify-between">
          {/* Left side - Product details */}
          <div className="flex-1">
            {/* First line - Pack size */}
            <div>
              <span className="text-sm text-neutral-900 font-medium">
                {variantTitle}
              </span>
            </div>
            {/* Second line - Price, MRP, and OFF */}
            <div className="flex items-center gap-1.5">
              <span className="text-base font-bold text-neutral-900">
                ₹{variantPrice.toLocaleString('en-IN')}
              </span>
              {hasDiscount && (
                <>
                  <span className="text-xs text-neutral-500 line-through">
                    MRP ₹{variantMrp.toLocaleString('en-IN')}
                  </span>
                  {discount > 0 && (
                    <Badge className="!bg-blue-500 !text-white !border-blue-500 text-[10px] px-1.5 py-0.5 rounded-full font-semibold">
                      {discount}% OFF
                    </Badge>
                  )}
                </>
              )}
            </div>
            {/* Third line - Inclusive of all taxes */}
            <p className="text-[11px] text-neutral-500 leading-none">
              {t("customer.inclusiveOfAllTaxes", "Inclusive of all taxes")}
            </p>
          </div>

          {/* Right side - Action Buttons (Add to Cart / Stepper AND Buy Now) */}
          <div className="ml-3 flex items-center gap-2">
            {!isAvailableAtLocation ? (
              <Button
                disabled
                className="px-5 py-2 text-sm font-semibold h-[38px] bg-neutral-100 text-neutral-400 border border-neutral-300 rounded-lg cursor-not-allowed">
                {t("customer.unavailable", "Unavailable")}
              </Button>
            ) : !isVariantAvailable ? (
              <Button
                disabled
                className="px-5 py-2 text-sm font-semibold h-[38px] bg-neutral-100 text-neutral-400 border border-neutral-300 rounded-lg cursor-not-allowed">
                {t("customer.outOfStock", "Out of Stock")}
              </Button>
            ) : (
              <>
                <AnimatePresence mode="wait">
                  {inCartQty === 0 ? (
                    <motion.div
                      key="add-button"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ duration: 0.2 }}
                      className="flex items-center">
                      <Button
                        ref={addButtonRef}
                        variant="outline"
                        size="default"
                        onClick={handleAddToCart}
                        className="px-4 py-2 text-sm font-semibold h-[38px] border-2 border-green-600 text-green-600 hover:bg-green-50 rounded-lg transition-colors whitespace-nowrap">
                        {t("customer.addToCart", "Add to Cart")}
                      </Button>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="stepper"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ duration: 0.2 }}
                      className="flex items-center gap-2 bg-white border-2 border-green-600 rounded-lg px-2 py-1 h-[38px]">
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={() => {
                          const productId = product.id || product._id;
                          const variantId = selectedVariant?._id;
                          updateQuantity(productId, inCartQty - 1, variantId, variantTitle);
                        }}
                        className="w-6 h-6 flex items-center justify-center text-green-600 font-bold hover:bg-green-50 rounded-full transition-colors border border-green-600 p-0 leading-none text-base"
                        style={{ lineHeight: 1 }}>
                        <span className="relative top-[-1px]">−</span>
                      </motion.button>
                      <motion.span
                        key={inCartQty}
                        initial={{ scale: 1.2, y: -2 }}
                        animate={{ scale: 1, y: 0 }}
                        transition={{ type: "spring", stiffness: 500, damping: 15 }}
                        className="text-sm font-bold text-green-600 min-w-[1.5rem] text-center">
                        {inCartQty}
                      </motion.span>
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={() => {
                          const productId = product.id || product._id;
                          const variantId = selectedVariant?._id;
                          updateQuantity(productId, inCartQty + 1, variantId, variantTitle);
                        }}
                        className="w-6 h-6 flex items-center justify-center text-green-600 font-bold hover:bg-green-50 rounded-full transition-colors border border-green-600 p-0 leading-none text-base"
                        style={{ lineHeight: 1 }}>
                        <span className="relative top-[-1px]">+</span>
                      </motion.button>
                    </motion.div>
                  )}
                </AnimatePresence>

                <Button
                  onClick={handleBuyNow}
                  className="px-5 py-2 text-sm font-semibold h-[38px] bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors shadow-sm whitespace-nowrap">
                  {t("customer.buyNow", "Buy Now")}
                </Button>
              </>
            )}
          </div>

        </div>
      </div>
    </div>
  );

}

