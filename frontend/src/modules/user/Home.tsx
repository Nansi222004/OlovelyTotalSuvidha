import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import HomeHero from "./components/HomeHero";
import PromoStrip from "./components/PromoStrip";
import LowestPricesEver from "./components/LowestPricesEver";
import CategoryTileSection from "./components/CategoryTileSection";
import BestsellerSection from "./components/BestsellerSection";
import FeaturedThisWeek from "./components/FeaturedThisWeek";
import ProductCard from "./components/ProductCard";
import { getHomeContent } from "../../services/api/customerHomeService";
import { useLocation } from "../../hooks/useLocation";
import PageLoader from "../../components/PageLoader";
import { useThemeContext } from "../../context/ThemeContext";
import { useTranslation } from "../../hooks/useTranslation";
import CommerceModeSwiper from "./components/CommerceModeSwiper";
import ChannelProductRow from "./components/ChannelProductRow";
import { getProducts } from "../../services/api/customerProductService";


import ChannelFilter, { ChannelFilterValue } from "../../components/ChannelFilter";
import { useCustomerChannel } from "../../context/CustomerChannelContext";

export default function Home() {
  const navigate = useNavigate();
  const { location } = useLocation();
  const { activeCategory, setActiveCategory } = useThemeContext();
  const { t, getTranslatedField } = useTranslation();
  const activeTab = activeCategory; // mapping for existing code compatibility
  const setActiveTab = setActiveCategory;
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollHandledRef = useRef(false);
  const SCROLL_POSITION_KEY = 'home-scroll-position';

  // State for dynamic data
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [homeData, setHomeData] = useState<any>({
    categories: [],
    homeSections: [], // Dynamic sections created by admin
    shops: [],
    promoBanners: [],
    trending: [],
    cookingIdeas: [],
  });

  const [products, setProducts] = useState<any[]>([]);
  const { activeChannel: channelFilter, setActiveChannel: setChannelFilter } = useCustomerChannel();

  // Channel products state for dedicated Quick Commerce, Ecommerce & Wholesale rows
  const [qcProducts, setQcProducts] = useState<any[]>([]);
  const [ecomProducts, setEcomProducts] = useState<any[]>([]);
  const [wholesaleProducts, setWholesaleProducts] = useState<any[]>([]);
  const [channelProductsLoading, setChannelProductsLoading] = useState(false);

  // Function to save scroll position before navigation
  const saveScrollPosition = () => {
    const mainElement = document.querySelector('main');
    const scrollPos = Math.max(
      mainElement ? mainElement.scrollTop : 0,
      window.scrollY || 0,
      document.documentElement.scrollTop || 0
    );
    if (scrollPos > 0) {
      sessionStorage.setItem(SCROLL_POSITION_KEY, scrollPos.toString());
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        // Pass the activeTab as slug (if it's not "all")
        // This ensures backend filters sections based on the category
        const slug = activeTab === "all" ? undefined : activeTab;

        const response = await getHomeContent(
          slug,
          location?.latitude,
          location?.longitude
        );
        if (response.success && response.data) {
          setHomeData(response.data);


        } else {
          setError("Failed to load content. Please try again.");
        }
      } catch (error) {
        console.error("Failed to fetch home content", error);
        setError("Network error. Please check your connection.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();

  }, [location?.latitude, location?.longitude, activeTab]);

  // Fetch dedicated channel products for Quick Commerce, Ecommerce & Wholesale
  useEffect(() => {
    let isMounted = true;
    const fetchChannelProducts = async () => {
      setChannelProductsLoading(true);
      try {
        const [qcRes, ecomRes, wsRes] = await Promise.all([
          getProducts({
            channel: 'QUICK_COMMERCE',
            limit: 10,
            latitude: location?.latitude,
            longitude: location?.longitude,
          }).catch((err) => {
            console.error('Failed to fetch QC products for home row', err);
            return { success: false, data: [] };
          }),
          getProducts({
            channel: 'ECOMMERCE',
            limit: 10,
          }).catch((err) => {
            console.error('Failed to fetch Ecommerce products for home row', err);
            return { success: false, data: [] };
          }),
          getProducts({
            channel: 'WHOLESALE',
            isWholesale: true,
            limit: 10,
          }).catch((err) => {
            console.error('Failed to fetch Wholesale products for home row', err);
            return { success: false, data: [] };
          }),
        ]);

        if (isMounted) {
          if (qcRes.success && qcRes.data) {
            setQcProducts(qcRes.data as any[]);
          }
          if (ecomRes.success && ecomRes.data) {
            setEcomProducts(ecomRes.data as any[]);
          }
          if (wsRes.success && wsRes.data) {
            setWholesaleProducts(wsRes.data as any[]);
          }
        }
      } catch (e) {
        console.error('Error fetching channel products for home', e);
      } finally {
        if (isMounted) {
          setChannelProductsLoading(false);
        }
      }
    };

    if (activeTab === 'all') {
      fetchChannelProducts();
    }

    return () => {
      isMounted = false;
    };
  }, [activeTab, location?.latitude, location?.longitude]);

  // Restore scroll position when returning to this page
  useEffect(() => {
    // Only restore scroll after data has loaded
    if (!loading && homeData.shops) {
      // Use a ref to ensure we only handle initial scroll once per mount
      if (scrollHandledRef.current) return;
      scrollHandledRef.current = true;

      const savedScrollPosition = sessionStorage.getItem(SCROLL_POSITION_KEY);
      if (savedScrollPosition) {
        const scrollY = parseInt(savedScrollPosition, 10);

        const performScroll = () => {
          const mainElement = document.querySelector('main');
          if (mainElement) {
            mainElement.scrollTop = scrollY;
          }
          window.scrollTo(0, scrollY);
        };

        // Try multiple times to ensure scroll is applied even if content is still rendering
        requestAnimationFrame(() => {
          performScroll();
          requestAnimationFrame(() => {
            performScroll();
            // Final fallback after a small delay for any late-rendering content
            setTimeout(performScroll, 100);
            setTimeout(performScroll, 300);
          });
        });

        // Clear the saved position after some time to ensure AppLayout can also see it if needed
        // but Home.tsx is the primary restorer now.
        setTimeout(() => {
          sessionStorage.removeItem(SCROLL_POSITION_KEY);
        }, 1000);
      } else {
        // No saved position, ensure we start at the top
        const performReset = () => {
          const mainElement = document.querySelector('main');
          if (mainElement) {
            mainElement.scrollTop = 0;
          }
          window.scrollTo(0, 0);
        };
        requestAnimationFrame(performReset);
        setTimeout(performReset, 100);
      }
    }
  }, [loading, homeData.shops]);

  // Global click/touch listener to save scroll position before any navigation
  useEffect(() => {
    const handleNavigationEvent = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement;
      // If clicking a link, button, or any element with cursor-pointer (like product cards/store tiles)
      if (target.closest('a') || target.closest('button') || target.closest('[role="button"]') || target.closest('.cursor-pointer')) {
        saveScrollPosition();
      }
    };

    window.addEventListener('click', handleNavigationEvent, { capture: true });
    window.addEventListener('touchstart', handleNavigationEvent, { capture: true, passive: true });
    return () => {
      window.removeEventListener('click', handleNavigationEvent, { capture: true });
      window.removeEventListener('touchstart', handleNavigationEvent, { capture: true });
    };
  }, []);

  const getFilteredProducts = (tabId: string) => {
    let list = products;
    if (channelFilter === 'QUICK_COMMERCE') {
      list = list.filter((p) => p.productType === 'QUICK_COMMERCE');
    } else if (channelFilter === 'ECOMMERCE') {
      list = list.filter((p) => p.productType === 'ECOMMERCE');
    } else if (channelFilter === 'WHOLESALE') {
      list = list.filter((p) => p.wholesaleEnabled && (p.wholesalePrice || 0) > 0);
    }
    if (tabId === "all") {
      return list;
    }
    return list.filter(
      (p) =>
        p.categoryId === tabId ||
        (p.category && (p.category._id === tabId || p.category.slug === tabId))
    );
  };

  const filteredProducts = useMemo(
    () => getFilteredProducts(activeTab),
    [activeTab, products, channelFilter]
  );

  const filteredLowestPrices = useMemo(() => {
    const list = homeData.lowestPrices || [];
    if (channelFilter === 'QUICK_COMMERCE') {
      return list.filter((p: any) => p.productType === 'QUICK_COMMERCE');
    }
    if (channelFilter === 'ECOMMERCE') {
      return list.filter((p: any) => p.productType === 'ECOMMERCE');
    }
    if (channelFilter === 'WHOLESALE') {
      return list.filter((p: any) => p.wholesaleEnabled && (p.wholesalePrice || 0) > 0);
    }
    return list;
  }, [homeData.lowestPrices, channelFilter]);

  if (loading && !products.length) {
    return <PageLoader />; // Let the global IconLoader handle the initial loading state
  }

  if (error && !loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-4 text-center">
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

  return (
    <div className="bg-white min-h-screen pb-20 md:pb-0" ref={contentRef}>
      {/* Hero Header with Gradient and Tabs */}
      <HomeHero activeTab={activeTab} onTabChange={setActiveTab} channelFilter={channelFilter} />

      {/* Customer Channel Segmented Filter */}
      <ChannelFilter
        value={channelFilter}
        onChange={setChannelFilter}
        activeTab={activeTab}
        className="sticky top-[98px] z-40"
      />

      {/* Promo Strip */}
      <PromoStrip activeTab={activeTab} />

      {/* LOWEST PRICES EVER Section */}
      {filteredLowestPrices.length > 0 && (
        <LowestPricesEver activeTab={activeTab} products={filteredLowestPrices} />
      )}


      {/* Main content */}
      <div
        className="bg-neutral-50 -mt-2 pt-1 space-y-5 md:space-y-8 md:pt-4">


        {/* Bestseller Cards Section - Render modern Bestseller Cards */}
        {activeTab === "all" && (
          <BestsellerSection
            title={t("customer.bestSellers", "Bestsellers")}
            tiles={homeData.bestsellers}
            loading={loading}
          />
        )}

        {/* Dynamic Commerce Mode Swiper — Communicates Quick Commerce, Ecommerce & Wholesale */}
        {activeTab === "all" && <CommerceModeSwiper channelFilter={channelFilter} />}

        {/* Dedicated Commerce Mode Product Rows */}
        {activeTab === "all" && (
          <>
            {/* Section A: Quick Commerce */}
            {(channelFilter === 'ALL' || channelFilter === 'QUICK_COMMERCE') && (
              <ChannelProductRow
                id="section-quick-commerce"
                title="Quick Commerce"
                subtitle="Everyday essentials, delivered locally"
                viewAllLink="/shop/quick-commerce"
                products={qcProducts}
                loading={channelProductsLoading}
                icon="⚡"
                themeColor="emerald"
              />
            )}

            {/* Section B: Ecommerce */}
            {(channelFilter === 'ALL' || channelFilter === 'ECOMMERCE') && (
              <ChannelProductRow
                id="section-ecommerce"
                title="Ecommerce"
                subtitle="Explore fashion, electronics, lifestyle and more"
                viewAllLink="/shop/ecommerce"
                products={ecomProducts}
                loading={channelProductsLoading}
                icon="📦"
                themeColor="blue"
              />
            )}

            {/* Section C: Wholesale Deals */}
            {(channelFilter === 'ALL' || channelFilter === 'WHOLESALE') && (
              <ChannelProductRow
                id="section-wholesale"
                title="Wholesale Deals"
                subtitle="Bulk buying with special wholesale prices"
                viewAllLink="/shop/wholesale"
                products={wholesaleProducts}
                loading={channelProductsLoading}
                isWholesale={true}
                icon="🏷️"
                themeColor="purple"
              />
            )}
          </>
        )}

        {/* Dynamic Home Sections - Render sections created by admin */}
        {homeData.homeSections && homeData.homeSections.length > 0 && (
          <>
            {homeData.homeSections.map((section: any) => {
              const columnCount = Number(section.columns) || 4;
              const sectionTitle = getTranslatedField(section, "title") || section.title;

              const sectionProducts = (section.data || []).filter((p: any) => {
                if (channelFilter === 'QUICK_COMMERCE') return p.productType === 'QUICK_COMMERCE';
                if (channelFilter === 'ECOMMERCE') return p.productType === 'ECOMMERCE';
                if (channelFilter === 'WHOLESALE') return p.wholesaleEnabled && (p.wholesalePrice || 0) > 0;
                return true;
              });

              if (section.displayType === "products") {
                if (sectionProducts.length === 0) {
                  return null;
                }

                // Strict column mapping as requested - applies to ALL screen sizes including mobile
                const gridClass = {
                  2: "grid-cols-2",
                  3: "grid-cols-3",
                  4: "grid-cols-4",
                  6: "grid-cols-6",
                  8: "grid-cols-8"
                }[columnCount] || "grid-cols-4";

                // Use compact mode for 4 or more columns to fit content on mobile
                const isCompact = columnCount >= 4;
                const gapClass = columnCount >= 4 ? "gap-2" : "gap-3 md:gap-4";

                return (
                  <div key={section.id} className="mt-6 mb-6 md:mt-8 md:mb-8">
                    {sectionTitle && (
                      <h2 className="text-lg md:text-2xl font-semibold text-neutral-900 mb-3 md:mb-6 px-4 md:px-6 lg:px-8 tracking-tight capitalize">
                        {sectionTitle}
                      </h2>
                    )}
                    <div className="px-4 md:px-6 lg:px-8">
                      <div className={`grid ${gridClass} ${gapClass}`}>
                        {sectionProducts.map((product: any) => (
                          <ProductCard
                            key={product.id || product._id}
                            product={product}
                            categoryStyle={true}
                            showBadge={true}
                            showPackBadge={false}
                            showStockInfo={false}
                            compact={isCompact}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                );
              }

              if (!section.data || section.data.length === 0) {
                return null;
              }

              return (
                <CategoryTileSection
                  key={section.id}
                  title={sectionTitle}
                  tiles={section.data || []}
                  columns={columnCount as 2 | 3 | 4 | 6 | 8}
                  showProductCount={false}
                />
              );
            })}
          </>
        )}

        {/* Filtered Products Section */}
        {activeTab !== "all" && filteredProducts.length > 0 && (
          <div data-products-section className="mt-6 mb-6 md:mt-8 md:mb-8">
            <h2 className="text-lg md:text-2xl font-semibold text-neutral-900 mb-3 md:mb-6 px-4 md:px-6 lg:px-8 tracking-tight capitalize">
              {activeTab === "grocery" ? t("home.groceryItems", "Grocery Items") : activeTab}
            </h2>
            <div className="px-4 md:px-6 lg:px-8">
              <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 md:gap-4">
                {filteredProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    categoryStyle={true}
                    showBadge={true}
                    showPackBadge={false}
                    showStockInfo={true}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "all" && (
          <>
            {/* Featured this week Section */}
            <FeaturedThisWeek products={homeData.featuredThisWeek || homeData.promoStrip?.featuredProducts || []} />

            {/* Shop by Store Section */}
            {(homeData.shops || []).length > 0 && (
              <div className="mb-6 mt-6 md:mb-8 md:mt-8">
                <div className="flex items-center justify-between mb-3 md:mb-4 px-4 md:px-6 lg:px-8">
                  <div>
                    <h2 className="text-lg md:text-2xl font-semibold text-neutral-900 tracking-tight">
                      {t("home.shopByStore", "Shop by Store")}
                    </h2>
                    <p className="text-xs md:text-sm text-neutral-500 mt-0.5">
                      {t("home.shopByStoreSubtitle", "Explore verified local & national vendors")}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      saveScrollPosition();
                      navigate("/stores");
                    }}
                    className="inline-flex items-center gap-1 text-xs md:text-sm font-semibold text-green-700 hover:text-green-800 bg-green-50 hover:bg-green-100 px-3 py-1.5 rounded-full transition-colors"
                  >
                    <span>{t("common.viewAll", "View All")}</span>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>

                <div className="px-4 md:px-6 lg:px-8">
                  {/* Mobile: Horizontal smooth scroll; Desktop: Responsive grid */}
                  <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-2 md:mx-0 md:px-0 md:grid md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 md:gap-4 scroll-smooth">
                    {(homeData.shops || []).map((tile: any) => {
                      const storeName = getTranslatedField(tile, "name") || tile.name || tile.storeName || "Store";
                      const storeImage = tile.logo || tile.image || tile.storeBanner || (tile.productImages && tile.productImages[0]) || "";
                      const hasProducts = tile.productCount > 0;

                      return (
                        <div
                          key={tile.id || tile._id}
                          onClick={() => {
                            const storeSlug = tile.id || tile._id || tile.slug;
                            saveScrollPosition();
                            navigate(`/store/${storeSlug}`);
                          }}
                          className="flex-shrink-0 w-[120px] md:w-auto bg-white rounded-xl p-2.5 border border-neutral-200 shadow-sm hover:shadow-md hover:border-green-300 transition-all cursor-pointer flex flex-col justify-between group"
                        >
                          <div>
                            {/* Logo / Image Container */}
                            <div className="w-full aspect-square rounded-lg bg-neutral-100 flex items-center justify-center overflow-hidden mb-2 relative">
                              {storeImage ? (
                                <img
                                  src={storeImage}
                                  alt={storeName}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                  onError={(e) => {
                                    (e.target as HTMLElement).style.display = "none";
                                    const parent = (e.target as HTMLElement).parentElement;
                                    if (parent) {
                                      parent.innerHTML = `<span class="text-2xl font-bold text-neutral-400">${storeName.charAt(0).toUpperCase()}</span>`;
                                    }
                                  }}
                                  loading="lazy"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-neutral-400">
                                  {storeName.charAt(0).toUpperCase()}
                                </div>
                              )}

                              {/* Vendor Type Badge */}
                              {tile.vendorType && (
                                <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-white/90 text-neutral-800 shadow-sm backdrop-blur-xs">
                                  {tile.vendorType === "QUICK_COMMERCE" ? "⚡ QC" : tile.vendorType === "ECOMMERCE" ? "🚚 Ecom" : "🔄 Hybrid"}
                                </span>
                              )}
                            </div>

                            {/* Store Name */}
                            <h3 className="text-xs font-semibold text-neutral-900 line-clamp-1 group-hover:text-green-700 transition-colors text-center">
                              {storeName}
                            </h3>
                          </div>

                          {/* Product Count or City */}
                          <div className="mt-1 text-center">
                            <span className="text-[10px] text-neutral-500 font-medium">
                              {hasProducts ? `${tile.productCount} items` : (tile.city || "Store Open")}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
