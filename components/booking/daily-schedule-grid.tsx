'use client';

import { useState, useEffect, useTransition, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { format, addDays, subDays } from 'date-fns';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ChevronLeft, ChevronRight, CalendarIcon, Loader2, AlertTriangle } from 'lucide-react';
import SlotCell from './slot-cell';
import BookingModal from './booking-modal';
import { getScheduleForDate, findNextAvailableDate, type FieldSchedule } from '@/lib/actions/schedule-actions';
import { type TimeSlot } from '@/lib/booking/slot-generator';
import { createClient } from '@/lib/supabase/client';

// ─── Types ──────────────────────────────────────────

interface Props {
  locationId: string;
  locationName: string;
  locationAddress?: string;
  initialDate?: string;
  initialSchedule?: FieldSchedule[];
}

interface ModalState {
  fieldId: string;
  fieldName: string;
  slot: TimeSlot;
  durationMinutes: number;
}

const SURFACE_OPTIONS = [
  { value: 'all', label: 'All surfaces' },
  { value: 'artificial_turf', label: 'Artificial turf' },
  { value: 'grass', label: 'Grass' },
  { value: 'clay', label: 'Clay' },
  { value: 'hard_court', label: 'Hard court' },
  { value: 'wood', label: 'Wood' },
  { value: 'rubber', label: 'Rubber' },
  { value: 'sand', label: 'Sand' },
];

const ENV_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'indoor', label: 'Indoor' },
  { value: 'outdoor', label: 'Outdoor' },
  { value: 'covered', label: 'Covered' },
];

const LIGHTING_OPTIONS = [
  { value: 'all', label: 'Lighting: All' },
  { value: 'yes', label: 'Has lighting' },
  { value: 'no', label: 'No lighting' },
];

// ─── Component ──────────────────────────────────────

