'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  updateField,
  updateFieldAttributes,
  updateFieldBookingSettings,
  updateFieldAvailability,
  deleteField,
} from '@/lib/actions/field-actions';
import { Save, Loader2, Trash2, X, Plus } from 'lucide-react';
import { toast } from 'sonner';

// ─── Constants ──────────────────────────────────────

const SURFACE_TYPES = [
  'grass', 'artificial_turf', 'clay', 'hard_court', 'wood',
  'rubber', 'concrete', 'sand', 'carpet', 'other',
];
const ENVIRONMENTS = ['indoor', 'outdoor', 'covered'];
const FORMATS = ['5x5', '6x6', '9x9', '11x11', 'singles', 'doubles'];
const BOOLEAN_ATTR_KEYS = [
  { key: 'has_lighting', label: 'Lighting' },
  { key: 'has_changing_rooms', label: 'Changing Rooms' },
  { key: 'has_parking', label: 'Parking' },
  { key: 'has_cafe_bar', label: 'Café / Bar' },
  { key: 'has_fitness_area', label: 'Fitness Area' },
  { key: 'has_equipment_rental', label: 'Equipment Rental' },
];
const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_LABELS: Record<string, string> = {
  monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu',
  friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
};

// ─── Types ──────────────────────────────────────────

interface SportCategory { id: string; name: string; icon: string | null }
interface Attribute { id: string; attribute_key: string; attribute_value: string }
interface BookingSettings {
  slot_duration_minutes: number;
  buffer_minutes: number | null;
  price_per_slot_eur: number;
  price_per_slot_local: number | null;
  min_booking_notice_hours: number | null;
  max_booking_advance_days: number | null;
  auto_confirm: boolean | null;
  cancellation_policy_hours: number | null;
}
interface AvailRow {
  id: string;
  day_of_week: string | null;
  specific_date: string | null;
  start_time: string;
  end_time: string;
  is_available: boolean | null;
  reason: string | null;
}

interface Props {
  locationId: string;
  field: {
    id: string; name: string; slug: string; description: string | null;
    is_active: boolean | null;
    sport_categories: { id: string; name: string; icon: string | null } | null;
  };
  attributes: Attribute[];
  bookingSettings: BookingSettings | null;
  availability: AvailRow[];
  sportCategories: SportCategory[];
}

