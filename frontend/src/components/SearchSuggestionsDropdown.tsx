import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getSearchSuggestions,
  SearchSuggestionsData,
  SuggestionCategory,
  SuggestionSubcategory,
  SuggestionProduct,
  SuggestionBrand,
} from '../services/api/customerProductService';

export interface SearchSuggestionsDropdownProps {
  query: string;
  isOpen: boolean;
  onClose: () => void;
  channel?: string;
  isWholesale?: boolean;
  onSelectQuery?: (q: string) => void;
  inputRef?: React.RefObject<HTMLInputElement>;
}

type FlattenedItem =
  | { type: 'category'; item: SuggestionCategory; id: string }
  | { type: 'subcategory'; item: SuggestionSubcategory; id: string }
  | { type: 'product'; item: SuggestionProduct; id: string }
  | { type: 'brand'; item: SuggestionBrand; id: string };

export const SearchSuggestionsDropdown: React.FC<SearchSuggestionsDropdownProps> = ({
  query,
  isOpen,
  onClose,
  channel,
  isWholesale,
  onSelectQuery,
  inputRef,
}) => {
  const navigate = useNavigate();
  const [data, setData] = useState<SearchSuggestionsData>({
    categories: [],
    subcategories: [],
    products: [],
    brands: [],
  });
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced fetch of suggestions (250ms debounce)
  useEffect(() => {
    const trimmed = query.trim();

    if (!isOpen || trimmed.length < 2) {
      setData({ categories: [], subcategories: [], products: [], brands: [] });
      setLoading(false);
      setSelectedIndex(-1);
      return;
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    setLoading(true);

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const response = await getSearchSuggestions(trimmed, channel, isWholesale);
        if (response.success && response.data) {
          setData(response.data);
        } else {
          setData({ categories: [], subcategories: [], products: [], brands: [] });
        }
      } catch (err) {
        console.error('Error fetching search suggestions:', err);
        setData({ categories: [], subcategories: [], products: [], brands: [] });
      } finally {
        setLoading(false);
        setSelectedIndex(-1);
      }
    }, 250);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [query, isOpen, channel, isWholesale]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(target) &&
        inputRef?.current &&
        !inputRef.current.contains(target)
      ) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose, inputRef]);

  // Flattened items for keyboard navigation
  const flattenedItems: FlattenedItem[] = useMemo(() => {
    const items: FlattenedItem[] = [];
    data.categories.forEach((cat) =>
      items.push({ type: 'category', item: cat, id: `cat-${cat._id}` })
    );
    data.subcategories.forEach((sub) =>
      items.push({ type: 'subcategory', item: sub, id: `sub-${sub._id}` })
    );
    data.products.forEach((prod) =>
      items.push({ type: 'product', item: prod, id: `prod-${prod._id}` })
    );
    data.brands.forEach((brand) =>
      items.push({ type: 'brand', item: brand, id: `brand-${brand._id}` })
    );
    return items;
  }, [data]);

  const handleSelectCategory = useCallback(
    (cat: SuggestionCategory) => {
      onClose();
      const target = cat.slug || cat._id;
      navigate(`/category/${target}`);
    },
    [navigate, onClose]
  );

  const handleSelectSubcategory = useCallback(
    (sub: SuggestionSubcategory) => {
      onClose();
      const parentTarget = sub.categorySlug || sub.category;
      navigate(`/category/${parentTarget}?subcategory=${sub._id}`);
    },
    [navigate, onClose]
  );

  const handleSelectProduct = useCallback(
    (prod: SuggestionProduct) => {
      onClose();
      navigate(`/product/${prod._id}`);
    },
    [navigate, onClose]
  );

  const handleSelectBrand = useCallback(
    (brand: SuggestionBrand) => {
      onClose();
      if (onSelectQuery) {
        onSelectQuery(brand.name);
      } else {
        navigate(`/search?q=${encodeURIComponent(brand.name)}`);
      }
    },
    [navigate, onClose, onSelectQuery]
  );

  const handleActivateItem = useCallback(
    (flattened: FlattenedItem) => {
      switch (flattened.type) {
        case 'category':
          handleSelectCategory(flattened.item);
          break;
        case 'subcategory':
          handleSelectSubcategory(flattened.item);
          break;
        case 'product':
          handleSelectProduct(flattened.item);
          break;
        case 'brand':
          handleSelectBrand(flattened.item);
          break;
      }
    },
    [handleSelectCategory, handleSelectSubcategory, handleSelectProduct, handleSelectBrand]
  );

  // Keyboard navigation on input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen || flattenedItems.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1 < flattenedItems.length ? prev + 1 : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : flattenedItems.length - 1));
      } else if (e.key === 'Enter') {
        if (selectedIndex >= 0 && selectedIndex < flattenedItems.length) {
          e.preventDefault();
          handleActivateItem(flattenedItems[selectedIndex]);
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, flattenedItems, selectedIndex, handleActivateItem, onClose]);

  if (!isOpen || query.trim().length < 2) {
    return null;
  }

  const hasResults =
    data.categories.length > 0 ||
    data.subcategories.length > 0 ||
    data.products.length > 0 ||
    data.brands.length > 0;

  let currentGlobalIndex = -1;

  return (
    <div
      ref={dropdownRef}
      className="absolute top-full left-0 right-0 mt-1.5 z-50 bg-white rounded-2xl shadow-2xl border border-neutral-200/90 overflow-hidden backdrop-blur-lg animate-in fade-in slide-in-from-top-1 duration-150"
      style={{ maxHeight: 'calc(100vh - 140px)' }}
    >
      {/* Popover Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-neutral-50/90 border-b border-neutral-100 text-xs font-semibold text-neutral-500 uppercase tracking-wider">
        <span className="flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 text-neutral-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          Search suggestions
        </span>
        {loading && (
          <span className="flex items-center gap-1.5 text-emerald-600 font-medium normal-case">
            <svg className="animate-spin h-3.5 w-3.5 text-emerald-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Searching...
          </span>
        )}
      </div>

      <div className="overflow-y-auto max-h-[60vh] divide-y divide-neutral-100">
        {/* Empty state */}
        {!loading && !hasResults && (
          <div className="px-6 py-8 text-center text-neutral-500 text-sm">
            <div className="w-10 h-10 mx-auto mb-2 text-neutral-300 flex items-center justify-center rounded-full bg-neutral-100">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                <line x1="8" y1="11" x2="14" y2="11" />
              </svg>
            </div>
            <p className="font-medium text-neutral-700">No matching suggestions</p>
            <p className="text-xs text-neutral-400 mt-0.5">Press Enter to perform a full catalog search</p>
          </div>
        )}

        {/* 1. Categories Section */}
        {data.categories.length > 0 && (
          <div className="py-2">
            <div className="px-4 py-1 text-[11px] font-bold uppercase tracking-wider text-neutral-400">
              Categories
            </div>
            {data.categories.map((cat) => {
              currentGlobalIndex++;
              const isSelected = selectedIndex === currentGlobalIndex;
              return (
                <button
                  key={cat._id}
                  type="button"
                  onClick={() => handleSelectCategory(cat)}
                  className={`w-full text-left px-4 py-2 flex items-center gap-3 transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-50 text-emerald-900'
                      : 'hover:bg-neutral-50 text-neutral-800'
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg bg-neutral-100 border border-neutral-200/60 overflow-hidden flex items-center justify-center flex-shrink-0 text-base">
                    {cat.image ? (
                      <img src={cat.image} alt={cat.name} className="w-full h-full object-cover" />
                    ) : (
                      <span>{cat.icon || '📁'}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{cat.name}</p>
                  </div>
                  <span className="text-xs text-neutral-400 flex items-center gap-0.5">
                    Category
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* 2. Subcategories Section */}
        {data.subcategories.length > 0 && (
          <div className="py-2">
            <div className="px-4 py-1 text-[11px] font-bold uppercase tracking-wider text-neutral-400">
              Subcategories
            </div>
            {data.subcategories.map((sub) => {
              currentGlobalIndex++;
              const isSelected = selectedIndex === currentGlobalIndex;
              return (
                <button
                  key={sub._id}
                  type="button"
                  onClick={() => handleSelectSubcategory(sub)}
                  className={`w-full text-left px-4 py-2 flex items-center gap-3 transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-50 text-emerald-900'
                      : 'hover:bg-neutral-50 text-neutral-800'
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg bg-neutral-100 border border-neutral-200/60 overflow-hidden flex items-center justify-center flex-shrink-0 text-sm">
                    {sub.image ? (
                      <img src={sub.image} alt={sub.name} className="w-full h-full object-cover" />
                    ) : (
                      <span>🏷️</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{sub.name}</p>
                    {sub.categoryName && (
                      <p className="text-xs text-neutral-400 truncate">in {sub.categoryName}</p>
                    )}
                  </div>
                  <span className="text-xs text-neutral-400 flex items-center gap-0.5">
                    Subcategory
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* 3. Products Section */}
        {data.products.length > 0 && (
          <div className="py-2">
            <div className="px-4 py-1 text-[11px] font-bold uppercase tracking-wider text-neutral-400">
              Products
            </div>
            {data.products.map((prod) => {
              currentGlobalIndex++;
              const isSelected = selectedIndex === currentGlobalIndex;
              return (
                <button
                  key={prod._id}
                  type="button"
                  onClick={() => handleSelectProduct(prod)}
                  className={`w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-50 text-emerald-900'
                      : 'hover:bg-neutral-50 text-neutral-800'
                  }`}
                >
                  <div className="w-10 h-10 rounded-lg bg-neutral-100 border border-neutral-200/60 overflow-hidden flex items-center justify-center flex-shrink-0">
                    {prod.mainImage ? (
                      <img src={prod.mainImage} alt={prod.productName} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-sm">🛍️</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-neutral-900 truncate">
                      {prod.productName}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs font-bold text-neutral-900">
                        ₹{prod.discPrice || prod.price}
                      </span>
                      {prod.discPrice && prod.discPrice < prod.price && (
                        <span className="text-[11px] text-neutral-400 line-through">
                          ₹{prod.price}
                        </span>
                      )}
                      {prod.categoryName && (
                        <span className="text-[10px] text-neutral-400 truncate">
                          • {prod.categoryName}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span
                      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                        prod.productType === 'ECOMMERCE'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200/60'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                      }`}
                    >
                      {prod.productType === 'ECOMMERCE' ? 'E-Com' : 'Quick'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* 4. Brands Section */}
        {data.brands.length > 0 && (
          <div className="py-2">
            <div className="px-4 py-1 text-[11px] font-bold uppercase tracking-wider text-neutral-400">
              Brands
            </div>
            {data.brands.map((brand) => {
              currentGlobalIndex++;
              const isSelected = selectedIndex === currentGlobalIndex;
              return (
                <button
                  key={brand._id}
                  type="button"
                  onClick={() => handleSelectBrand(brand)}
                  className={`w-full text-left px-4 py-2 flex items-center gap-3 transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-50 text-emerald-900'
                      : 'hover:bg-neutral-50 text-neutral-800'
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg bg-neutral-100 border border-neutral-200/60 overflow-hidden flex items-center justify-center flex-shrink-0 text-sm">
                    {brand.image ? (
                      <img src={brand.image} alt={brand.name} className="w-full h-full object-cover" />
                    ) : (
                      <span>⭐</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate text-neutral-900">{brand.name}</p>
                  </div>
                  <span className="text-xs text-neutral-400 flex items-center gap-0.5">
                    Brand
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Popover Footer */}
      {hasResults && (
        <div className="px-4 py-2 bg-neutral-50 border-t border-neutral-100 flex items-center justify-between text-[11px] text-neutral-400">
          <span>Use ↑ ↓ to navigate</span>
          <span>Press Enter to select</span>
        </div>
      )}
    </div>
  );
};

export default SearchSuggestionsDropdown;
