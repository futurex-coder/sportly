'use client';

import { useState, useTransition, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  createBooking,
  updateBookingStatus,
  getAvailableSlots,
} from '@/lib/actions/booking-actions';
import {
  Plus,
  Loader2,
  CalendarIcon,
  Search,
  X,
  Check,
  Ban,
  CheckCircle2,
} from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { toast } from 'sonner';

// ─── Types ──────────────────────────────────────────

interface Booking {
  id: string;
  field_id: string;
  user_id: string;
  date: string;
  start_time: string;
  end_time: string;
  status: string;
  total_price_eur: number | null;
  total_price_local: number | null;
  notes: string | null;
  profiles: { full_name: string | null; email: string } | null;
}

interface FieldInfo {
  name: string;
  locationName: string;
  locationId: string;
}

interface Location {
  id: string;
  name: string;
}

interface Field {
  id: string;
  name: string;
  location_id: string;
  locations: { name: string } | null;
}

interface Member {
  id: string;
  full_name: string | null;
  email: string;
}

interface Props {
  bookings: Booking[];
  fieldMap: Record<string, FieldInfo>;
  locations: Location[];
  fields: Field[];
  members: Member[];
  activeLocationId: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  confirmed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  confirmed: <Check className="mr-1 size-3" />,
  completed: <CheckCircle2 className="mr-1 size-3" />,
  cancelled: <Ban className="mr-1 size-3" />,
};

// ─── Component ──────────────────────────────────────

