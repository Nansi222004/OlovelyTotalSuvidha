/**
 * DynamicBannerCarousel.tsx
 * 
 * Admin-created active banner carousel component.
 * 
 * Features:
 * - Can accept preloaded `banners` or fetch dynamically by `section`
 * - Renders only when active admin banners exist (returns null if empty)
 * - Safe deep link navigation (PRODUCT, CATEGORY, SEARCH, URL)
 * - Auto-advance with pause-on-hover & pause-on-touch
 * - Touch swipe & mouse drag navigation
 * - Desktop hover chevrons and pagination dot indicators
 * - Graceful image error fallback (styled gradient card without duplicating banners)
 * - Deduplicates banners by document ID
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  getCustomerBanners,
  type ActiveBanner,
} from "../../../services/api/customerBannerService";

export interface DynamicBannerCarouselProps {
  /** Commerce section to load banners for if pre-loaded banners not provided */
  section?: "QUICK_COMMERCE" | "ECOMMERCE" | "WHOLESALE" | "ALL";
  /** Slide auto-advance interval in ms. Default 4000. */
  autoSlideInterval?: number;
  /** Legacy prop alias for autoSlideInterval */
  interval?: number;
  /** Extra className on the outer section wrapper */
  className?: string;
  /** Pre-loaded active banners (if provided by parent component) */
  banners?: ActiveBanner[];
  /** Whether to show the section header. Default true. */
  showHeader?: boolean;
}

