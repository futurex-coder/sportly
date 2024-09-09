'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MapPin, Search, ChevronRight, X, Layers } from 'lucide-react';

interface ClubRow {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  logoUrl: string | null;
  description: string | null;
  addresses: string[];
  cities: string[];
  minPriceEur: number | null;
  maxPriceEur: number | null;
  minPriceLocal: number | null;
  maxPriceLocal: number | null;
  slotDuration: number | null;
  currency: string;
  fieldCount: number;
}

interface Sport {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  color_primary: string | null;
}

interface Props {
  sport: Sport;
  clubs: ClubRow[];
  cities: string[];
  initialCity: string;
}

export default function ClubListingClient({
  sport,
  clubs,
  cities,
  initialCity,
}: Props) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [city, setCity] = useState(initialCity);

  const filtered = useMemo(() => {
    return clubs.filter((c) => {
      if (city && !c.cities.some((ct) => ct.toLowerCase() === city.toLowerCase())) {
        return false;
      }
      if (search) {
        const q = search.toLowerCase();
        if (
          !c.name.toLowerCase().includes(q) &&
          !c.addresses.some((a) => a.toLowerCase().includes(q))
        ) {
          return false;
        }
      }
      return true;
    });
  }, [clubs, city, search]);

  function handleCityChange(val: string) {
    setCity(val === '__all__' ? '' : val);
  }

  const primary = sport.color_primary ?? '#16a34a';

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <span>{sport.icon}</span> {sport.name} Clubs
        </h1>
        <p className="text-muted-foreground text-sm">
          {filtered.length} club{filtered.length !== 1 ? 's' : ''} with{' '}
          {sport.name.toLowerCase()} fields
        </p>
      </div>

      {/* Filter bar */}
      <div className="mb-6 flex flex-wrap items-end gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
          <Input
            placeholder="Search clubs or addresses..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={city || '__all__'} onValueChange={handleCityChange}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All cities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All cities</SelectItem>
            {cities.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(search || city) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch('');
              setCity('');
            }}
          >
            <X className="mr-1 size-4" /> Clear
          </Button>
        )}
      </div>

      {/* Club list */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-md border border-dashed py-20">
          <Layers className="text-muted-foreground mb-4 size-10" />
          <h3 className="text-lg font-semibold">No clubs found</h3>
          <p className="text-muted-foreground text-sm">
            Try a different city or search term.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((club) => (
            <Link
              key={club.id}
              href={`/clubs/${club.slug}`}
              className="group flex flex-col rounded-xl border bg-white p-4 transition-shadow hover:shadow-md sm:flex-row sm:items-center sm:gap-4 dark:bg-zinc-900"
            >
              <div className="flex items-center gap-3 sm:gap-4">
                {/* Logo */}
                <Avatar className="size-12 shrink-0 rounded-lg sm:size-14">
                  <AvatarImage src={club.logoUrl ?? undefined} />
                  <AvatarFallback
                    className="rounded-lg text-lg font-bold text-white"
                    style={{ backgroundColor: primary }}
                  >
                    {club.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold group-hover:underline">
                    {club.name}
                  </h3>
                  <p className="text-muted-foreground flex items-center gap-1 text-sm">
                    <MapPin className="size-3 shrink-0" />
                    <span className="truncate">
                      {club.cities.join(', ')}
                      {club.addresses.length > 0 && ` — ${club.addresses[0]}`}
                    </span>
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {club.fieldCount} field{club.fieldCount !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>

              {/* Mobile: price + CTA row */}
              <div className="mt-3 flex items-center justify-between border-t pt-3 sm:mt-0 sm:border-0 sm:pt-0">
                {/* Price */}
                <div className="text-left sm:text-right">
                  {club.minPriceEur !== null ? (
                    <>
                      <div className="text-sm font-semibold">
                        <PriceRange
                          min={club.minPriceEur}
                          max={club.maxPriceEur}
                          suffix="€"
                        />
                      </div>
                      {club.minPriceLocal !== null && (
                        <div className="text-muted-foreground text-xs">
                          <PriceRange
                            min={club.minPriceLocal}
                            max={club.maxPriceLocal}
                            suffix={club.currency === 'BGN' ? 'лв' : club.currency}
                          />
                        </div>
                      )}
                      {club.slotDuration && (
                        <div className="text-muted-foreground text-[10px]">
                          / {club.slotDuration} min
                        </div>
                      )}
                    </>
                  ) : (
                    <span className="text-muted-foreground text-xs">
                      Price on request
                    </span>
                  )}
                </div>

                {/* Reserve button */}
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  style={{
                    borderColor: primary,
                    color: primary,
                  }}
                  tabIndex={-1}
                >
                  Reserve <ChevronRight className="ml-1 size-4" />
                </Button>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function PriceRange({
  min,
  max,
  suffix,
}: {
  min: number | null;
  max: number | null;
  suffix: string;
}) {
  if (min === null) return null;
  if (max === null || min === max) {
    return (
      <span>
        {min.toFixed(2)} {suffix}
      </span>
    );
  }
  return (
    <span>
      {min.toFixed(2)} – {max.toFixed(2)} {suffix}
    </span>
  );
}
