import { useNavigate } from 'react-router-dom';
import { useLayoutEffect, useRef, useState, useEffect, useMemo } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { getTheme } from '../../../utils/themes';
import { useLocation } from '../../../hooks/useLocation';
import { appConfig } from '../../../services/configService';
import { getCategories } from '../../../services/api/customerProductService';
import { Category } from '../../../types/domain';
import { getHeaderCategoriesPublic } from '../../../services/api/headerCategoryService';
import { getIconByName } from '../../../utils/iconLibrary';
import { useAppSettings } from '../../../context/AppSettingsContext';
import { useTranslation } from '../../../hooks/useTranslation';

gsap.registerPlugin(ScrollTrigger);

interface HomeHeroProps {
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
}

interface Tab {
  id: string;
  label: string;
  icon: React.ReactNode;
}

const ALL_TAB: Tab = {
  id: 'all',
  label: 'All',
  icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 9L12 2L21 9V20C21 20.5304 20.7893 21.0391 20.4142 21.4142C20.0391 21.7893 19.5304 22 19 22H5C4.46957 22 3.96086 21.7893 3.58579 21.4142C3.21071 21.0391 3 20.5304 3 20V9Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 22V12H15V22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

const MORE_TAB: Tab = {
  id: 'more-categories',
  label: 'More',
  icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
    </svg>
  ),
};

