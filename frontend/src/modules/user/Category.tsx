import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useState, useMemo, useEffect, useRef } from "react";
import ProductCard from "./components/ProductCard";
import { motion, AnimatePresence } from "framer-motion";
import {
  getProducts,
  getCategoryById,
  Category as ApiCategory,
} from "../../services/api/customerProductService";
import { useLocation as useLocationContext } from "../../hooks/useLocation";
import { useTranslation } from "../../hooks/useTranslation";
import { getIconByName } from "../../utils/iconLibrary";

export default function CategoryPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { location: userLocation } = useLocationContext();
  const { t, getTranslatedField } = useTranslation();

  const [category, setCategory] = useState<ApiCategory | null>(null);
  const [subcategories, setSubcategories] = useState<ApiCategory[]>([]);
  const [selectedSubcategory, setSelectedSubcategory] = useState("all");

  // In-category search state
  const [searchQuery, setSearchQuery] = useState("");

  // Filter States
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]); // Pending filters in modal
  const [appliedFilters, setAppliedFilters] = useState<string[]>([]); // Applied filters
  const [filterSearchQuery, setFilterSearchQuery] = useState("");
  const [selectedFilterCategory, setSelectedFilterCategory] = useState("Type");
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 10000]); // Default max price
  const [appliedPriceRange, setAppliedPriceRange] = useState<[number, number]>([0, 10000]);

  // Sort States
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [sortBy, setSortBy] = useState("default"); // default, price-asc, price-desc, name-asc, name-desc

  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryLoading, setCategoryLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const subcategoriesContainerRef = useRef<HTMLDivElement>(null);
  const subcategoryRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  // Common Types Definition for reusable filtering logic (Grocery + Fashion)
  const commonTypes = useMemo(() => [
    // Grocery
    { keywords: ["tomato", "tomatoes"], display: "Tomato" },
    { keywords: ["potato", "potatoes"], display: "Potato" },
    { keywords: ["chilli", "chili", "chilies"], display: "Chilli" },
    { keywords: ["spinach"], display: "Spinach" },
    { keywords: ["brinjal", "eggplant"], display: "Brinjal" },
    { keywords: ["onion", "onions"], display: "Onion" },
    { keywords: ["peanut", "peanuts"], display: "Peanuts" },
    { keywords: ["lemon", "lemons"], display: "Lemon" },
    { keywords: ["mushroom", "mushrooms"], display: "Mushroom" },
    { keywords: ["capsicum", "bell pepper", "pepper"], display: "Capsicum" },
    { keywords: ["ginger"], display: "Ginger" },
    { keywords: ["carrot", "carrots"], display: "Carrot" },
    { keywords: ["fenugreek", "methi"], display: "Fenugreek" },
    { keywords: ["broccoli"], display: "Broccoli" },
    { keywords: ["cucumber", "cucumbers"], display: "Cucumber" },
    { keywords: ["cabbage"], display: "Cabbage" },
    { keywords: ["cauliflower"], display: "Cauliflower" },
    { keywords: ["ladyfinger", "okra"], display: "Ladyfinger" },
    { keywords: ["beans"], display: "Beans" },
    { keywords: ["peas"], display: "Peas" },
    { keywords: ["garlic"], display: "Garlic" },
    { keywords: ["apple", "apples"], display: "Apple" },
    { keywords: ["banana", "bananas"], display: "Banana" },
    { keywords: ["orange", "oranges"], display: "Orange" },
    { keywords: ["mango", "mangoes"], display: "Mango" },

    // Fashion - Gender
    { keywords: ["men", "man", "male", "gent"], display: "Men" },
    { keywords: ["women", "woman", "female", "ladies"], display: "Women" },
    { keywords: ["kid", "kids", "boy", "boys", "girl", "girls", "baby"], display: "Kids" },

    // Fashion - Apparel
    { keywords: ["shirt", "shirts"], display: "Shirt" },
    { keywords: ["t-shirt", "tshirts", "tees", "polo"], display: "T-Shirt" },
    { keywords: ["jeans", "denim", "jins"], display: "Jeans" },
    { keywords: ["trouser", "trousers", "pant", "pants", "chinos"], display: "Pants" },
    { keywords: ["saree", "saris", "sari"], display: "Saree" },
    { keywords: ["kurta", "kurti", "kurtas", "ethnic"], display: "Kurta/Kurti" },
    { keywords: ["dress", "dresses", "gown", "onepiece"], display: "Dress" },
    { keywords: ["top", "tops", "tunic"], display: "Tops" },
    { keywords: ["skirt", "skirts"], display: "Skirt" },
    { keywords: ["jacket", "hoodie", "sweater", "blazer", "coat"], display: "Winter Wear" },
    { keywords: ["short", "shorts", "boxer"], display: "Shorts" },

    // Fashion - Accessories & Footwear
    { keywords: ["shoe", "shoes", "sneaker", "sneakers", "footwear", "boot", "sandal", "heels"], display: "Shoes" },
    { keywords: ["watch", "watches", "smartwatch"], display: "Watch" },
    { keywords: ["sunglass", "sunglasses", "shades", "specs"], display: "Sunglasses" },
    { keywords: ["bag", "bags", "handbag", "purse", "wallet", "clutch"], display: "Bags & Wallets" },
    { keywords: ["belt", "belts"], display: "Belts" },
    { keywords: ["jewellery", "earring", "necklace", "bangles"], display: "Jewellery" },
  ], []);

  // Fetch Category Details
  useEffect(() => {
    const fetchCategoryDetails = async () => {
      setCategoryLoading(true);
      setError(null);
      try {
        const response = await getCategoryById(id!);
        if (response.success && response.data) {
          const {
            category: cat,
            subcategories: subs,
            currentSubcategory,
          } = response.data;

          setCategory(cat);
          setSubcategories([
            {
              _id: "all",
              id: "all",
              name: "All",
              icon: "📦",
              isActive: true,
            } as any,
            ...(subs || []),
          ]);

          // Check URL query params first, then API response
          const subcategoryFromUrl = searchParams.get("subcategory");
          if (subcategoryFromUrl) {
            setSelectedSubcategory(subcategoryFromUrl);
          } else if (currentSubcategory) {
            setSelectedSubcategory(
              currentSubcategory._id || currentSubcategory.id
            );
          }
        } else {
          setError("Category not found or failed to load details.");
        }
      } catch (error) {
        console.error("Error fetching category details:", error);
        setError("Failed to load category information.");
      } finally {
        setCategoryLoading(false);
      }
    };

    if (id) {
      fetchCategoryDetails();
    }
  }, [id, searchParams]);

  // Fetch Products when category or subcategory changes
  const fetchProducts = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = { category: category?._id || id };
      if (selectedSubcategory !== "all") {
        params.subcategory = selectedSubcategory;
      }
      // Include user location for seller service radius filtering
      if (userLocation?.latitude && userLocation?.longitude) {
        params.latitude = userLocation.latitude;
        params.longitude = userLocation.longitude;
      }

      const response = await getProducts(params);
      if (response.success) {
        const safeProducts = (response.data || []).map((p: any) => ({
          ...p,
          tags: Array.isArray(p.tags) ? p.tags : [],
          nameParts: p.name ? p.name.toLowerCase().split(" ") : [],
          price: p.salePrice || p.price || 0,
        }));
        setProducts(safeProducts);
      } else {
        setError("Failed to fetch products for this category.");
      }
    } catch (error) {
      console.error("Error fetching products:", error);
      setError("Network error while loading products.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchProducts();
    }
  }, [id, selectedSubcategory, category?._id, userLocation]);

  // Sync selectedFilters with appliedFilters when modal opens
  useEffect(() => {
    if (isFiltersOpen) {
      setSelectedFilters([...appliedFilters]);
      setPriceRange([...appliedPriceRange]);
    }
  }, [isFiltersOpen, appliedFilters, appliedPriceRange]);

  // Derived state: Filtered, Searched, and Sorted Products
  const categoryProducts = useMemo(() => {
    let result = [...products];

    // 0. Search query filter
    const query = searchQuery.trim().toLowerCase();
    if (query) {
      result = result.filter((product) => {
        const name = (
          getTranslatedField(product, "name") ||
          product.name ||
          ""
        ).toLowerCase();
        const desc = (product.description || "").toLowerCase();
        const tags = Array.isArray(product.tags) ? product.tags.join(" ").toLowerCase() : "";
        return name.includes(query) || desc.includes(query) || tags.includes(query);
      });
    }

    // 1. Filter
    // 1a. Type/Category Filter
    if (appliedFilters.length > 0) {
      result = result.filter((product) => {
        const name = (product.name || "").toLowerCase();
        return appliedFilters.some((filterName) => {
          const typeDef = commonTypes.find((t) => t.display === filterName);
          if (typeDef) {
            return typeDef.keywords.some((keyword) => name.includes(keyword));
          }
          return false;
        });
      });
    }

    // 1b. Price Filter
    result = result.filter((product) => {
      const price = product.price || 0;
      return price >= appliedPriceRange[0] && price <= appliedPriceRange[1];
    });

    // 2. Sort
    switch (sortBy) {
      case "price-asc":
        result.sort((a, b) => a.price - b.price);
        break;
      case "price-desc":
        result.sort((a, b) => b.price - a.price);
        break;
      case "name-asc":
        result.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        break;
      case "name-desc":
        result.sort((a, b) => (b.name || "").localeCompare(a.name || ""));
        break;
      default:
        break;
    }

    return result;
  }, [products, searchQuery, appliedFilters, sortBy, commonTypes, appliedPriceRange, getTranslatedField]);

  // Handle Subcategory Click with auto-scroll into view
  const handleSubcategoryClick = (subId: string) => {
    setSelectedSubcategory(subId);
    const btn = subcategoryRefs.current.get(subId);
    if (btn && subcategoriesContainerRef.current) {
      btn.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  };

  // Filter options extraction
  const getFilterOptions = () => {
    const filterMap = new Map<string, number>();

    products.forEach((product) => {
      const name = (product.name || "").toLowerCase();
      const cleanName = name
        .replace(/^(fresh|organic|premium|best|new)\s+/i, "")
        .trim();

      for (const type of commonTypes) {
        if (type.keywords.some((keyword) => cleanName.includes(keyword))) {
          filterMap.set(type.display, (filterMap.get(type.display) || 0) + 1);
          break;
        }
      }
    });

    return Array.from(filterMap.entries())
      .map(([name, count]) => ({ name, count, icon: getIconForFilter(name) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  };

  const getIconForFilter = (name: string): string => {
    const iconMap: Record<string, string> = {
      Tomato: "🍅",
      Potato: "🥔",
      Chilli: "🌶️",
      Spinach: "🥬",
      Brinjal: "🍆",
      Onion: "🧅",
      Peanuts: "🥜",
      Lemon: "🍋",
      Mushroom: "🍄",
      Capsicum: "🫑",
      Ginger: "🫚",
      Carrot: "🥕",
      Fenugreek: "🌿",
      Broccoli: "🥦",
      Cucumber: "🥒",
      Cabbage: "🥬",
      Cauliflower: "🥦",
      Apple: "🍎",
      Banana: "🍌",
      Orange: "🍊",
      Mango: "🥭",
      Men: "👨",
      Women: "👩",
      Kids: "👶",
      Shirt: "👕",
      "T-Shirt": "👕",
      Jeans: "👖",
      Pants: "👖",
      Saree: "🥻",
      "Kurta/Kurti": "👘",
      Dress: "👗",
      Tops: "👚",
      Skirt: "👗",
      "Winter Wear": "🧥",
      Shorts: "🩳",
      Shoes: "👟",
      Watch: "⌚",
      Sunglasses: "🕶️",
      "Bags & Wallets": "👜",
      Belts: "🧶",
      Jewellery: "💍",
    };
    return iconMap[name] || "🏷️";
  };

  const filterOptions = getFilterOptions();
  const filteredOptions = filterOptions.filter((option) =>
    option.name.toLowerCase().includes(filterSearchQuery.toLowerCase())
  );

  const handleFilterToggle = (filterName: string) => {
    setSelectedFilters((prev) =>
      prev.includes(filterName)
        ? prev.filter((f) => f !== filterName)
        : [...prev, filterName]
    );
  };

  const handleClearFilters = () => {
    setSelectedFilters([]);
  };

  const handleApplyFilters = () => {
    setAppliedFilters(selectedFilters);
    setAppliedPriceRange(priceRange);
    setIsFiltersOpen(false);
  };

  const sortOptions = [
    { id: "default", label: "Recommended" },
    { id: "price-asc", label: "Price: Low to High" },
    { id: "price-desc", label: "Price: High to Low" },
    { id: "name-asc", label: "Name: A to Z" },
    { id: "name-desc", label: "Name: Z to A" },
  ];

  const currentSortLabel = useMemo(() => {
    return sortOptions.find((s) => s.id === sortBy)?.label || "Recommended";
  }, [sortBy]);

  // 1. Loading Skeleton State
  if ((categoryLoading || loading) && !category) {
    return (
      <div className="flex flex-col min-h-screen bg-white font-sans">
        {/* Skeleton Category Header */}
        <div className="sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full skeleton-shimmer flex-shrink-0" />
            <div className="w-11 h-11 rounded-xl skeleton-shimmer flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="w-40 h-5 rounded-md skeleton-shimmer" />
              <div className="w-20 h-3 rounded-md skeleton-shimmer" />
            </div>
          </div>
          {/* Skeleton Search Bar */}
          <div className="w-full h-9 rounded-xl skeleton-shimmer mt-3" />
        </div>

        {/* Skeleton Filters / Sort Bar */}
        <div className="px-4 py-2.5 flex items-center gap-2 border-b border-slate-100 bg-white">
          <div className="w-20 h-8 rounded-lg skeleton-shimmer" />
          <div className="w-24 h-8 rounded-lg skeleton-shimmer" />
          <div className="w-20 h-8 rounded-lg skeleton-shimmer" />
        </div>

        {/* Skeleton Product Cards Grid */}
        <div className="p-3 sm:p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5 sm:gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="bg-white rounded-xl border border-slate-100 p-2 space-y-2 flex flex-col justify-between"
            >
              <div className="w-full aspect-square rounded-lg skeleton-shimmer" />
              <div className="w-3/4 h-3 rounded skeleton-shimmer" />
              <div className="w-1/2 h-3.5 rounded skeleton-shimmer" />
              <div className="w-full h-8 rounded-lg skeleton-shimmer mt-2" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 2. Error State (when category or products fail completely)
  if (error && !products.length && !category) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center bg-white font-sans">
        <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mb-4 border border-red-100 shadow-sm">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-slate-900 mb-1">{t("common.oops", "Oops!")}</h3>
        <p className="text-sm text-slate-500 mb-5 max-w-xs">{error}</p>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/categories")}
            className="px-5 py-2.5 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-semibold shadow-xs transition-all"
          >
            {t("customer.browseCategories", "Browse Categories")}
          </button>
          <button
            onClick={() => window.location.reload()}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
          >
            {t("common.retry", "Retry")}
          </button>
        </div>
      </div>
    );
  }

  if (!category && !categoryLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center bg-white font-sans">
        <div className="w-16 h-16 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center mb-4 border border-slate-100">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-slate-900 mb-1">Category not found</h2>
        <p className="text-xs text-slate-500 mb-5">The category you are looking for does not exist.</p>
        <button
          onClick={() => navigate("/categories")}
          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
        >
          {t("customer.browseCategories", "Browse Categories")}
        </button>
      </div>
    );
  }

  const categoryName = getTranslatedField(category, "name") || category?.name || "Category";
  const hasSubcategories = subcategories.length > 1;

  return (
    <div className="flex flex-col min-h-screen bg-white font-sans overflow-x-hidden">
      {/* 1. Compact Category Header */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-100 px-4 pt-3.5 pb-3 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
        <div className="flex items-center gap-3">
          {/* Back Button */}
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 flex items-center justify-center text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-full transition-colors flex-shrink-0 cursor-pointer"
            aria-label="Go back"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Category Image / Icon Container */}
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-50 to-slate-50 border border-emerald-100/80 flex items-center justify-center overflow-hidden flex-shrink-0 shadow-2xs">
            {category?.image ? (
              <img
                src={category.image}
                alt={categoryName}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = "none";
                  const fallback = (e.target as HTMLElement).nextElementSibling;
                  if (fallback) (fallback as HTMLElement).style.display = "flex";
                }}
              />
            ) : null}
            <span className={`text-xl text-emerald-700 ${category?.image ? "hidden" : "flex"} items-center justify-center`}>
              {category?.icon || "📦"}
            </span>
          </div>

          {/* Category Name & Products Count */}
          <div className="flex-1 min-w-0">
            <h1
              title={categoryName}
              className="text-base sm:text-lg font-black text-slate-900 tracking-tight leading-tight truncate"
            >
              {categoryName}
            </h1>
            <p className="text-[11px] text-slate-500 font-medium leading-none mt-0.5">
              {loading
                ? "Loading products..."
                : `${categoryProducts.length} ${categoryProducts.length === 1 ? "product" : "products"}`}
            </p>
          </div>
        </div>

        {/* 2. In-Category Product Search Bar */}
        <div className="relative w-full mt-2.5">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search in ${categoryName}...`}
            className="w-full pl-9 pr-9 py-1.5 bg-slate-50 hover:bg-slate-100/80 focus:bg-white text-slate-800 placeholder-slate-400 text-xs sm:text-sm rounded-xl border border-slate-200/90 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              aria-label="Clear search"
            >
              <svg className="w-3.5 h-3.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-full p-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* 3. Subcategories Horizontal Scroll Bar (if category has subcategories) */}
      {hasSubcategories && (
        <div className="bg-white border-b border-slate-100 px-3 sm:px-4 py-2">
          <div
            ref={subcategoriesContainerRef}
            className="flex items-center gap-2 overflow-x-auto scrollbar-hide py-0.5"
          >
            {subcategories.map((subcat) => {
              const subId = subcat.id || subcat._id;
              const isSelected = selectedSubcategory === subId;
              const subName = subId === "all" ? t("common.all", "All") : getTranslatedField(subcat, "name") || subcat.name;

              return (
                <button
                  key={subId}
                  ref={(el) => {
                    if (el) subcategoryRefs.current.set(subId, el);
                    else subcategoryRefs.current.delete(subId);
                  }}
                  onClick={() => handleSubcategoryClick(subId)}
                  className={`tab-pill flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-all flex-shrink-0 ${
                    isSelected
                      ? "bg-emerald-600 text-white shadow-sm shadow-emerald-200 border border-emerald-600"
                      : "bg-slate-100/90 text-slate-700 hover:bg-slate-200/80 border border-slate-200/60"
                  }`}
                >
                  <span className="text-sm flex-shrink-0">
                    {subcat.image ? (
                      <img
                        src={subcat.image}
                        alt=""
                        className="w-3.5 h-3.5 object-cover rounded-full"
                      />
                    ) : (
                      subcat.icon || "📦"
                    )}
                  </span>
                  <span>{subName}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. Filter & Sort Action Bar */}
      <div className="sticky top-[108px] z-20 bg-white/95 backdrop-blur-md border-b border-slate-100 px-3 sm:px-4 py-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {/* Filter Button */}
            <button
              onClick={() => setIsFiltersOpen(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                appliedFilters.length > 0 || appliedPriceRange[1] < 10000
                  ? "bg-emerald-50 text-emerald-700 border-emerald-300 shadow-2xs"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              <span>{t("common.filters", "Filters")}</span>
              {(appliedFilters.length > 0 || appliedPriceRange[1] < 10000) && (
                <span className="bg-emerald-600 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full font-bold ml-0.5">
                  {appliedFilters.length + (appliedPriceRange[1] < 10000 ? 1 : 0)}
                </span>
              )}
            </button>

            {/* Sort Button */}
            <button
              onClick={() => setIsSortOpen(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                sortBy !== "default"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-300 shadow-2xs"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h18M6 12h12M10 17h4" />
              </svg>
              <span>{sortBy !== "default" ? currentSortLabel : t("common.sort", "Sort")}</span>
              <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          {/* Active Filters Clear Shortcut */}
          {(appliedFilters.length > 0 || appliedPriceRange[1] < 10000 || sortBy !== "default" || searchQuery) && (
            <button
              onClick={() => {
                setAppliedFilters([]);
                setAppliedPriceRange([0, 10000]);
                setSortBy("default");
                setSearchQuery("");
              }}
              className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold cursor-pointer underline"
            >
              Reset all
            </button>
          )}
        </div>
      </div>

      {/* 5. Product Grid & Empty States */}
      <div className="flex-1 px-3 sm:px-4 py-4 pb-32 md:pb-16">
        {loading ? (
          /* Inline Loading Grid */
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5 sm:gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="bg-white rounded-xl border border-slate-100 p-2 space-y-2 flex flex-col justify-between"
              >
                <div className="w-full aspect-square rounded-lg skeleton-shimmer" />
                <div className="w-3/4 h-3 rounded skeleton-shimmer" />
                <div className="w-1/2 h-3.5 rounded skeleton-shimmer" />
                <div className="w-full h-8 rounded-lg skeleton-shimmer mt-2" />
              </div>
            ))}
          </div>
        ) : categoryProducts.length > 0 ? (
          /* Product Grid */
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5 sm:gap-4">
            {categoryProducts.map((product) => (
              <ProductCard
                key={product.id || product._id}
                product={product}
                showHeartIcon={true}
                showStockInfo={false}
                showBadge={true}
                showOptionsText={true}
                categoryStyle={true}
              />
            ))}
          </div>
        ) : (
          /* 6. Polished Empty State */
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="w-20 h-20 bg-emerald-50 text-emerald-700 rounded-3xl flex items-center justify-center mb-4 border border-emerald-100 shadow-sm text-3xl">
              {category?.icon || "📦"}
            </div>
            <h3 className="text-slate-900 font-bold text-lg mb-1.5">
              {searchQuery
                ? `No products matching "${searchQuery}"`
                : t("customer.noProductsFound", "No products found")}
            </h3>
            <p className="text-slate-500 text-xs sm:text-sm max-w-sm mb-6 leading-relaxed">
              {searchQuery
                ? `Try checking your spelling or searching for other items in ${categoryName}.`
                : `There are currently no products available in "${categoryName}". You can explore other categories or continue browsing.`}
            </p>
            <div className="flex items-center gap-3">
              {searchQuery ? (
                <button
                  onClick={() => setSearchQuery("")}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer"
                >
                  Clear Search
                </button>
              ) : (
                <button
                  onClick={() => navigate("/categories")}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer active:scale-95"
                >
                  {t("customer.browseCategories", "Browse Categories")}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 7. Filters Modal */}
      <AnimatePresence>
        {isFiltersOpen && (
          <>
            <style>{`
              nav[class*="fixed bottom-0"] {
                display: none !important;
              }
            `}</style>
            <div className="fixed inset-0 z-[100]">
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0 bg-black/40 backdrop-blur-xs"
                onClick={() => setIsFiltersOpen(false)}
              />

              {/* Modal Container */}
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", stiffness: 320, damping: 32 }}
                onClick={(e) => e.stopPropagation()}
                className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl max-h-[75vh] flex flex-col overflow-hidden"
              >
                {/* Header */}
                <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
                  <h2 className="text-base font-bold text-slate-900">Filters</h2>
                  <button
                    onClick={() => setIsFiltersOpen(false)}
                    className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-xs transition-colors cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                {/* Filter Search */}
                <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/50">
                  <div className="relative">
                    <svg
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                    <input
                      type="text"
                      placeholder="Search across filters..."
                      value={filterSearchQuery}
                      onChange={(e) => setFilterSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-xs text-slate-800 placeholder-slate-400 transition-all"
                    />
                  </div>
                </div>

                {/* Content Split Area */}
                <div className="flex flex-1 overflow-hidden min-h-0">
                  {/* Left Column Tabs */}
                  <div className="w-28 border-r border-slate-100 flex-shrink-0 bg-slate-50/80">
                    <button
                      onClick={() => setSelectedFilterCategory("Type")}
                      className={`w-full px-3 py-3 text-left text-xs font-semibold transition-colors cursor-pointer ${
                        selectedFilterCategory === "Type"
                          ? "bg-white text-emerald-700 border-l-3 border-emerald-600 shadow-2xs font-bold"
                          : "text-slate-600 hover:bg-slate-100/70"
                      }`}
                    >
                      Type
                    </button>
                    <button
                      onClick={() => setSelectedFilterCategory("Price")}
                      className={`w-full px-3 py-3 text-left text-xs font-semibold transition-colors cursor-pointer ${
                        selectedFilterCategory === "Price"
                          ? "bg-white text-emerald-700 border-l-3 border-emerald-600 shadow-2xs font-bold"
                          : "text-slate-600 hover:bg-slate-100/70"
                      }`}
                    >
                      Price
                    </button>
                  </div>

                  {/* Right Column Options */}
                  <div className="flex-1 overflow-y-auto p-4">
                    {selectedFilterCategory === "Price" ? (
                      <div className="space-y-6">
                        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                          Price Range
                        </h3>
                        <div className="px-1">
                          <input
                            type="range"
                            min="0"
                            max="10000"
                            step="100"
                            value={priceRange[1]}
                            onChange={(e) =>
                              setPriceRange([priceRange[0], parseInt(e.target.value)])
                            }
                            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                          />
                          <div className="flex justify-between items-center mt-3">
                            <div className="border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-700 w-24 text-center bg-slate-50">
                              ₹{priceRange[0]}
                            </div>
                            <span className="text-slate-400 font-bold">-</span>
                            <div className="border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-700 w-24 text-center bg-slate-50">
                              ₹{priceRange[1]}
                            </div>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                            Quick Select
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {[500, 1000, 2000, 5000].map((max) => (
                              <button
                                key={max}
                                onClick={() => setPriceRange([0, max])}
                                className={`px-3 py-1 text-xs font-semibold rounded-full border transition-colors cursor-pointer ${
                                  priceRange[1] === max
                                    ? "bg-emerald-600 text-white border-emerald-600"
                                    : "bg-white text-slate-700 border-slate-200 hover:border-emerald-500"
                                }`}
                              >
                                Under ₹{max}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div>
                        {filteredOptions.length > 0 ? (
                          <div className="space-y-1">
                            {filteredOptions.map((option) => {
                              const isChecked = selectedFilters.includes(option.name);
                              return (
                                <button
                                  key={option.name}
                                  onClick={() => handleFilterToggle(option.name)}
                                  className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer"
                                >
                                  <span className="text-lg flex-shrink-0 w-6 h-6 flex items-center justify-center">
                                    {option.icon}
                                  </span>
                                  <span className="flex-1 text-left text-xs font-semibold text-slate-700">
                                    {option.name}
                                  </span>
                                  <span className="text-xs text-slate-400 font-medium">
                                    ({option.count})
                                  </span>
                                  <div className="w-5 h-5 flex items-center justify-center flex-shrink-0 ml-2">
                                    {isChecked ? (
                                      <div className="w-4.5 h-4.5 border-2 border-emerald-600 bg-emerald-600 rounded flex items-center justify-center">
                                        <svg
                                          className="w-3 h-3 text-white"
                                          fill="none"
                                          stroke="currentColor"
                                          viewBox="0 0 24 24"
                                        >
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={3}
                                            d="M5 13l4 4L19 7"
                                          />
                                        </svg>
                                      </div>
                                    ) : (
                                      <div className="w-4.5 h-4.5 border-2 border-slate-300 rounded bg-white" />
                                    )}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-center py-8 text-slate-400 text-xs">
                            No filters found matching "{filterSearchQuery}"
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="px-4 py-3 border-t border-slate-100 flex gap-3 bg-white">
                  <button
                    onClick={handleClearFilters}
                    className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-xl font-semibold text-xs hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Clear Filter
                  </button>
                  <button
                    onClick={handleApplyFilters}
                    className="flex-1 px-4 py-2 rounded-xl font-semibold text-xs transition-colors bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm cursor-pointer"
                  >
                    Apply
                  </button>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      {/* 8. Sort Modal */}
      <AnimatePresence>
        {isSortOpen && (
          <>
            <div className="fixed inset-0 z-[100]">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0 bg-black/40 backdrop-blur-xs"
                onClick={() => setIsSortOpen(false)}
              />
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", stiffness: 320, damping: 32 }}
                onClick={(e) => e.stopPropagation()}
                className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl overflow-hidden"
              >
                <div className="px-5 py-3.5 border-b border-slate-100 flex justify-between items-center">
                  <h2 className="text-base font-bold text-slate-900">Sort By</h2>
                  <button
                    onClick={() => setIsSortOpen(false)}
                    className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-xs transition-colors cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
                <div className="p-3 space-y-1">
                  {sortOptions.map((option) => (
                    <button
                      key={option.id}
                      onClick={() => {
                        setSortBy(option.id);
                        setIsSortOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                        sortBy === option.id
                          ? "bg-emerald-50 text-emerald-700 font-bold"
                          : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <span>{option.label}</span>
                      {sortBy === option.id && (
                        <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