export default function BookingsClient({
  bookings,
  fieldMap,
  locations,
  fields,
  members,
  activeLocationId,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);

  // Manual booking modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalStep, setModalStep] = useState(0); // 0=location, 1=field, 2=date, 3=slot, 4=client
  const [selLocationId, setSelLocationId] = useState(activeLocationId ?? '');
  const [selFieldId, setSelFieldId] = useState('');
  const [selDate, setSelDate] = useState<Date | undefined>(undefined);
  const [selSlot, setSelSlot] = useState<{ startTime: string; endTime: string } | null>(null);
  const [selMemberId, setSelMemberId] = useState('');
  const [selNotes, setSelNotes] = useState('');
  const [availSlots, setAvailSlots] = useState<{ startTime: string; endTime: string }[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Filtered bookings
  const filtered = useMemo(() => {
    return bookings.filter((b) => {
      if (statusFilter !== 'all' && b.status !== statusFilter) return false;
      if (dateFrom && b.date < format(dateFrom, 'yyyy-MM-dd')) return false;
      if (dateTo && b.date > format(dateTo, 'yyyy-MM-dd')) return false;
      if (search) {
        const q = search.toLowerCase();
        const clientName = b.profiles?.full_name?.toLowerCase() ?? '';
        const clientEmail = b.profiles?.email.toLowerCase() ?? '';
        const fieldName = fieldMap[b.field_id]?.name.toLowerCase() ?? '';
        if (!clientName.includes(q) && !clientEmail.includes(q) && !fieldName.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [bookings, statusFilter, dateFrom, dateTo, search, fieldMap]);

  // Fields filtered by selected location (modal)
  const modalFields = useMemo(
    () => (selLocationId ? fields.filter((f) => f.location_id === selLocationId) : []),
    [fields, selLocationId]
  );

  function resetModal() {
    setModalStep(0);
    setSelLocationId(activeLocationId ?? '');
    setSelFieldId('');
    setSelDate(undefined);
    setSelSlot(null);
    setSelMemberId('');
    setSelNotes('');
    setAvailSlots([]);
    setModalError(null);
  }

  function openModal() {
    resetModal();
    if (activeLocationId) setModalStep(1);
    setModalOpen(true);
  }

  async function handleDateSelect(date: Date | undefined) {
    setSelDate(date);
    setSelSlot(null);
    if (!date || !selFieldId) return;
    setSlotsLoading(true);
    const { slots, error } = await getAvailableSlots(selFieldId, format(date, 'yyyy-MM-dd'));
    const available = slots
      .filter((s) => s.status === 'available')
      .map((s) => ({ startTime: s.startTime, endTime: s.endTime }));
    setAvailSlots(available);
    setSlotsLoading(false);
    if (error) setModalError(error);
  }

  async function handleCreateBooking() {
    if (!selFieldId || !selDate || !selSlot || !selMemberId) return;
    setModalError(null);
    startTransition(async () => {
      const result = await createBooking({
        fieldId: selFieldId,
        userId: selMemberId,
        date: format(selDate, 'yyyy-MM-dd'),
        startTime: selSlot.startTime,
        endTime: selSlot.endTime,
        notes: selNotes || undefined,
      });
      if (!result.success) {
        toast.error(result.error ?? 'Failed to create booking');
        setModalError(result.error ?? 'Failed to create booking');
      } else {
        toast.success('Booking created.');
        setModalOpen(false);
        router.refresh();
      }
    });
  }

  const handleStatusChange = useCallback(
    (bookingId: string, status: 'confirmed' | 'cancelled' | 'completed') => {
      startTransition(async () => {
        const result = await updateBookingStatus(bookingId, status);
        if (!result.success) {
          toast.error(result.error ?? 'Failed to update booking status');
        } else {
          toast.success(`Booking ${status}.`);
          router.refresh();
        }
      });
    },
    [router]
  );

  function clearFilters() {
    setSearch('');
    setStatusFilter('all');
    setDateFrom(undefined);
    setDateTo(undefined);
  }

  const hasFilters = search || statusFilter !== 'all' || dateFrom || dateTo;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Bookings</h1>
          <p className="text-muted-foreground text-sm">
            {filtered.length} booking{filtered.length !== 1 ? 's' : ''}
            {hasFilters ? ' (filtered)' : ''}
          </p>
        </div>
        <Button onClick={openModal}>
          <Plus className="mr-2 size-4" />
          Manual Booking
        </Button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
          <Input
            placeholder="Search client or field..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <DatePicker label="From" date={dateFrom} onSelect={setDateFrom} />
        <DatePicker label="To" date={dateTo} onSelect={setDateTo} />
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="mr-1 size-4" /> Clear
          </Button>
        )}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={CalendarIcon}
          title="No bookings found"
          description={hasFilters ? 'Try adjusting your filters.' : 'No bookings yet. Create one to get started.'}
        />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Field</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="w-[100px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((b) => {
                const fi = fieldMap[b.field_id];
                return (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium whitespace-nowrap">
                      {formatDate(b.date)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {b.start_time.slice(0, 5)} – {b.end_time.slice(0, 5)}
                    </TableCell>
                    <TableCell>{fi?.name ?? '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{fi?.locationName ?? '—'}</TableCell>
                    <TableCell>
                      <div className="text-sm">{b.profiles?.full_name ?? 'Unknown'}</div>
                      <div className="text-muted-foreground text-xs">{b.profiles?.email}</div>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[b.status] ?? ''}`}
                      >
                        {STATUS_ICONS[b.status]}
                        {b.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {b.total_price_eur != null ? `€${Number(b.total_price_eur).toFixed(2)}` : '—'}
                    </TableCell>
                    <TableCell>
                      <StatusActions
                        bookingId={b.id}
                        currentStatus={b.status}
                        onChange={handleStatusChange}
                        disabled={isPending}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* ── Manual Booking Modal ── */}
      <Dialog open={modalOpen} onOpenChange={(open) => { if (!open) setModalOpen(false); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Manual Booking</DialogTitle>
          </DialogHeader>

          {modalError && (
            <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
              {modalError}
            </div>
          )}

          {/* Step 0: Location */}
          {modalStep === 0 && (
            <div className="space-y-3">
              <Label>Select Location</Label>
              {locations.map((loc) => (
                <button
                  key={loc.id}
                  className="w-full rounded-md border p-3 text-left transition-colors hover:bg-accent"
                  onClick={() => { setSelLocationId(loc.id); setSelFieldId(''); setModalStep(1); }}
                >
                  {loc.name}
                </button>
              ))}
            </div>
          )}

          {/* Step 1: Field */}
          {modalStep === 1 && (
            <div className="space-y-3">
              <Label>Select Field</Label>
              {modalFields.length === 0 ? (
                <p className="text-muted-foreground text-sm">No active fields at this location.</p>
              ) : (
                modalFields.map((f) => (
                  <button
                    key={f.id}
                    className="w-full rounded-md border p-3 text-left transition-colors hover:bg-accent"
                    onClick={() => { setSelFieldId(f.id); setModalStep(2); }}
                  >
                    {f.name}
                  </button>
                ))
              )}
              <Button variant="ghost" size="sm" onClick={() => setModalStep(0)}>Back</Button>
            </div>
          )}

          {/* Step 2: Date */}
          {modalStep === 2 && (
            <div className="space-y-3">
              <Label>Select Date</Label>
              <Calendar
                mode="single"
                selected={selDate}
                onSelect={(d) => { handleDateSelect(d); if (d) setModalStep(3); }}
                disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                className="mx-auto"
              />
              <Button variant="ghost" size="sm" onClick={() => setModalStep(1)}>Back</Button>
            </div>
          )}

          {/* Step 3: Slot */}
          {modalStep === 3 && (
            <div className="space-y-3">
              <Label>
                Select Time Slot — {selDate ? format(selDate, 'MMM d, yyyy') : ''}
              </Label>
              {slotsLoading ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="text-muted-foreground size-6 animate-spin" />
                </div>
              ) : availSlots.length === 0 ? (
                <p className="text-muted-foreground py-4 text-center text-sm">
                  No available slots on this date.
                </p>
              ) : (
                <div className="grid max-h-56 grid-cols-3 gap-2 overflow-y-auto">
                  {availSlots.map((slot) => (
                    <button
                      key={slot.startTime}
                      className={`rounded-md border px-3 py-2 text-sm transition-colors hover:bg-accent ${
                        selSlot?.startTime === slot.startTime ? 'border-primary bg-primary/10 font-medium' : ''
                      }`}
                      onClick={() => setSelSlot(slot)}
                    >
                      {slot.startTime} – {slot.endTime}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => { setModalStep(2); setSelSlot(null); }}>
                  Back
                </Button>
                {selSlot && (
                  <Button size="sm" onClick={() => setModalStep(4)}>
                    Next
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Step 4: Client + Notes */}
          {modalStep === 4 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Client</Label>
                <Select value={selMemberId} onValueChange={setSelMemberId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a member..." />
                  </SelectTrigger>
                  <SelectContent>
                    {members.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.full_name ?? m.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Notes (optional)</Label>
                <Input value={selNotes} onChange={(e) => setSelNotes(e.target.value)} placeholder="Any notes..." />
              </div>
              <div className="bg-muted/50 rounded-md p-3 text-sm">
                <div><strong>Field:</strong> {fields.find((f) => f.id === selFieldId)?.name}</div>
                <div><strong>Date:</strong> {selDate ? format(selDate, 'MMM d, yyyy') : ''}</div>
                <div><strong>Time:</strong> {selSlot?.startTime} – {selSlot?.endTime}</div>
              </div>
              <DialogFooter className="gap-2">
                <Button variant="ghost" size="sm" onClick={() => setModalStep(3)}>
                  Back
                </Button>
                <Button
                  onClick={handleCreateBooking}
                  disabled={!selMemberId || isPending}
                  size="sm"
                >
                  {isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                  Confirm Booking
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────

function DatePicker({
  label,
  date,
  onSelect,
}: {
  label: string;
  date: Date | undefined;
  onSelect: (d: Date | undefined) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-[150px] justify-start font-normal">
          <CalendarIcon className="mr-2 size-4" />
          {date ? format(date, 'MMM d, yyyy') : label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={date} onSelect={onSelect} />
      </PopoverContent>
    </Popover>
  );
}

function StatusActions({
  bookingId,
  currentStatus,
  onChange,
  disabled,
}: {
  bookingId: string;
  currentStatus: string;
  onChange: (id: string, status: 'confirmed' | 'cancelled' | 'completed') => void;
  disabled: boolean;
}) {
  if (currentStatus === 'cancelled' || currentStatus === 'completed') return null;

  return (
    <div className="flex gap-1">
      {currentStatus === 'confirmed' && (
        <>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-green-600 hover:text-green-700"
            title="Complete"
            onClick={() => onChange(bookingId, 'completed')}
            disabled={disabled}
          >
            <CheckCircle2 className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive size-7"
            title="Cancel"
            onClick={() => onChange(bookingId, 'cancelled')}
            disabled={disabled}
          >
            <Ban className="size-4" />
          </Button>
        </>
      )}
    </div>
  );
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return format(d, 'EEE, MMM d');
}
