import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import LazyImage from "../../../components/LazyImage";
import { useTranslation } from "../../../hooks/useTranslation";

interface CategoryTile {
  id: string;
  name: string;
  productImages?: (string | undefined)[];
  image?: string; // Support single image property
  productCount?: number;
  categoryId?: string;
  subcategoryId?: string;
  productId?: string;
  sellerId?: string;
  bgColor?: string;
  slug?: string;
  type?: "subcategory" | "product" | "category";
}

interface CategoryTileSectionProps {
  title: string;
  tiles: CategoryTile[];
  columns?: 2 | 3 | 4 | 6 | 8; // Support all column options
  showProductCount?: boolean; // Show product count only for bestsellers
  onTileClick?: (tile: CategoryTile) => void; // Custom click handler
}

export default function CategoryTileSection({
  title,
  tiles,
  columns = 4,
  showProductCount = false,
  onTileClick,
}: CategoryTileSectionProps) {
  const navigate = useNavigate();
  const { t, getTranslatedField } = useTranslation();

  const handleTileClick = (tile: CategoryTile) => {
    if (onTileClick) {
        onTileClick(tile);
        return;
    }

    if (tile.subcategoryId || tile.type === "subcategory") {
      // Navigate to subcategory page or category with subcategory filter
      if (tile.categoryId) {
        navigate(
          `/category/${tile.categoryId}?subcategory=${tile.subcategoryId || tile.id
          }`
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
    if ((tile as any).sellerId) {
      // Navigate to seller's products page or category
      navigate(`/seller/${(tile as any).sellerId}`);
      return;
    }
    // Otherwise just log for now
    console.log("Clicked tile", tile.id);
  };

  // Dynamic grid classes based on column count
  const getGridCols = () => {
    switch (columns) {
      case 2:
        return "grid-cols-2";
      case 3:
        return "grid-cols-3";
      case 4:
        return "grid-cols-4";
      case 6:
        return "grid-cols-6";
      case 8:
        return "grid-cols-8";
      default:
        return "grid-cols-4";
    }
  };

  const gridCols = getGridCols();
  const gapClass = columns >= 6 ? "gap-1.5 md:gap-2.5" : "gap-2.5 md:gap-4";

  return (
    <div className="mb-6 md:mb-8 mt-0 overflow-visible">
      <h2 className="text-lg md:text-2xl font-semibold text-neutral-900 mb-3 md:mb-6 px-4 md:px-6 lg:px-8 tracking-tight">
        {title}
      </h2>
      <div className="px-4 md:px-6 lg:px-8 overflow-visible">
        <div className={`grid ${gridCols} ${gapClass} overflow-visible auto-rows-fr`}>
          {tiles.map((tile) => {
            const images =
              tile.productImages || (tile.image ? [tile.image] : []);
            const hasImages = images.filter(Boolean).length > 0;
            const tileName = getTranslatedField(tile, "name") || tile.name;

            return (
              <motion.div
                key={tile.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex flex-col">
                <Link
                  to={
                    tile.subcategoryId || tile.type === "subcategory"
                      ? tile.categoryId
                        ? `/category/${tile.categoryId}?subcategory=${tile.subcategoryId || tile.id
                        }`
                        : tile.slug
                          ? `/category/${tile.slug}`
                          : `/category/subcategory/${tile.subcategoryId || tile.id
                          }`
                      : tile.productId
                        ? `/product/${tile.productId}`
                        : tile.type === "category"
                          ? tile.slug
                            ? `/category/${tile.slug}`
                            : tile.categoryId
                              ? `/category/${tile.categoryId}`
                              : "#"
                          : tile.categoryId
                            ? `/category/${tile.categoryId}`
                            : (tile as any).sellerId
                              ? `/seller/${(tile as any).sellerId}`
                              : "#"
                  }
                  onClick={(e) => {
                    if (onTileClick) {
                        e.preventDefault();
                        onTileClick(tile);
                        return;
                    }
                    if (
                      !tile.categoryId &&
                      !tile.productId &&
                      !tile.subcategoryId &&
                      !(tile as any).sellerId
                    ) {
                      e.preventDefault();
                      handleTileClick(tile);
                    }
                  }}
                  className={
                    showProductCount
                      ? "block bg-white rounded-2xl shadow-2xs border border-neutral-200/80 hover:shadow-md transition-shadow h-full p-2.5"
                      : "group flex flex-col items-center cursor-pointer active:scale-95 select-none w-full"
                  }>
                  {showProductCount ? (
                    <>
                      {/* Bestsellers: 2x2 collage card */}
                      <div
                        className={`w-full rounded-xl overflow-hidden h-32 md:h-36 mb-2 ${
                          tile.bgColor || "bg-[#ecf7f6]"
                        }`}
                      >
                        {hasImages ? (
                          <div className="w-full h-full grid grid-cols-2 gap-0.5 p-0.5">
                            {images.slice(0, 4).map((img, idx) =>
                              img ? (
                                <LazyImage
                                  key={idx}
                                  src={img}
                                  alt=""
                                  className="w-full h-full object-contain bg-white rounded-sm"
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.style.display = "none";
                                  }}
                                />
                              ) : (
                                <div
                                  key={idx}
                                  className="w-full h-full bg-neutral-200 rounded-sm flex items-center justify-center text-xs text-neutral-400"
                                >
                                  {idx + 1}
                                </div>
                              )
                            )}
                          </div>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-3xl text-neutral-300">
                            {tileName.charAt(0)}
                          </div>
                        )}
                      </div>

                      {/* Product count */}
                      {tile.productCount && (
                        <div className="mb-1.5 flex justify-center">
                          <span className="inline-block bg-neutral-100 text-neutral-600 text-[10px] font-medium px-2 py-0.5 rounded-full leading-tight">
                            +{tile.productCount} {t("common.more", "more")}
                          </span>
                        </div>
                      )}

                      {/* Tile name inside card */}
                      <div className="text-sm font-bold text-neutral-900 line-clamp-2 leading-tight text-center w-full block">
                        {tileName}
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Standard Category Tile: Full fit with no padding */}
                      <div
                        className={`aspect-square w-full rounded-2xl ${
                          tile.bgColor || "bg-[#ecf7f6]"
                        } flex items-center justify-center overflow-hidden p-0 shadow-2xs group-hover:shadow-sm transition-all duration-200 relative`}
                      >
                        {hasImages ? (
                          <LazyImage
                            src={images[0] || ""}
                            alt={tileName}
                            className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-300"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = "none";
                              const parent = target.parentElement;
                              if (parent) {
                                parent.innerHTML = `<div class="w-full h-full flex items-center justify-center text-3xl text-neutral-300">${tileName.charAt(0)}</div>`;
                              }
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-3xl text-neutral-300">
                            {tileName.charAt(0)}
                          </div>
                        )}
                      </div>

                      {/* Category Name below container - max 2 lines, clean line-wrapping */}
                      <div className="mt-1.5 text-center text-sm font-bold text-neutral-900 leading-tight line-clamp-2 w-full break-words px-0.5 group-hover:text-emerald-700 transition-colors">
                        {tileName}
                      </div>
                    </>
                  )}
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
