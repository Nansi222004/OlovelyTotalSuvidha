/**
 * CommerceModeSwiper.tsx
 * 
 * "Shop Your Way" Dynamic Promotional Swiper section positioned immediately AFTER Bestsellers on Home.
 * Communicates Olovely's three shopping modes:
 *   1. ⚡ Quick Commerce (Everyday essentials delivered in 10-30 minutes)
 *   2. 📦 Ecommerce (Shop electronics, fashion, lifestyle & more)
 *   3. 🏷️ Wholesale (Bulk shopping with special wholesale pricing)
 * 
 * Key Highlights:
 * - Clean "Shop Your Way" section header with subtitle.
 * - 3 dedicated, beautiful fallback banners using local high-resolution assets:
 *   - /assets/fallback-quick-commerce.jpg
 *   - /assets/fallback-ecommerce.jpg
 *   - /assets/fallback-wholesale.jpg
 * - Dynamic Theme Integration: Card background gradient, subtle borders, ambient glow,
 *   active pagination dots, and CTA buttons dynamically inherit colors from ThemeContext.
 * - Admin Banner Override: If an admin creates/uploads an active banner for a mode,
 *   that image and copy take priority.
 * - Robust Error Handling: Broken/inaccessible admin images automatically fall back
 *   to the local mode asset without breaking layout.
 * - CustomerChannelContext Integration: Clicking a slide updates the customer commerce channel
 *   state (QUICK_COMMERCE, ECOMMERCE, WHOLESALE) and persists across navigation/refresh.
 * - Responsive: Full touch swipe on mobile, desktop prev/next controls, and pagination dots.
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useThemeContext } from "../../../context/ThemeContext";
import { useCustomerChannel, CustomerChannel } from "../../../context/CustomerChannelContext";
import { getCommerceModeBanners, ActiveBanner, CommerceModeBanners } from "../../../services/api/customerBannerService";

interface ModeSlideConfig {
  mode: "QUICK_COMMERCE" | "ECOMMERCE" | "WHOLESALE";
  defaultTitle: string;
  defaultSubtitle: string;
  defaultCta: string;
  icon: string;
  badge: string;
  fallbackImage: string;
}

const MODE_CONFIGS: ModeSlideConfig[] = [
  {
    mode: "QUICK_COMMERCE",
    defaultTitle: "Quick Commerce",
    defaultSubtitle: "Everyday essentials delivered in 10-30 minutes",
    defaultCta: "Shop Quick Commerce →",
    icon: "⚡",
    badge: "10-30 Mins Delivery",
    fallbackImage: "/assets/fallback-quick-commerce.jpg",
  },
  {
    mode: "ECOMMERCE",
    defaultTitle: "Ecommerce",
    defaultSubtitle: "Shop electronics, fashion, lifestyle & more",
    defaultCta: "Explore Ecommerce →",
    icon: "📦",
    badge: "Courier Shipping Across India",
    fallbackImage: "/assets/fallback-ecommerce.jpg",
  },
  {
    mode: "WHOLESALE",
    defaultTitle: "Wholesale",
    defaultSubtitle: "Bulk shopping with special wholesale pricing",
    defaultCta: "Shop Wholesale →",
    icon: "🏷️",
    badge: "Bulk Pricing & B2B Rates",
    fallbackImage: "/assets/fallback-wholesale.jpg",
  },
];

interface Props {
  className?: string;
  autoSlideInterval?: number;
}

export default function CommerceModeSwiper({
  className = "",
  autoSlideInterval = 5000,
}: Props) {
  const navigate = useNavigate();
  const { currentTheme } = useThemeContext();
  const { setActiveChannel } = useCustomerChannel();

  const [banners, setBanners] = useState<CommerceModeBanners | Record<string, ActiveBanner | null>>({
    QUICK_COMMERCE: null,
    ECOMMERCE: null,
    WHOLESALE: null,
  });
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [imgErrorMap, setImgErrorMap] = useState<Record<string, boolean>>({});
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Touch gesture tracking for mobile swipe
  const touchStartXRef = useRef<number | null>(null);
  const touchEndXRef = useRef<number | null>(null);

  // Fetch admin banners for each mode on mount
  useEffect(() => {
    let cancelled = false;
    const fetchBanners = async () => {
      try {
        const modeBanners = await getCommerceModeBanners();
        if (!cancelled) {
          setBanners(modeBanners);
        }
      } catch (err) {
        console.warn("Could not load commerce mode banners; using fallbacks", err);
      }
    };
    fetchBanners();
    return () => {
      cancelled = true;
    };
  }, []);

  // Auto-slide advance
  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!isPaused) {
      timerRef.current = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % MODE_CONFIGS.length);
      }, autoSlideInterval);
    }
  }, [isPaused, autoSlideInterval]);

  useEffect(() => {
    startTimer();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [startTimer]);

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
    startTimer();
  };

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev === 0 ? MODE_CONFIGS.length - 1 : prev - 1));
    startTimer();
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % MODE_CONFIGS.length);
    startTimer();
  };

  // Touch swipe handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    setIsPaused(true);
    touchStartXRef.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndXRef.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    setIsPaused(false);
    if (!touchStartXRef.current || !touchEndXRef.current) return;
    const distance = touchStartXRef.current - touchEndXRef.current;
    const minSwipeDistance = 45;

    if (distance > minSwipeDistance) {
      // Swiped left -> Next
      setCurrentIndex((prev) => (prev + 1) % MODE_CONFIGS.length);
    } else if (distance < -minSwipeDistance) {
      // Swiped right -> Prev
      setCurrentIndex((prev) => (prev === 0 ? MODE_CONFIGS.length - 1 : prev - 1));
    }

    touchStartXRef.current = null;
    touchEndXRef.current = null;
  };

  // Click / CTA navigation
  const handleSlideClick = (config: ModeSlideConfig) => {
    // 1. Authoritatively set customer channel state in CustomerChannelContext
    setActiveChannel(config.mode as CustomerChannel);

    const banner = banners[config.mode];

    // 2. If banner has explicit deep-link target, navigate there
    if (banner && banner.targetType === "CATEGORY" && banner.targetId) {
      navigate(`/category/${banner.targetId}`);
      return;
    }
    if (banner && banner.targetType === "PRODUCT" && banner.targetId) {
      navigate(`/product/${banner.targetId}`);
      return;
    }
    if (banner && banner.targetType === "URL" && banner.targetId) {
      window.open(banner.targetId, "_blank", "noopener,noreferrer");
      return;
    }

    // 3. Default behavior: Channel is updated on Home; smoothly scroll to content section
    const targetEl =
      document.querySelector("[data-products-section]") ||
      document.querySelector("main");
    if (targetEl && targetEl !== document.querySelector("main")) {
      targetEl.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const activeConfig = MODE_CONFIGS[currentIndex];
  const activeBanner = banners[activeConfig.mode];

  // Resolve title, subtitle, CTA text (admin overrides fallback)
  const displayTitle = (activeBanner && activeBanner.title) || activeConfig.defaultTitle;
  const displaySubtitle =
    (activeBanner && activeBanner.subtitle) || activeConfig.defaultSubtitle;
  const displayCta = (activeBanner && activeBanner.ctaText) || activeConfig.defaultCta;

  // Resolve image URL: admin image (with mobile override if available) -> fallback local asset
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const adminImgSrc =
    (isMobile && activeBanner?.mobileImageUrl) || activeBanner?.imageUrl;
  const activeImgSrc =
    adminImgSrc && !imgErrorMap[activeConfig.mode]
      ? adminImgSrc
      : activeConfig.fallbackImage;

  // ---------------------------------------------------------------------------
  // DYNAMIC THEME ATMOSPHERE (Derived from ThemeContext)
  // ---------------------------------------------------------------------------
  const primaryColor = currentTheme.primary?.[0] || "rgb(34, 197, 94)";
  const secondaryColor = currentTheme.primary?.[1] || currentTheme.secondary?.[0] || "rgb(74, 222, 128)";
  const accentColor =
    currentTheme.accentColor && currentTheme.accentColor !== "#000"
      ? currentTheme.accentColor
      : primaryColor;

  // Dynamic card background gradient tinted with the active header/category atmosphere
  const dynamicCardGradient = `linear-gradient(135deg, ${primaryColor}15 0%, #ffffff 45%, ${secondaryColor}10 100%)`;
  const dynamicBorderColor = `${primaryColor}28`;
  const dynamicGlowColor = `${primaryColor}18`;

  return (
    <section
      aria-label="Shop Your Way - Commerce Shopping Modes"
      className={`relative w-full px-4 md:px-6 lg:px-8 my-5 md:my-7 select-none ${className}`}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Section Header */}
      <div className="mb-3 md:mb-4 px-1">
        <h2 className="text-lg md:text-2xl font-bold text-neutral-900 tracking-tight">
          Shop Your Way
        </h2>
        <p className="text-xs md:text-sm text-neutral-500 mt-0.5">
          Three ways to shop, one trusted platform
        </p>
      </div>

      {/* Swiper Relative Container (Holding Card + Arrows) */}
      <div className="relative w-full">
        {/* Previous Arrow Button */}
        <button
          type="button"
          onClick={handlePrev}
          aria-label="Previous mode"
          className="absolute -left-2.5 sm:-left-3.5 top-1/2 -translate-y-1/2 z-20 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/95 backdrop-blur-sm border border-neutral-200/90 shadow-md text-neutral-700 hover:text-neutral-950 hover:bg-white flex items-center justify-center transition-all hover:scale-105 active:scale-95"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Next Arrow Button */}
        <button
          type="button"
          onClick={handleNext}
          aria-label="Next mode"
          className="absolute -right-2.5 sm:-right-3.5 top-1/2 -translate-y-1/2 z-20 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/95 backdrop-blur-sm border border-neutral-200/90 shadow-md text-neutral-700 hover:text-neutral-950 hover:bg-white flex items-center justify-center transition-all hover:scale-105 active:scale-95"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* Main Swiper Card */}
        <div
          className="relative w-full rounded-2xl md:rounded-3xl border shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden cursor-pointer group"
          style={{
            background: dynamicCardGradient,
            borderColor: dynamicBorderColor,
            boxShadow: `0 4px 20px -2px ${dynamicGlowColor}`,
          }}
          onClick={() => handleSlideClick(activeConfig)}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={activeConfig.mode}
              initial={{ opacity: 0, x: 18 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -18 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
              className="w-full flex flex-col sm:flex-row items-center justify-between min-h-[170px] sm:min-h-[190px] md:min-h-[220px] p-4 sm:p-6 md:p-8 gap-4 sm:gap-6"
            >
              {/* Left Content Area (Icon, Title, Subtitle, CTA) */}
              <div className="flex-1 flex flex-col justify-center items-start text-left z-10 w-full sm:w-auto">
                {/* Title with Icon */}
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-2xl sm:text-3xl">{activeConfig.icon}</span>
                  <h3 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-extrabold text-neutral-900 tracking-tight leading-tight">
                    {displayTitle}
                  </h3>
                </div>

                {/* Subtitle */}
                <p className="text-xs sm:text-sm md:text-base text-neutral-600 font-medium max-w-sm sm:max-w-md line-clamp-2 leading-relaxed">
                  {displaySubtitle}
                </p>

                {/* CTA Button */}
                <div className="mt-3.5 sm:mt-5">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSlideClick(activeConfig);
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 sm:px-5 sm:py-2.5 rounded-full text-xs sm:text-sm font-bold text-white transition-all duration-200 group-hover:scale-105 shadow-sm active:scale-95"
                    style={{
                      backgroundColor: accentColor,
                    }}
                  >
                    <span>{displayCta}</span>
                  </button>
                </div>
              </div>

              {/* Right Visual Area (Fallback Asset or Admin Uploaded Image) */}
              <div className="relative w-full sm:w-5/12 md:w-1/2 flex items-center justify-center sm:justify-end overflow-hidden max-h-[150px] sm:max-h-[180px] md:max-h-[210px]">
                <img
                  src={activeImgSrc}
                  alt={displayTitle}
                  className="w-auto h-full max-h-[140px] sm:max-h-[175px] md:max-h-[200px] object-contain rounded-xl transition-transform duration-500 group-hover:scale-105 drop-shadow-sm"
                  loading="lazy"
                  onError={() => {
                    // Mark admin image as failed so it reverts to safe local fallback image
                    setImgErrorMap((prev) => ({ ...prev, [activeConfig.mode]: true }));
                  }}
                />
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Pagination Indicators Below Card */}
      <div className="flex items-center justify-center gap-2 mt-3">
        {MODE_CONFIGS.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => goToSlide(i)}
            aria-label={`Go to mode ${i + 1}`}
            className="p-1 focus:outline-none"
          >
            <div
              className={`rounded-full transition-all duration-300 ${
                i === currentIndex
                  ? "w-6 h-2 shadow-xs"
                  : "w-2 h-2 bg-neutral-300 hover:bg-neutral-400"
              }`}
              style={{
                backgroundColor: i === currentIndex ? accentColor : undefined,
              }}
            />
          </button>
        ))}
      </div>
    </section>
  );
}
