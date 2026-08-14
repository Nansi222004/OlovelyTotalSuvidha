import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useState, useMemo, useEffect } from "react";
import ProductCard from "./components/ProductCard";
import { motion, AnimatePresence } from "framer-motion";
import {
  getProducts,
  getCategoryById,
  Category as ApiCategory,
} from "../../services/api/customerProductService";
import { useLocation as useLocationContext } from "../../hooks/useLocation";

export default function CategoryPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { location: userLocation } = useLocationContext();

  const [category, setCategory] = useState<ApiCategory | null>(null);
  const [subcategories, setSubcategories] = useState<ApiCategory[]>([]);
  const [selectedSubcategory, setSelectedSubcategory] = useState("all");

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
  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      setError(null);
      try {
        // If the ID in the URL is actually for a subcategory, we should use the parent category ID
        // which we fetch in the other useEffect and store in 'category'.
        // However, for fetching products, the backend getProducts handles 'category' (parent)
        // and 'subcategory' separately.

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
          // Ensure products have default tags/name array for filtering logic if missing
          const safeProducts = response.data.map((p: any) => ({
            ...p,
            tags: Array.isArray(p.tags) ? p.tags : [],
            nameParts: p.name ? p.name.toLowerCase().split(" ") : [],
            price: p.salePrice || p.price || 0, // Ensure price is available for sorting
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

    if (id) {
      fetchProducts();
    }
  }, [id, selectedSubcategory, category?._id, userLocation]);

  // Client-side filtering removed in favor of backend subcategory filtering
  // Sync selectedFilters with appliedFilters when modal opens
  useEffect(() => {
    if (isFiltersOpen) {
      setSelectedFilters([...appliedFilters]);
      setPriceRange([...appliedPriceRange]);
    }
  }, [isFiltersOpen, appliedFilters, appliedPriceRange]);

  // Derived state: Filtered and Sorted Products
  const categoryProducts = useMemo(() => {
    let result = [...products];

    // 1. Filter
    // 1a. Type/Category Filter
    if (appliedFilters.length > 0) {
      result = result.filter((product) => {
        const name = product.name.toLowerCase();
        // Check if product matches ANY of the applied filters
        return appliedFilters.some((filterName) => {
          const typeDef = commonTypes.find(t => t.display === filterName);
          if (typeDef) {
            return typeDef.keywords.some(keyword => name.includes(keyword));
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
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "name-desc":
        result.sort((a, b) => b.name.localeCompare(a.name));
        break;
      default:
        // Default sorting
        break;
    }

    return result;
  }, [products, appliedFilters, sortBy, commonTypes, appliedPriceRange]);

  if ((categoryLoading || loading) && !products.length && !category) {
    return null; // Let global IconLoader handle it
  }

  if (error && !products.length && !category) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-4 text-center bg-white">
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

  if (!category && !categoryLoading) {
    return (
      <div className="px-4 md:px-6 lg:px-8 py-6 md:py-8">
        <h1 className="text-2xl md:text-3xl font-bold text-neutral-900 mb-4">
          Category not found
        </h1>
        <p className="text-neutral-600 md:text-lg">
          The category you're looking for doesn't exist.
        </p>
      </div>
    );
  }

  // Extract filter options from products
  const getFilterOptions = () => {
    const categoryProducts = products.filter((p) => p.categoryId === id);
    const filterMap = new Map<string, number>();

    categoryProducts.forEach((product) => {
      // Extract main ingredient/type from product name
      const name = product.name.toLowerCase();
      // Remove common prefixes like "fresh", "organic", etc.
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
      // Fashion Icons
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
    { id: 'default', label: 'Recommended' },
    { id: 'price-asc', label: 'Price: Low to High' },
    { id: 'price-desc', label: 'Price: High to Low' },
    { id: 'name-asc', label: 'Name: A to Z' },
    { id: 'name-desc', label: 'Name: Z to A' },
  ];

  return (
    <div className="flex bg-white h-screen overflow-hidden">
      {/* Left Sidebar */}
      <div className="w-24 bg-white border-r border-neutral-100 overflow-y-auto scrollbar-hide flex-shrink-0 py-2">
        <div className="space-y-1">
          {subcategories.map((subcat) => {
            const isSelected =
              selectedSubcategory === (subcat.id || subcat._id);
            return (
              <button
                key={subcat.id || subcat._id}
                type="button"
                onClick={() => {
                  console.log("Clicked subcategory:", subcat.id || subcat._id);
                  setSelectedSubcategory(subcat.id || subcat._id);
                }}
                className={`w-full flex flex-col items-center justify-center py-2 relative transition-all duration-200 group ${isSelected ? "bg-green-50" : "hover:bg-neutral-50"
                  }`}
                style={{
                  minHeight: "80px",
                }}>
                {/* Active Indicator - curved blob on left */}
                {isSelected && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-12 bg-green-600 rounded-r-full"></div>
                )}

                {/* Image Container */}
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl mb-1.5 flex-shrink-0 overflow-hidden transition-all duration-200 shadow-sm ${isSelected
                    ? "ring-2 ring-green-600 ring-offset-2 bg-white"
                    : "bg-neutral-50 border border-neutral-100 group-hover:shadow-md"
                    }`}>
                  {subcat.image ? (
                    <img
                      src={subcat.image}
                      alt={subcat.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = "none";
                        const parent = target.parentElement;
                        if (parent) {
                          parent.textContent =
                            subcat.icon || subcat.name?.charAt(0) || "📦";
                        }
                      }}
                    />
                  ) : (
                    <span className="text-2xl">{subcat.icon || "📦"}</span>
                  )}
                </div>

                {/* Text Label */}
                <span
                  className={`text-[10px] text-center leading-tight px-1 transition-colors ${isSelected
                    ? "font-bold text-green-700"
                    : "text-neutral-500 group-hover:text-neutral-900"
                    }`}
                  style={{
                    wordBreak: "break-word",
                    maxWidth: "100%",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden"
                  }}>
                  {subcat.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden bg-white">
        {/* Header */}
        <div className="sticky top-0 z-40 bg-white border-b border-neutral-200 flex-shrink-0">
          <div className="px-4 md:px-6 lg:px-8 py-3 md:py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => navigate(-1)}
                  className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center text-neutral-700 hover:bg-neutral-100 rounded-full transition-colors"
                  aria-label="Go back">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M15 18L9 12L15 6"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                <h1 className="text-base md:text-xl font-bold text-neutral-900">
                  {category?.name}
                </h1>
              </div>
            </div>
          </div>
        </div>

        {/* Filter/Sort Bar - Updated layout */}
        <div className="px-4 md:px-6 lg:px-8 py-1.5 md:py-2 bg-white border-b border-neutral-200 flex-shrink-0">
          <div className="flex items-center gap-1.5 md:gap-2 overflow-x-auto scrollbar-hide -mx-4 md:-mx-6 lg:-mx-8 px-4 md:px-6 lg:px-8 scroll-smooth">
            {/* Filters Button */}
            <button
              onClick={() => setIsFiltersOpen(true)}
              className={`flex items-center gap-1 px-2 py-1 text-xs font-medium border rounded-md transition-colors flex-shrink-0 whitespace-nowrap ${appliedFilters.length > 0 || appliedPriceRange[1] < 10000
                ? "bg-green-50 border-green-200 text-green-700"
                : "bg-white border-neutral-300 text-neutral-700 hover:bg-neutral-50"
                }`}>
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="flex-shrink-0">
                <circle cx="6" cy="8" r="1.5" fill="currentColor" />
                <circle cx="6" cy="16" r="1.5" fill="currentColor" />
                <path
                  d="M3 8h6M3 16h6M10 8h11M10 16h11"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
              <span>Filters</span>
              {(appliedFilters.length > 0 || appliedPriceRange[1] < 10000) && (
                <span className="ml-1 bg-green-600 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full">
                  {appliedFilters.length + (appliedPriceRange[1] < 10000 ? 1 : 0)}
                </span>
              )}
              <span className="text-neutral-500 text-[10px] ml-0.5">▾</span>
            </button>

            {/* Sort Button */}
            <button
              onClick={() => setIsSortOpen(true)}
              className={`flex items-center gap-1 px-2 py-1 text-xs font-medium border rounded-md transition-colors flex-shrink-0 whitespace-nowrap ${sortBy !== "default"
                ? "bg-green-50 border-green-200 text-green-700"
                : "bg-white border-neutral-300 text-neutral-700 hover:bg-neutral-50"
                }`}>
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="flex-shrink-0">
                <path
                  d="M7 8l5-5 5 5M7 16l5 5 5-5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span>Sort</span>
              {sortBy !== "default" && (
                <span className="ml-1 text-[10px] text-green-600 font-bold">•</span>
              )}
              <span className="text-neutral-500 text-[10px] ml-0.5">▾</span>
            </button>

            {/* Category Buttons */}
            {subcategories
              .filter((subcat) => (subcat.id || subcat._id) !== "all")
              .map((subcat) => {
                const subId = subcat.id || subcat._id;
                const isSelected = selectedSubcategory === subId;
                return (
                  <button
                    key={subId}
                    onClick={() => setSelectedSubcategory(subId)}
                    className={`flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md transition-colors flex-shrink-0 whitespace-nowrap ${isSelected
                      ? "bg-white border border-neutral-300 text-neutral-900"
                      : "bg-white border border-neutral-300 text-neutral-700 hover:bg-neutral-50"
                      }`}>
                    <span className="text-sm flex-shrink-0">
                      {subcat.image ? (
                        <img
                          src={subcat.image}
                          alt=""
                          className="w-4 h-4 object-cover rounded-full"
                        />
                      ) : (
                        subcat.icon || "📦"
                      )}
                    </span>
                    <span>{subcat.name}</span>
                  </button>
                );
              })}
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto scrollbar-hide bg-white">
          {/* Products Grid */}
          {categoryProducts.length > 0 ? (
            <div className="px-3 md:px-6 lg:px-8 py-4 md:py-6">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 md:gap-4">
                {categoryProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    showHeartIcon={false}
                    showStockInfo={false}
                    showBadge={true}
                    showOptionsText={true}
                    categoryStyle={true}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="px-4 md:px-6 lg:px-8 py-8 md:py-12 text-center">
              <p className="text-neutral-500 md:text-lg">
                No products found in this category.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Filters Modal */}
      <AnimatePresence>
        {isFiltersOpen && (
          <>
            {/* Hide footer when modal is open */}
            <style>{`
              nav[class*="fixed bottom-0"] {
                display: none !important;
              }
            `}</style>
            <div className="fixed inset-0 z-[100]">
              {/* Backdrop - Semi-transparent overlay */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0 bg-black/40"
                onClick={() => setIsFiltersOpen(false)}
              />

              {/* Modal - Slides up from bottom, compact size matching image */}
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                onClick={(e) => e.stopPropagation()}
                className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl max-h-[70vh] flex flex-col">
                {/* Header */}
                <div className="px-5 py-4 border-b border-neutral-200">
                  <h2 className="text-base font-bold text-neutral-900">
                    Filters
                  </h2>
                </div>

                {/* Search Bar */}
                <div className="px-5 py-3 border-b border-neutral-200">
                  <div className="relative">
                    <svg
                      className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24">
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
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm text-neutral-700 placeholder:text-neutral-400"
                    />
                  </div>
                </div>

                {/* Content Area */}
                <div className="flex flex-1 overflow-hidden min-h-0">
                  {/* Left Column - Filter Categories */}
                  <div className="w-24 border-r border-neutral-200 flex-shrink-0 bg-neutral-50">
                    <button
                      onClick={() => setSelectedFilterCategory("Type")}
                      className={`w-full px-3 py-3 text-left text-sm font-medium transition-colors ${selectedFilterCategory === "Type"
                        ? "bg-green-50 text-green-700"
                        : "text-neutral-600 hover:bg-neutral-100"
                        }`}>
                      Type
                    </button>
                    <button
                      onClick={() => setSelectedFilterCategory("Price")}
                      className={`w-full px-3 py-3 text-left text-sm font-medium transition-colors ${selectedFilterCategory === "Price"
                        ? "bg-green-50 text-green-700"
                        : "text-neutral-600 hover:bg-neutral-100"
                        }`}>
                      Price
                    </button>
                  </div>

                  {/* Right Column - Filter Options */}
                  <div className="flex-1 overflow-y-auto">
                    {selectedFilterCategory === "Price" ? (
                      <div className="p-4 space-y-6">
                        <h3 className="text-sm font-medium text-neutral-900 mb-2">Price Range</h3>
                        <div className="px-2">
                          <input
                            type="range"
                            min="0"
                            max="10000"
                            step="100"
                            value={priceRange[1]}
                            onChange={(e) => setPriceRange([priceRange[0], parseInt(e.target.value)])}
                            className="w-full h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-green-600"
                          />
                          <div className="flex justify-between items-center mt-3">
                            <div className="border border-neutral-300 rounded px-2 py-1 text-sm text-neutral-700 w-24 text-center">
                              ₹{priceRange[0]}
                            </div>
                            <span className="text-neutral-400">-</span>
                            <div className="border border-neutral-300 rounded px-2 py-1 text-sm text-neutral-700 w-24 text-center">
                              ₹{priceRange[1]}
                            </div>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="text-xs text-neutral-500 font-medium uppercase tracking-wider">Quick Select</div>
                          <div className="flex flex-wrap gap-2">
                            {[500, 1000, 2000, 5000].map(max => (
                              <button
                                key={max}
                                onClick={() => setPriceRange([0, max])}
                                className={`px-3 py-1.5 text-xs border rounded-full transition-colors ${priceRange[1] === max
                                  ? 'bg-green-600 text-white border-green-600'
                                  : 'bg-white text-neutral-600 border-neutral-300 hover:border-green-600'
                                  }`}
                              >
                                Under ₹{max}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4">
                        {filteredOptions.length > 0 ? (
                          filteredOptions.map((option) => {
                            const isChecked = selectedFilters.includes(option.name);
                            return (
                              <button
                                key={option.name}
                                onClick={() => handleFilterToggle(option.name)}
                                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-neutral-50 rounded-lg transition-colors">
                                <span className="text-xl flex-shrink-0 w-6 h-6 flex items-center justify-center">
                                  {option.icon}
                                </span>
                                <span className="flex-1 text-left text-sm font-medium text-neutral-700">
                                  {option.name}
                                </span>
                                <span className="text-sm text-neutral-500">
                                  ({option.count})
                                </span>
                                <div className="w-5 h-5 flex items-center justify-center flex-shrink-0 ml-2">
                                  {isChecked ? (
                                    <div className="w-5 h-5 border-2 border-green-600 bg-green-600 rounded-sm flex items-center justify-center">
                                      <svg
                                        className="w-3 h-3 text-white"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24">
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth={3}
                                          d="M5 13l4 4L19 7"
                                        />
                                      </svg>
                                    </div>
                                  ) : (
                                    <div className="w-5 h-5 border-2 border-neutral-300 rounded-sm bg-white"></div>
                                  )}
                                </div>
                              </button>
                            );
                          })
                        ) : (
                          <div className="text-center py-8 text-neutral-500 text-sm">
                            No filters found matching "{filterSearchQuery}"
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="px-5 py-4 border-t border-neutral-200 flex gap-3 bg-white">
                  <button
                    onClick={handleClearFilters}
                    className="flex-1 px-4 py-2.5 border border-green-600 text-green-600 rounded-lg font-medium text-sm hover:bg-green-50 transition-colors bg-white">
                    Clear Filter
                  </button>
                  <button
                    onClick={handleApplyFilters}
                    className="flex-1 px-4 py-2.5 rounded-lg font-medium text-sm transition-colors bg-green-600 text-white hover:bg-green-700">
                    Apply
                  </button>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      {/* Sort Modal */}
      <AnimatePresence>
        {isSortOpen && (
          <>
            <div className="fixed inset-0 z-[100]">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0 bg-black/40"
                onClick={() => setIsSortOpen(false)}
              />
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                onClick={(e) => e.stopPropagation()}
                className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-neutral-200 flex justify-between items-center">
                  <h2 className="text-base font-bold text-neutral-900">Sort By</h2>
                  <button onClick={() => setIsSortOpen(false)} className="text-neutral-500 p-1">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="p-4 space-y-2">
                  {sortOptions.map((option) => (
                    <button
                      key={option.id}
                      onClick={() => {
                        setSortBy(option.id);
                        setIsSortOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium transition-colors ${sortBy === option.id
                        ? "bg-green-50 text-green-700"
                        : "text-neutral-700 hover:bg-neutral-50"
                        }`}
                    >
                      {option.label}
                      {sortBy === option.id && (
                        <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
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
