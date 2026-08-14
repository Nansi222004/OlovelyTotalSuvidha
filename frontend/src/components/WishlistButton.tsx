import { useWishlist } from '../hooks/useWishlist';

interface WishlistButtonProps {
  productId: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  position?: 'absolute' | 'relative';
}

export default function WishlistButton({
  productId,
  className = '',
  size = 'md',
  position = 'absolute'
}: WishlistButtonProps) {
  const { isWishlisted, toggleWishlist } = useWishlist(productId);

  const sizeClasses = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-12 h-12'
  };

  const iconSizes = {
    sm: '16',
    md: '20',
    lg: '24'
  };

  // Only add default positioning if className doesn't already specify it
  const hasPositioning = className.includes('top-') || className.includes('right-') || className.includes('left-') || className.includes('bottom-');
  const positionClasses = position === 'absolute' && !hasPositioning ? 'absolute top-2 right-2' : position === 'absolute' ? 'absolute' : '';
  const baseClasses = `${positionClasses} z-30 ${sizeClasses[size]} rounded-full bg-white/95 backdrop-blur-sm flex items-center justify-center hover:bg-white transition-all shadow-md group/heart ${className}`;

  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleWishlist(e);
      }}
      className={baseClasses}
      aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
    >
      <svg
        width={iconSizes[size]}
        height={iconSizes[size]}
        viewBox="0 0 24 24"
        fill={isWishlisted ? "#ef4444" : "none"}
        xmlns="http://www.w3.org/2000/svg"
        className={`transition-colors ${isWishlisted ? "text-red-500" : "text-neutral-400 group-hover/heart:text-red-400"}`}
      >
        <path
          d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

