'use client';

import { useState } from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RatingStarsProps {
  /** Current rating value (0–5, supports halves for display). */
  value: number;
  /** If provided, the component is interactive (clickable). */
  onChange?: (value: number) => void;
  /** Star size class. Defaults to "size-4". */
  size?: string;
  /** Show the numeric value next to the stars. */
  showValue?: boolean;
  /** Max value suffix, e.g. "/ 5". */
  showMax?: boolean;
}

export default function RatingStars({
  value,
  onChange,
  size = 'size-4',
  showValue = false,
  showMax = false,
}: RatingStarsProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const interactive = !!onChange;
  const displayValue = hovered ?? value;

  const full = Math.floor(displayValue);
  const hasHalf = displayValue - full >= 0.25 && displayValue - full < 0.75;
  const empty = 5 - full - (hasHalf ? 1 : 0);

  return (
    <div className="inline-flex items-center gap-1">
      <div
        className={cn('flex gap-0.5', interactive && 'cursor-pointer')}
        onMouseLeave={() => interactive && setHovered(null)}
      >
        {Array.from({ length: 5 }).map((_, i) => {
          const starValue = i + 1;
          const isFilled = starValue <= full;
          const isHalf = !isFilled && hasHalf && starValue === full + 1;
          const isEmpty = !isFilled && !isHalf;

          return (
            <button
              key={i}
              type="button"
              disabled={!interactive}
              onClick={() => onChange?.(starValue)}
              onMouseEnter={() => interactive && setHovered(starValue)}
              className={cn(
                'transition-colors disabled:cursor-default',
                interactive && 'hover:scale-110'
              )}
            >
              <Star
                className={cn(
                  size,
                  isFilled && 'fill-yellow-400 text-yellow-400',
                  isHalf && 'fill-yellow-400/50 text-yellow-400',
                  isEmpty && 'text-muted-foreground/30'
                )}
              />
            </button>
          );
        })}
      </div>
      {showValue && (
        <span className="ml-1 font-semibold">{value.toFixed(1)}</span>
      )}
      {showMax && (
        <span className="text-muted-foreground text-sm">/ 5</span>
      )}
    </div>
  );
}
