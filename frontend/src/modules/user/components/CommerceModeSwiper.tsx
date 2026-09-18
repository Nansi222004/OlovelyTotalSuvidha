/**
 * CommerceModeSwiper.tsx
 * 
 * Central Promotional Banner Section for the customer Home page.
 * 
 * Rules:
 * 1. When one or more active admin-created banners are available for the currently selected
 *    commerce mode, display those banners in DynamicBannerCarousel and COMPLETELY HIDE
 *    the fallback promotional banner.
 * 2. When no active admin-created banners are available for the selected mode, display the
 *    existing fallback promotional banner ("Shop Your Way").
 * 3. The decision is made in one clear place: both can NEVER render simultaneously.
 * 4. While banners are loading, renders an elegant skeleton to avoid flashing the fallback.
 * 5. On API failure, gracefully displays the fallback rather than leaving the banner area blank.
 * 6. Deduplicates banners by document ID and preserves admin priority order and deep links.
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useThemeContext } from "../../../context/ThemeContext";
import { useCustomerChannel, CustomerChannel } from "../../../context/CustomerChannelContext";
import {
  getCustomerBanners,
  type ActiveBanner,
} from "../../../services/api/customerBannerService";
import DynamicBannerCarousel from "./DynamicBannerCarousel";

// ============================================================================
// Fallback Mode Configurations ("Shop Your Way")
// ============================================================================
interface ModeSlideConfig {
  mode: "QUICK_COMMERCE" | "ECOMMERCE" | "WHOLESALE";
  defaultTitle: string;
  defaultSubtitle: string;
  defaultCta: string;
  icon: string;
  badge: string;
  fallbackImage: string;
}

const FALLBACK_MODE_CONFIGS: ModeSlideConfig[] = [
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

// ============================================================================
// Component 1: Loading Skeleton
// ============================================================================
function BannerLoadingSkeleton({ className = "" }: { className?: string }) {
  return (
    <section className={`w-full px-3 sm:px-4 md:px-6 lg:px-8 my-4 sm:my-5 md:my-7 select-none ${className}`}>
      <div className="mb-2.5 sm:mb-3 md:mb-4 px-0.5 animate-pulse">
        <div className="w-36 sm:w-48 h-5 sm:h-7 bg-neutral-200 rounded-md mb-1.5" />
        <div className="w-56 sm:w-64 h-3.5 bg-neutral-100 rounded-md" />
      </div>
      <div className="relative w-full rounded-2xl md:rounded-3xl border border-neutral-200/70 bg-neutral-100 min-h-[140px] sm:min-h-[170px] md:min-h-[210px] animate-pulse overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full animate-[shimmer_1.6s_infinite]" />
      </div>
    </section>
  );
}

// ============================================================================
// Component 2: Existing Fallback Promotional Banner ("Shop Your Way")
// ============================================================================
interface FallbackSwiperProps {
  className?: string;
  autoSlideInterval?: number;
}

function FallbackShopYourWaySwiper({
  className = "",
  autoSlideInterval = 4000,
}: FallbackSwiperProps) {
  const { currentTheme } = useThemeContext();
  const { setActiveChannel } = useCustomerChannel();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dragStartXRef = useRef<number | null>(null);
  const dragDistanceRef = useRef<number>(0);
  const hasDraggedBeyondThresholdRef = useRef(false);
  const DRAG_THRESHOLD = 8;

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!isPaused && !prefersReducedMotion) {
      timerRef.current = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % FALLBACK_MODE_CONFIGS.length);
      }, autoSlideInterval);
    }
  }, [isPaused, prefersReducedMotion, autoSlideInterval]);

  useEffect(() => {
    startTimer();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [startTimer]);

  const goToSlide = (idx: number) => {
    setCurrentIndex(idx);
    startTimer();
  };

  const handleSlideClick = (config: ModeSlideConfig, e?: React.MouseEvent) => {
    if (hasDraggedBeyondThresholdRef.current) {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      return;
    }

    setActiveChannel(config.mode as CustomerChannel);

    const targetEl =
      document.querySelector("[data-products-section]") ||
      document.querySelector("main");
    if (targetEl && targetEl !== document.querySelector("main")) {
      targetEl.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const activeConfig = FALLBACK_MODE_CONFIGS[currentIndex];

  const primaryColor = currentTheme.primary?.[0] || "rgb(34, 197, 94)";
  const secondaryColor = currentTheme.primary?.[1] || currentTheme.secondary?.[0] || "rgb(74, 222, 128)";
  const accentColor =
    currentTheme.accentColor && currentTheme.accentColor !== "#000"
      ? currentTheme.accentColor
      : primaryColor;

  const dynamicCardGradient = `linear-gradient(135deg, ${primaryColor}15 0%, #ffffff 50%, ${secondaryColor}10 100%)`;
  const dynamicBorderColor = `${primaryColor}28`;
  const dynamicGlowColor = `${primaryColor}18`;

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Shop Your Way - Commerce Shopping Modes"
      className={`relative w-full px-3 sm:px-4 md:px-6 lg:px-8 my-4 sm:my-5 md:my-7 select-none ${className}`}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Section Header */}
      <div className="mb-2.5 sm:mb-3 md:mb-4 px-0.5">
        <h2 className="text-base sm:text-lg md:text-2xl font-bold text-neutral-900 tracking-tight">
          Shop Your Way
        </h2>
        <p className="text-[11px] sm:text-xs md:text-sm text-neutral-500 mt-0.5">
          Three ways to shop, one trusted platform
        </p>
      </div>

      {/* Main Swiper Card */}
      <div
        className="relative w-full rounded-2xl md:rounded-3xl border shadow-2xs hover:shadow-md transition-all duration-300 overflow-hidden group cursor-pointer"
        style={{
          background: dynamicCardGradient,
          borderColor: dynamicBorderColor,
          boxShadow: `0 4px 20px -2px ${dynamicGlowColor}`,
        }}
        onClick={(e) => handleSlideClick(activeConfig, e)}
        onTouchStart={(e) => {
          setIsPaused(true);
          dragStartXRef.current = e.touches[0].clientX;
          dragDistanceRef.current = 0;
          hasDraggedBeyondThresholdRef.current = false;
        }}
        onTouchMove={(e) => {
          if (dragStartXRef.current === null) return;
          const delta = dragStartXRef.current - e.touches[0].clientX;
          dragDistanceRef.current = delta;
          if (Math.abs(delta) > DRAG_THRESHOLD) {
            hasDraggedBeyondThresholdRef.current = true;
          }
        }}
        onTouchEnd={() => {
          const delta = dragDistanceRef.current;
          if (delta > 35) {
            setCurrentIndex((prev) => (prev + 1) % FALLBACK_MODE_CONFIGS.length);
          } else if (delta < -35) {
            setCurrentIndex((prev) => (prev === 0 ? FALLBACK_MODE_CONFIGS.length - 1 : prev - 1));
          }
          dragStartXRef.current = null;
          dragDistanceRef.current = 0;
          setTimeout(() => {
            hasDraggedBeyondThresholdRef.current = false;
            setIsPaused(false);
          }, 120);
        }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={activeConfig.mode}
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: 18 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: -18 }}
            transition={{ duration: prefersReducedMotion ? 0.05 : 0.28, ease: "easeOut" }}
            className="w-full flex flex-row items-center justify-between min-h-[120px] sm:min-h-[160px] md:min-h-[200px] p-3 sm:p-5 md:p-7 gap-2.5 sm:gap-4 md:gap-6"
          >
            {/* Left Content Area */}
            <div className="flex-1 min-w-0 flex flex-col justify-center items-start text-left z-10 pr-1 sm:pr-2">
              <div className="mb-1 sm:mb-1.5">
                <span className="inline-flex items-center gap-1 text-[9px] sm:text-[11px] md:text-xs font-bold px-2 py-0.5 rounded-full bg-black/5 text-neutral-700 tracking-tight">
                  <span>{activeConfig.icon}</span>
                  <span>{activeConfig.badge}</span>
                </span>
              </div>

              <h3 className="text-sm sm:text-lg md:text-2xl font-black text-neutral-900 tracking-tight leading-snug line-clamp-1 sm:line-clamp-2">
                {activeConfig.defaultTitle}
              </h3>

              <p className="text-[11px] sm:text-xs md:text-sm text-neutral-600 font-medium line-clamp-2 mt-0.5 sm:mt-1 leading-tight sm:leading-relaxed max-w-[220px] sm:max-w-sm md:max-w-md">
                {activeConfig.defaultSubtitle}
              </p>

              <div className="mt-2 sm:mt-3 md:mt-4">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSlideClick(activeConfig, e);
                  }}
                  className="inline-flex items-center gap-1 sm:gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 md:px-5 md:py-2.5 rounded-full text-[11px] sm:text-xs md:text-sm font-bold text-white transition-transform duration-200 hover:scale-105 active:scale-95 shadow-2xs"
                  style={{
                    backgroundColor: accentColor,
                  }}
                >
                  <span>{activeConfig.defaultCta}</span>
                </button>
              </div>
            </div>

            {/* Right Visual Area */}
            <div className="relative w-24 sm:w-36 md:w-48 lg:w-56 h-24 sm:h-36 md:h-44 flex-shrink-0 flex items-center justify-center overflow-hidden">
              <img
                src={activeConfig.fallbackImage}
                alt={activeConfig.defaultTitle}
                className="w-full h-full object-contain rounded-xl transition-transform duration-500 group-hover:scale-105 drop-shadow-sm pointer-events-none"
                loading="lazy"
              />
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Pagination Indicators */}
      <div className="flex items-center justify-center gap-1.5 sm:gap-2 mt-2.5 sm:mt-3" role="tablist" aria-label="Slide controls">
        {FALLBACK_MODE_CONFIGS.map((config, i) => (
          <button
            key={config.mode}
            type="button"
            role="tab"
            aria-selected={i === currentIndex}
            onClick={() => goToSlide(i)}
            aria-label={`Go to ${config.defaultTitle} slide`}
            className="p-1 focus:outline-none rounded-full"
          >
            <div
              className={`rounded-full transition-all duration-300 ${
                i === currentIndex
                  ? "w-6 sm:w-7 h-1.5 sm:h-2 shadow-xs"
                  : "w-1.5 sm:w-2 h-1.5 sm:h-2 bg-neutral-300 hover:bg-neutral-400"
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

// ============================================================================
// Top-Level Component: Sole Decision Point between Admin Carousel & Fallback
// ============================================================================
interface Props {
  className?: string;
  autoSlideInterval?: number;
  channelFilter?: "ALL" | "QUICK_COMMERCE" | "ECOMMERCE" | "WHOLESALE";
}

export default function CommerceModeSwiper({
  className = "",
  autoSlideInterval = 4000,
  channelFilter,
}: Props) {
  const { activeChannel: contextChannel } = useCustomerChannel();
  const activeChannel = channelFilter || contextChannel || "ALL";

  const [adminBanners, setAdminBanners] = useState<ActiveBanner[]>([]);
  const [isFallback, setIsFallback] = useState(true);
  const [loading, setLoading] = useState(true);

  // Recalculate whenever active channel mode changes
  useEffect(() => {
    let cancelled = false;
    const fetchBanners = async () => {
      try {
        setLoading(true);

        const result = await getCustomerBanners(activeChannel);
        if (cancelled) return;

        // Deduplicate by banner._id
        const uniqueBanners: ActiveBanner[] = [];
        const seenIds = new Set<string>();
        for (const b of result.banners || []) {
          const id = b._id || b.title;
          if (!seenIds.has(id)) {
            seenIds.add(id);
            uniqueBanners.push(b);
          }
        }

        setAdminBanners(uniqueBanners);
        setIsFallback(result.isFallback || uniqueBanners.length === 0);
      } catch (err) {
        console.warn("Could not load active admin banners, falling back to mode swiper", err);
        if (!cancelled) {
          setAdminBanners([]);
          setIsFallback(true);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchBanners();
    return () => {
      cancelled = true;
    };
  }, [activeChannel]);

  // ---------------------------------------------------------------------------
  // VISIBILITY DECISION IN ONE CLEAR PLACE
  // ---------------------------------------------------------------------------

  // 1. If admin banners are loading, show a skeleton to avoid briefly flashing the fallback
  if (loading) {
    return <BannerLoadingSkeleton className={className} />;
  }

  // 2. When one or more active admin-created banners are available for the currently
  // selected commerce mode, display those banners and COMPLETELY HIDE the fallback swiper
  if (!isFallback && adminBanners.length > 0) {
    return (
      <DynamicBannerCarousel
        banners={adminBanners}
        className={className}
        autoSlideInterval={autoSlideInterval}
      />
    );
  }

  // 3. When no active admin-created banners are available for the selected mode (or on error),
  // display the existing fallback promotional banner ("Shop Your Way")
  return (
    <FallbackShopYourWaySwiper
      className={className}
      autoSlideInterval={autoSlideInterval}
    />
  );
}
