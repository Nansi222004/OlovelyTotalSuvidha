/**
 * FSSAI veg / non-veg mark.
 *   VEG     → green square outline with a filled green circle
 *   NON_VEG → brown-red square outline with a filled triangle (FSSAI 2022 non-veg symbol; egg is non-veg)
 * Renders nothing for non-food products (foodType unset).
 */
export type FoodType = 'VEG' | 'NON_VEG';

const VEG_COLOR = '#0F8A3B';
const NON_VEG_COLOR = '#A5281B';

interface FoodTypeMarkProps {
  foodType?: FoodType | string | null;
  /** Edge length in px (default 14). */
  size?: number;
  className?: string;
}

export function normalizeFoodType(value?: string | null): FoodType | null {
  const v = String(value || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (v === 'VEG') return 'VEG';
  if (v === 'NON_VEG' || v === 'NONVEG' || v === 'EGG') return 'NON_VEG';
  return null;
}

export default function FoodTypeMark({ foodType, size = 14, className = '' }: FoodTypeMarkProps) {
  const type = normalizeFoodType(foodType);
  if (!type) return null;
  const isVeg = type === 'VEG';
  const color = isVeg ? VEG_COLOR : NON_VEG_COLOR;
  const label = isVeg ? 'Vegetarian' : 'Non-vegetarian';

  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={`inline-flex flex-shrink-0 items-center justify-center bg-white ${className}`}
      style={{
        width: size,
        height: size,
        border: `${Math.max(1, Math.round(size / 10))}px solid ${color}`,
        borderRadius: Math.max(1, Math.round(size / 8)),
      }}
    >
      {isVeg ? (
        <span style={{ width: size * 0.5, height: size * 0.5, borderRadius: '50%', backgroundColor: color }} />
      ) : (
        <span
          style={{
            width: 0,
            height: 0,
            borderLeft: `${size * 0.3}px solid transparent`,
            borderRight: `${size * 0.3}px solid transparent`,
            borderBottom: `${size * 0.5}px solid ${color}`,
          }}
        />
      )}
    </span>
  );
}