export default function FieldDetailClient({
  locationId,
  field,
  attributes,
  bookingSettings,
  availability,
  sportCategories,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // ── Info state
  const [name, setName] = useState(field.name);
  const [sportCatId, setSportCatId] = useState(field.sport_categories?.id ?? '');
  const [description, setDescription] = useState(field.description ?? '');

  // ── Attributes state
  function getAttr(key: string) {
    return attributes.find((a) => a.attribute_key === key)?.attribute_value ?? '';
  }
  const [surfaceType, setSurfaceType] = useState(getAttr('surface_type'));
  const [environment, setEnvironment] = useState(getAttr('environment'));
  const [size, setSize] = useState(getAttr('size'));
  const [maxPlayers, setMaxPlayers] = useState(getAttr('max_players'));
  const [format, setFormat] = useState(getAttr('format'));
  const [boolAttrs, setBoolAttrs] = useState<Record<string, boolean>>(
    Object.fromEntries(BOOLEAN_ATTR_KEYS.map((a) => [a.key, getAttr(a.key) === 'true']))
  );

  // ── Booking settings state
  const bs = bookingSettings;
  const [slotDuration, setSlotDuration] = useState(bs?.slot_duration_minutes ?? 60);
  const [bufferMin, setBufferMin] = useState(bs?.buffer_minutes ?? 0);
  const [priceEur, setPriceEur] = useState(bs?.price_per_slot_eur ?? 0);
  const [priceLocal, setPriceLocal] = useState<number | ''>(bs?.price_per_slot_local ?? '');
  const [minNotice, setMinNotice] = useState(bs?.min_booking_notice_hours ?? 1);
  const [maxAdvance, setMaxAdvance] = useState(bs?.max_booking_advance_days ?? 30);
  const [autoConfirm, setAutoConfirm] = useState(bs?.auto_confirm ?? true);
  const [cancelHours, setCancelHours] = useState(bs?.cancellation_policy_hours ?? 24);

  // ── Availability state
  const [availRules, setAvailRules] = useState(
    availability.map((a) => ({
      dayOfWeek: a.day_of_week ?? undefined,
      specificDate: a.specific_date ?? undefined,
      startTime: a.start_time,
      endTime: a.end_time,
      isAvailable: a.is_available ?? true,
      reason: a.reason ?? undefined,
    }))
  );

  function showMsg(msg: string, isError: boolean) {
    if (isError) { setError(msg); setSuccess(null); }
    else { setSuccess(msg); setError(null); }
    setTimeout(() => { setError(null); setSuccess(null); }, 3000);
  }

  // ── Save handlers

  async function handleSaveInfo() {
    startTransition(async () => {
      const result = await updateField(field.id, {
        name, sportCategoryId: sportCatId, description,
      });
      if (!result.success) {
        toast.error(result.error ?? 'Failed to save field info');
        showMsg(result.error ?? 'Failed to save field info', true);
      } else {
        toast.success('Info saved.');
        showMsg('Info saved.', false);
        router.refresh();
      }
    });
  }

  async function handleSaveAttrs() {
    const attrs: { key: string; value: string }[] = [];
    if (surfaceType) attrs.push({ key: 'surface_type', value: surfaceType });
    if (environment) attrs.push({ key: 'environment', value: environment });
    if (size.trim()) attrs.push({ key: 'size', value: size.trim() });
    if (maxPlayers.trim()) attrs.push({ key: 'max_players', value: maxPlayers.trim() });
    if (format) attrs.push({ key: 'format', value: format });
    BOOLEAN_ATTR_KEYS.forEach((a) => {
      if (boolAttrs[a.key]) attrs.push({ key: a.key, value: 'true' });
    });

    startTransition(async () => {
      const result = await updateFieldAttributes(field.id, attrs);
      if (!result.success) {
        toast.error(result.error ?? 'Failed to save attributes');
        showMsg(result.error ?? 'Failed to save attributes', true);
      } else {
        toast.success('Attributes saved.');
        showMsg('Attributes saved.', false);
        router.refresh();
      }
    });
  }

  async function handleSaveBooking() {
    startTransition(async () => {
      const result = await updateFieldBookingSettings(field.id, {
        slotDurationMinutes: slotDuration,
        bufferMinutes: bufferMin,
        pricePerSlotEur: priceEur,
        pricePerSlotLocal: priceLocal === '' ? undefined : priceLocal,
        minBookingNoticeHours: minNotice,
        maxBookingAdvanceDays: maxAdvance,
        autoConfirm,
        cancellationPolicyHours: cancelHours,
      });
      if (!result.success) {
        toast.error(result.error ?? 'Failed to save booking settings');
        showMsg(result.error ?? 'Failed to save booking settings', true);
      } else {
        toast.success('Booking settings saved.');
        showMsg('Booking settings saved.', false);
        router.refresh();
      }
    });
  }

  async function handleSaveAvail() {
    startTransition(async () => {
      const result = await updateFieldAvailability(field.id, availRules.map((r) => ({
        dayOfWeek: r.dayOfWeek,
        specificDate: r.specificDate,
        startTime: r.startTime,
        endTime: r.endTime,
        isAvailable: r.isAvailable,
        reason: r.reason,
      })));
      if (!result.success) {
        toast.error(result.error ?? 'Failed to save availability');
        showMsg(result.error ?? 'Failed to save availability', true);
      } else {
        toast.success('Availability saved.');
        showMsg('Availability saved.', false);
        router.refresh();
      }
    });
  }

  async function handleToggleActive(isActive: boolean) {
    startTransition(async () => {
      const result = await updateField(field.id, { isActive });
      if (!result.success) {
        toast.error(result.error ?? 'Failed to toggle field status');
        showMsg(result.error ?? 'Failed to toggle field status', true);
      } else {
        toast.success(isActive ? 'Field activated.' : 'Field deactivated.');
        router.refresh();
      }
    });
  }

  async function handleDelete() {
    if (!confirm('Delete this field? This cannot be undone.')) return;
    startTransition(async () => {
      const result = await deleteField(field.id);
      if (!result?.success) {
        toast.error(result?.error ?? 'Failed to delete field');
        showMsg(result?.error ?? 'Failed to delete field', true);
      }
    });
  }

  const saveBtnProps = { disabled: isPending, size: 'sm' as const };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-2xl">{field.sport_categories?.icon ?? '🏅'}</span>
            <h1 className="text-2xl font-bold">{field.name}</h1>
            <Badge variant={field.is_active ? 'default' : 'secondary'}>
              {field.is_active ? 'Active' : 'Inactive'}
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm">{field.sport_categories?.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={field.is_active ?? true}
            onCheckedChange={handleToggleActive}
            disabled={isPending}
          />
          <Button
            variant="ghost" size="icon"
            className="text-destructive hover:text-destructive"
            onClick={handleDelete} disabled={isPending}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      {(error || success) && (
        <div className={`flex items-center justify-between rounded-md p-3 text-sm ${
          error ? 'bg-destructive/10 text-destructive' : 'bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-400'
        }`}>
          {error ?? success}
          <button onClick={() => { setError(null); setSuccess(null); }}><X className="size-4" /></button>
        </div>
      )}

      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">Info</TabsTrigger>
          <TabsTrigger value="attributes">Attributes</TabsTrigger>
          <TabsTrigger value="booking">Booking</TabsTrigger>
          <TabsTrigger value="availability">Availability</TabsTrigger>
        </TabsList>

        {/* ── Info ── */}
        <TabsContent value="info" className="space-y-4 pt-4">
          <div className="grid max-w-lg gap-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Sport Category</Label>
              <Select value={sportCatId} onValueChange={setSportCatId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {sportCategories.map((sc) => (
                    <SelectItem key={sc.id} value={sc.id}>{sc.icon} {sc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </div>
          <Button onClick={handleSaveInfo} {...saveBtnProps}>
            {isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
            Save Info
          </Button>
        </TabsContent>

        {/* ── Attributes ── */}
        <TabsContent value="attributes" className="space-y-6 pt-4">
          <div className="grid max-w-2xl grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Surface Type</Label>
              <Select value={surfaceType} onValueChange={setSurfaceType}>
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  {SURFACE_TYPES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Environment</Label>
              <Select value={environment} onValueChange={setEnvironment}>
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  {ENVIRONMENTS.map((e) => <SelectItem key={e} value={e}>{e.charAt(0).toUpperCase() + e.slice(1)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Size</Label>
              <Input value={size} onChange={(e) => setSize(e.target.value)} placeholder="e.g. 40x20m" />
            </div>
            <div className="space-y-2">
              <Label>Max Players</Label>
              <Input type="number" min={1} value={maxPlayers} onChange={(e) => setMaxPlayers(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Format</Label>
              <Select value={format} onValueChange={setFormat}>
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  {FORMATS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="max-w-2xl space-y-3">
            <Label>Amenities</Label>
            <div className="grid grid-cols-2 gap-3">
              {BOOLEAN_ATTR_KEYS.map((a) => (
                <div key={a.key} className="flex items-center justify-between rounded-md border px-3 py-2">
                  <span className="text-sm">{a.label}</span>
                  <Switch checked={boolAttrs[a.key]} onCheckedChange={(v) => setBoolAttrs({ ...boolAttrs, [a.key]: v })} />
                </div>
              ))}
            </div>
          </div>
          <Button onClick={handleSaveAttrs} {...saveBtnProps}>
            {isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
            Save Attributes
          </Button>
        </TabsContent>

        {/* ── Booking Settings ── */}
        <TabsContent value="booking" className="space-y-4 pt-4">
          <div className="grid max-w-2xl grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Slot Duration</Label>
              <Select value={String(slotDuration)} onValueChange={(v) => setSlotDuration(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 min</SelectItem>
                  <SelectItem value="60">60 min</SelectItem>
                  <SelectItem value="90">90 min</SelectItem>
                  <SelectItem value="120">120 min</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Buffer (min)</Label>
              <Input type="number" min={0} value={bufferMin} onChange={(e) => setBufferMin(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>Price (EUR)</Label>
              <Input type="number" min={0} step={0.5} value={priceEur} onChange={(e) => setPriceEur(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>Price (BGN)</Label>
              <Input type="number" min={0} step={0.5} value={priceLocal} onChange={(e) => setPriceLocal(e.target.value === '' ? '' : Number(e.target.value))} placeholder="Optional" />
            </div>
            <div className="space-y-2">
              <Label>Min Notice (hours)</Label>
              <Input type="number" min={0} value={minNotice} onChange={(e) => setMinNotice(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>Max Advance (days)</Label>
              <Input type="number" min={1} value={maxAdvance} onChange={(e) => setMaxAdvance(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>Free Cancel (hours)</Label>
              <Input type="number" min={0} value={cancelHours} onChange={(e) => setCancelHours(Number(e.target.value))} />
            </div>
            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <span className="text-sm">Auto-confirm</span>
              <Switch checked={autoConfirm} onCheckedChange={setAutoConfirm} />
            </div>
          </div>
          <Button onClick={handleSaveBooking} {...saveBtnProps}>
            {isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
            Save Booking Settings
          </Button>
        </TabsContent>

        {/* ── Availability ── */}
        <TabsContent value="availability" className="space-y-4 pt-4">
          <p className="text-muted-foreground max-w-2xl text-sm">
            Override the location schedule for this field. Without overrides, the field inherits the location hours.
          </p>
          {availRules.map((rule, i) => (
            <div key={i} className="grid max-w-2xl grid-cols-[110px_90px_90px_90px_40px] items-end gap-2 rounded-md border p-3">
              <div className="space-y-1">
                <Label className="text-xs">{rule.specificDate !== undefined ? 'Date' : 'Day'}</Label>
                <Select
                  value={rule.dayOfWeek ?? '__date__'}
                  onValueChange={(v) => {
                    const updated = [...availRules];
                    if (v === '__date__') { updated[i] = { ...rule, dayOfWeek: undefined, specificDate: '' }; }
                    else { updated[i] = { ...rule, dayOfWeek: v, specificDate: undefined }; }
                    setAvailRules(updated);
                  }}
                >
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DAYS.map((d) => <SelectItem key={d} value={d}>{DAY_LABELS[d]}</SelectItem>)}
                    <SelectItem value="__date__">Date</SelectItem>
                  </SelectContent>
                </Select>
                {rule.specificDate !== undefined && (
                  <Input type="date" className="mt-1 h-8 text-xs" value={rule.specificDate}
                    onChange={(e) => { const u = [...availRules]; u[i] = { ...rule, specificDate: e.target.value }; setAvailRules(u); }} />
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">From</Label>
                <Input type="time" className="h-9" value={rule.startTime}
                  onChange={(e) => { const u = [...availRules]; u[i] = { ...rule, startTime: e.target.value }; setAvailRules(u); }} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">To</Label>
                <Input type="time" className="h-9" value={rule.endTime}
                  onChange={(e) => { const u = [...availRules]; u[i] = { ...rule, endTime: e.target.value }; setAvailRules(u); }} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Status</Label>
                <Select value={rule.isAvailable ? 'available' : 'blocked'}
                  onValueChange={(v) => { const u = [...availRules]; u[i] = { ...rule, isAvailable: v === 'available' }; setAvailRules(u); }}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="blocked">Blocked</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive size-9"
                onClick={() => setAvailRules(availRules.filter((_, j) => j !== i))}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => setAvailRules([
            ...availRules,
            { dayOfWeek: 'monday', startTime: '08:00', endTime: '22:00', isAvailable: true },
          ])}>
            <Plus className="mr-2 size-4" /> Add Override
          </Button>
          <div>
            <Button onClick={handleSaveAvail} {...saveBtnProps}>
              {isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
              Save Availability
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
