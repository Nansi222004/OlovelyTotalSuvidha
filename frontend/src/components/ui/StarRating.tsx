interface StarRatingProps {
  rating: number;
  reviewCount?: number;
  size?: 'sm' | 'md' | 'lg';
  showCount?: boolean;
  className?: string;
  /** When set, stars become clickable for selecting a rating */
  interactive?: boolean;
  onChange?: (rating: number) => void;
}

export default function StarRating({
  rating,
  reviewCount,
  size = 'md',
  showCount = true,
  className = '',
  interactive = false,
  onChange,
}: StarRatingProps) {
  // Ensure rating is between 0 and 5
  const normalizedRating = Math.max(0, Math.min(5, rating || 0));
  const fullStars = interactive
    ? Math.round(normalizedRating)
    : Math.floor(normalizedRating);
  const hasHalfStar =
    !interactive && normalizedRating % 1 >= 0.5 && normalizedRating % 1 < 1;
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

  const starSize = {
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
    lg: 'w-5 h-5',
  }[size];

  const textSize = {
    sm: 'text-[10px]',
    md: 'text-xs',
    lg: 'text-sm',
  }[size];

  const formatReviewCount = (count?: number): string => {
    if (!count || count === 0) return '';
    if (count < 1000) return `(${count})`;
    if (count < 100000) return `(${(count / 1000).toFixed(1)}k)`;
    return `(${(count / 100000).toFixed(1)} lac)`;
  };

  const renderStar = (filled: boolean, key: string, value?: number) => {
    const svg = (
      <svg
        key={key}
        className={`${starSize} ${filled ? 'text-yellow-400' : 'text-neutral-300'} ${
          interactive ? 'cursor-pointer hover:scale-110 transition-transform' : ''
        }`}
        fill="currentColor"
        viewBox="0 0 24 24"
        onClick={
          interactive && onChange && value
            ? (e) => {
                e.stopPropagation();
                onChange(value);
              }
            : undefined
        }
        role={interactive ? 'button' : undefined}
        aria-label={interactive && value ? `Rate ${value} stars` : undefined}
      >
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
    );
    return svg;
  };

  if (interactive) {
    return (
      <div className={`flex items-center gap-1 ${className}`}>
        <div className="flex items-center gap-0.5">
          {[1, 2, 3, 4, 5].map((value) =>
            renderStar(value <= fullStars, `star-${value}`, value)
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <div className="flex items-center gap-0.5">
        {/* Full stars */}
        {Array.from({ length: fullStars }).map((_, i) =>
          renderStar(true, `full-${i}`)
        )}

        {/* Half star */}
        {hasHalfStar && (
          <div className="relative inline-block">
            <svg
              className={`${starSize} text-neutral-300`}
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            <div className="absolute inset-0 overflow-hidden" style={{ width: '50%' }}>
              <svg
                className={`${starSize} text-yellow-400`}
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            </div>
          </div>
        )}

        {/* Empty stars */}
        {Array.from({ length: emptyStars }).map((_, i) =>
          renderStar(false, `empty-${i}`)
        )}
      </div>

      {normalizedRating > 0 && (
        <>
          <span className={`${textSize} text-neutral-600 font-medium`}>
            {normalizedRating.toFixed(1)}
          </span>
          {showCount && reviewCount !== undefined && reviewCount > 0 && (
            <span className={`${textSize} text-neutral-500`}>
              {formatReviewCount(reviewCount)}
            </span>
          )}
        </>
      )}
    </div>
  );
}
