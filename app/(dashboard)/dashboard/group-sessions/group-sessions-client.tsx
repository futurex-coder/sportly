'use client';

import { useState, useTransition, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  cancelSession,
  confirmGroupSession,
} from '@/lib/actions/session-actions';
import {
  getSessionStatus,
  getSessionStatusDisplay,
  type SessionStatus,
} from '@/lib/db/queries';
import {
  Loader2,
  CalendarIcon,
  Search,
  X,
  ExternalLink,
  Ban,
  CheckCircle2,
  Users,
  Bell,
  Eye,
  Lock,
} from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { toast } from 'sonner';

// ─── Types ──────────────────────────────────────────

interface SessionRow {
  id: string;
  title: string;
  field_id: string;
  date: string;
  start_time: string;
  end_time: string;
  visibility: string;
  max_participants: number;
  current_participants: number;
  is_confirmed: boolean | null;
  is_cancelled: boolean | null;
  cancelled_reason: string | null;
  completed_at: string | null;
  organizer_id: string;
  profiles: { full_name: string | null; email: string; avatar_url: string | null } | null;
  sport_categories: { id: string; name: string; icon: string } | null;
}

interface FieldInfo {
  name: string;
  locationName: string;
  locationId: string;
  sportName: string;
  sportIcon: string;
}

interface Location {
  id: string;
  name: string;
}

interface SportCategory {
  id: string;
  name: string;
  icon: string;
}

interface Props {
  sessions: SessionRow[];
  fieldMap: Record<string, FieldInfo>;
  locations: Location[];
  sportCategories: SportCategory[];
  pendingCounts: Record<string, number>;
  activeLocationId: string | null;
}

const STATUS_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'expired', label: 'Expired' },
];

const VISIBILITY_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'All visibility' },
  { value: 'public', label: 'Public' },
  { value: 'private', label: 'Private' },
];

// ─── Component ──────────────────────────────────────