export default function DailyScheduleGrid({
  locationId,
  locationName,
  locationAddress,
  initialDate,
  initialSchedule,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const today = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const [selectedDate, setSelectedDate] = useState(initialDate ?? today);
  const [schedule, setSchedule] = useState<FieldSchedule[]>(initialSchedule ?? []);
  const [loading, setLoading] = useState(!initialSchedule);

  // Filters
  const [surfaceFilter, setSurfaceFilter] = useState('all');
  const [envFilter, setEnvFilter] = useState('all');
  const [lightFilter, setLightFilter] = useState('all');

  // Mobile: single field selector
  const [mobileFieldIdx, setMobileFieldIdx] = useState(0);

  // Booking modal
  const [modalState, setModalState] = useState<ModalState | null>(null);

  // Availability banner
  const [banner, setBanner] = useState<{
    message: string;
    type: 'searching' | 'noAvailability';
  } | null>(null);
  const autoSearchDateRef = useRef<string | null>(null);

  // Fetch schedule for a given date
  const fetchSchedule = useCallback(
    async (date: string) => {
      setLoading(true);
      try {
        const data = await getScheduleForDate(locationId, date);
        setSchedule(data);
      } finally {
        setLoading(false);
      }
    },
    [locationId]
  );

  useEffect(() => {
    if (!initialSchedule) fetchSchedule(selectedDate);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Supabase Realtime: auto-refresh on bookings / group_sessions changes ──
  const fieldIds = useMemo(
    () => schedule.map((fs) => fs.field.id),
    [schedule]
  );

  const refreshRef = useRef(fetchSchedule);
  refreshRef.current = fetchSchedule;
  const dateRef = useRef(selectedDate);
  dateRef.current = selectedDate;

  useEffect(() => {
    if (fieldIds.length === 0) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`schedule-${locationId}-${fieldIds.join(',')}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings',
          filter: `field_id=in.(${fieldIds.join(',')})`,
        },
        () => refreshRef.current(dateRef.current)
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'group_sessions',
          filter: `field_id=in.(${fieldIds.join(',')})`,
        },
        () => refreshRef.current(dateRef.current)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fieldIds.join(','), locationId]); // eslint-disable-line react-hooks/exhaustive-deps

  function changeDate(date: string) {
    if (date < today) return;
    setSelectedDate(date);
    setMobileFieldIdx(0);
    setBanner(null);
    autoSearchDateRef.current = null;
    startTransition(() => fetchSchedule(date));
  }

  function goPrev() {
    const prev = format(subDays(new Date(selectedDate + 'T12:00:00'), 1), 'yyyy-MM-dd');
    changeDate(prev);
  }

  function goNext() {
    const next = format(addDays(new Date(selectedDate + 'T12:00:00'), 1), 'yyyy-MM-dd');
    changeDate(next);
  }

  // ── Auto-redirect when no slots are available ──
  useEffect(() => {
    if (loading) return;
    if (schedule.length === 0) {
      setBanner(null);
      return;
    }

    const allSlots = schedule.flatMap((fs) => fs.slots);
    const hasAvailable = allSlots.some((s) => s.status === 'available');

    if (hasAvailable) {
      setBanner(null);
      autoSearchDateRef.current = null;
      return;
    }

    // Already searching from this date
    if (autoSearchDateRef.current === selectedDate) return;
    autoSearchDateRef.current = selectedDate;

    const allClosed = allSlots.length > 0 && allSlots.every((s) => s.status === 'closed');
    const dayName = format(new Date(selectedDate + 'T12:00:00'), 'EEEE');
    const dateLabel = format(new Date(selectedDate + 'T12:00:00'), 'EEE, dd MMM');

    setBanner({
      type: 'searching',
      message: allClosed
        ? `Closed on ${dayName}. Finding next open day…`
        : `No available slots for ${dateLabel}. Finding next available date…`,
    });

    const searchDate = selectedDate;
    findNextAvailableDate(locationId, searchDate).then((result) => {
      if (autoSearchDateRef.current !== searchDate) return;

      if (result) {
        autoSearchDateRef.current = null;
        setSelectedDate(result.date);
        setSchedule(result.schedule);
        setBanner(null);
      } else {
        setBanner({
          type: 'noAvailability',
          message: 'No availability in the next 30 days. Contact the club directly.',
        });
      }
    });
  }, [loading, selectedDate, schedule, locationId]);

  // Filter fields client-side
  const filteredFields = useMemo(() => {
    return schedule.filter((fs) => {
      const attrs = fs.field.attributes;
      if (surfaceFilter !== 'all' && attrs.surface_type !== surfaceFilter) return false;
      if (envFilter !== 'all' && attrs.environment !== envFilter) return false;
      if (lightFilter === 'yes' && attrs.has_lighting !== 'true') return false;
      if (lightFilter === 'no' && attrs.has_lighting === 'true') return false;
      return true;
    });
  }, [schedule, surfaceFilter, envFilter, lightFilter]);

  // Collect all unique time labels across all fields
  const timeLabels = useMemo(() => {
    const set = new Set<string>();
    filteredFields.forEach((fs) => fs.slots.forEach((s) => set.add(s.startTime)));
    return Array.from(set).sort();
  }, [filteredFields]);

  // Quick lookup: field slots by startTime
  function getSlot(fieldSchedule: FieldSchedule, time: string): TimeSlot | undefined {
    return fieldSchedule.slots.find((s) => s.startTime === time);
  }

  function handleSlotClick(fs: FieldSchedule, slot: TimeSlot) {
    const canBook = slot.status === 'available';
    const hasSessions = slot.sessions.length > 0;
    if (!canBook && !hasSessions) return;
    setModalState({
      fieldId: fs.field.id,
      fieldName: fs.field.name,
      slot,
      durationMinutes: fs.bookingSettings?.slotDurationMinutes ?? 60,
    });
  }

  function handleBookingSuccess() {
    fetchSchedule(selectedDate);
  }

  const displayDate = new Date(selectedDate + 'T12:00:00');
  const isPrevDisabled = selectedDate <= today;
  const isLoading = loading || isPending;

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* ── Filter Row ── */}
        <div className="space-y-2">
          {/* Date navigation — always visible */}
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={goPrev}
              disabled={isPrevDisabled || isLoading}
            >
              <ChevronLeft className="size-4" />
            </Button>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="h-8 min-w-[160px] flex-1 font-medium sm:flex-none">
                  <CalendarIcon className="mr-2 size-4" />
                  {format(displayDate, 'EEE, dd.MM.yyyy')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={displayDate}
                  onSelect={(d) => d && changeDate(format(d, 'yyyy-MM-dd'))}
                  disabled={(d) => d < new Date(today + 'T00:00:00')}
                />
              </PopoverContent>
            </Popover>

            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={goNext}
              disabled={isLoading}
            >
              <ChevronRight className="size-4" />
            </Button>

            {isLoading && <Loader2 className="text-muted-foreground ml-1 size-4 animate-spin" />}
          </div>

          {/* Attribute filters — scroll on mobile, inline on desktop */}
          <div className="flex gap-2 overflow-x-auto pb-1 sm:overflow-visible sm:pb-0">
            <Select value={surfaceFilter} onValueChange={setSurfaceFilter}>
              <SelectTrigger className="h-8 w-[140px] shrink-0 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SURFACE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={envFilter} onValueChange={setEnvFilter}>
              <SelectTrigger className="h-8 w-[120px] shrink-0 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ENV_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={lightFilter} onValueChange={setLightFilter}>
              <SelectTrigger className="h-8 w-[140px] shrink-0 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LIGHTING_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* ── Availability Banner ── */}
        {banner && (
          <div
            className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-sm ${
              banner.type === 'noAvailability'
                ? 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200'
                : 'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-200'
            }`}
          >
            {banner.type === 'searching' ? (
              <Loader2 className="size-4 shrink-0 animate-spin" />
            ) : (
              <AlertTriangle className="size-4 shrink-0" />
            )}
            <span>{banner.message}</span>
          </div>
        )}

        {/* ── Mobile: field selector ── */}
        {filteredFields.length > 1 && (
          <div className="lg:hidden">
            <Select
              value={String(mobileFieldIdx)}
              onValueChange={(v) => setMobileFieldIdx(Number(v))}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {filteredFields.map((fs, i) => (
                  <SelectItem key={fs.field.id} value={String(i)}>
                    {fs.field.sportCategory?.icon ?? '🏅'} {fs.field.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* ── Grid ── */}
        {filteredFields.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-md border border-dashed py-16">
            <p className="text-muted-foreground text-sm">
              {schedule.length === 0
                ? 'No fields available at this location.'
                : 'No fields match the selected filters.'}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop grid (hidden on mobile) */}
            <div className="hidden lg:block">
              <DesktopGrid
                fields={filteredFields}
                timeLabels={timeLabels}
                getSlot={getSlot}
                onSlotClick={handleSlotClick}
              />
            </div>

            {/* Mobile single-field list (hidden on desktop) */}
            <div className="lg:hidden">
              <MobileFieldSlots
                fieldSchedule={filteredFields[mobileFieldIdx] ?? filteredFields[0]}
                timeLabels={timeLabels}
                getSlot={getSlot}
                onSlotClick={handleSlotClick}
              />
            </div>
          </>
        )}

        {/* ── Booking Modal ── */}
        {modalState && (
          <BookingModal
            open={!!modalState}
            onOpenChange={(open) => !open && setModalState(null)}
            fieldId={modalState.fieldId}
            fieldName={modalState.fieldName}
            locationName={locationName}
            locationAddress={locationAddress}
            date={selectedDate}
            startTime={modalState.slot.startTime}
            endTime={modalState.slot.endTime}
            durationMinutes={modalState.durationMinutes}
            priceEur={modalState.slot.priceEur}
            priceLocal={modalState.slot.priceLocal}
            sessions={modalState.slot.sessions}
            onSuccess={handleBookingSuccess}
          />
        )}
      </div>
    </TooltipProvider>
  );
}

// ─── Desktop Grid ───────────────────────────────────

function DesktopGrid({
  fields,
  timeLabels,
  getSlot,
  onSlotClick,
}: {
  fields: FieldSchedule[];
  timeLabels: string[];
  getSlot: (fs: FieldSchedule, time: string) => TimeSlot | undefined;
  onSlotClick: (fs: FieldSchedule, slot: TimeSlot) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <div
        className="grid min-w-fit"
        style={{
          gridTemplateColumns: `64px repeat(${fields.length}, minmax(140px, 1fr))`,
        }}
      >
        {/* Header row: empty corner + field headers */}
        <div className="bg-muted/50 border-b p-2" />
        {fields.map((fs, i) => (
          <FieldHeader key={fs.field.id} fieldSchedule={fs} index={i + 1} />
        ))}

        {/* Time rows */}
        {timeLabels.map((time) => (
          <TimeRow
            key={time}
            time={time}
            fields={fields}
            getSlot={getSlot}
            onSlotClick={onSlotClick}
          />
        ))}
      </div>
    </div>
  );
}

function FieldHeader({
  fieldSchedule: fs,
  index,
}: {
  fieldSchedule: FieldSchedule;
  index: number;
}) {
  const attrs = fs.field.attributes;
  const surface = attrs.surface_type?.replace(/_/g, ' ') ?? '';
  const env = attrs.environment ?? '';
  const hasLight = attrs.has_lighting === 'true';

  return (
    <div className="bg-muted/50 border-b border-l p-2 text-center">
      <div className="text-sm font-semibold">
        {fs.field.sportCategory?.icon ?? '🏅'} {fs.field.name}
      </div>
      {surface && (
        <div className="text-muted-foreground text-[10px] capitalize italic">
          {surface}
        </div>
      )}
      <div className="text-muted-foreground flex items-center justify-center gap-1.5 text-[10px]">
        {hasLight && <span>💡 Lit</span>}
        {env && <span className="capitalize">{env}</span>}
      </div>
    </div>
  );
}

function TimeRow({
  time,
  fields,
  getSlot,
  onSlotClick,
}: {
  time: string;
  fields: FieldSchedule[];
  getSlot: (fs: FieldSchedule, time: string) => TimeSlot | undefined;
  onSlotClick: (fs: FieldSchedule, slot: TimeSlot) => void;
}) {
  return (
    <>
      <div className="text-muted-foreground flex items-center justify-center border-b px-2 text-xs font-medium">
        {time}
      </div>
      {fields.map((fs) => {
        const slot = getSlot(fs, time);
        if (!slot) {
          return (
            <div key={fs.field.id} className="border-b border-l p-1">
              <div className="bg-zinc-50 dark:bg-zinc-900/40 flex h-full items-center justify-center rounded-md" />
            </div>
          );
        }
        const clickable = slot.status === 'available' || slot.sessions.length > 0;
        return (
          <div key={fs.field.id} className="border-b border-l p-1">
            <SlotCell
              slot={slot}
              durationMinutes={fs.bookingSettings?.slotDurationMinutes ?? 60}
              onClick={clickable ? () => onSlotClick(fs, slot) : undefined}
            />
          </div>
        );
      })}
    </>
  );
}

// ─── Mobile Single-Field List ───────────────────────

function MobileFieldSlots({
  fieldSchedule: fs,
  timeLabels,
  getSlot,
  onSlotClick,
}: {
  fieldSchedule: FieldSchedule;
  timeLabels: string[];
  getSlot: (fs: FieldSchedule, time: string) => TimeSlot | undefined;
  onSlotClick: (fs: FieldSchedule, slot: TimeSlot) => void;
}) {
  if (!fs) return null;

  const attrs = fs.field.attributes;
  const surface = attrs.surface_type?.replace(/_/g, ' ') ?? '';
  const env = attrs.environment ?? '';
  const hasLight = attrs.has_lighting === 'true';

  return (
    <div className="space-y-2">
      {/* Field info header */}
      <div className="rounded-md border p-3">
        <div className="text-sm font-semibold">
          {fs.field.sportCategory?.icon ?? '🏅'} {fs.field.name}
        </div>
        <div className="text-muted-foreground flex gap-2 text-xs">
          {surface && <span className="capitalize italic">{surface}</span>}
          {hasLight && <span>💡 Lit</span>}
          {env && <span className="capitalize">{env}</span>}
        </div>
      </div>

      {/* Slot list */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {timeLabels.map((time) => {
          const slot = getSlot(fs, time);
          if (!slot) return null;
          const clickable = slot.status === 'available' || slot.sessions.length > 0;
          return (
            <div key={time} className="flex gap-2">
              <span className="text-muted-foreground flex w-12 shrink-0 items-center text-xs font-medium">
                {time}
              </span>
              <div className="flex-1">
                <SlotCell
                  slot={slot}
                  durationMinutes={fs.bookingSettings?.slotDurationMinutes ?? 60}
                  onClick={clickable ? () => onSlotClick(fs, slot) : undefined}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
