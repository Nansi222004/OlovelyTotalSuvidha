import { useLayoutEffect, useRef, useState, useEffect, useCallback } from "react";
import { gsap } from "gsap";
import { Link, useNavigate } from "react-router-dom";
import { getTheme } from "../../../utils/themes";
import { getHomeContent } from "../../../services/api/customerHomeService";
import { getSubcategories } from "../../../services/api/categoryService";
import { apiCache } from "../../../utils/apiCache";
import { useLocation } from "../../../hooks/useLocation";
import { calculateProductPrice } from "../../../utils/priceUtils";

interface PromoCard {
  id: string;
  badge: string;
  title: string;
  imageUrl?: string;
  categoryId?: string;
  slug?: string;
  bgColor?: string;
  subcategoryImages?: string[]; // Array of subcategory image URLs
}

// Icon mappings for each category
const getCategoryIcons = (categoryId: string) => {
  const iconMap: Record<string, string[]> = {
    "personal-care": ["🧴", "💧", "🧼", "💄"],
    "breakfast-instant": ["🍜", "☕", "🥛", "🍞"],
    "atta-rice": ["🌾", "🍚", "🫘", "🫒"],
    household: ["🧹", "🧽", "🧼", "🧴"],
    "home-office": ["🏠", "💼", "📦", "🎁"],
    fashion: ["👕", "👗", "👠", "👜"],
    electronics: ["📱", "💻", "⌚", "🎧"],
    "fruits-veg": ["🥬", "🥕", "🍅", "🥒"],
    "dairy-breakfast": ["🥛", "🧀", "🍞", "🥚"],
    snacks: ["🍿", "🍪", "🥨", "🍫"],
    sports: ["⚽", "🏀", "🏋️", "🎾"],
  };
  return iconMap[categoryId] || ["📦", "📦", "📦", "📦"];
};

interface PromoStripProps {
  activeTab?: string;
}