export default function HomeHero({ activeTab = 'all', onTabChange }: HomeHeroProps) {
  const { settings: appSettings } = useAppSettings();
  const { t, getTranslatedField } = useTranslation();
  const [tabs, setTabs] = useState<Tab[]>([ALL_TAB, MORE_TAB]);

  useEffect(() => {
    const fetchHeaderCategories = async () => {
      try {
        const cats = await getHeaderCategoriesPublic();
        if (cats && cats.length > 0) {
          const mapped = cats
            .filter(c => c.slug !== 'all' && c.status === 'Published')
            .sort((a, b) => (a.order || 0) - (b.order || 0))
            .map(c => ({
              id: c.slug,
              label: getTranslatedField(c, "name") || c.name,
              icon: getIconByName(c.iconName)
            }));
          setTabs([ALL_TAB, ...mapped, MORE_TAB]);
        } else {
          setTabs([ALL_TAB, MORE_TAB]);
        }
      } catch (error) {
        console.error('Failed to fetch header categories', error);
        setTabs([ALL_TAB, MORE_TAB]);
      }
    };
    fetchHeaderCategories();
  }, [getTranslatedField]);
  const navigate = useNavigate();
  const { location: userLocation } = useLocation();
  const heroRef = useRef<HTMLDivElement>(null);
  const topSectionRef = useRef<HTMLDivElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
  const [, setIsSticky] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });

  // Format location display text - only show if user has provided location
  const locationDisplayText = useMemo(() => {
    if (userLocation?.address) {
      // Use the full address if available
      return userLocation.address;
    }
    // Fallback to city, state format if available
    if (userLocation?.city && userLocation?.state) {
      return `${userLocation.city}, ${userLocation.state}`;
    }
    // Fallback to city only
    if (userLocation?.city) {
      return userLocation.city;
    }
    // No default - return empty string if no location provided
    return '';
  }, [userLocation]);

  const [categories, setCategories] = useState<Category[]>([]);

  // Fetch categories for search suggestions
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await getCategories();
        if (response.success && response.data) {
          setCategories(response.data.map((c: any) => ({
            ...c,
            id: c._id || c.id
          })));
        }
      } catch (error) {
        console.error("Error fetching categories for suggestions:", error);
      }
    };
    fetchCategories();
  }, []);

  // Search suggestions based on active tab or fetched categories
  const searchSuggestions = useMemo(() => {
    if (activeTab === 'all' && categories.length > 0) {
      // Use real category names for 'all' tab suggestions
      return categories.slice(0, 8).map(c => c.name.toLowerCase());
    }

    switch (activeTab) {
      case 'grocery':
        return ['atta', 'dal', 'rice', 'spices', 'sugar', 'ghee', 'oil', 'tea'];
      case 'fruits-vegetables':
        return ['fresh vegetables', 'potatoes', 'onions', 'apples', 'bananas', 'fresh juice'];
      case 'dairy-milk':
        return ['milk', 'paneer', 'curd', 'butter', 'cheese', 'ghee'];
      case 'bakery-biscuits':
        return ['bread', 'cookies', 'rusk', 'biscuits', 'cakes', 'toast'];
      case 'snacks-drinks':
        return ['chips', 'namkeen', 'cold drinks', 'chocolates', 'ice cream', 'farsan'];
      case 'beauty':
        return ['face wash', 'body lotion', 'shampoo', 'hair oil', 'baby care', 'cosmetics'];
      case 'fashion':
        return ['t-shirt', 'saree', 'jeans', 'footwear', 'bags', 'kurta', 'kids wear'];
      case 'electronics':
        return ['chargers', 'cables', 'power banks', 'earphones', 'mobile accessories', 'appliances'];
      case 'home-furniture':
        return ['home decor', 'cleaners', 'kitchen items', 'stationery', 'furniture', 'pooja items'];
      case 'toys-sports':
        return ['toys', 'cricket bat', 'football', 'board games', 'gym equipment', 'yoga mat'];
      default: // 'all'
        return ['atta', 'milk', 'dal', 'chips', 'fresh fruits', 'oil', 'tea', 'vegetables'];
    }
  }, [activeTab, categories]);

  useLayoutEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        hero,
        { opacity: 0, y: 20 },
        {
          opacity: 1,
          y: 0,
          duration: 0.6,
          ease: 'power2.out',
        }
      );
    }, hero);

    return () => ctx.revert();
  }, []);

  // Animate search suggestions
  useEffect(() => {
    setCurrentSearchIndex(0);
    const interval = setInterval(() => {
      setCurrentSearchIndex((prev) => (prev + 1) % searchSuggestions.length);
    }, 2000);

    return () => clearInterval(interval);
  }, [searchSuggestions.length, activeTab]);

  // Handle sticky header transition based on scroll position
  useEffect(() => {
    const handleScroll = () => {
      if (topSectionRef.current && stickyRef.current) {
        const topSectionBottom = topSectionRef.current.getBoundingClientRect().bottom;
        const topSectionHeight = topSectionRef.current.offsetHeight;
        // When the top section has scrolled up, transition to white
        const progress = Math.min(Math.max(1 - (topSectionBottom / topSectionHeight), 0), 1);
        setScrollProgress(progress);
        setIsSticky(topSectionBottom <= 0);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Check initial state

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Update sliding indicator position when activeTab changes and scroll to active tab
  useEffect(() => {
    const updateIndicator = (shouldScroll = true) => {
      const activeTabButton = tabRefs.current.get(activeTab);
      const container = tabsContainerRef.current;

      if (activeTabButton && container) {
        try {
          // Use offsetLeft for position relative to container (not affected by scroll)
          // This ensures the indicator stays aligned even when container scrolls
          const left = activeTabButton.offsetLeft;
          const width = activeTabButton.offsetWidth;

          // Ensure valid values
          if (width > 0) {
            setIndicatorStyle({ left, width });
          }

          // Scroll the container to bring the active tab into view (only when tab changes)
          if (shouldScroll) {
            const containerScrollLeft = container.scrollLeft;
            const containerWidth = container.offsetWidth;
            const buttonLeft = left;
            const buttonWidth = width;
            const buttonRight = buttonLeft + buttonWidth;

            // Calculate scroll position to center the button or keep it visible
            const scrollPadding = 20; // Padding from edges
            let targetScrollLeft = containerScrollLeft;

            // If button is on the left side and partially or fully hidden
            if (buttonLeft < containerScrollLeft + scrollPadding) {
              targetScrollLeft = buttonLeft - scrollPadding;
            }
            // If button is on the right side and partially or fully hidden
            else if (buttonRight > containerScrollLeft + containerWidth - scrollPadding) {
              targetScrollLeft = buttonRight - containerWidth + scrollPadding;
            }

            // Smooth scroll to the target position
            if (targetScrollLeft !== containerScrollLeft) {
              container.scrollTo({
                left: Math.max(0, targetScrollLeft),
                behavior: 'smooth'
              });
            }
          }
        } catch (error) {
          console.warn('Error updating indicator:', error);
        }
      }
    };

    // Update immediately with scroll
    updateIndicator(true);

    // Also update after delays to handle any layout shifts and ensure smooth animation
    const timeout1 = setTimeout(() => updateIndicator(true), 50);
    const timeout2 = setTimeout(() => updateIndicator(true), 150);
    const timeout3 = setTimeout(() => updateIndicator(false), 300); // Last update without scroll to avoid conflicts

    return () => {
      clearTimeout(timeout1);
      clearTimeout(timeout2);
      clearTimeout(timeout3);
    };
  }, [activeTab]);

  const handleTabClick = (tabId: string) => {
    if (tabId === 'more-categories') {
      navigate('/categories');
      return;
    }
    onTabChange?.(tabId);
    // Don't scroll - keep page at current position
  };

  const theme = getTheme(activeTab || 'all');
  const heroGradient = `linear-gradient(to bottom right, ${theme.primary[0]}, ${theme.primary[1]}, ${theme.primary[2]})`;

  // Helper to convert RGB to RGBA
  const rgbToRgba = (rgb: string, alpha: number) => {
    return rgb.replace('rgb', 'rgba').replace(')', `, ${alpha})`);
  };

  return (
    <div
      ref={heroRef}
      style={{
        background: heroGradient,
        paddingBottom: 0,
        marginBottom: 0,
      }}
    >
      {/* Top section with logo on left, delivery info and name on right - NOT sticky */}
      <div>
        <div ref={topSectionRef} className="px-4 md:px-6 lg:px-8 pt-2 md:pt-3 pb-1">
          <div className="flex items-center gap-3 mb-1.5">
            {/* Left: App Logo - Solid white background with fixed compact size */}
            <div
              className="bg-white rounded-2xl p-1.5 shadow-sm border border-white/90 flex items-center justify-center flex-shrink-0 overflow-hidden"
              style={{
                width: '50px',
                height: '50px',
                minWidth: '50px',
                maxWidth: '50px',
                minHeight: '50px',
                maxHeight: '50px',
              }}
            >
              <img
                src={appSettings?.appLogo || '/assets/olovelylogo.png'}
                alt={appSettings?.appName || 'Olovely'}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                }}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/assets/olovelylogo.png';
                }}
              />
            </div>

            {/* Right: Text content (App Name, Delivery Time, Location) */}
            <div className="flex-1 min-w-0 pr-1">
              {/* Service name - dynamic */}
              <div className="text-neutral-800 font-bold text-[11px] md:text-xs tracking-tight truncate leading-tight">
                {appSettings?.appName || 'Olovely Total Suvidha'}
              </div>
              {/* Delivery time - large, bold */}
              <div className="text-neutral-950 font-black text-2xl md:text-xl leading-tight my-0.5">
                {appSettings?.estimatedDeliveryTime || appConfig.estimatedDeliveryTime || '12-15 mins'}
              </div>
              {/* Location with dropdown indicator - only show if location is provided */}
              {locationDisplayText && (
                <div
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('openLocationChangeModal'));
                  }}
                  className="text-neutral-800 hover:text-neutral-950 cursor-pointer text-[10px] md:text-xs inline-flex items-center gap-1 leading-tight transition-colors py-0.5 select-none"
                  title="Click to change location"
                >
                  <span className="line-clamp-1 font-medium" title={locationDisplayText}>{locationDisplayText}</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
                    <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Sticky section: Search Bar and Category Tabs - Always sticky */}
      <div
        ref={stickyRef}
        className="sticky top-0 z-50"
        style={{
          ...(scrollProgress >= 0.1 && {
            background: `linear-gradient(to bottom right,
              ${rgbToRgba(theme.primary[0], 1 - scrollProgress)},
              ${rgbToRgba(theme.primary[1], 1 - scrollProgress)},
              ${rgbToRgba(theme.primary[2], 1 - scrollProgress)}),
              rgba(255, 255, 255, ${scrollProgress})`,
            boxShadow: `0 4px 6px -1px rgba(0, 0, 0, ${scrollProgress * 0.1})`,
            transition: 'background 0.1s ease-out, box-shadow 0.1s ease-out',
          }),
        }}
      >
        <div className="px-4 md:px-6 lg:px-8 pt-2 md:pt-2 pb-2 md:pb-2">
          {/* Search Bar */}
          <div
            onClick={() => navigate('/search')}
            className="w-full md:w-auto md:max-w-xl md:mx-auto rounded-xl shadow-lg px-3 py-2 md:px-3 md:py-1.5 flex items-center gap-2 cursor-pointer hover:shadow-xl transition-all duration-300 mb-2 md:mb-1.5 bg-white"
            style={{
              backgroundColor: scrollProgress > 0.1 ? `rgba(249, 250, 251, ${scrollProgress})` : 'white',
              border: scrollProgress > 0.1 ? `1px solid rgba(229, 231, 235, ${scrollProgress})` : 'none',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0 md:w-4 md:h-4">
              <circle cx="11" cy="11" r="8" stroke={scrollProgress > 0.5 ? "#9ca3af" : "#6b7280"} strokeWidth="2" />
              <path d="m21 21-4.35-4.35" stroke={scrollProgress > 0.5 ? "#9ca3af" : "#6b7280"} strokeWidth="2" strokeLinecap="round" />
            </svg>
            <div className="flex-1 relative h-4 md:h-4 overflow-hidden">
              {searchSuggestions.map((suggestion, index) => {
                const isActive = index === currentSearchIndex;
                const prevIndex = (currentSearchIndex - 1 + searchSuggestions.length) % searchSuggestions.length;
                const isPrev = index === prevIndex;

                return (
                  <div
                    key={suggestion}
                    className={`absolute inset-0 flex items-center transition-all duration-500 ${isActive
                      ? 'translate-y-0 opacity-100'
                      : isPrev
                        ? '-translate-y-full opacity-0'
                        : 'translate-y-full opacity-0'
                      }`}
                  >
                    <span className={`text-xs md:text-xs`} style={{ color: scrollProgress > 0.5 ? '#9ca3af' : '#6b7280' }}>
                      Search &apos;{suggestion}&apos;
                    </span>
                  </div>
                );
              })}
            </div>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0 md:w-4 md:h-4">
              <path d="M12 1C13.1 1 14 1.9 14 3C14 4.1 13.1 5 12 5C10.9 5 10 4.1 10 3C10 1.9 10.9 1 12 1Z" fill={scrollProgress > 0.5 ? "#9ca3af" : "#6b7280"} />
              <path d="M19 10V17C19 18.1 18.1 19 17 19H7C5.9 19 5 18.1 5 17V10" stroke={scrollProgress > 0.5 ? "#9ca3af" : "#6b7280"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M12 11V17" stroke={scrollProgress > 0.5 ? "#9ca3af" : "#6b7280"} strokeWidth="2" strokeLinecap="round" />
              <path d="M8 11V17" stroke={scrollProgress > 0.5 ? "#9ca3af" : "#6b7280"} strokeWidth="2" strokeLinecap="round" />
              <path d="M16 11V17" stroke={scrollProgress > 0.5 ? "#9ca3af" : "#6b7280"} strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="border-b border-neutral-400/40 w-full" style={{ paddingBottom: 0 }}>
          <div
            ref={tabsContainerRef}
            className="relative flex gap-2 md:gap-3 overflow-x-auto scrollbar-hide -mx-4 md:mx-0 px-4 md:px-6 lg:px-8 md:justify-center scroll-smooth"
            style={{ paddingBottom: '12px' }}
            data-padding-bottom="md:8px"
          >
            {/* Sliding Indicator */}
            {indicatorStyle.width > 0 && (
              <div
                className="absolute bottom-0 h-1 bg-neutral-900 rounded-t-md transition-all duration-300 ease-out pointer-events-none"
                style={{
                  left: `${indicatorStyle.left}px`,
                  width: `${indicatorStyle.width}px`,
                  transition: 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1), width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  zIndex: 0,
                }}
              />
            )}

            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              const tabColor = isActive
                ? 'text-neutral-900'
                : scrollProgress > 0.5
                  ? 'text-neutral-600'
                  : 'text-neutral-800';

              return (
                <button
                  key={tab.id}
                  ref={(el) => {
                    if (el) {
                      tabRefs.current.set(tab.id, el);
                    } else {
                      tabRefs.current.delete(tab.id);
                    }
                  }}
                  onClick={() => handleTabClick(tab.id)}
                  className={`flex-shrink-0 flex flex-col md:flex-row items-center justify-center min-w-[50px] md:min-w-fit md:px-3 py-1 md:py-1.5 relative ${tabColor} z-10`}
                  style={{
                    transition: 'color 0.3s ease-out',
                  }}
                  type="button"
                >
                  <div className={`mb-0.5 md:hidden w-5 h-5 flex items-center justify-center ${tabColor}`} style={{
                    transition: 'color 0.3s ease-out, transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    transform: isActive ? 'scale(1.1)' : 'scale(1)',
                  }}>
                    {tab.icon}
                  </div>
                  <span
                    className={`text-[10px] md:text-xs md:whitespace-nowrap ${isActive ? 'font-semibold' : 'font-medium'}`}
                    style={{
                      transition: 'font-weight 0.3s ease-out',
                    }}
                  >
                    {tab.id === 'all'
                      ? t('common.all', 'All')
                      : tab.id === 'more-categories'
                        ? t('common.more', 'More')
                        : tab.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

