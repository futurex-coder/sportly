'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cancelBooking } from '@/lib/actions/booking-actions';
import { formatPrice } from '@/lib/utils/price';
import { toast } from 'sonner';
import {
  CalendarDays,
  Clock,
  MapPin,
  X,
  RefreshCw,
  Ban,
  Check,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';

interface Booking {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  status: string;
  total_price_eur: number | null;
  total_price_local: number | null;
  fields: {
    name: string;
    slug: string;
    sport_categories: { name: string; icon: string | null } | null;
    locations: {
      name: string;
      city: string;
      address: string;
      clubs: { name: string; slug: string };
    };
  };
}

const STATUS_CONFIG: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  confirmed: { color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', icon: <Check className="mr-1 size-3" />, label: 'Confirmed' },
  completed: { color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', icon: <CheckCircle2 className="mr-1 size-3" />, label: 'Completed' },
  cancelled: { color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', icon: <Ban className="mr-1 size-3" />, label: 'Cancelled' },
};

export default function MyBookingsClient({
  upcoming,
  past,
}: {
  upcoming: Booking[];
  past: Booking[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleCancel(bookingId: string) {
    if (!confirm('Cancel this booking?')) return;
    setError(null);
    startTransition(async () => {
      const result = await cancelBooking(bookingId);
      if (!result.success) {
        toast.error(result.error ?? 'Failed to cancel booking');
        setError(result.error ?? 'Failed to cancel booking');
        return;
      }
      toast.success('Booking cancelled');
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
          {error}
        </div>
      )}

      <Tabs defaultValue="upcoming">
        <TabsList>
          <TabsTrigger value="upcoming">Upcoming ({upcoming.length})</TabsTrigger>
          <TabsTrigger value="past">Past ({past.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="space-y-3 pt-4">
          {upcoming.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="No upcoming bookings"
              description="Browse clubs and book a field to get started."
              actionLabel="Find a Club"
              actionHref="/"
            />
          ) : (
            upcoming.map((b) => (
              <BookingCard
                key={b.id}
                booking={b}
                onCancel={() => handleCancel(b.id)}
                isPending={isPending}
                showActions
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="past" className="space-y-3 pt-4">
          {past.length === 0 ? (
            <EmptyState
              icon={Clock}
              title="No past bookings"
              description="Your completed bookings will appear here."
            />
          ) : (
            past.map((b) => (
              <BookingCard key={b.id} booking={b} isPending={false} />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function BookingCard({
  booking: b,
  onCancel,
  isPending,
  showActions,
}: {
  booking: Booking;
  onCancel?: () => void;
  isPending: boolean;
  showActions?: boolean;
}) {
  const f = b.fields;
  const loc = f.locations;
  const club = loc.clubs;
  const sc = f.sport_categories;
  const st = STATUS_CONFIG[b.status] ?? STATUS_CONFIG.confirmed;

  const date = new Date(b.date + 'T12:00:00');
  const dateStr = date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

  return (
    <div className="flex items-start gap-4 rounded-lg border p-4">
      <div className="bg-muted flex size-12 flex-col items-center justify-center rounded-lg text-center">
        <span className="text-lg">{sc?.icon ?? '🏅'}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold">{f.name}</span>
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${st.color}`}>
            {st.icon}{st.label}
          </span>
        </div>
        <Link href={`/clubs/${club.slug}`} className="text-muted-foreground text-sm hover:underline">
          {club.name} — {loc.name}
        </Link>
        <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-3 text-xs">
          <span className="flex items-center gap-1">
            <CalendarDays className="size-3" /> {dateStr}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="size-3" /> {b.start_time.slice(0, 5)} – {b.end_time.slice(0, 5)}
          </span>
          <span className="flex items-center gap-1">
            <MapPin className="size-3" /> {loc.city}
          </span>
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2">
        <span className="text-sm font-semibold">
          {formatPrice(
            b.total_price_eur != null ? Number(b.total_price_eur) : null,
            b.total_price_local != null ? Number(b.total_price_local) : null
          )}
        </span>
        {showActions && b.status !== 'cancelled' && b.status !== 'completed' && (
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" className="text-destructive h-7 text-xs" onClick={onCancel} disabled={isPending}>
              {isPending ? <Loader2 className="mr-1 size-3 animate-spin" /> : <X className="mr-1 size-3" />}
              Cancel
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
              <Link href={`/clubs/${club.slug}`}>
                <RefreshCw className="mr-1 size-3" /> Rebook
              </Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

