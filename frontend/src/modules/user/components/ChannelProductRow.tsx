import React, { useRef, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import ProductCard from './ProductCard';
import { Product } from '../../../types/domain';

export interface ChannelProductRowProps {
  id?: string;
  title: string;
  subtitle: string;
  viewAllLink: string;
  products: any[];
  loading?: boolean;
  isWholesale?: boolean;
  icon?: string;
  themeColor?: 'emerald' | 'blue' | 'purple';
}

export default function ChannelProductRow({
  id,
  title,
  subtitle,
  viewAllLink,
  products = [],
  loading = false,
  isWholesale = false,
  icon,
  themeColor = 'emerald',
}: ChannelProductRowProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeftState, setScrollLeftState] = useState(0);

  // Check scroll boundary to show/hide arrows
  const checkScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  };

  useEffect(() => {
    checkScroll();
    const el = scrollContainerRef.current;
    if (!el) return;
    el.addEventListener('scroll', checkScroll, { passive: true });
    window.addEventListener('resize', checkScroll);
    return () => {
      el.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, [products]);

  const scroll = (direction: 'left' | 'right') => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const scrollAmount = Math.max(el.clientWidth * 0.75, 240);
    el.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  // Mouse drag to scroll
  const handleMouseDown = (e: React.MouseEvent) => {
    const el = scrollContainerRef.current;
    if (!el) return;
    setIsDragging(true);
    setStartX(e.pageX - el.offsetLeft);
    setScrollLeftState(el.scrollLeft);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    const el = scrollContainerRef.current;
    if (!el) return;
    const x = e.pageX - el.offsetLeft;
    const walk = (x - startX) * 1.5;
    el.scrollLeft = scrollLeftState - walk;
  };

  // 1. Loading State
  if (loading) {
    return (
      <section className="my-6 md:my-8 px-4 md:px-6 lg:px-8" aria-label={`Loading ${title}`}>
        <div className="flex items-center justify-between mb-3 md:mb-4">
          <div>
            <div className="h-6 w-36 bg-neutral-200 rounded animate-pulse mb-1.5" />
            <div className="h-3.5 w-48 bg-neutral-100 rounded animate-pulse" />
          </div>
          <div className="h-8 w-20 bg-neutral-100 rounded-full animate-pulse" />
        </div>
        <div className="flex gap-3 overflow-hidden pb-2">
          {Array.from({ length: 5 }).map((_, idx) => (
            <div
              key={idx}
              className="flex-shrink-0 w-[155px] xs:w-[170px] sm:w-[185px] md:w-[200px] bg-white rounded-xl p-3 border border-neutral-100 shadow-2xs animate-pulse"
            >
              <div className="w-full aspect-square bg-neutral-100 rounded-lg mb-3" />
              <div className="h-3 bg-neutral-200 rounded w-1/3 mb-2" />
              <div className="h-4 bg-neutral-200 rounded w-5/6 mb-2" />
              <div className="h-4 bg-neutral-100 rounded w-1/2 mb-3" />
              <div className="h-8 bg-neutral-100 rounded-lg w-full mt-auto" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  // 2. Strict Empty State: Cleanly hide section if no products exist (Never show orphaned heading)
  if (!products || products.length === 0) {
    return null;
  }

  const badgeColorClass =
    themeColor === 'purple'
      ? 'bg-purple-50 text-purple-700 border-purple-200/80 hover:bg-purple-100'
      : themeColor === 'blue'
      ? 'bg-blue-50 text-blue-700 border-blue-200/80 hover:bg-blue-100'
      : 'bg-emerald-50 text-emerald-700 border-emerald-200/80 hover:bg-emerald-100';

  const viewAllBtnColorClass =
    themeColor === 'purple'
      ? 'text-purple-700 hover:text-purple-800 bg-purple-50 hover:bg-purple-100 border-purple-200'
      : themeColor === 'blue'
      ? 'text-blue-700 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border-blue-200'
      : 'text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border-emerald-200';

  return (
    <section id={id} className="my-5 md:my-7 relative group/row" aria-label={title}>
      {/* Header with Title, Subtitle, and View All button */}
      <div className="flex items-end justify-between mb-3 md:mb-4 px-4 md:px-6 lg:px-8">
        <div>
          <div className="flex items-center gap-2">
            {icon && <span className="text-xl md:text-2xl select-none">{icon}</span>}
            <h2 className="text-lg md:text-2xl font-black text-neutral-900 tracking-tight">
              {title}
            </h2>
            <span
              className={`hidden xs:inline-flex items-center text-[10px] md:text-xs font-bold px-2 py-0.5 rounded-full border ${badgeColorClass}`}
            >
              {products.length} {products.length === 1 ? 'item' : 'items'}
            </span>
          </div>
          {subtitle && (
            <p className="text-xs md:text-sm text-neutral-500 font-medium mt-0.5">
              {subtitle}
            </p>
          )}
        </div>

        {/* View All Button on Right */}
        <Link
          to={viewAllLink}
          className={`inline-flex items-center gap-1 text-xs md:text-sm font-bold px-3 py-1.5 rounded-full border transition-all duration-200 flex-shrink-0 shadow-2xs hover:shadow-xs active:scale-95 ${viewAllBtnColorClass}`}
        >
          <span>View All</span>
          <svg
            className="w-3.5 h-3.5 transition-transform group-hover/row:translate-x-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>

      {/* Carousel Container with Scroll Arrows */}
      <div className="relative">
        {/* Left Arrow (Desktop / Tablet) */}
        {canScrollLeft && (
          <button
            onClick={() => scroll('left')}
            aria-label={`Scroll ${title} left`}
            className="hidden md:flex absolute -left-2 lg:left-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/95 backdrop-blur-xs border border-neutral-200/80 shadow-md items-center justify-center text-neutral-700 hover:text-neutral-900 hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}

        {/* Right Arrow (Desktop / Tablet) */}
        {canScrollRight && (
          <button
            onClick={() => scroll('right')}
            aria-label={`Scroll ${title} right`}
            className="hidden md:flex absolute -right-2 lg:right-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/95 backdrop-blur-xs border border-neutral-200/80 shadow-md items-center justify-center text-neutral-700 hover:text-neutral-900 hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}

        {/* Horizontal Scrollable Row */}
        <div
          ref={scrollContainerRef}
          onMouseDown={handleMouseDown}
          onMouseLeave={handleMouseLeave}
          onMouseUp={handleMouseUp}
          onMouseMove={handleMouseMove}
          className={`flex gap-2.5 sm:gap-3.5 overflow-x-auto scrollbar-hide px-4 md:px-6 lg:px-8 py-1 scroll-smooth snap-x snap-mandatory select-none ${
            isDragging ? 'cursor-grabbing select-none' : 'cursor-default'
          }`}
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {products.map((product) => (
            <div
              key={product.id || (product as any)._id}
              className="flex-shrink-0 w-[150px] xs:w-[165px] sm:w-[180px] md:w-[195px] lg:w-[210px] snap-start"
            >
              <ProductCard
                product={product}
                categoryStyle={false}
                showBadge={true}
                showStockInfo={true}
                forceWholesale={isWholesale}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
