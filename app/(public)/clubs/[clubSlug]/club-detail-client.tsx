'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import DailyScheduleGrid from '@/components/booking/daily-schedule-grid';
import { formatPrice } from '@/lib/utils/price';
import {
  MapPin,
  Phone,
  Mail,
  Sun,
  Lamp,
  Car,
  Coffee,
  Shirt,
  Dumbbell,
  Wrench,
  ChevronRight,
  Calendar,
  Users,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────

interface Club {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  description: string | null;
  logo_url: string | null;
  email: string | null;
  phone: string | null;
}

interface Location {
  id: string;
  name: string;
  slug: string;
  address: string;
  city: string;
  country: string | null;
  phone: string | null;
  email: string | null;
  description: string | null;
  cover_image_url: string | null;
}

interface Schedule {
  day_of_week: string;
  open_time: string;
  close_time: string;
  is_closed: boolean | null;
}

interface Field {
  id: string;
  name: string;
  location_id: string;
  sport_categories: { id: string; name: string; icon: string | null; color_primary: string | null } | null;
  field_attributes: { attribute_key: string; attribute_value: string }[];
  field_booking_settings:
    | { slot_duration_minutes: number; price_per_slot_eur: number; price_per_slot_local: number | null; currency_local: string | null }
    | { slot_duration_minutes: number; price_per_slot_eur: number; price_per_slot_local: number | null; currency_local: string | null }[]
    | null;
}

interface Trainer {
  id: string;
  user_id: string;
  profiles: { id: string; full_name: string | null; avatar_url: string | null; phone: string | null; city: string | null } | null;
}

interface Props {
  club: Club;
  locations: Location[];
  schedules: Record<string, Schedule[]>;
  fields: Field[];
  images: Record<string, { url: string; caption: string | null }[]>;
  trainers: Trainer[];
}

// ─── Amenity config ─────────────────────────────────

const AMENITY_MAP: Record<string, { label: string; icon: React.ReactNode }> = {
  has_lighting: { label: 'Lighting', icon: <Lamp className="size-4" /> },
  has_changing_rooms: { label: 'Changing Rooms', icon: <Shirt className="size-4" /> },
  has_parking: { label: 'Parking', icon: <Car className="size-4" /> },
  has_cafe_bar: { label: 'Café / Bar', icon: <Coffee className="size-4" /> },
  has_fitness_area: { label: 'Fitness Area', icon: <Dumbbell className="size-4" /> },
  has_equipment_rental: { label: 'Equipment Rental', icon: <Wrench className="size-4" /> },
};

const DAYS_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_SHORT: Record<string, string> = {
  monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu',
  friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
};

// ─── Component ──────────────────────────────────────

export default function ClubDetailClient({
  club,
  locations,
  schedules,
  fields,
  images,
  trainers,
}: Props) {
  const [activeLocationId, setActiveLocationId] = useState(locations[0]?.id ?? '');
  const [activeTab, setActiveTab] = useState('schedule');

  const loc = locations.find((l) => l.id === activeLocationId) ?? locations[0];
  const locFields = useMemo(
    () => fields.filter((f) => f.location_id === activeLocationId),
    [fields, activeLocationId]
  );
  const locSchedule = schedules[activeLocationId] ?? [];
  const locImages = images[activeLocationId] ?? [];

  // Aggregate amenities across all fields at this location
  const amenities = useMemo(() => {
    const set = new Set<string>();
    locFields.forEach((f) => {
      (f.field_attributes ?? []).forEach((a) => {
        if (a.attribute_value === 'true' && AMENITY_MAP[a.attribute_key]) {
          set.add(a.attribute_key);
        }
      });
    });
    return Array.from(set);
  }, [locFields]);

  // Aggregate field summary: surfaces, environments, counts
  const fieldSummary = useMemo(() => {
    let indoor = 0;
    let outdoor = 0;
    let lit = 0;
    const surfaces: Record<string, number> = {};
    locFields.forEach((f) => {
      const attrs = Object.fromEntries(
        (f.field_attributes ?? []).map((a) => [a.attribute_key, a.attribute_value])
      );
      if (attrs.environment === 'indoor') indoor++;
      else outdoor++;
      if (attrs.has_lighting === 'true') lit++;
      const s = attrs.surface_type;
      if (s) surfaces[s] = (surfaces[s] || 0) + 1;
    });
    return { indoor, outdoor, lit, surfaces };
  }, [locFields]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      {/* Breadcrumb */}
      <nav className="text-muted-foreground mb-4 flex items-center gap-1 text-sm">
        <Link href="/" className="hover:underline">Home</Link>
        <ChevronRight className="size-3" />
        <Link href="/sports/football/clubs" className="hover:underline">Clubs</Link>
        <ChevronRight className="size-3" />
        <span className="text-foreground font-medium">{club.name}</span>
      </nav>

      {/* Header */}
      <div className="mb-6 flex items-start gap-4">
        {club.logo_url ? (
          <img src={club.logo_url} alt={club.name} className="size-16 rounded-xl object-cover" />
        ) : (
          <div className="bg-muted flex size-16 items-center justify-center rounded-xl text-2xl font-bold">
            {club.name.charAt(0)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold">{club.name}</h1>
          {loc && (
            <p className="text-muted-foreground flex items-center gap-1 text-sm">
              <MapPin className="size-3" /> {loc.city}, {loc.address}
            </p>
          )}
        </div>
      </div>

      {/* Location picker */}
      {locations.length > 1 && (
        <div className="mb-4">
          <Select value={activeLocationId} onValueChange={setActiveLocationId}>
            <SelectTrigger className="w-full sm:w-[320px]">
              <SelectValue placeholder="Select location" />
            </SelectTrigger>
            <SelectContent>
              {locations.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  <div className="flex items-center gap-2">
                    <MapPin className="size-3" />
                    <span>{l.name}</span>
                    <span className="text-muted-foreground text-xs">— {l.city}, {l.address}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full justify-start">
          <TabsTrigger value="about">About</TabsTrigger>
          <TabsTrigger value="schedule">Daily Schedule</TabsTrigger>
          <TabsTrigger value="weekly">Weekly</TabsTrigger>
          <TabsTrigger value="trainers">
            Trainers{trainers.length > 0 ? ` (${trainers.length})` : ''}
          </TabsTrigger>
        </TabsList>

        {/* ── Tab: About ── */}
        <TabsContent value="about" className="pt-6">
          {loc && (
            <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
              {/* Left column */}
              <div className="space-y-4">
                {loc.cover_image_url && (
                  <img
                    src={loc.cover_image_url}
                    alt={loc.name}
                    className="h-52 w-full rounded-xl object-cover"
                  />
                )}
                <div className="space-y-2">
                  <div className="text-muted-foreground flex items-center gap-2 text-sm">
                    <MapPin className="size-4" /> {loc.city}, {loc.address}
                  </div>
                  {(loc.phone || club.phone) && (
                    <div className="text-muted-foreground flex items-center gap-2 text-sm">
                      <Phone className="size-4" /> {loc.phone ?? club.phone}
                    </div>
                  )}
                  {(loc.email || club.email) && (
                    <div className="text-muted-foreground flex items-center gap-2 text-sm">
                      <Mail className="size-4" /> {loc.email ?? club.email}
                    </div>
                  )}
                </div>

                {/* Opening hours */}
                {locSchedule.length > 0 && (
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold">Opening Hours</h3>
                    {DAYS_ORDER.map((day) => {
                      const s = locSchedule.find((sc) => sc.day_of_week === day);
                      return (
                        <div key={day} className="flex justify-between text-sm">
                          <span className="text-muted-foreground w-12">{DAY_SHORT[day]}</span>
                          {s?.is_closed ? (
                            <span className="text-muted-foreground">Closed</span>
                          ) : s ? (
                            <span>{s.open_time?.slice(0, 5)} – {s.close_time?.slice(0, 5)}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Right column */}
              <div className="space-y-6">
                {/* Field summary */}
                <div className="flex flex-wrap gap-3">
                  {fieldSummary.indoor > 0 && (
                    <Badge variant="secondary">
                      {fieldSummary.indoor} Indoor
                    </Badge>
                  )}
                  {fieldSummary.outdoor > 0 && (
                    <Badge variant="secondary">
                      <Sun className="mr-1 size-3" /> {fieldSummary.outdoor} Outdoor
                    </Badge>
                  )}
                  {fieldSummary.lit > 0 && (
                    <Badge variant="secondary">
                      <Lamp className="mr-1 size-3" /> {fieldSummary.lit} Lit
                    </Badge>
                  )}
                  {Object.entries(fieldSummary.surfaces).map(([surface, count]) => (
                    <Badge key={surface} variant="outline" className="capitalize">
                      {surface.replace(/_/g, ' ')} ({count})
                    </Badge>
                  ))}
                </div>

                {/* Gallery */}
                {locImages.length > 0 && (
                  <div>
                    <h3 className="mb-2 text-sm font-semibold">Photos</h3>
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {locImages.map((img, i) => (
                        <img
                          key={i}
                          src={img.url}
                          alt={img.caption ?? `Photo ${i + 1}`}
                          className="h-32 w-48 shrink-0 rounded-lg object-cover"
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Amenities */}
                {amenities.length > 0 && (
                  <div>
                    <h3 className="mb-2 text-sm font-semibold">Amenities</h3>
                    <div className="flex flex-wrap gap-2">
                      {amenities.map((key) => {
                        const am = AMENITY_MAP[key];
                        if (!am) return null;
                        return (
                          <div
                            key={key}
                            className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm"
                          >
                            {am.icon}
                            {am.label}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Description */}
                {(loc.description || club.description) && (
                  <div>
                    <h3 className="mb-2 text-sm font-semibold">About</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {loc.description ?? club.description}
                    </p>
                  </div>
                )}

                {/* Fields overview */}
                {locFields.length > 0 && (
                  <div>
                    <h3 className="mb-2 text-sm font-semibold">
                      Fields ({locFields.length})
                    </h3>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {locFields.map((f) => {
                        const bs = Array.isArray(f.field_booking_settings)
                          ? f.field_booking_settings[0]
                          : f.field_booking_settings;
                        return (
                          <div
                            key={f.id}
                            className="flex items-center gap-2 rounded-lg border p-3"
                          >
                            <span className="text-lg">{f.sport_categories?.icon ?? '🏅'}</span>
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-medium">{f.name}</div>
                              <div className="text-muted-foreground text-xs">
                                {f.sport_categories?.name}
                              </div>
                            </div>
                            {bs && (
                              <div className="text-right text-xs font-medium">
                                {formatPrice(
                                  Number(bs.price_per_slot_eur),
                                  bs.price_per_slot_local != null ? Number(bs.price_per_slot_local) : null
                                )}
                                <div className="text-muted-foreground text-[10px]">
                                  / {bs.slot_duration_minutes} min
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <Button onClick={() => setActiveTab('schedule')}>
                  <Calendar className="mr-2 size-4" /> Reserve a Pitch
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ── Tab: Daily Schedule ── */}
        <TabsContent value="schedule" className="pt-6">
          {loc ? (
            <div>
              <p className="text-muted-foreground mb-4 text-sm">
                Reserve a pitch at <strong>{club.name}</strong> — {loc.name}
              </p>
              <DailyScheduleGrid
                locationId={loc.id}
                locationName={loc.name}
                locationAddress={`${loc.city}, ${loc.address}`}
              />
            </div>
          ) : (
            <p className="text-muted-foreground py-12 text-center">
              No locations available.
            </p>
          )}
        </TabsContent>

        {/* ── Tab: Weekly Schedule ── */}
        <TabsContent value="weekly" className="pt-6">
          <WeeklyOverview
            schedule={locSchedule}
            fields={locFields}
            onDayClick={(day) => {
              setActiveTab('schedule');
            }}
          />
        </TabsContent>

        {/* ── Tab: Trainers ── */}
        <TabsContent value="trainers" className="pt-6">
          {trainers.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-md border border-dashed py-16">
              <Users className="text-muted-foreground mb-4 size-10" />
              <p className="text-muted-foreground text-sm">No trainers listed yet.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {trainers.map((t) => {
                const p = t.profiles;
                return (
                  <div key={t.id} className="flex gap-4 rounded-xl border p-4">
                    <Avatar className="size-14">
                      <AvatarImage src={p?.avatar_url ?? undefined} />
                      <AvatarFallback>
                        {p?.full_name
                          ? p.full_name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
                          : '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-semibold">{p?.full_name ?? 'Trainer'}</h3>
                      {p?.city && (
                        <p className="text-muted-foreground flex items-center gap-1 text-xs">
                          <MapPin className="size-3" /> {p.city}
                        </p>
                      )}
                      {p?.phone && (
                        <p className="text-muted-foreground flex items-center gap-1 text-xs">
                          <Phone className="size-3" /> {p.phone}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Weekly Overview ────────────────────────────────

function WeeklyOverview({
  schedule,
  fields,
  onDayClick,
}: {
  schedule: Schedule[];
  fields: Field[];
  onDayClick: (day: string) => void;
}) {
  const hours = Array.from({ length: 16 }, (_, i) => i + 7); // 07:00 – 22:00

  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[640px]" style={{ gridTemplateColumns: '60px repeat(7, 1fr)' }}>
        {/* Header */}
        <div className="bg-muted/50 border-b p-2" />
        {DAYS_ORDER.map((day) => {
          const s = schedule.find((sc) => sc.day_of_week === day);
          return (
            <button
              key={day}
              className="bg-muted/50 border-b border-l p-2 text-center text-xs font-semibold transition-colors hover:bg-accent"
              onClick={() => onDayClick(day)}
            >
              <div>{DAY_SHORT[day]}</div>
              {s?.is_closed ? (
                <div className="text-muted-foreground text-[10px]">Closed</div>
              ) : s ? (
                <div className="text-muted-foreground text-[10px]">
                  {s.open_time?.slice(0, 5)}–{s.close_time?.slice(0, 5)}
                </div>
              ) : null}
            </button>
          );
        })}

        {/* Time rows */}
        {hours.map((h) => {
          const time = `${String(h).padStart(2, '0')}:00`;
          return (
            <WeeklyRow
              key={h}
              hour={h}
              time={time}
              schedule={schedule}
              fieldCount={fields.length}
              onDayClick={onDayClick}
            />
          );
        })}
      </div>
      <p className="text-muted-foreground mt-3 text-xs">
        Click a day to view the daily schedule and book.
      </p>
    </div>
  );
}

function WeeklyRow({
  hour,
  time,
  schedule,
  fieldCount,
  onDayClick,
}: {
  hour: number;
  time: string;
  schedule: Schedule[];
  fieldCount: number;
  onDayClick: (day: string) => void;
}) {
  return (
    <>
      <div className="text-muted-foreground flex items-center justify-center border-b px-1 text-xs">
        {time}
      </div>
      {DAYS_ORDER.map((day) => {
        const s = schedule.find((sc) => sc.day_of_week === day);
        let cellClass = 'border-b border-l p-1 transition-colors cursor-pointer hover:bg-accent/50 ';
        let content = '';

        if (s?.is_closed) {
          cellClass += 'bg-zinc-100 dark:bg-zinc-900/40';
        } else if (s) {
          const openH = parseInt(s.open_time);
          const closeH = parseInt(s.close_time);
          if (hour < openH || hour >= closeH) {
            cellClass += 'bg-zinc-100 dark:bg-zinc-900/40';
          } else {
            cellClass += 'bg-emerald-50 dark:bg-emerald-950/20';
            content = `${fieldCount}`;
          }
        } else {
          cellClass += 'bg-zinc-50 dark:bg-zinc-900/30';
        }

        return (
          <button
            key={day}
            className={cellClass}
            onClick={() => onDayClick(day)}
            title={`${DAY_SHORT[day]} ${time}`}
          >
            {content && (
              <div className="text-muted-foreground text-center text-[10px]">
                {content} fields
              </div>
            )}
          </button>
        );
      })}
    </>
  );
}
