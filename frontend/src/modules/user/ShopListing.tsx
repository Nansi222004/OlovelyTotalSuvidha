import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useLocation as useRouterLocation, Link } from 'react-router-dom';
import { getProducts, GetProductsParams } from '../../services/api/customerProductService';
import { Product } from '../../types/domain';
import { useLocation } from '../../hooks/useLocation';
import { useCustomerChannel } from '../../context/CustomerChannelContext';
import ProductCard from './components/ProductCard';
import PageLoader from '../../components/PageLoader';

export type ShopMode = 'quick-commerce' | 'ecommerce' | 'wholesale';

interface ShopListingProps {
  mode?: ShopMode;
}

interface ModeConfig {
  mode: ShopMode;
  channelKey: 'QUICK_COMMERCE' | 'ECOMMERCE' | 'WHOLESALE';
  title: string;
  subtitle: string;
  icon: string;
  badge: string;
  badgeBg: string;
  themeColor: string;
  metaTitle: string;
}

const MODE_CONFIGS: Record<ShopMode, ModeConfig> = {
  'quick-commerce': {
    mode: 'quick-commerce',
    channelKey: 'QUICK_COMMERCE',
    title: 'Quick Commerce',
    subtitle: 'Everyday essentials, delivered locally in minutes',
    icon: '⚡',
    badge: 'Local Fast Delivery',
    badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    themeColor: 'emerald',
    metaTitle: 'Quick Commerce - Fast Local Delivery | Olovely',
  },
  ecommerce: {
    mode: 'ecommerce',
    channelKey: 'ECOMMERCE',
    title: 'Ecommerce Collection',
    subtitle: 'Explore fashion, electronics, lifestyle and more via courier shipping',
    icon: '📦',
    badge: 'Nationwide Courier',
    badgeBg: 'bg-blue-50 text-blue-700 border-blue-200',
    themeColor: 'blue',
    metaTitle: 'Ecommerce - Nationwide Shipping | Olovely',
  },
  wholesale: {
    mode: 'wholesale',
    channelKey: 'WHOLESALE',
    title: 'Wholesale Deals',
    subtitle: 'Bulk buying with special wholesale prices and tiered business rates',
    icon: '🏷️',
    badge: 'Verified Bulk Deals',
    badgeBg: 'bg-purple-50 text-purple-700 border-purple-200',
    themeColor: 'purple',
    metaTitle: 'Wholesale Deals - Bulk Pricing & MOQs | Olovely',
  },
};

