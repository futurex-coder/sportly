'use client';

import { type TimeSlot } from '@/lib/booking/slot-generator';
import { formatPrice } from '@/lib/utils/price';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Users } from 'lucide-react';

interface SlotCellProps {
  slot: TimeSlot;
  durationMinutes: number;
  onClick?: () => void;
}

const STATUS_CLASSES: Record<TimeSlot['status'], string> = {
  available:
    'cursor-pointer border border-transparent bg-white hover:border-primary/40 hover:bg-primary/5 dark:bg-zinc-950 dark:hover:bg-primary/10',
  booked:
    'bg-emerald-500/90 text-white dark:bg-emerald-600/80',
  blocked:
    'bg-red-50 text-red-400 dark:bg-red-950/30 dark:text-red-500',
  past:
    'bg-zinc-100 text-zinc-400 dark:bg-zinc-800/60 dark:text-zinc-600',
  closed:
    'bg-zinc-50 text-zinc-300 dark:bg-zinc-900/40 dark:text-zinc-700',
};

function SessionBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <Badge
      variant="secondary"
      className="mt-0.5 h-4 gap-0.5 px-1 text-[9px] font-medium"
    >
      <Users className="size-2.5" />
      {count}
    </Badge>
  );
}

export default function SlotCell({ slot, durationMinutes, onClick }: SlotCellProps) {
  const base = 'flex flex-col items-center justify-center rounded-md px-2 py-2.5 text-center transition-colors';
  const sessionCount = slot.sessions.length;
  const isClickable = slot.status === 'available' || sessionCount > 0;

  if (slot.status === 'available') {
    return (
      <button className={`${base} ${STATUS_CLASSES.available}`} onClick={onClick}>
        <span className="text-xs font-semibold">
          {formatPrice(slot.priceEur, slot.priceLocal)}
        </span>
        <span className="text-muted-foreground text-[10px]">{durationMinutes} min</span>
        <SessionBadge count={sessionCount} />
      </button>
    );
  }

  if (slot.status === 'booked') {
    const content = (
      <div className="flex flex-col items-center">
        <span className="text-xs font-medium">Booked</span>
        <SessionBadge count={sessionCount} />
      </div>
    );

    if (isClickable) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className={`${base} ${STATUS_CLASSES.booked} cursor-pointer ring-white/20 hover:ring-2`}
              onClick={onClick}
            >
              {content}
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p className="text-xs">
              {slot.startTime} – {slot.endTime} &middot; Booked &middot; {sessionCount} {sessionCount === 1 ? 'session' : 'sessions'}
            </p>
          </TooltipContent>
        </Tooltip>
      );
    }

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`${base} ${STATUS_CLASSES.booked}`}>
            {content}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p className="text-xs">
            {slot.startTime} – {slot.endTime} &middot; Booked
          </p>
        </TooltipContent>
      </Tooltip>
    );
  }

  if (slot.status === 'blocked') {
    return (
      <div className={`${base} ${STATUS_CLASSES.blocked}`}>
        <span className="text-[11px]">Blocked</span>
      </div>
    );
  }

  if (slot.status === 'past') {
    return (
      <div className={`${base} ${STATUS_CLASSES.past}`}>
        <span className="text-[11px]">Past</span>
      </div>
    );
  }

  // closed
  return <div className={`${base} ${STATUS_CLASSES.closed}`} />;
}
