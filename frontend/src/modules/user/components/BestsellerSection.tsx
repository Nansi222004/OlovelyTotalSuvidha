import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import LazyImage from "../../../components/LazyImage";
import { useTranslation } from "../../../hooks/useTranslation";

export interface BestsellerTile {
  id: string;
  name: string;
  productImages?: (string | undefined)[];
  image?: string;
  productCount?: number;
  categoryId?: string;
  subcategoryId?: string;
  productId?: string;
  sellerId?: string;
  slug?: string;
  type?: "subcategory" | "product" | "category";
  bgColor?: string;
  translations?: Record<string, any>;
}

interface BestsellerSectionProps {
  title?: string;
  tiles?: BestsellerTile[];
  loading?: boolean;
  onTileClick?: (tile: BestsellerTile) => void;
}

export default function BestsellerSection({
  title,
  tiles = [],
  loading = false,
  onTileClick,
}: BestsellerSectionProps) {
  const navigate = useNavigate();
  const { t, getTranslatedField } = useTranslation();

  // If loading, display clean skeleton cards matching dimensions
  if (loading) {
    return (
      <section className="mb-6 md:mb-8 mt-2 overflow-hidden" aria-label="Loading Bestsellers">
        <div className="flex items-center justify-between mb-3.5 md:mb-5 px-4 md:px-6 lg:px-8">
          <div className="h-6 w-32 bg-neutral-200 rounded animate-pulse" />
          <div className="h-4 w-16 bg-neutral-200 rounded animate-pulse" />
        </div>

        <div className="flex overflow-x-auto scrollbar-hide snap-x snap-mandatory gap-3 px-4 pb-2 -mx-4 md:mx-0 md:grid md:grid-cols-4 lg:grid-cols-6 md:gap-4 md:px-6 lg:px-8">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={idx}
              className="flex-none w-[145px] xs:w-[160px] sm:w-[175px] md:w-auto bg-white rounded-2xl p-2.5 border border-neutral-100 shadow-sm animate-pulse flex flex-col justify-between"
            >
              <div className="w-full aspect-square bg-neutral-100 rounded-xl mb-2.5" />
              <div className="h-3.5 bg-neutral-200 rounded w-3/4 mx-auto mb-2" />
              <div className="h-3 bg-neutral-100 rounded-full w-1/2 mx-auto" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  // 13. EMPTY STATE: Completely hide section if no tiles exist
  if (!tiles || tiles.length === 0) {
    return null;
  }

  const handleTileClick = (tile: BestsellerTile, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
    }

    if (onTileClick) {
      onTileClick(tile);
      return;
    }

    if (tile.subcategoryId || tile.type === "subcategory") {
      if (tile.categoryId) {
        navigate(
          `/category/${tile.categoryId}?subcategory=${tile.subcategoryId || tile.id}`
        );
      } else if (tile.slug) {
        navigate(`/category/${tile.slug}`);
      } else {
        navigate(`/category/subcategory/${tile.subcategoryId || tile.id}`);
      }
      return;
    }

    if (tile.categoryId) {
      navigate(`/category/${tile.categoryId}`);
      return;
    }

    if (tile.productId) {
      navigate(`/product/${tile.productId}`);
      return;
    }

    if (tile.sellerId) {
      navigate(`/seller/${tile.sellerId}`);
      return;
    }

    if (tile.slug) {
      navigate(`/category/${tile.slug}`);
    }
  };

  const getTargetUrl = (tile: BestsellerTile): string => {
    if (tile.subcategoryId || tile.type === "subcategory") {
      return tile.categoryId
        ? `/category/${tile.categoryId}?subcategory=${tile.subcategoryId || tile.id}`
        : tile.slug
          ? `/category/${tile.slug}`
          : `/category/subcategory/${tile.subcategoryId || tile.id}`;
    }
    if (tile.productId) return `/product/${tile.productId}`;
    if (tile.categoryId) return `/category/${tile.categoryId}`;
    if (tile.sellerId) return `/seller/${tile.sellerId}`;
    if (tile.slug) return `/category/${tile.slug}`;
    return "#";
  };

  // Helper to resolve 4 quadrant images with elegant fallbacks
  const getQuadrants = (tile: BestsellerTile): (string | null)[] => {
    const validImages = (tile.productImages || [])
      .filter((img): img is string => typeof img === "string" && img.trim().length > 0);

    if (validImages.length === 0 && tile.image && tile.image.trim().length > 0) {
      validImages.push(tile.image);
    }

    if (validImages.length === 0) {
      return [];
    }

    if (validImages.length === 1) {
      return [validImages[0], validImages[0], validImages[0], validImages[0]];
    }

    if (validImages.length === 2) {
      return [validImages[0], validImages[1], validImages[0], validImages[1]];
    }

    if (validImages.length === 3) {
      return [validImages[0], validImages[1], validImages[2], validImages[0]];
    }

    return validImages.slice(0, 4);
  };

  const displayTitle = title || t("customer.bestSellers", "Bestsellers");

  return (
    <section className="mb-6 md:mb-8 mt-2 overflow-hidden" aria-label={displayTitle}>
      {/* 1. SECTION HEADER */}
      <div className="flex items-center justify-between mb-3.5 md:mb-5 px-4 md:px-6 lg:px-8">
        <h2 className="text-lg md:text-2xl font-bold text-neutral-900 tracking-tight">
          {displayTitle}
        </h2>
        <Link
          to="/category/all"
          className="text-xs sm:text-sm font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 transition-colors group focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded-md px-1"
          aria-label={`${t("common.seeAll", "See all")} ${displayTitle}`}
        >
          <span>{t("common.seeAll", "See all")}</span>
          <svg
            className="w-3.5 h-3.5 md:w-4 md:h-4 transition-transform group-hover:translate-x-0.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>

      {/* 6. CAROUSEL / RESPONSIVE CONTAINER */}
      <div className="px-4 md:px-6 lg:px-8">
        <div className="flex overflow-x-auto scrollbar-hide snap-x snap-mandatory gap-3 pb-3 -mx-4 px-4 md:mx-0 md:px-0 md:pb-0 md:grid md:grid-cols-4 lg:grid-cols-6 md:gap-4 md:overflow-visible">
          {tiles.map((tile) => {
            const tileName = getTranslatedField(tile, "name") || tile.name || "Category";
            const quadrants = getQuadrants(tile);
            const targetUrl = getTargetUrl(tile);

            return (
              <motion.div
                key={tile.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.98 }}
                className="flex-none w-[145px] xs:w-[160px] sm:w-[175px] md:w-auto snap-start flex flex-col"
              >
                <Link
                  to={targetUrl}
                  onClick={(e) => handleTileClick(tile, e)}
                  className="group block bg-white rounded-2xl p-2.5 shadow-[0_2px_8px_rgba(0,0,0,0.05)] border border-neutral-200/80 hover:border-emerald-500/50 hover:shadow-md transition-all duration-200 h-full flex flex-col justify-between focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  aria-label={`${tileName} ${tile.productCount ? `with +${tile.productCount} more items` : ""}`}
                >
                  {/* 2 & 3. 2x2 IMAGE COLLAGE OR FALLBACK */}
                  <div className="w-full aspect-square bg-neutral-50/80 rounded-xl overflow-hidden border border-neutral-100 p-1 flex items-center justify-center">
                    {quadrants.length === 4 ? (
                      <div className="w-full h-full grid grid-cols-2 gap-1 rounded-lg overflow-hidden">
                        {quadrants.map((imgSrc, idx) => (
                          <div
                            key={idx}
                            className="w-full h-full bg-white rounded-md overflow-hidden relative border border-neutral-100/50"
                          >
                            {imgSrc ? (
                              <LazyImage
                                src={imgSrc}
                                alt={`${tileName} preview ${idx + 1}`}
                                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.style.opacity = "0.3";
                                }}
                              />
                            ) : (
                              <div className="w-full h-full bg-neutral-100 flex items-center justify-center text-[10px] text-neutral-400">
                                📦
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      /* Clean Icon Fallback when 0 preview images exist */
                      <div className="w-full h-full bg-gradient-to-br from-emerald-50/80 to-teal-50/60 rounded-lg flex flex-col items-center justify-center p-2 text-center border border-emerald-100/60">
                        <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm mb-1 shadow-sm">
                          {tileName.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-[10px] font-semibold text-emerald-800 line-clamp-1">
                          {tileName}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* 4 & 5. CATEGORY NAME & "+X MORE" BADGE */}
                  <div className="mt-2.5 flex flex-col items-center text-center flex-1 justify-between gap-1.5">
                    <h3 className="text-xs sm:text-sm font-bold text-neutral-900 line-clamp-2 leading-tight tracking-tight min-h-[32px] flex items-center justify-center group-hover:text-emerald-700 transition-colors">
                      {tileName}
                    </h3>

                    {Boolean(tile.productCount && tile.productCount > 0) && (
                      <span className="inline-flex items-center gap-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200/60 text-[10px] sm:text-xs font-bold px-2.5 py-0.5 rounded-full shadow-2xs">
                        +{tile.productCount} {t("common.more", "more")}
                      </span>
                    )}
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