export default function DynamicBannerCarousel({
  section = "ALL",
  autoSlideInterval,
  interval = 4000,
  className = "",
  banners: propBanners,
  showHeader = true,
}: DynamicBannerCarouselProps) {
  const slideInterval = autoSlideInterval || interval;
  const navigate = useNavigate();

  const [fetchedBanners, setFetchedBanners] = useState<ActiveBanner[]>([]);
  const [loaded, setLoaded] = useState(propBanners !== undefined);
  const [current, setCurrent] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({});

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const touchStartX = useRef<number | null>(null);
  const touchDeltaX = useRef<number>(0);

  // Fetch banners if not provided via props
  useEffect(() => {
    if (propBanners !== undefined) {
      setLoaded(true);
      return;
    }

    let cancelled = false;
    const loadBanners = async () => {
      try {
        const result = await getCustomerBanners(section);
        if (!cancelled) {
          setFetchedBanners(result.banners || []);
          setCurrent(0);
          setLoaded(true);
        }
      } catch {
        if (!cancelled) {
          setFetchedBanners([]);
          setLoaded(true);
        }
      }
    };

    loadBanners();
    return () => {
      cancelled = true;
    };
  }, [section, propBanners]);

  // Determine active banner list and deduplicate by _id
  const rawBanners = propBanners !== undefined ? propBanners : fetchedBanners;
  const banners: ActiveBanner[] = [];
  const seenIds = new Set<string>();
  for (const b of rawBanners) {
    const id = b._id || b.title;
    if (!seenIds.has(id)) {
      seenIds.add(id);
      banners.push(b);
    }
  }

  // Auto-advance timer
  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!isPaused && banners.length > 1) {
      timerRef.current = setInterval(() => {
        setCurrent((c) => (c + 1) % banners.length);
      }, slideInterval);
    }
  }, [banners.length, slideInterval, isPaused]);

  useEffect(() => {
    startTimer();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [startTimer]);

  // Reset current index if it exceeds banner length
  useEffect(() => {
    if (current >= banners.length && banners.length > 0) {
      setCurrent(0);
    }
  }, [banners.length, current]);

  const goTo = (idx: number) => {
    setCurrent(idx);
    startTimer();
  };

  const handleNext = () => {
    setCurrent((c) => (c + 1) % banners.length);
    startTimer();
  };

  const handlePrev = () => {
    setCurrent((c) => (c === 0 ? banners.length - 1 : c - 1));
    startTimer();
  };

  const handleClick = (banner: ActiveBanner) => {
    if (Math.abs(touchDeltaX.current) > 10) return; // Suppress click on drag

    const targetId = banner.targetId?.trim();
    if (banner.targetType === "CATEGORY" && targetId) {
      navigate(`/category/${targetId}`);
    } else if (banner.targetType === "PRODUCT" && targetId) {
      navigate(`/product/${targetId}`);
    } else if (banner.targetType === "SEARCH" && targetId) {
      navigate(`/search?q=${encodeURIComponent(targetId)}`);
    } else if (banner.targetType === "URL" && targetId) {
      const url = targetId.startsWith("http") ? targetId : `https://${targetId}`;
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  // Strictly return null if loading or no real active banners exist
  if (!loaded || banners.length === 0) {
    return null;
  }

  const banner = banners[current] || banners[0];
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const preferredImg = (isMobile && banner.mobileImageUrl) || banner.imageUrl;
  const hasImage = Boolean(preferredImg && !imgErrors[banner._id]);

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Promotional Banners"
      className={`relative w-full px-3 sm:px-4 md:px-6 lg:px-8 my-4 sm:my-5 md:my-7 select-none ${className}`}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Section Header */}
      {showHeader && (
        <div className="mb-2.5 sm:mb-3 md:mb-4 px-0.5">
          <h2 className="text-base sm:text-lg md:text-2xl font-bold text-neutral-900 tracking-tight">
            Special Offers & Promotions
          </h2>
          <p className="text-[11px] sm:text-xs md:text-sm text-neutral-500 mt-0.5">
            Handpicked deals curated just for you
          </p>
        </div>
      )}

      {/* Main Banner Card */}
      <div
        className={`relative w-full rounded-2xl md:rounded-3xl overflow-hidden shadow-sm border border-neutral-100 bg-neutral-900 group ${
          banner.targetType && banner.targetType !== "NONE" ? "cursor-pointer" : ""
        }`}
        onClick={() => handleClick(banner)}
        onTouchStart={(e) => {
          setIsPaused(true);
          touchStartX.current = e.touches[0].clientX;
          touchDeltaX.current = 0;
        }}
        onTouchMove={(e) => {
          if (touchStartX.current === null) return;
          touchDeltaX.current = e.touches[0].clientX - touchStartX.current;
        }}
        onTouchEnd={() => {
          if (Math.abs(touchDeltaX.current) > 35 && banners.length > 1) {
            if (touchDeltaX.current < 0) handleNext();
            else handlePrev();
          }
          touchStartX.current = null;
          touchDeltaX.current = 0;
          setIsPaused(false);
        }}
      >
        {/* Banner Media */}
        <div className="relative w-full min-h-[130px] sm:min-h-[170px] md:min-h-[220px] max-h-[260px] md:max-h-[300px] flex items-center justify-center overflow-hidden">
          {hasImage ? (
            <img
              key={banner._id + preferredImg}
              src={preferredImg}
              alt={banner.title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
              loading="lazy"
              onError={() => {
                setImgErrors((prev) => ({ ...prev, [banner._id]: true }));
              }}
            />
          ) : (
            /* Elegant styled text fallback if no image uploaded or image failed */
            <div className="w-full h-full min-h-[130px] sm:min-h-[170px] md:min-h-[220px] bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700 text-white flex flex-col items-center justify-center p-6 text-center">
              <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-white/20 backdrop-blur-sm mb-2">
                Special Offer
              </span>
              <h3 className="text-base sm:text-xl md:text-2xl font-black tracking-tight">{banner.title}</h3>
              {banner.subtitle && (
                <p className="text-xs sm:text-sm text-emerald-100 mt-1 max-w-md line-clamp-2">
                  {banner.subtitle}
                </p>
              )}
              {banner.ctaText && (
                <span className="mt-3 inline-flex items-center gap-1.5 px-4 py-1.5 bg-white text-emerald-700 font-bold text-xs sm:text-sm rounded-full shadow-sm">
                  {banner.ctaText} →
                </span>
              )}
            </div>
          )}

          {/* Overlay text on image if title/subtitle or CTA provided */}
          {hasImage && (banner.subtitle || banner.ctaText) && (
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent flex flex-col justify-end p-3 sm:p-5 md:p-6 text-white pointer-events-none">
              {banner.title && (
                <h3 className="text-sm sm:text-lg md:text-xl font-extrabold tracking-tight drop-shadow-sm line-clamp-1">
                  {banner.title}
                </h3>
              )}
              {banner.subtitle && (
                <p className="text-xs sm:text-sm text-neutral-200 mt-0.5 max-w-lg line-clamp-1 sm:line-clamp-2 drop-shadow-xs font-medium">
                  {banner.subtitle}
                </p>
              )}
              {banner.ctaText && (
                <div className="mt-2">
                  <span className="inline-flex items-center gap-1 px-3 py-1 sm:px-4 sm:py-1.5 bg-white text-neutral-900 text-[11px] sm:text-xs md:text-sm font-bold rounded-full shadow-sm">
                    {banner.ctaText}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Desktop Left/Right Navigation Chevrons */}
        {banners.length > 1 && (
          <>
            <button
              type="button"
              aria-label="Previous banner"
              onClick={(e) => {
                e.stopPropagation();
                handlePrev();
              }}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 hover:bg-black/70 text-white backdrop-blur-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 hidden sm:flex"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              type="button"
              aria-label="Next banner"
              onClick={(e) => {
                e.stopPropagation();
                handleNext();
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 hover:bg-black/70 text-white backdrop-blur-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 hidden sm:flex"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </>
        )}
      </div>

      {/* Pagination Dot Indicators */}
      {banners.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 pt-2" role="tablist" aria-label="Banner slides">
          {banners.map((b, i) => (
            <button
              key={b._id || i}
              type="button"
              role="tab"
              aria-selected={i === current}
              onClick={() => goTo(i)}
              aria-label={`Go to banner ${i + 1}`}
              className={`rounded-full transition-all duration-300 ${
                i === current
                  ? "w-6 h-1.5 bg-emerald-600 shadow-xs"
                  : "w-1.5 h-1.5 bg-neutral-300 hover:bg-neutral-400"
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