export default function GroupSessionsClient({
  sessions,
  fieldMap,
  locations,
  sportCategories,
  pendingCounts,
  activeLocationId,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [visibilityFilter, setVisibilityFilter] = useState('all');
  const [sportFilter, setSportFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState(activeLocationId ?? 'all');
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);

  const filtered = useMemo(() => {
    return sessions.filter((s) => {
      const status = getSessionStatus(s);
      if (statusFilter !== 'all' && status !== statusFilter) return false;
      if (visibilityFilter !== 'all' && s.visibility !== visibilityFilter) return false;

      const fi = fieldMap[s.field_id];
      if (locationFilter !== 'all' && fi?.locationId !== locationFilter) return false;

      if (sportFilter !== 'all') {
        const sportId = s.sport_categories?.id;
        if (sportId !== sportFilter) return false;
      }

      if (dateFrom && s.date < format(dateFrom, 'yyyy-MM-dd')) return false;
      if (dateTo && s.date > format(dateTo, 'yyyy-MM-dd')) return false;

      if (search) {
        const q = search.toLowerCase();
        const title = s.title.toLowerCase();
        const organizer = s.profiles?.full_name?.toLowerCase() ?? '';
        const email = s.profiles?.email.toLowerCase() ?? '';
        const fieldName = fi?.name.toLowerCase() ?? '';
        if (
          !title.includes(q) &&
          !organizer.includes(q) &&
          !email.includes(q) &&
          !fieldName.includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [sessions, statusFilter, visibilityFilter, sportFilter, locationFilter, dateFrom, dateTo, search, fieldMap]);

  const handleCancel = useCallback(
    (sessionId: string) => {
      startTransition(async () => {
        const result = await cancelSession(sessionId);
        if (!result.success) {
          toast.error(result.error ?? 'Failed to cancel session');
        } else {
          toast.success('Session cancelled.');
          router.refresh();
        }
      });
    },
    [router]
  );

  const handleConfirm = useCallback(
    (sessionId: string) => {
      startTransition(async () => {
        const result = await confirmGroupSession(sessionId);
        if (!result.success) {
          toast.error(result.error ?? 'Failed to confirm session');
        } else {
          toast.success('Session confirmed and slot reserved.');
          router.refresh();
        }
      });
    },
    [router]
  );

  function clearFilters() {
    setSearch('');
    setStatusFilter('all');
    setVisibilityFilter('all');
    setSportFilter('all');
    setLocationFilter(activeLocationId ?? 'all');
    setDateFrom(undefined);
    setDateTo(undefined);
  }

  const hasFilters =
    search ||
    statusFilter !== 'all' ||
    visibilityFilter !== 'all' ||
    sportFilter !== 'all' ||
    locationFilter !== (activeLocationId ?? 'all') ||
    dateFrom ||
    dateTo;

  const totalPending = Object.values(pendingCounts).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Group Sessions</h1>
          <p className="text-muted-foreground text-sm">
            {filtered.length} session{filtered.length !== 1 ? 's' : ''}
            {hasFilters ? ' (filtered)' : ''}
            {totalPending > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 text-yellow-600">
                <Bell className="size-3" /> {totalPending} pending request{totalPending !== 1 ? 's' : ''}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
          <Input
            placeholder="Search title, organizer, field..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {locations.length > 1 && (
          <Select value={locationFilter} onValueChange={setLocationFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All locations</SelectItem>
              {locations.map((loc) => (
                <SelectItem key={loc.id} value={loc.id}>
                  {loc.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {sportCategories.length > 1 && (
          <Select value={sportFilter} onValueChange={setSportFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sports</SelectItem>
              {sportCategories.map((sc) => (
                <SelectItem key={sc.id} value={sc.id}>
                  {sc.icon} {sc.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTER_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={visibilityFilter} onValueChange={setVisibilityFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {VISIBILITY_FILTER_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
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
          icon={Users}
          title="No group sessions found"
          description={
            hasFilters
              ? 'Try adjusting your filters.'
              : 'No group sessions yet for this club.'
          }
        />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Date / Time</TableHead>
                <TableHead>Field</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Organizer</TableHead>
                <TableHead>Participants</TableHead>
                <TableHead>Visibility</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Requests</TableHead>
                <TableHead className="w-[120px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((s) => {
                const fi = fieldMap[s.field_id];
                const status = getSessionStatus(s);
                const statusDisplay = getSessionStatusDisplay(status);
                const pending = pendingCounts[s.id] ?? 0;

                return (
                  <TableRow key={s.id}>
                    <TableCell className="max-w-[200px]">
                      <div className="flex items-center gap-2">
                        <span className="text-lg leading-none">
                          {s.sport_categories?.icon ?? fi?.sportIcon ?? '🏅'}
                        </span>
                        <span className="truncate font-medium">{s.title}</span>
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <div className="text-sm font-medium">{formatDate(s.date)}</div>
                      <div className="text-muted-foreground text-xs">
                        {s.start_time.slice(0, 5)} – {s.end_time.slice(0, 5)}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{fi?.name ?? '—'}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {fi?.locationName ?? '—'}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{s.profiles?.full_name ?? 'Unknown'}</div>
                      <div className="text-muted-foreground text-xs">{s.profiles?.email}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-sm">
                        <Users className="text-muted-foreground size-3.5" />
                        <span>
                          {s.current_participants}/{s.max_participants}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {s.visibility === 'public' ? (
                        <Badge variant="outline" className="gap-1 text-xs">
                          <Eye className="size-3" /> Public
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1 text-xs">
                          <Lock className="size-3" /> Private
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusDisplay.bgColor} ${statusDisplay.color}`}
                      >
                        {statusDisplay.label}
                      </span>
                    </TableCell>
                    <TableCell>
                      {pending > 0 ? (
                        <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200">
                          <Bell className="mr-1 size-3" />
                          {pending}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <SessionActions
                        sessionId={s.id}
                        status={status}
                        onCancel={handleCancel}
                        onConfirm={handleConfirm}
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

function SessionActions({
  sessionId,
  status,
  onCancel,
  onConfirm,
  disabled,
}: {
  sessionId: string;
  status: SessionStatus;
  onCancel: (id: string) => void;
  onConfirm: (id: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="icon" className="size-7" title="View Detail" asChild>
        <Link href={`/sessions/${sessionId}`}>
          <ExternalLink className="size-4" />
        </Link>
      </Button>

      {status === 'draft' && (
        <Button
          variant="ghost"
          size="icon"
          className="size-7 text-green-600 hover:text-green-700"
          title="Confirm Session"
          onClick={() => onConfirm(sessionId)}
          disabled={disabled}
        >
          <CheckCircle2 className="size-4" />
        </Button>
      )}

      {(status === 'draft' || status === 'active') && (
        <Button
          variant="ghost"
          size="icon"
          className="text-destructive hover:text-destructive size-7"
          title="Cancel Session"
          onClick={() => onCancel(sessionId)}
          disabled={disabled}
        >
          <Ban className="size-4" />
        </Button>
      )}
    </div>
  );
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return format(d, 'EEE, MMM d');
}
