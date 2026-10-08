import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getSellerSuggestions,
  SellerSuggestion,
} from '../../../services/api/sellerService';
import { useDebouncedSuggestions } from '../../../hooks/useDebouncedSuggestions';

const EMPTY_SELLER_SUGGESTIONS: SellerSuggestion[] = [];

interface AdminSellerSuggestionsDropdownProps {
  query: string;
  isOpen: boolean;
  inputRef: React.RefObject<HTMLInputElement>;
  onClose: () => void;
  onSelect: (seller: SellerSuggestion) => void;
}

export default function AdminSellerSuggestionsDropdown({
  query,
  isOpen,
  inputRef,
  onClose,
  onSelect,
}: AdminSellerSuggestionsDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const fetchSuggestions = useCallback(async (trimmed: string) => {
    const response = await getSellerSuggestions(trimmed);
    return response.success ? response.data : EMPTY_SELLER_SUGGESTIONS;
  }, []);
  const { data: suggestions, loading } = useDebouncedSuggestions({
    query,
    isOpen,
    emptyValue: EMPTY_SELLER_SUGGESTIONS,
    fetchSuggestions,
  });

  useEffect(() => setSelectedIndex(-1), [suggestions]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!dropdownRef.current?.contains(target) && !inputRef.current?.contains(target)) onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [inputRef, isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') return onClose();
      if (!suggestions.length) return;
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedIndex((current) => (current + 1) % suggestions.length);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedIndex((current) => (current <= 0 ? suggestions.length - 1 : current - 1));
      } else if (event.key === 'Enter' && selectedIndex >= 0) {
        event.preventDefault();
        onSelect(suggestions[selectedIndex]);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, onSelect, selectedIndex, suggestions]);

  if (!isOpen || query.trim().length < 2) return null;

  return (
    <div
      ref={dropdownRef}
      className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-2xl"
      role="listbox"
      aria-label="Seller suggestions"
    >
      <div className="flex items-center justify-between border-b border-neutral-100 bg-neutral-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
        <span>Seller suggestions</span>
        {loading && <span className="normal-case text-teal-700">Searching...</span>}
      </div>
      <div className="max-h-72 overflow-y-auto overscroll-contain py-1">
        {!loading && suggestions.length === 0 && (
          <div className="px-4 py-6 text-center text-sm text-neutral-500">No matching sellers</div>
        )}
        {suggestions.map((seller, index) => (
          <button
            key={seller._id}
            type="button"
            role="option"
            aria-selected={selectedIndex === index}
            onMouseEnter={() => setSelectedIndex(index)}
            onClick={() => onSelect(seller)}
            className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors ${
              selectedIndex === index ? 'bg-teal-50' : 'hover:bg-neutral-50'
            }`}
          >
            <div className="h-9 w-9 flex-none overflow-hidden rounded-lg bg-neutral-100">
              {(seller.logo || seller.profile) ? (
                <img src={seller.logo || seller.profile} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-teal-700">
                  {(seller.storeName || seller.sellerName).slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-neutral-900">{seller.sellerName}</div>
              <div className="truncate text-xs text-neutral-500">{seller.storeName}</div>
              <div className="truncate text-[11px] text-neutral-400">{seller.mobile} · {seller.email}</div>
            </div>
            <span className="flex-none text-[10px] font-medium text-neutral-400">{seller.status}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
