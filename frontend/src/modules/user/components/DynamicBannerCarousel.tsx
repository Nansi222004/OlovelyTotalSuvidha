/**
 * DynamicBannerCarousel.tsx
 * 
 * Section-aware banner carousel component for the customer Home page.
 * - Fetches active banners from the Admin-managed Banner collection
 * - Auto-slides with configurable interval
 * - Falls back gracefully (renders nothing if no banners or API error)
 * - Error-safe: never breaks the parent page
 * - Supports click navigation (category, product, or external URL)
 * - Responsive: uses mobileImageUrl on small screens if available
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { getActiveBanners, type ActiveBanner } from "../../../services/api/customerBannerService";

interface Props {
  /** Commerce section to load banners for. Maps to channelFilter. */
  section?: "QUICK_COMMERCE" | "ECOMMERCE" | "WHOLESALE" | "ALL";
  /** Slide auto-advance interval in ms. Default 4500. */
  interval?: number;
  /** Extra className on the wrapper */
  className?: string;
}

export default function DynamicBannerCarousel({ section = "ALL", interval = 4500, className = "" }: Props) {
  const navigate = useNavigate();
  const [banners, setBanners] = useState<ActiveBanner[]>([]);
  const [current, setCurrent] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch banners on section change
  useEffect(() => {
    let cancelled = false;
    const fetchBanners = async () => {
      try {
        const data = await getActiveBanners(section);
        if (!cancelled) {
          setBanners(data);
          setCurrent(0);
          setLoaded(true);
        }
      } catch {
        // Service already handles errors and returns []; this is a safety net.
        if (!cancelled) setLoaded(true);
      }
    };
    fetchBanners();
    return () => { cancelled = true; };
  }, [section]);

  // Auto-advance
  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (banners.length > 1) {
      timerRef.current = setInterval(() => {
        setCurrent(c => (c + 1) % banners.length);
      }, interval);
    }
  }, [banners.length, interval]);

  useEffect(() => {
    startTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [startTimer]);

  const goTo = (idx: number) => {
    setCurrent(idx);
    startTimer(); // reset auto-advance on manual nav
  };

  const handleClick = (banner: ActiveBanner) => {
    if (banner.targetType === "CATEGORY" && banner.targetId) {
      navigate(`/category/${banner.targetId}`);
    } else if (banner.targetType === "PRODUCT" && banner.targetId) {
      navigate(`/product/${banner.targetId}`);
    } else if (banner.targetType === "URL" && banner.targetId) {
      window.open(banner.targetId, "_blank", "noopener,noreferrer");
    }
  };

  // Don't render if no banners
  if (!loaded || banners.length === 0) return null;

  const banner = banners[current];
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const imgSrc = (isMobile && banner.mobileImageUrl) ? banner.mobileImageUrl : banner.imageUrl;

  return (
    <div className={`relative w-full overflow-hidden select-none ${className}`} role="region" aria-label="Promotional Banners">
      {/* Banner Slide */}
      <div
        className={`relative w-full ${banner.targetType !== "NONE" ? "cursor-pointer" : ""}`}
        onClick={() => handleClick(banner)}
      >
        {imgSrc ? (
          <img
            key={banner._id + imgSrc}
            src={imgSrc}
            alt={banner.title}
            className="w-full object-cover transition-opacity duration-500 ease-in-out"
            style={{ maxHeight: 220, minHeight: 100 }}
            loading="lazy"
            onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          /* Text-only fallback banner */
          <div className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white flex flex-col items-center justify-center py-8 px-4">
            <p className="text-lg font-bold text-center leading-tight">{banner.title}</p>
            {banner.subtitle && <p className="text-sm mt-1 text-indigo-100 text-center">{banner.subtitle}</p>}
            {banner.ctaText && (
              <span className="mt-3 px-4 py-1.5 bg-white text-indigo-600 text-sm font-semibold rounded-full">
                {banner.ctaText}
              </span>
            )}
          </div>
        )}

        {/* Overlay text when image + text provided */}
        {imgSrc && (banner.subtitle || banner.ctaText) && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-4 py-3">
            {banner.subtitle && <p className="text-white text-xs font-medium leading-tight">{banner.subtitle}</p>}
            {banner.ctaText && (
              <span className="inline-block mt-1 px-3 py-0.5 bg-white/20 backdrop-blur-sm border border-white/40 text-white text-xs font-semibold rounded-full">
                {banner.ctaText}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Dot indicators (only if multiple banners) */}
      {banners.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 py-2">
          {banners.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              aria-label={`Go to banner ${i + 1}`}
              className={`rounded-full transition-all duration-300 ${
                i === current
                  ? "w-5 h-1.5 bg-indigo-600"
                  : "w-1.5 h-1.5 bg-gray-300 hover:bg-gray-400"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
