import { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { getHeaderCategoriesPublic, HeaderCategory } from "../../services/api/headerCategoryService";
import { getCategories, Category as ApiCategory } from "../../services/api/customerProductService";
import { getIconByName } from "../../utils/iconLibrary";
import { useTranslation } from "../../hooks/useTranslation";
import { motion, AnimatePresence } from "framer-motion";
import "./styles/Categories.css";

interface GroupedCategory extends HeaderCategory {
  categories: ApiCategory[];
}

export default function Categories() {
  const navigate = useNavigate();
  const { t, getTranslatedField } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [headerCategories, setHeaderCategories] = useState<HeaderCategory[]>([]);
  const [allCategories, setAllCategories] = useState<ApiCategory[]>([]);

  // Search and Tab Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<string>("all");

  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  // Fetch all categories and published header categories in parallel
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const [headers, catRes] = await Promise.all([
          getHeaderCategoriesPublic(true),
          getCategories(false, true), // Flat list of categories
        ]);

        setHeaderCategories(headers || []);
        setAllCategories(catRes?.data || []);
      } catch (err) {
        console.error("Failed to fetch categories data:", err);
        setError("Network error. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Dynamically group categories by Header Category ID
  const allGroups = useMemo<GroupedCategory[]>(() => {
    if (!allCategories.length) return [];

    const groups: GroupedCategory[] = headerCategories
      .filter((h) => h.status === "Published" && h.slug !== "all")
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .map((header) => {
        const matchingCategories = allCategories.filter((cat) => {
          // Only show top-level categories (no parentId) under headers
          if (cat.parentId) return false;

          // headerCategoryId might be an object or a string
          const headerId =
            typeof cat.headerCategoryId === "object"
              ? cat.headerCategoryId?._id
              : cat.headerCategoryId;

          return headerId?.toString() === header._id.toString();
        });

        return {
          ...header,
          categories: matchingCategories.sort(
            (a, b) => (a.order || 0) - (b.order || 0)
          ),
        };
      })
      .filter((group) => group.categories.length > 0);

    // Fallback: collect any root categories that weren't mapped to a header category
    const matchedCategoryIds = new Set(
      groups.flatMap((group) => group.categories.map((c) => c._id))
    );
    const unmappedCategories = allCategories.filter(
      (cat) => !cat.parentId && !matchedCategoryIds.has(cat._id)
    );

    if (unmappedCategories.length > 0) {
      groups.push({
        _id: "other-categories",
        name: t("common.otherCategories", "Other Categories"),
        slug: "other",
        iconName: "grid",
        iconLibrary: "Custom",
        status: "Published",
        order: 9999,
        categories: unmappedCategories.sort(
          (a, b) => (a.order || 0) - (b.order || 0)
        ),
      } as GroupedCategory);
    }

    return groups;
  }, [headerCategories, allCategories, t]);

  // Filter groups based on selected Tab and Client-Side Search Query
  const filteredGroups = useMemo(() => {
    let groups = allGroups;

    // Filter by active Header Category tab if not "all"
    if (activeTab !== "all") {
      groups = groups.filter(
        (g) => g._id === activeTab || g.slug === activeTab
      );
    }

    // Filter by search query if text is present
    const query = searchQuery.trim().toLowerCase();
    if (query) {
      groups = groups
        .map((group) => {
          const matchingCats = group.categories.filter((cat) => {
            const name = (
              getTranslatedField(cat, "name") ||
              cat.name ||
              ""
            ).toLowerCase();
            const desc = (cat.description || "").toLowerCase();
            return name.includes(query) || desc.includes(query);
          });

          return {
            ...group,
            categories: matchingCats,
          };
        })
        .filter((group) => group.categories.length > 0);
    }

    return groups;
  }, [allGroups, activeTab, searchQuery, getTranslatedField]);

  // Total matching categories across visible groups
  const totalMatchingCategoriesCount = useMemo(() => {
    return filteredGroups.reduce((acc, g) => acc + g.categories.length, 0);
  }, [filteredGroups]);

  // Handle Tab Click and Auto-scroll tab into view
  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId);
    const tabEl = tabRefs.current.get(tabId);
    if (tabEl && tabsContainerRef.current) {
      tabEl.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  };

  // Clear search input
  const handleClearSearch = () => {
    setSearchQuery("");
  };

  // 1. Loading Skeleton State
  if (loading) {
    return (
      <div className="categories-container font-sans bg-white min-h-screen">
        {/* Skeleton Header */}
        <div className="px-4 pt-4 pb-3 border-b border-slate-100 bg-white">
          <div className="w-32 h-7 rounded-lg skeleton-shimmer mb-1.5" />
          <div className="w-48 h-3.5 rounded-md skeleton-shimmer mb-3" />
          <div className="w-full h-10 rounded-xl skeleton-shimmer" />
        </div>

        {/* Skeleton Tabs */}
        <div className="px-4 py-2.5 flex items-center gap-2 overflow-x-hidden border-b border-slate-100 bg-white">
          {[80, 100, 120, 110, 95].map((w, i) => (
            <div
              key={i}
              style={{ width: `${w}px` }}
              className="h-9 rounded-full skeleton-shimmer flex-shrink-0"
            />
          ))}
        </div>

        {/* Skeleton Section & Cards */}
        <div className="p-4 space-y-6">
          {[1, 2].map((s) => (
            <div key={s} className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-lg skeleton-shimmer" />
                  <div className="w-28 h-5 rounded-md skeleton-shimmer" />
                  <div className="w-20 h-4 rounded-full skeleton-shimmer" />
                </div>
                <div className="w-16 h-4 rounded-md skeleton-shimmer" />
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2.5 sm:gap-3.5">
                {[1, 2, 3, 4, 5, 6].map((c) => (
                  <div
                    key={c}
                    className="relative aspect-square w-full rounded-2xl overflow-hidden skeleton-shimmer flex flex-col justify-end p-2.5"
                  >
                    <div className="w-3/4 h-3 rounded-md bg-slate-300/60 mx-auto" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 2. Error State
  if (error && !allGroups.length) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center bg-white">
        <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mb-4 border border-red-100 shadow-sm">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-slate-900 mb-1">{t("common.oops", "Oops!")}</h3>
        <p className="text-sm text-slate-500 mb-5 max-w-xs">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold shadow-sm transition-all text-sm active:scale-95 cursor-pointer"
        >
          {t("common.retry", "Retry")}
        </button>
      </div>
    );
  }

  return (
    <div className="categories-container font-sans">
      {/* 1. Page Header: Title + Subtitle + Search Field */}
      <div className="bg-white px-4 pt-4 pb-3 border-b border-slate-100/90 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
        <div className="flex flex-col mb-3">
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-tight">
            {t("common.categories", "Categories")}
          </h1>
          <p className="text-slate-500 font-medium text-xs mt-0.5">
            {t("customer.discoverProductsByCategory", "Explore products by category")}
          </p>
        </div>

        {/* Search Bar */}
        <div className="relative w-full">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("customer.searchCategories", "Search categories...")}
            className="w-full pl-9 pr-9 py-2 bg-slate-50 hover:bg-slate-100/80 focus:bg-white text-slate-800 placeholder-slate-400 text-xs sm:text-sm rounded-xl border border-slate-200/90 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
          />
          {searchQuery && (
            <button
              onClick={handleClearSearch}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              aria-label="Clear search"
            >
              <svg className="w-4 h-4 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-full p-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Live Search Result Indicator */}
        {searchQuery && (
          <div className="flex items-center justify-between mt-2 pt-1 text-xs text-slate-500">
            <span>
              {totalMatchingCategoriesCount === 1
                ? `1 category matching "${searchQuery}"`
                : `${totalMatchingCategoriesCount} categories matching "${searchQuery}"`}
            </span>
            <button
              onClick={handleClearSearch}
              className="text-emerald-600 hover:text-emerald-700 font-semibold cursor-pointer"
            >
              {t("common.clear", "Clear")}
            </button>
          </div>
        )}
      </div>

      {/* 2. Header Category Navigation Tabs (Horizontally Scrollable) */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-slate-100 px-3 sm:px-4 py-2.5 shadow-[0_2px_6px_rgba(0,0,0,0.02)]">
        <div
          ref={tabsContainerRef}
          className="flex items-center gap-2 overflow-x-auto scrollbar-hide py-0.5"
        >
          {/* "All" Tab */}
          <button
            ref={(el) => {
              if (el) tabRefs.current.set("all", el);
              else tabRefs.current.delete("all");
            }}
            onClick={() => handleTabClick("all")}
            className={`tab-pill flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-all flex-shrink-0 ${
              activeTab === "all"
                ? "bg-emerald-600 text-white shadow-sm shadow-emerald-200 border border-emerald-600"
                : "bg-slate-100/90 text-slate-700 hover:bg-slate-200/80 border border-slate-200/60"
            }`}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <rect x="3" y="3" width="7" height="7" rx="1.5" />
              <rect x="14" y="3" width="7" height="7" rx="1.5" />
              <rect x="14" y="14" width="7" height="7" rx="1.5" />
              <rect x="3" y="14" width="7" height="7" rx="1.5" />
            </svg>
            <span>{t("common.all", "All")}</span>
          </button>

          {/* Dynamic Published Header Categories */}
          {allGroups.map((group) => {
            const isTabActive = activeTab === group._id || activeTab === group.slug;
            return (
              <button
                key={group._id}
                ref={(el) => {
                  if (el) {
                    tabRefs.current.set(group._id, el);
                    if (group.slug) tabRefs.current.set(group.slug, el);
                  } else {
                    tabRefs.current.delete(group._id);
                    if (group.slug) tabRefs.current.delete(group.slug);
                  }
                }}
                onClick={() => handleTabClick(group._id)}
                className={`tab-pill flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-all flex-shrink-0 ${
                  isTabActive
                    ? "bg-emerald-600 text-white shadow-sm shadow-emerald-200 border border-emerald-600"
                    : "bg-slate-100/90 text-slate-700 hover:bg-slate-200/80 border border-slate-200/60"
                }`}
              >
                <span className="w-3.5 h-3.5 flex items-center justify-center flex-shrink-0 text-current [&>svg]:w-3.5 [&>svg]:h-3.5">
                  {getIconByName(group.iconName)}
                </span>
                <span>{getTranslatedField(group, "name") || group.name}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ml-0.5 ${
                    isTabActive
                      ? "bg-emerald-700/80 text-white"
                      : "bg-slate-200/80 text-slate-600"
                  }`}
                >
                  {group.categories.length}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Category Sections List Area */}
      <div className="categories-scroll-area px-3 sm:px-4 py-4 space-y-6 sm:space-y-8">
        <AnimatePresence mode="popLayout">
          {filteredGroups.map((group, groupIndex) => (
            <motion.section
              key={group._id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.3, delay: groupIndex * 0.05 }}
              className="space-y-3"
            >
              {/* Section Header with Icon, Name, Count Badge, and 'View all >' */}
              <div className="flex items-center justify-between pb-0.5">
                <div className="flex items-center gap-2">
                  <div className="text-emerald-600 flex items-center justify-center [&>svg]:w-5 [&>svg]:h-5">
                    {getIconByName(group.iconName)}
                  </div>
                  <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight leading-none">
                    {getTranslatedField(group, "name") || group.name}
                  </h2>
                  <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 text-[11px] font-semibold px-2 py-0.5 rounded-full">
                    {group.categories.length === 1
                      ? `1 category`
                      : `${group.categories.length} categories`}
                  </span>
                </div>

                {activeTab === "all" && (
                  <button
                    onClick={() => handleTabClick(group._id)}
                    className="text-emerald-700 hover:text-emerald-800 text-xs font-bold flex items-center gap-0.5 cursor-pointer hover:underline"
                  >
                    <span>View all</span>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                )}
              </div>

              {/* 4. Full Coverage Category Cards Grid */}
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-2.5 sm:gap-3.5 category-mobile-grid">
                {group.categories.map((category) => (
                  <motion.div
                    key={category._id}
                    whileHover={{ y: -3, scale: 1.02 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => navigate(`/category/${category._id}`)}
                    className="group relative aspect-square w-full rounded-2xl overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_20px_rgba(0,0,0,0.15)] transition-all duration-300 cursor-pointer bg-slate-100 active:scale-95 select-none"
                  >
                    {/* Full Image Coverage (No Padding, No White Space) */}
                    {category.image ? (
                      <img
                        src={category.image}
                        alt={getTranslatedField(category, "name") || category.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                        onError={(e) => {
                          // Fallback to icon if image fails to load
                          (e.target as HTMLElement).style.display = "none";
                          const fallbackEl = (e.target as HTMLElement).nextElementSibling;
                          if (fallbackEl) (fallbackEl as HTMLElement).style.display = "flex";
                        }}
                      />
                    ) : null}

                    {/* Fallback Icon Container */}
                    <div
                      className={`w-full h-full bg-gradient-to-br from-emerald-50 via-slate-100 to-emerald-100 text-3xl sm:text-4xl text-emerald-700/80 ${
                        category.image ? "hidden" : "flex"
                      } items-center justify-center`}
                    >
                      {category.icon || "📦"}
                    </div>

                    {/* Bottom Gradient Overlay for Text Readability */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 via-40% to-transparent flex flex-col justify-end p-2 sm:p-2.5 pointer-events-none">
                      {/* Bold White Category Label Clamped to 2 Lines */}
                      <span
                        title={getTranslatedField(category, "name") || category.name}
                        className="text-white text-[11px] sm:text-xs font-bold text-center leading-[1.2] line-clamp-2 drop-shadow-md"
                      >
                        {getTranslatedField(category, "name") || category.name}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.section>
          ))}
        </AnimatePresence>

        {/* 7. Empty State for Search */}
        {!loading && searchQuery && filteredGroups.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="w-16 h-16 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center mb-3 border border-slate-100">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0zM10 8v6M8 10h4" />
              </svg>
            </div>
            <h3 className="text-slate-800 font-bold text-base mb-1">
              {t("customer.noMatchingCategories", "No matching categories")}
            </h3>
            <p className="text-slate-400 text-xs max-w-xs mb-4">
              We couldn't find any category matching "{searchQuery}".
            </p>
            <button
              onClick={handleClearSearch}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all active:scale-95 cursor-pointer"
            >
              {t("customer.clearSearch", "Clear Search")}
            </button>
          </div>
        )}

        {/* 7. Empty State for Zero Categories */}
        {!loading && !searchQuery && allGroups.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-2xl flex items-center justify-center mb-4 border border-slate-100">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <h3 className="text-slate-900 font-bold text-base mb-1">
              {t("customer.noCategoriesFound", "No Categories Found")}
            </h3>
            <p className="text-slate-400 text-xs max-w-xs mb-4">
              {t("customer.noCategoriesPrompt", "We couldn't find any registered categories at the moment.")}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer"
            >
              {t("common.retry", "Retry")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
