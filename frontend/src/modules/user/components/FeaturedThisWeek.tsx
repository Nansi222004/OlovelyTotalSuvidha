import { useTranslation } from '../../../hooks/useTranslation';
import ProductCard from './ProductCard';

interface FeaturedThisWeekProps {
  products?: any[];
}

export default function FeaturedThisWeek({ products }: FeaturedThisWeekProps) {
  const { t } = useTranslation();

  // If no products provided or empty array, cleanly hide the section (do not show fake fallback)
  if (!products || products.length === 0) {
    return null;
  }

  return (
    <section className="mb-6 mt-6 md:mb-8 md:mt-8" aria-label="Featured this week">
      <div className="flex items-center justify-between mb-3 md:mb-4 px-4 md:px-6 lg:px-8">
        <div>
          <h2 className="text-lg md:text-2xl font-semibold text-neutral-900 tracking-tight">
            {t("home.featuredThisWeek", "Featured this week")}
          </h2>
          <p className="text-xs md:text-sm text-neutral-500 mt-0.5">
            {t("home.featuredSubtitle", "Handpicked deals & top essentials for you")}
          </p>
        </div>
      </div>

      <div className="px-4 md:px-6 lg:px-8">
        {/* Mobile: horizontal scrollable carousel; Desktop: responsive grid */}
        <div className="flex gap-2.5 overflow-x-auto scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0 md:grid md:grid-cols-4 lg:grid-cols-6 md:gap-4 scroll-smooth">
          {products.map((product: any) => (
            <div
              key={product.id || product._id}
              className="flex-shrink-0 w-[140px] md:w-auto"
            >
              <ProductCard
                product={product}
                categoryStyle={true}
                showBadge={true}
                showPackBadge={false}
                showStockInfo={true}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