export default function ShopListing({ mode: propMode }: ShopListingProps) {
  const { mode: paramMode } = useParams<{ mode: string }>();
  const navigate = useNavigate();
  const routerLocation = useRouterLocation();
  const { location } = useLocation();
  const { setActiveChannel } = useCustomerChannel();

  // Resolve active mode from props, params, or pathname
  const activeMode: ShopMode = useMemo(() => {
    if (propMode && MODE_CONFIGS[propMode]) return propMode;
    if (paramMode && MODE_CONFIGS[paramMode as ShopMode]) return paramMode as ShopMode;
    if (routerLocation.pathname.includes('/wholesale')) return 'wholesale';
    if (routerLocation.pathname.includes('/ecommerce')) return 'ecommerce';
    return 'quick-commerce';
  }, [propMode, paramMode, routerLocation.pathname]);

  const config = MODE_CONFIGS[activeMode];

  // Set document title
  useEffect(() => {
    document.title = config.metaTitle;
  }, [config.metaTitle]);

  // Keep CustomerChannelContext aligned
  useEffect(() => {
    if (activeMode === 'wholesale') {
      setActiveChannel('WHOLESALE');
    } else if (activeMode === 'ecommerce') {
      setActiveChannel('ECOMMERCE');
    } else if (activeMode === 'quick-commerce') {
      setActiveChannel('QUICK_COMMERCE');
    }
  }, [activeMode, setActiveChannel]);

  // State
  const [products, setProducts] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<'popular' | 'price_asc' | 'price_desc' | 'discount'>('popular');

  const fetchProducts = useCallback(
    async (pageToFetch: number, isLoadMore = false) => {
      try {
        if (isLoadMore) {
          setLoadingMore(true);
        } else {
          setLoading(true);
          setError(null);
        }

        const params: GetProductsParams = {
          page: pageToFetch,
          limit: 16,
          sort,
        };

        if (activeMode === 'quick-commerce') {
          params.channel = 'QUICK_COMMERCE';
          if (location?.latitude && location?.longitude) {
            params.latitude = location.latitude;
            params.longitude = location.longitude;
          }
        } else if (activeMode === 'ecommerce') {
          params.channel = 'ECOMMERCE';
        } else if (activeMode === 'wholesale') {
          params.channel = 'WHOLESALE';
          params.isWholesale = 'true';
        }

        const response = await getProducts(params);

        if (response.success && response.data) {
          if (isLoadMore) {
            setProducts((prev) => [...prev, ...(response.data as any[])]);
          } else {
            setProducts(response.data as any[]);
          }
          setPage(response.pagination?.page || pageToFetch);
          setTotalPages(response.pagination?.pages || 1);
          setTotalCount(response.pagination?.total ?? response.data.length);
        } else {
          if (!isLoadMore) {
            setProducts([]);
            setError('Unable to load products. Please try again.');
          }
        }
      } catch (err: any) {
        console.error('Failed to load shop listing products', err);
        if (!isLoadMore) {
          setError(err.response?.data?.message || err.message || 'Failed to load products');
        }
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [activeMode, sort, location?.latitude, location?.longitude]
  );

  useEffect(() => {
    setPage(1);
    fetchProducts(1, false);
  }, [fetchProducts]);

  const handleLoadMore = () => {
    if (page < totalPages && !loadingMore) {
      fetchProducts(page + 1, true);
    }
  };

  const handleModeSwitch = (newMode: ShopMode) => {
    navigate(`/shop/${newMode}`);
  };

  return (
    <div className="min-h-screen bg-neutral-50 pb-20 md:pb-12">
      {/* Top Sticky Header */}
      <div className="sticky top-0 z-30 bg-white border-b border-neutral-200/80 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-3.5">
          <div className="flex items-center justify-between gap-3">
            {/* Back Button and Title */}
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <button
                id="shop-back-button"
                onClick={() => {
                  if (window.history.length > 1) {
                    navigate(-1);
                  } else {
                    navigate('/');
                  }
                }}
                aria-label="Back"
                className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-700 transition-colors flex-shrink-0 cursor-pointer"
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <span className="text-xl select-none">{config.icon}</span>
                  <h1 className="text-base sm:text-lg md:text-xl font-black text-neutral-900 truncate">
                    {config.title}
                  </h1>
                </div>
                {totalCount !== null && (
                  <p className="text-[11px] sm:text-xs text-neutral-500 font-medium truncate">
                    {totalCount} {totalCount === 1 ? 'product' : 'products'} available
                  </p>
                )}
              </div>
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <label htmlFor="shop-sort-select" className="sr-only">
                Sort products
              </label>
              <select
                id="shop-sort-select"
                value={sort}
                onChange={(e) => setSort(e.target.value as any)}
                className="text-xs sm:text-sm font-semibold bg-neutral-50 border border-neutral-300 rounded-lg px-2.5 py-1.5 text-neutral-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
              >
                <option value="popular">Most Popular</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
                <option value="discount">Highest Discount</option>
              </select>
            </div>
          </div>

          {/* Mode Switcher Nav Tabs */}
          <div className="flex gap-2 mt-3 pt-2 border-t border-neutral-100 overflow-x-auto scrollbar-hide">
            {(['quick-commerce', 'ecommerce', 'wholesale'] as ShopMode[]).map((m) => {
              const tabCfg = MODE_CONFIGS[m];
              const isSelected = activeMode === m;
              return (
                <button
                  key={m}
                  id={`tab-${m}`}
                  onClick={() => handleModeSwitch(m)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                    isSelected
                      ? m === 'wholesale'
                        ? 'bg-purple-700 text-white shadow-xs'
                        : m === 'ecommerce'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-emerald-700 text-white shadow-xs'
                      : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                  }`}
                >
                  <span>{tabCfg.icon}</span>
                  <span>{tabCfg.title}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 pt-4 sm:pt-6">
        {/* Banner Card */}
        <div
          className={`mb-5 sm:mb-6 p-4 sm:p-5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            activeMode === 'wholesale'
              ? 'bg-gradient-to-r from-purple-50 via-purple-100/40 to-white border-purple-200/80'
              : activeMode === 'ecommerce'
              ? 'bg-gradient-to-r from-blue-50 via-blue-100/40 to-white border-blue-200/80'
              : 'bg-gradient-to-r from-emerald-50 via-emerald-100/40 to-white border-emerald-200/80'
          }`}
        >
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[10px] sm:text-xs font-extrabold px-2 py-0.5 rounded-full border ${config.badgeBg}`}>
                {config.badge}
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-black text-neutral-900 tracking-tight">
              {config.title}
            </h2>
            <p className="text-xs sm:text-sm text-neutral-600 font-medium max-w-xl mt-0.5">
              {config.subtitle}
            </p>
          </div>

          <Link
            to="/"
            className="text-xs font-bold text-neutral-600 hover:text-neutral-900 inline-flex items-center gap-1 self-start sm:self-auto"
          >
            <span>Browse All Categories</span>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>

        {/* 1. Loading State */}
        {loading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-2.5 sm:gap-3.5 md:gap-4">
            {Array.from({ length: 10 }).map((_, idx) => (
              <div
                key={idx}
                className="bg-white rounded-xl p-3 border border-neutral-100 shadow-2xs animate-pulse flex flex-col"
              >
                <div className="w-full aspect-square bg-neutral-100 rounded-lg mb-3" />
                <div className="h-3 bg-neutral-200 rounded w-1/3 mb-2" />
                <div className="h-4 bg-neutral-200 rounded w-5/6 mb-2" />
                <div className="h-4 bg-neutral-100 rounded w-1/2 mb-4" />
                <div className="h-9 bg-neutral-100 rounded-lg w-full mt-auto" />
              </div>
            ))}
          </div>
        )}

        {/* 2. Error State */}
        {!loading && error && (
          <div className="bg-white rounded-2xl border border-red-200 p-8 sm:p-12 text-center max-w-md mx-auto my-8 shadow-xs">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
              ⚠️
            </div>
            <h3 className="text-lg font-bold text-neutral-900 mb-1">Failed to Load Products</h3>
            <p className="text-xs sm:text-sm text-neutral-600 mb-6">{error}</p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => fetchProducts(1, false)}
                className="px-5 py-2 bg-emerald-700 text-white rounded-lg text-sm font-bold hover:bg-emerald-800 transition-colors cursor-pointer"
              >
                Try Again
              </button>
              <button
                onClick={() => navigate('/')}
                className="px-5 py-2 bg-neutral-100 text-neutral-700 rounded-lg text-sm font-bold hover:bg-neutral-200 transition-colors cursor-pointer"
              >
                Go Home
              </button>
            </div>
          </div>
        )}

        {/* 3. Empty State */}
        {!loading && !error && products.length === 0 && (
          <div className="bg-white rounded-2xl border border-neutral-200/80 p-8 sm:p-12 text-center max-w-md mx-auto my-8 shadow-xs">
            <div className="w-16 h-16 bg-neutral-100 text-neutral-400 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
              {config.icon}
            </div>
            <h3 className="text-lg font-bold text-neutral-900 mb-1">
              No {config.title} Products Found
            </h3>
            <p className="text-xs sm:text-sm text-neutral-500 mb-6">
              {activeMode === 'quick-commerce'
                ? 'No local quick commerce products are currently serviceable at your current location.'
                : activeMode === 'wholesale'
                ? 'No wholesale-eligible products are available at this time.'
                : 'No ecommerce courier products are available right now. Please check back later.'}
            </p>
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 px-6 py-2.5 bg-emerald-700 text-white rounded-full text-sm font-bold hover:bg-emerald-800 transition-colors shadow-2xs"
            >
              <span>Return to Home</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        )}

        {/* 4. Product Grid */}
        {!loading && !error && products.length > 0 && (
          <>
            <div
              id="shop-product-grid"
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-2.5 sm:gap-3.5 md:gap-4"
            >
              {products.map((product) => (
                <div key={product.id || (product as any)._id} className="h-full">
                  <ProductCard
                    product={product}
                    categoryStyle={false}
                    showBadge={true}
                    showStockInfo={true}
                    forceWholesale={activeMode === 'wholesale'}
                  />
                </div>
              ))}
            </div>

            {/* Pagination / Load More */}
            {page < totalPages && (
              <div className="mt-8 sm:mt-10 text-center">
                <button
                  id="shop-load-more-btn"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="inline-flex items-center gap-2 px-8 py-3 bg-white border-2 border-neutral-300 hover:border-neutral-400 text-neutral-800 rounded-full font-bold text-sm shadow-2xs hover:shadow-xs active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                >
                  {loadingMore ? (
                    <>
                      <div className="w-4 h-4 border-2 border-neutral-400 border-t-transparent rounded-full animate-spin" />
                      <span>Loading more...</span>
                    </>
                  ) : (
                    <>
                      <span>Load More Products</span>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </>
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