export default function PromoStrip({ activeTab = "all" }: PromoStripProps) {
  const { location } = useLocation();
  const theme = getTheme(activeTab);
  const navigate = useNavigate();
  const [categoryCards, setCategoryCards] = useState<PromoCard[]>([]);
  const [featuredProducts, setFeaturedProducts] = useState<any[]>([]);
  const [headingText, setHeadingText] = useState(theme.bannerText);
  const [saleTextValue, setSaleTextValue] = useState(theme.saleText);
  const [dateRange, setDateRange] = useState("");
  const [crazyDealsTitle, setCrazyDealsTitle] = useState("CRAZY DEALS");
  const [subcategoryImagesMap, setSubcategoryImagesMap] = useState<Record<string, string[]>>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const snowflakesRef = useRef<HTMLDivElement>(null);
  const housefullRef = useRef<HTMLDivElement>(null);
  const saleRef = useRef<HTMLDivElement>(null);
  const dateRef = useRef<HTMLDivElement>(null);
  const [currentProductIndex, setCurrentProductIndex] = useState(0);
  const priceContainerRef = useRef<HTMLDivElement>(null);
  const productNameRef = useRef<HTMLDivElement>(null);
  const productImageRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [hasData, setHasData] = useState(false);

  // Fetch subcategory images for category cards - DEFERRED for faster initial load
  const fetchSubcategoryImages = useCallback(async (cards: PromoCard[]) => {
    // Defer subcategory image fetching to not block initial render
    // Load them after a short delay to prioritize main content
    setTimeout(async () => {
      const imagesMap: Record<string, string[]> = {};

      // Fetch images in batches to avoid overwhelming the network
      const batchSize = 2;
      for (let i = 0; i < cards.length; i += batchSize) {
        const batch = cards.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async (card) => {
            const categoryId = card.categoryId;
            if (!categoryId) return;

            try {
              const response = await getSubcategories(categoryId, { limit: 4 });
              if (response.success && response.data) {
                const images = response.data
                  .filter((subcat) => subcat.subcategoryImage)
                  .map((subcat) => subcat.subcategoryImage!)
                  .slice(0, 4);

                if (images.length > 0) {
                  imagesMap[card.id] = images;
                }
              }
            } catch (error) {
              // Silently fail - emoji fallback will be used
              console.error(`Error fetching subcategories for category ${categoryId}:`, error);
            }
          })
        );
        // Small delay between batches to prevent network congestion
        if (i + batchSize < cards.length) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }

      setSubcategoryImagesMap(imagesMap);
    }, 300); // 300ms delay - allows main content to render first
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      // Check cache first before showing loading state
      const cacheKey = `home-content-${activeTab || 'all'}`;
      const cachedData = apiCache.getSync(cacheKey);

      // Only show loading if data is not cached
      if (!cachedData) {
        setLoading(true);
      }

      try {
        // Pass activeTab (header category slug) and location to filter categories
        // Use cache with 5 minute TTL for faster loading
        const response = await getHomeContent(
          activeTab,
          location?.latitude,
          location?.longitude,
          true,
          5 * 60 * 1000
        );

        // Reset current product index when fetching new data
        setCurrentProductIndex(0);

        let fetchedCards: PromoCard[] = [];
        let fetchedProducts: any[] = [];
        let newHeadingText = theme.bannerText;
        let newSaleTextValue = theme.saleText;
        let newDateRange = "";

        if (response.success && response.data) {
          // 1. Check for PromoStrip data from backend (highest priority)
          if (response.data.promoStrip && response.data.promoStrip.isActive) {
            const promoStrip = response.data.promoStrip;
            newHeadingText = promoStrip.heading || newHeadingText;
            newSaleTextValue = promoStrip.saleText || newSaleTextValue;
            // Set CRAZY DEALS title from PromoStrip
            if (promoStrip.crazyDealsTitle) {
              setCrazyDealsTitle(promoStrip.crazyDealsTitle);
            } else {
              setCrazyDealsTitle("CRAZY DEALS");
            }

            // Format date range
            if (promoStrip.startDate && promoStrip.endDate) {
              const start = new Date(promoStrip.startDate);
              const end = new Date(promoStrip.endDate);
              newDateRange = `${start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase()} - ${end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase()}`;
            }

            // Map category cards from PromoStrip
            if (promoStrip.categoryCards && promoStrip.categoryCards.length > 0) {
              fetchedCards = promoStrip.categoryCards
                .sort((a: any, b: any) => (a.order || 0) - (b.order || 0))
                .map((card: any) => {
                  const category = typeof card.categoryId === 'object' ? card.categoryId : null;
                  return {
                    id: card._id || card.categoryId?._id || card.categoryId,
                    badge: card.badge || `Up to ${card.discountPercentage || 0}% OFF`,
                    title: card.title || category?.name || "",
                    categoryId: category?._id || card.categoryId, // Use _id for fetching subcategories
                    slug: category?.slug || card.categoryId, // Use slug for navigation
                    imageUrl: category?.image,
                    bgColor: "bg-yellow-50",
                  };
                });
            }

            // Map featured products from PromoStrip
            if (promoStrip.featuredProducts && promoStrip.featuredProducts.length > 0) {
              fetchedProducts = promoStrip.featuredProducts.map((p: any) => {
                const product = typeof p === 'object' ? p : null;
                const price = Number(product?.price) || 0;
                const mrp = Number(product?.mrp) || Number(product?.compareAtPrice) || 0;
                const originalPrice = mrp > 0 ? mrp : (price > 0 ? Math.round(price * 1.2) : 999);
                const discountedPrice = price > 0 ? price : 499;

                // Try multiple image field names and fallbacks
                const imageUrl =
                  product?.mainImage ||
                  product?.mainImageUrl ||
                  product?.image ||
                  product?.imageUrl ||
                  (product?.galleryImageUrls && product.galleryImageUrls.length > 0 ? product.galleryImageUrls[0] : null) ||
                  (product?.galleryImages && product.galleryImages.length > 0 ? product.galleryImages[0] : null) ||
                  null;

                // Always prioritize productName to avoid showing category names
                const productName = product?.productName || product?.name || "Product";

                return {
                  id: product?._id || p,
                  _id: product?._id || p,
                  name: productName,
                  productName: productName, // Always use productName, never category name
                  price: price,
                  mrp: mrp,
                  originalPrice: isNaN(originalPrice) ? 999 : originalPrice,
                  discountedPrice: isNaN(discountedPrice) ? 499 : discountedPrice,
                  imageUrl: imageUrl,
                };
              });
            }
          }
          // 2. Fallback to promoCards if no PromoStrip
          else if (response.data.promoCards && response.data.promoCards.length > 0) {
            fetchedCards = response.data.promoCards;
          }
          // 3. Fallback to categories if no promo cards
          else if (
            response.data.categories &&
            response.data.categories.length > 0
          ) {
            fetchedCards = response.data.categories
              .slice(0, 4)
              .map((c: any) => ({
                id: c._id || c.id,
                badge: "Up to 50% OFF",
                title: c.name,
                categoryId: c.slug || c._id,
                bgColor: c.color || "bg-yellow-50",
              }));
          }


        }

        setCategoryCards(fetchedCards);
        setFeaturedProducts(fetchedProducts);
        setHeadingText(newHeadingText);
        setSaleTextValue(newSaleTextValue);
        setDateRange(newDateRange);
        // Reset CRAZY DEALS title if no PromoStrip data
        if (!response.data?.promoStrip || !response.data.promoStrip.isActive) {
          setCrazyDealsTitle("CRAZY DEALS");
        }
        setHasData(fetchedCards.length > 0 || fetchedProducts.length > 0);

        // Fetch subcategory images AFTER setting hasData to true
        // This allows the main content to render immediately
        if (fetchedCards.length > 0) {
          fetchSubcategoryImages(fetchedCards);
        }
      } catch (error) {
        console.error("Error fetching home content for PromoStrip:", error);
        setCategoryCards([]);
        setFeaturedProducts([]);
        setHasData(false);
      } finally {
        setLoading(false);
      }
    };
    fetchData();

    // REMOVED: Polling every 30 seconds causes unnecessary re-renders and API calls
    // If real-time updates are needed, consider using WebSockets or Server-Sent Events
    // For now, data will only refresh when activeTab changes

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, theme.bannerText, theme.saleText]);

  // Reset product index when activeTab changes or featuredProducts change
  useEffect(() => {
    setCurrentProductIndex(0);
  }, [activeTab, featuredProducts.length]);

  useLayoutEffect(() => {
    if (!hasData) return;
    const container = containerRef.current;
    if (!container) return;

    let ctx: gsap.Context | null = null;

    // Defer card animation to prioritize content rendering
    const timeoutId = setTimeout(() => {
      ctx = gsap.context(() => {
        const cards = container.querySelectorAll(".promo-card");
        if (cards.length > 0) {
          gsap.fromTo(
            cards,
            { y: 20, opacity: 0 },
            {
              y: 0,
              opacity: 1,
              duration: 0.4, // Reduced duration
              stagger: 0.05, // Reduced stagger
              ease: "power2.out", // Simpler easing
            }
          );
        }
      }, container);
    }, 100); // Start animation 100ms after render

    return () => {
      clearTimeout(timeoutId);
      if (ctx) {
        ctx.revert();
      }
    };
  }, [hasData]);

  // Snowflake animation - DEFERRED for faster initial load
  useLayoutEffect(() => {
    if (!hasData) return;
    const snowflakesContainer = snowflakesRef.current;
    if (!snowflakesContainer) return;

    // Defer animation start to prioritize content rendering
    const timeoutId = setTimeout(() => {
      const snowflakes = snowflakesContainer.querySelectorAll(".snowflake");

      snowflakes.forEach((snowflake, index) => {
        const delay = index * 0.3;
        const duration = 3 + Math.random() * 2; // 3-5 seconds
        const xOffset = (Math.random() - 0.5) * 40; // Random horizontal drift

        gsap.set(snowflake, {
          y: -20,
          x: xOffset,
          opacity: 0.8 + Math.random() * 0.2, // 0.8-1.0 opacity for better visibility
          scale: 0.6 + Math.random() * 0.4, // 0.6-1.0 scale for better visibility
        });

        gsap.to(snowflake, {
          y: "+=200",
          x: `+=${xOffset}`,
          duration: duration,
          delay: delay,
          ease: "none",
          repeat: -1,
        });
      });
    }, 200); // Start animation 200ms after render

    return () => {
      clearTimeout(timeoutId);
      const snowflakes = snowflakesContainer.querySelectorAll(".snowflake");
      snowflakes.forEach((snowflake) => {
        gsap.killTweensOf(snowflake);
      });
    };
  }, [hasData]);

  // HOUSEFULL SALE animation - SIMPLIFIED and DEFERRED for faster load
  useLayoutEffect(() => {
    if (!hasData) return;
    const housefullContainer = housefullRef.current;
    const saleText = saleRef.current;
    const dateText = dateRef.current;
    if (!housefullContainer) return;

    // Defer animation start to prioritize content rendering
    const timeoutId = setTimeout(() => {
      const letters = housefullContainer.querySelectorAll(".housefull-letter");

      // Simplified animation - single entrance animation instead of loop
      gsap.set([housefullContainer, saleText, dateText], {
        scale: 0.8,
        opacity: 0,
      });

      gsap.to([housefullContainer, saleText, dateText], {
        scale: 1,
        opacity: 1,
        duration: 0.5,
        ease: "back.out(1.7)",
      });

      // Simplified letter animation - only run once
      gsap.to(letters, {
        y: -10,
        duration: 0.15,
        stagger: 0.04,
        ease: "power2.out",
        yoyo: true,
        repeat: 1,
      });
    }, 150); // Start animation 150ms after render

    return () => {
      clearTimeout(timeoutId);
      const letters = housefullContainer.querySelectorAll(".housefull-letter");
      gsap.killTweensOf([housefullContainer, saleText, dateText, letters]);
    };
  }, [hasData]);

  // Product rotation animation
  useEffect(() => {
    if (featuredProducts.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentProductIndex((prev) => (prev + 1) % featuredProducts.length);
    }, 3000);

    return () => clearInterval(interval);
  }, [featuredProducts.length]);

  // Reset product index when featuredProducts change
  useEffect(() => {
    if (featuredProducts.length > 0 && currentProductIndex >= featuredProducts.length) {
      setCurrentProductIndex(0);
    }
  }, [featuredProducts.length, currentProductIndex]);

  // Animate product change
  useEffect(() => {
    const elements = [
      priceContainerRef.current,
      productNameRef.current,
      productImageRef.current,
    ];
    if (elements.some((el) => !el)) return;

    const tween = gsap.to(elements, {
      opacity: 0,
      x: -30,
      duration: 0.3,
      ease: "power2.in",
      onComplete: () => {
        const currentElements = [
          priceContainerRef.current,
          productNameRef.current,
          productImageRef.current,
        ];
        if (currentElements.some((el) => !el)) return;

        gsap.set(currentElements, {
          x: 30,
          opacity: 0,
        });

        gsap.to(currentElements, {
          opacity: 1,
          x: 0,
          duration: 0.4,
          ease: "power2.out",
        });
      },
    });

    return () => {
      tween.kill();
    };
  }, [currentProductIndex]);

  const currentProduct = featuredProducts.length > 0 ? featuredProducts[currentProductIndex] : null;

  // Show minimal loading state - render faster
  if (loading) {
    return (
      <div
        className="relative"
        style={{
          background: `linear-gradient(to bottom, ${theme.primary[0]}, ${theme.primary[1]}, ${theme.primary[2]}, ${theme.primary[3]}, ${theme.primary[3]})`,
          paddingTop: "12px",
          paddingBottom: "0px",
          marginTop: 0,
          minHeight: "200px"
        }}>
        <div className="h-[200px] w-full bg-transparent animate-pulse rounded-lg mx-0 mt-4" />
      </div>
    );
  }

  // Show "No active promotions" only if there are no cards AND no products
  if (!hasData || (categoryCards.length === 0 && featuredProducts.length === 0)) {
    return (
      <div className="text-center py-6 text-neutral-400 text-sm">
        No active promotions
      </div>
    );
  }

  // If no featured products but we have category cards, use a fallback product
  const displayProduct = currentProduct || {
    id: 'fallback',
    name: 'Special Offers',
    originalPrice: 999,
    discountedPrice: 499,
    imageUrl: undefined,
  };

  // Calculate prices from actual product data using utility
  const { displayPrice, mrp } = calculateProductPrice(displayProduct);

  // Fallback prices if product data is incomplete
  const finalDiscountedPrice = displayPrice > 0 ? displayPrice : (Number.isFinite(displayProduct.discountedPrice) ? displayProduct.discountedPrice : 499);
  const finalOriginalPrice = mrp > 0 ? mrp : (Number.isFinite(displayProduct.originalPrice) ? displayProduct.originalPrice : 999);

  // Ensure prices are valid numbers
  const safeOriginalPrice = Number.isFinite(finalOriginalPrice) ? Math.round(finalOriginalPrice) : 999;
  const safeDiscountedPrice = Number.isFinite(finalDiscountedPrice) ? Math.round(finalDiscountedPrice) : 499;

  // Helper function to handle product navigation
  const handleProductClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    // Get product ID - handle both string and ObjectId formats
    const productId = displayProduct?.id || displayProduct?._id;

    if (productId && productId !== 'fallback') {
      // Convert to string if it's an object
      const idString = typeof productId === 'string' ? productId : String(productId);
      if (idString && idString !== 'fallback' && idString.length > 0) {
        navigate(`/product/${idString}`);
      }
    }
  };

  return (
    <div
      className="relative"
      style={{
        background: `linear-gradient(to bottom, ${theme.primary[0]}, ${theme.primary[1]}, ${theme.primary[2]}, ${theme.primary[3]}, ${theme.primary[3]})`,
        paddingTop: "12px",
        paddingBottom: "0px",
        marginTop: 0,
      }}>
      {/* HOUSEFULL SALE Banner */}
      <div
        className="px-4 mb-3 text-center relative"
        style={{ minHeight: "80px" }}>
        {/* Snowflakes Container */}
        <div
          ref={snowflakesRef}
          className="absolute inset-0 pointer-events-none overflow-hidden"
          style={{ top: 0, bottom: "auto", height: "100px" }}>
          {/* Left side snowflakes */}
          {[...Array(8)].map((_, i) => (
            <div
              key={`left-${i}`}
              className="snowflake absolute"
              style={{
                left: `${5 + (i % 4) * 12}%`,
                top: `${Math.floor(i / 4) * 30}px`,
              }}>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                style={{
                  filter: "drop-shadow(0 0 2px rgba(255, 255, 255, 0.9))",
                }}>
                <path
                  d="M12 1V5M12 19V23M3 12H1M23 12H21M20.5 20.5L18.5 18.5M20.5 3.5L18.5 5.5M3.5 20.5L5.5 18.5M3.5 3.5L5.5 5.5M18.5 18.5L16.5 16.5M18.5 5.5L16.5 7.5M5.5 18.5L7.5 16.5M5.5 5.5L7.5 7.5"
                  stroke="rgba(255, 255, 255, 1)"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                />
                <circle cx="12" cy="12" r="1.8" fill="rgba(255, 255, 255, 1)" />
              </svg>
            </div>
          ))}
          {/* Right side snowflakes */}
          {[...Array(8)].map((_, i) => (
            <div
              key={`right-${i}`}
              className="snowflake absolute"
              style={{
                right: `${5 + (i % 4) * 12}%`,
                top: `${Math.floor(i / 4) * 30}px`,
              }}>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                style={{
                  filter: "drop-shadow(0 0 2px rgba(255, 255, 255, 0.9))",
                }}>
                <path
                  d="M12 1V5M12 19V23M3 12H1M23 12H21M20.5 20.5L18.5 18.5M20.5 3.5L18.5 5.5M3.5 20.5L5.5 18.5M3.5 3.5L5.5 5.5M18.5 18.5L16.5 16.5M18.5 5.5L16.5 7.5M5.5 18.5L7.5 16.5M5.5 5.5L7.5 7.5"
                  stroke="rgba(255, 255, 255, 1)"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                />
                <circle cx="12" cy="12" r="1.8" fill="rgba(255, 255, 255, 1)" />
              </svg>
            </div>
          ))}
        </div>

        <div className="relative z-10">
          <div className="flex items-center justify-center gap-3 mb-0">
            {/* Left Lightning Bolt */}
            <svg
              width="28"
              height="36"
              viewBox="0 0 24 30"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="flex-shrink-0">
              <path
                d="M13 2L3 14H12L11 22L21 10H12L13 2Z"
                fill="#FFD700"
                stroke="#FFA500"
                strokeWidth="0.5"
              />
            </svg>

            {/* HOUSEFULL Text */}
            <h1
              ref={housefullRef}
              className="text-3xl font-black text-white"
              style={
                {
                  fontFamily: '"Poppins", sans-serif',
                  letterSpacing: "1.5px",
                  lineHeight: "1.1",
                  textShadow:
                    `-2px -2px 0 ${theme.accentColor}, 2px -2px 0 ${theme.accentColor}, -2px 2px 0 ${theme.accentColor}, 2px 2px 0 ${theme.accentColor}, ` +
                    `-2px 0px 0 ${theme.accentColor}, 2px 0px 0 ${theme.accentColor}, 0px -2px 0 ${theme.accentColor}, 0px 2px 0 ${theme.accentColor}, ` +
                    `-1px -1px 0 ${theme.accentColor}, 1px -1px 0 ${theme.accentColor}, -1px 1px 0 ${theme.accentColor}, 1px 1px 0 ${theme.accentColor}, ` +
                    "0px 2px 0px rgba(0, 0, 0, 0.8), 0px 4px 0px rgba(0, 0, 0, 0.6), " +
                    "0px 6px 0px rgba(0, 0, 0, 0.4), 0px 8px 8px rgba(0, 0, 0, 0.3), " +
                    "2px 2px 2px rgba(0, 0, 0, 0.5)",
                } as React.CSSProperties
              }>
              {headingText.split("").map((letter, index) => (
                <span key={index} className="housefull-letter inline-block">
                  {letter}
                </span>
              ))}
            </h1>

            {/* Right Lightning Bolt */}
            <svg
              width="28"
              height="36"
              viewBox="0 0 24 30"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="flex-shrink-0"
              style={{ transform: "scaleX(-1)" }}>
              <path
                d="M13 2L3 14H12L11 22L21 10H12L13 2Z"
                fill="#FFD700"
                stroke="#FFA500"
                strokeWidth="0.5"
              />
            </svg>
          </div>

          {/* SALE Text */}
          <div
            className="flex justify-center mb-0.5"
            style={{ marginTop: "-3px" }}>
            <h2
              ref={saleRef}
              className="text-xl font-black text-white"
              style={
                {
                  fontFamily: '"Poppins", sans-serif',
                  letterSpacing: "1.5px",
                  textShadow:
                    `-1.5px -1.5px 0 ${theme.accentColor}, 1.5px -1.5px 0 ${theme.accentColor}, -1.5px 1.5px 0 ${theme.accentColor}, 1.5px 1.5px 0 ${theme.accentColor}, ` +
                    `-1.5px 0px 0 ${theme.accentColor}, 1.5px 0px 0 ${theme.accentColor}, 0px -1.5px 0 ${theme.accentColor}, 0px 1.5px 0 ${theme.accentColor}, ` +
                    `-1px -1px 0 ${theme.accentColor}, 1px -1px 0 ${theme.accentColor}, -1px 1px 0 ${theme.accentColor}, 1px 1px 0 ${theme.accentColor}, ` +
                    "0px 2px 0px rgba(0, 0, 0, 0.8), 0px 4px 0px rgba(0, 0, 0, 0.6), " +
                    "0px 6px 0px rgba(0, 0, 0, 0.4), 0px 8px 8px rgba(0, 0, 0, 0.3), " +
                    "2px 2px 2px rgba(0, 0, 0, 0.5)",
                } as React.CSSProperties
              }>
              {saleTextValue}
            </h2>
          </div>

          {/* Dates */}
          {dateRange && (
            <div
              ref={dateRef}
              className="font-bold text-xs text-center mt-1"
              style={{ color: theme.textColor }}>
              {dateRange}
            </div>
          )}
        </div>
      </div>

      {/* Main Content: Crazy Deals + Category Cards */}
      <div className="px-4 mt-2">
        <div ref={containerRef} className="flex gap-2">
          {/* Crazy Deals Section - Left */}
          <div className="flex-shrink-0 w-[100px] promo-card">
            <div
              className="h-full rounded-lg p-1 flex flex-col items-center justify-between relative overflow-hidden"
              style={{
                background: `radial-gradient(circle at center, rgba(255, 255, 255, 0.15), transparent 60%), linear-gradient(to bottom, ${theme.primary[0]}, ${theme.primary[1]}, ${theme.primary[2]})`,
                minHeight: "110px",
              }}>
              {/* CRAZY DEALS - Two lines, bigger */}
              <div className="text-center mb-1.5" style={{ marginTop: "4px" }}>
                <div
                  className="text-white font-black leading-tight"
                  style={{
                    fontSize: "13px",
                    fontFamily: "sans-serif",
                    textShadow:
                      "2px 2px 4px rgba(0, 0, 0, 0.8), 1px 1px 2px rgba(0, 0, 0, 0.9)",
                    letterSpacing: "0.5px",
                  }}>
                  {crazyDealsTitle.split(" ").map((word, idx) => (
                    <div key={idx}>{word}</div>
                  ))}
                </div>
              </div>

              {/* Price Banners - Compact */}
              <div
                ref={priceContainerRef}
                className="flex flex-col items-center mb-0.5 relative">
                {/* Original Price - Darker Gray, Smaller Banner */}
                <div
                  className="bg-neutral-600 rounded px-1.5 inline-block relative z-10"
                  style={{
                    height: "fit-content",
                    lineHeight: "1",
                    paddingTop: "2px",
                    paddingBottom: "2px",
                  }}>
                  <span className="text-white text-[8px] font-medium line-through leading-none">
                    ₹{safeOriginalPrice}
                  </span>
                </div>
                {/* Discounted Price - Bright Green Banner */}
                <div
                  className="bg-green-500 rounded px-2 inline-block relative -mt-0.5 z-20"
                  style={{
                    height: "fit-content",
                    lineHeight: "1",
                    paddingTop: "2px",
                    paddingBottom: "2px",
                  }}>
                  <span className="text-white text-[9px] font-bold leading-none">
                    ₹{safeDiscountedPrice}
                  </span>
                </div>
              </div>

              {/* Product Name - Compact - Clickable */}
              <div
                ref={productNameRef}
                onClick={handleProductClick}
                className="text-neutral-900 font-black text-[9px] text-center mb-0.5 cursor-pointer hover:underline line-clamp-2"
                title={displayProduct.productName || displayProduct.name}>
                {displayProduct.productName || displayProduct.name}
              </div>

              {/* Product Thumbnail - Bottom Center, sized to container */}
              <div
                ref={productImageRef}
                className="flex-1 flex items-end justify-center w-full"
                style={{ minHeight: "50px", maxHeight: "65px" }}>
                <div
                  onClick={handleProductClick}
                  className="w-12 h-16 rounded flex items-center justify-center overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
                  style={{ background: "transparent" }}>
                  {displayProduct.imageUrl ? (
                    <img
                      src={displayProduct.imageUrl}
                      alt={displayProduct.name}
                      className="w-full h-full object-contain"
                      loading="lazy"
                      decoding="async"
                      style={{
                        mixBlendMode: "normal",
                        backgroundColor: "transparent",
                      }}
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        // Hide broken image and show fallback
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const parent = target.parentElement;
                        if (parent && !parent.querySelector('.product-fallback')) {
                          const fallback = document.createElement('div');
                          fallback.className = 'product-fallback w-full h-full bg-gradient-to-b from-yellow-100 to-yellow-50 flex items-center justify-center';
                          const icon = document.createElement('div');
                          icon.className = 'w-7 h-9 bg-yellow-200 rounded-sm relative';
                          icon.innerHTML = `
                            <div class="absolute top-0 left-1/2 transform -translate-x-1/2 w-2.5 h-2.5 bg-blue-400 rounded-full"></div>
                            <div class="absolute bottom-0 left-0 right-0 h-1.5 bg-white/80"></div>
                          `;
                          fallback.appendChild(icon);
                          parent.appendChild(fallback);
                        }
                      }}
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-b from-yellow-100 to-yellow-50 flex items-center justify-center">
                      <div className="w-7 h-9 bg-yellow-200 rounded-sm relative">
                        <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-2.5 h-2.5 bg-blue-400 rounded-full"></div>
                        <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-white/80"></div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Category Cards Grid - Right */}
          <div className="flex-1 grid grid-cols-2 gap-2">
            {categoryCards.map((card) => {
              // Use subcategory images from the map if available, otherwise check card.subcategoryImages, then fallback to emoji icons
              const subcategoryImages = subcategoryImagesMap[card.id] || card.subcategoryImages || [];
              const hasSubcategoryImages = subcategoryImages.length > 0;
              const categoryIcons = getCategoryIcons(card.categoryId || "");

              return (
                <div key={card.id} className="promo-card">
                  <Link
                    to={card.slug || card.categoryId ? `/category/${card.slug || card.categoryId}` : "#"}
                    className="group rounded-lg transition-all duration-300 hover:shadow-md active:scale-[0.98] h-full flex flex-col overflow-hidden relative"
                    style={{
                      minHeight: "90px",
                      background: "rgba(255, 247, 237, 0.9)", // Very light orange
                    }}>
                    {/* Green Discount Banner - Only around text, centered at top */}
                    <div
                      className="w-full flex justify-center"
                      style={{ paddingTop: "0", paddingBottom: "2px" }}>
                      <div className="bg-green-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded tracking-tight text-center inline-block">
                        {card.badge}
                      </div>
                    </div>

                    <div
                      className="px-1 pb-1 flex flex-col flex-1 justify-between"
                      style={{ paddingTop: "2px" }}>
                      {/* Category Title */}
                      <div
                        className="text-neutral-900 font-bold text-center"
                        style={{
                          fontSize: "13px",
                          lineHeight: "1.2",
                          marginBottom: "6px",
                        }}>
                        {card.title}
                      </div>

                      {/* Subcategory Images or Emoji Icons - Horizontal Layout */}
                      <div
                        className="flex items-center justify-center gap-1 overflow-hidden"
                        style={{ marginTop: "auto" }}>
                        {hasSubcategoryImages
                          ? // Display subcategory images as small icons
                          subcategoryImages.slice(0, 4).map((imageUrl, idx) => (
                            <div
                              key={idx}
                              className="flex-shrink-0 bg-white rounded flex items-center justify-center overflow-hidden border border-neutral-200"
                              style={{ width: "24px", height: "24px" }}>
                              <img
                                src={imageUrl}
                                alt={`Subcategory ${idx + 1}`}
                                className="w-full h-full object-cover"
                                loading="lazy"
                                decoding="async"
                                onError={(e) => {
                                  // Fallback to emoji if image fails to load
                                  const target =
                                    e.target as HTMLImageElement;
                                  target.style.display = "none";
                                  const parent = target.parentElement;
                                  if (parent) {
                                    parent.innerHTML =
                                      categoryIcons[idx] || "📦";
                                    parent.style.fontSize = "18px";
                                    parent.style.display = "flex";
                                    parent.style.alignItems = "center";
                                    parent.style.justifyContent = "center";
                                  }
                                }}
                              />
                            </div>
                          ))
                          : // Fallback to emoji icons if no subcategory images
                          categoryIcons.slice(0, 4).map((icon, idx) => (
                            <div
                              key={idx}
                              className="flex-shrink-0 bg-transparent rounded flex items-center justify-center overflow-hidden"
                              style={{
                                width: "24px",
                                height: "24px",
                                fontSize: "18px",
                              }}>
                              {icon}
                            </div>
                          ))}
                      </div>
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
