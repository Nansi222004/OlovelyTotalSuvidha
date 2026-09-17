/**
 * CommerceModeSwiper.tsx
 * 
 * "Shop Your Way" Dynamic Promotional Swiper section positioned immediately AFTER Bestsellers on Home.
 * Communicates Olovely's three shopping modes:
 *   1. ⚡ Quick Commerce (Everyday essentials delivered in 10-30 minutes)
 *   2. 📦 Ecommerce (Shop electronics, fashion, lifestyle & more)
 *   3. 🏷️ Wholesale (Bulk shopping with special wholesale pricing)
 * 
 * Features:
 * - Autoplay every ~4s with pause-on-hover / pause-on-drag and clean unmount.
 * - Natural touch swipe on mobile & mouse drag on desktop.
 * - Drag displacement threshold (>8px) prevents accidental CTA click navigation during swipe/drag.
 * - Visible navigation arrows removed on mobile and desktop for a clean, clutter-free look.
 * - Responsive layout crafted for 320px, 375px, 390px, 414px, and Desktop screens.
 * - Keyboard navigation (ArrowLeft / ArrowRight / Enter / Space) and screen-reader accessibility.
 * - Respects prefers-reduced-motion.
 * - Dynamic theme integration and admin-managed banner support with local fallback assets.
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
  autoSlideInterval = 4000,
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
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Drag & Swipe gesture tracking
  const isMouseDownRef = useRef(false);
  const dragStartXRef = useRef<number | null>(null);
  const dragCurrentXRef = useRef<number | null>(null);
  const dragDistanceRef = useRef<number>(0);
  const hasDraggedBeyondThresholdRef = useRef(false);
  const DRAG_THRESHOLD = 8; // >8px displacement is treated as swipe/drag, suppressing CTA click

  // Check prefers-reduced-motion
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

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

  // Auto-slide advance with ~4s interval
  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!isPaused && !prefersReducedMotion) {
      timerRef.current = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % MODE_CONFIGS.length);
      }, autoSlideInterval);
    }
  }, [isPaused, prefersReducedMotion, autoSlideInterval]);

  useEffect(() => {
    startTimer();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [startTimer]);

  // Pause autoplay when document is hidden (user switched tabs)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsPaused(true);
      } else {
        setIsPaused(false);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
    startTimer();
  };

  // --- TOUCH SWIPE HANDLERS (Mobile) ---
  const handleTouchStart = (e: React.TouchEvent) => {
    setIsPaused(true);
    const clientX = e.touches[0].clientX;
    dragStartXRef.current = clientX;
    dragCurrentXRef.current = clientX;
    dragDistanceRef.current = 0;
    hasDraggedBeyondThresholdRef.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (dragStartXRef.current === null) return;
    const clientX = e.touches[0].clientX;
    dragCurrentXRef.current = clientX;
    const delta = dragStartXRef.current - clientX;
    dragDistanceRef.current = delta;
    if (Math.abs(delta) > DRAG_THRESHOLD) {
      hasDraggedBeyondThresholdRef.current = true;
    }
  };

  const handleTouchEnd = () => {
    const delta = dragDistanceRef.current;
    const minSwipeDistance = 35;

    if (delta > minSwipeDistance) {
      // Swiped left -> Next
      setCurrentIndex((prev) => (prev + 1) % MODE_CONFIGS.length);
    } else if (delta < -minSwipeDistance) {
      // Swiped right -> Prev
      setCurrentIndex((prev) => (prev === 0 ? MODE_CONFIGS.length - 1 : prev - 1));
    }

    dragStartXRef.current = null;
    dragCurrentXRef.current = null;
    dragDistanceRef.current = 0;

    // Reset drag threshold flag after click event cycle concludes
    setTimeout(() => {
      hasDraggedBeyondThresholdRef.current = false;
      setIsPaused(false);
    }, 120);
  };

  // --- MOUSE DRAG HANDLERS (Desktop) ---
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Left button only
    isMouseDownRef.current = true;
    setIsPaused(true);
    dragStartXRef.current = e.clientX;
    dragCurrentXRef.current = e.clientX;
    dragDistanceRef.current = 0;
    hasDraggedBeyondThresholdRef.current = false;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isMouseDownRef.current || dragStartXRef.current === null) return;
    const clientX = e.clientX;
    dragCurrentXRef.current = clientX;
    const delta = dragStartXRef.current - clientX;
    dragDistanceRef.current = delta;
    if (Math.abs(delta) > DRAG_THRESHOLD) {
      hasDraggedBeyondThresholdRef.current = true;
    }
  };

  const handleMouseUp = () => {
    if (!isMouseDownRef.current) return;
    isMouseDownRef.current = false;
    const delta = dragDistanceRef.current;
    const minDragDistance = 35;

    if (delta > minDragDistance) {
      // Dragged left -> Next
      setCurrentIndex((prev) => (prev + 1) % MODE_CONFIGS.length);
    } else if (delta < -minDragDistance) {
      // Dragged right -> Prev
      setCurrentIndex((prev) => (prev === 0 ? MODE_CONFIGS.length - 1 : prev - 1));
    }

    dragStartXRef.current = null;
    dragCurrentXRef.current = null;
    dragDistanceRef.current = 0;

    setTimeout(() => {
      hasDraggedBeyondThresholdRef.current = false;
      setIsPaused(false);
    }, 120);
  };

  const handleMouseLeave = () => {
    if (isMouseDownRef.current) {
      handleMouseUp();
    }
    setIsPaused(false);
  };

  // --- CLICK & NAVIGATION ---
  const handleSlideClick = (config: ModeSlideConfig, e?: React.MouseEvent) => {
    // If the user was dragging/swiping, suppress the click navigation
    if (hasDraggedBeyondThresholdRef.current) {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      return;
    }

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

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      setCurrentIndex((prev) => (prev === 0 ? MODE_CONFIGS.length - 1 : prev - 1));
      startTimer();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      setCurrentIndex((prev) => (prev + 1) % MODE_CONFIGS.length);
      startTimer();
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleSlideClick(MODE_CONFIGS[currentIndex]);
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
  const dynamicCardGradient = `linear-gradient(135deg, ${primaryColor}15 0%, #ffffff 50%, ${secondaryColor}10 100%)`;
  const dynamicBorderColor = `${primaryColor}28`;
  const dynamicGlowColor = `${primaryColor}18`;

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Shop Your Way - Commerce Shopping Modes"
      className={`relative w-full px-3 sm:px-4 md:px-6 lg:px-8 my-4 sm:my-5 md:my-7 select-none ${className}`}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={handleMouseLeave}
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

      {/* Swiper Container with Touch and Mouse Dragging */}
      <div
        className="relative w-full touch-pan-y cursor-grab active:cursor-grabbing outline-none"
        tabIndex={0}
        role="region"
        aria-label={`Slide ${currentIndex + 1} of ${MODE_CONFIGS.length}: ${displayTitle}`}
        onKeyDown={handleKeyDown}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        {/* Main Swiper Card - Responsive design for 320px, 375px, 390px, 414px & Desktop */}
        <div
          className="relative w-full rounded-2xl md:rounded-3xl border shadow-2xs hover:shadow-md transition-all duration-300 overflow-hidden group"
          style={{
            background: dynamicCardGradient,
            borderColor: dynamicBorderColor,
            boxShadow: `0 4px 20px -2px ${dynamicGlowColor}`,
          }}
          onClick={(e) => handleSlideClick(activeConfig, e)}
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
              {/* Left Content Area (Badge, Title with Icon, Subtitle, CTA) */}
              <div className="flex-1 min-w-0 flex flex-col justify-center items-start text-left z-10 pr-1 sm:pr-2">
                {/* Mode Category Badge */}
                <div className="mb-1 sm:mb-1.5">
                  <span className="inline-flex items-center gap-1 text-[9px] sm:text-[11px] md:text-xs font-bold px-2 py-0.5 rounded-full bg-black/5 text-neutral-700 tracking-tight">
                    <span>{activeConfig.icon}</span>
                    <span>{activeConfig.badge}</span>
                  </span>
                </div>

                {/* Title */}
                <h3 className="text-sm sm:text-lg md:text-2xl font-black text-neutral-900 tracking-tight leading-snug line-clamp-1 sm:line-clamp-2">
                  {displayTitle}
                </h3>

                {/* Subtitle */}
                <p className="text-[11px] sm:text-xs md:text-sm text-neutral-600 font-medium line-clamp-2 mt-0.5 sm:mt-1 leading-tight sm:leading-relaxed max-w-[220px] sm:max-w-sm md:max-w-md">
                  {displaySubtitle}
                </p>

                {/* CTA Button */}
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
                    <span>{displayCta}</span>
                  </button>
                </div>
              </div>

              {/* Right Visual Area (Fallback Asset or Admin Uploaded Image) */}
              <div className="relative w-24 sm:w-36 md:w-48 lg:w-56 h-24 sm:h-36 md:h-44 flex-shrink-0 flex items-center justify-center overflow-hidden">
                <img
                  src={activeImgSrc}
                  alt={displayTitle}
                  className="w-full h-full object-contain rounded-xl transition-transform duration-500 group-hover:scale-105 drop-shadow-sm pointer-events-none"
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
      <div className="flex items-center justify-center gap-1.5 sm:gap-2 mt-2.5 sm:mt-3" role="tablist" aria-label="Slide controls">
        {MODE_CONFIGS.map((config, i) => (
          <button
            key={config.mode}
            type="button"
            role="tab"
            aria-selected={i === currentIndex}
            onClick={() => goToSlide(i)}
            aria-label={`Go to ${config.defaultTitle} slide`}
            className="p-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-full"
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
