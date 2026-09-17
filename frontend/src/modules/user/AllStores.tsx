import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getAllStores } from "../../services/api/customerHomeService";
import { useLocation } from "../../hooks/useLocation";
import { useTranslation } from "../../hooks/useTranslation";

interface StoreItem {
  id: string;
  _id: string;
  name: string;
  storeName: string;
  image?: string;
  logo?: string;
  storeBanner?: string;
  description?: string;
  vendorType: "QUICK_COMMERCE" | "ECOMMERCE" | "HYBRID";
  wholesaleEnabled?: boolean;
  city?: string;
  productCount: number;
  productImages?: string[];
  slug: string;
}

export default function AllStores() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { location } = useLocation();
  const { t } = useTranslation();

  const initialChannel = searchParams.get("channel") || "ALL";
  const initialSearch = searchParams.get("search") || "";
  const initialPage = parseInt(searchParams.get("page") || "1", 10);

  const [stores, setStores] = useState<StoreItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [activeChannel, setActiveChannel] = useState<string>(initialChannel);
  const [page, setPage] = useState<number>(initialPage);
  const [pagination, setPagination] = useState<{
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  }>({ page: 1, limit: 12, total: 0, totalPages: 1 });

  const fetchStoresData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params: any = {
        page,
        limit: 12,
        channel: activeChannel,
      };

      if (searchQuery.trim()) {
        params.search = searchQuery.trim();
      }

      if (location?.latitude && location?.longitude) {
        params.latitude = location.latitude;
        params.longitude = location.longitude;
      }

      const res = await getAllStores(params);
      if (res.success && res.data) {
        setStores(res.data);
        if (res.pagination) {
          setPagination(res.pagination);
        }
      } else {
        setStores([]);
      }
    } catch (err: any) {
      console.error("Error loading stores:", err);
      setError(err.response?.data?.message || "Failed to load stores. Please try again.");
      setStores([]);
    } finally {
      setLoading(false);
    }
  }, [page, activeChannel, searchQuery, location]);

  useEffect(() => {
    fetchStoresData();
  }, [fetchStoresData]);

  const handleChannelChange = (channel: string) => {
    setActiveChannel(channel);
    setPage(1);
    const newParams = new URLSearchParams(searchParams);
    newParams.set("channel", channel);
    newParams.set("page", "1");
    setSearchParams(newParams);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    const newParams = new URLSearchParams(searchParams);
    if (searchQuery.trim()) {
      newParams.set("search", searchQuery.trim());
    } else {
      newParams.delete("search");
    }
    newParams.set("page", "1");
    setSearchParams(newParams);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
    const newParams = new URLSearchParams(searchParams);
    newParams.set("page", newPage.toString());
    setSearchParams(newParams);
  };

  const clearSearch = () => {
    setSearchQuery("");
    setPage(1);
    const newParams = new URLSearchParams(searchParams);
    newParams.delete("search");
    newParams.set("page", "1");
    setSearchParams(newParams);
  };

  return (
    <div className="min-h-screen bg-neutral-50 pb-20 md:pb-12">
      {/* Header Sticky Bar */}
      <header className="sticky top-0 z-30 bg-white border-b border-neutral-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-3">
            {/* Back Button & Title */}
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => navigate(-1)}
                className="w-10 h-10 rounded-full flex items-center justify-center bg-neutral-100 hover:bg-neutral-200 text-neutral-700 transition-colors flex-shrink-0"
                aria-label="Back"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h1 className="text-lg md:text-xl font-bold text-neutral-900 truncate">
                  {t("stores.allStoresTitle", "All Stores & Vendors")}
                </h1>
                <p className="text-xs text-neutral-500 hidden sm:block">
                  {pagination.total > 0
                    ? `${pagination.total} verified stores available`
                    : "Browse verified local & national sellers"}
                </p>
              </div>
            </div>

            {/* Search Input */}
            <form onSubmit={handleSearchSubmit} className="flex-1 max-w-md relative">
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t("stores.searchPlaceholder", "Search stores by name or city...")}
                  className="w-full pl-9 pr-9 py-2 bg-neutral-100 border border-neutral-200 rounded-full text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                />
                <svg
                  className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                  />
                </svg>
                {searchQuery && (
                  <button
                    type="button"
                    onClick={clearSearch}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Channel Filter Tabs */}
          <div className="flex gap-2 overflow-x-auto scrollbar-hide py-2.5 border-t border-neutral-100">
            {[
              { key: "ALL", label: "All Stores", icon: "🏬" },
              { key: "QUICK_COMMERCE", label: "Quick Commerce", icon: "⚡" },
              { key: "ECOMMERCE", label: "Nationwide E-com", icon: "🚚" },
              { key: "WHOLESALE", label: "Wholesale Eligible", icon: "🏢" },
            ].map((tab) => {
              const isActive = activeChannel === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => handleChannelChange(tab.key)}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                    isActive
                      ? "bg-green-600 text-white shadow-sm"
                      : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                  }`}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Loading State */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl p-4 border border-neutral-200 shadow-sm animate-pulse flex flex-col justify-between h-56"
              >
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 bg-neutral-200 rounded-xl flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-neutral-200 rounded w-3/4" />
                    <div className="h-3 bg-neutral-200 rounded w-1/2" />
                  </div>
                </div>
                <div className="space-y-2 my-4">
                  <div className="h-3 bg-neutral-200 rounded w-full" />
                  <div className="h-3 bg-neutral-200 rounded w-2/3" />
                </div>
                <div className="h-8 bg-neutral-200 rounded-lg w-full" />
              </div>
            ))}
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center max-w-md mx-auto my-12">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-neutral-900 mb-1">Failed to load stores</h3>
            <p className="text-xs text-neutral-600 mb-4">{error}</p>
            <button
              onClick={fetchStoresData}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg shadow transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && stores.length === 0 && (
          <div className="bg-white border border-neutral-200 rounded-2xl p-12 text-center max-w-lg mx-auto my-12 shadow-sm">
            <div className="w-16 h-16 rounded-full bg-neutral-100 text-neutral-400 flex items-center justify-center mx-auto mb-4 text-3xl">
              🏬
            </div>
            <h3 className="text-lg font-bold text-neutral-900 mb-1">No stores found</h3>
            <p className="text-sm text-neutral-500 mb-6">
              {searchQuery
                ? `No stores matched your search "${searchQuery}" in ${activeChannel === 'ALL' ? 'all channels' : activeChannel}.`
                : "No eligible stores are available under this channel filter right now."}
            </p>
            <button
              onClick={() => {
                setSearchQuery("");
                setActiveChannel("ALL");
                setPage(1);
                setSearchParams(new URLSearchParams());
              }}
              className="px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-full shadow transition-colors"
            >
              Reset Filters
            </button>
          </div>
        )}

        {/* Stores Grid */}
        {!loading && !error && stores.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-medium text-neutral-500">
                Showing {stores.length} of {pagination.total} stores
              </span>
              {activeChannel !== "ALL" && (
                <span className="text-xs font-semibold text-green-700 bg-green-50 px-2.5 py-1 rounded-full">
                  Filtered by {activeChannel.replace("_", " ")}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {stores.map((store) => {
                const storeName = store.storeName || store.name || "Store";
                const logoSrc = store.logo || store.image || store.storeBanner;
                const hasProducts = store.productCount > 0;

                return (
                  <div
                    key={store.id}
                    onClick={() => navigate(`/store/${store.id}`)}
                    className="bg-white rounded-2xl p-4 border border-neutral-200 shadow-sm hover:shadow-md hover:border-green-300 transition-all cursor-pointer flex flex-col justify-between group relative overflow-hidden"
                  >
                    {/* Top Section: Logo & Titles */}
                    <div>
                      <div className="flex items-start gap-3">
                        {/* Store Logo with Fallback */}
                        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-neutral-50 to-neutral-100 border border-neutral-200 flex-shrink-0 overflow-hidden flex items-center justify-center shadow-inner">
                          {logoSrc ? (
                            <img
                              src={logoSrc}
                              alt={storeName}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                              onError={(e) => {
                                // On broken logo, replace with initial letter fallback
                                (e.target as HTMLElement).style.display = "none";
                                const parent = (e.target as HTMLElement).parentElement;
                                if (parent) {
                                  parent.innerHTML = `<span class="text-xl font-bold text-neutral-400">${storeName.charAt(0).toUpperCase()}</span>`;
                                }
                              }}
                              loading="lazy"
                            />
                          ) : (
                            <span className="text-xl font-bold text-neutral-400">
                              {storeName.charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>

                        {/* Store Info */}
                        <div className="flex-1 min-w-0">
                          <h3 className="text-base font-bold text-neutral-900 group-hover:text-green-700 transition-colors line-clamp-1">
                            {storeName}
                          </h3>
                          {store.city && (
                            <p className="text-xs text-neutral-500 flex items-center gap-1 mt-0.5">
                              <svg className="w-3.5 h-3.5 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              <span className="truncate">{store.city}</span>
                            </p>
                          )}
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {/* Vendor Type Badges */}
                            {store.vendorType === "QUICK_COMMERCE" && (
                              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                ⚡ Local
                              </span>
                            )}
                            {store.vendorType === "ECOMMERCE" && (
                              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-50 text-sky-700 border border-sky-200">
                                🚚 Courier
                              </span>
                            )}
                            {store.vendorType === "HYBRID" && (
                              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                                🔄 Local & Courier
                              </span>
                            )}
                            {store.wholesaleEnabled && (
                              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                🏢 Wholesale
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Description */}
                      {store.description && (
                        <p className="text-xs text-neutral-600 line-clamp-2 mt-3 leading-relaxed">
                          {store.description}
                        </p>
                      )}
                    </div>

                    {/* Bottom Action Section */}
                    <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between">
                      <span className="text-xs text-neutral-500 font-medium">
                        {hasProducts ? (
                          <span className="text-neutral-700 font-semibold">{store.productCount} items</span>
                        ) : (
                          <span className="text-neutral-400">Store Open</span>
                        )}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 group-hover:translate-x-0.5 transition-transform">
                        <span>Visit Store</span>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination Controls */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <button
                  onClick={() => handlePageChange(Math.max(1, page - 1))}
                  disabled={page <= 1}
                  className="px-3.5 py-1.5 rounded-lg border border-neutral-300 bg-white text-xs font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>

                <div className="flex items-center gap-1">
                  {[...Array(pagination.totalPages)].map((_, idx) => {
                    const pNum = idx + 1;
                    // Show first, last, current, and surrounding pages
                    if (
                      pNum === 1 ||
                      pNum === pagination.totalPages ||
                      Math.abs(pNum - page) <= 1
                    ) {
                      return (
                        <button
                          key={pNum}
                          onClick={() => handlePageChange(pNum)}
                          className={`w-8 h-8 rounded-lg text-xs font-semibold transition-colors ${
                            pNum === page
                              ? "bg-green-600 text-white"
                              : "bg-white border border-neutral-300 text-neutral-700 hover:bg-neutral-50"
                          }`}
                        >
                          {pNum}
                        </button>
                      );
                    }
                    if (
                      pNum === 2 && page > 3 ||
                      pNum === pagination.totalPages - 1 && page < pagination.totalPages - 2
                    ) {
                      return (
                        <span key={pNum} className="px-1 text-xs text-neutral-400">
                          ...
                        </span>
                      );
                    }
                    return null;
                  })}
                </div>

                <button
                  onClick={() => handlePageChange(Math.min(pagination.totalPages, page + 1))}
                  disabled={page >= pagination.totalPages}
                  className="px-3.5 py-1.5 rounded-lg border border-neutral-300 bg-white text-xs font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
