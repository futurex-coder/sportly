'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Wizard, { type WizardStep } from '@/components/forms/wizard';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createField } from '@/lib/actions/field-actions';
import { X, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

// ─── Constants ──────────────────────────────────────

interface SportCategory {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
}

const SURFACE_TYPES = [
  'grass', 'artificial_turf', 'clay', 'hard_court', 'wood',
  'rubber', 'concrete', 'sand', 'carpet', 'other',
];

const ENVIRONMENTS = ['indoor', 'outdoor', 'covered'];

const FORMATS = ['5x5', '6x6', '9x9', '11x11', 'singles', 'doubles'];

const BOOLEAN_ATTRS = [
  { key: 'has_lighting', label: 'Lighting' },
  { key: 'has_changing_rooms', label: 'Changing Rooms' },
  { key: 'has_parking', label: 'Parking' },
  { key: 'has_cafe_bar', label: 'Café / Bar' },
  { key: 'has_fitness_area', label: 'Fitness Area' },
  { key: 'has_equipment_rental', label: 'Equipment Rental' },
];

const DAYS = [
  'monday', 'tuesday', 'wednesday', 'thursday',
  'friday', 'saturday', 'sunday',
];

const DAY_LABELS: Record<string, string> = {
  monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu',
  friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
};

// ─── Types ──────────────────────────────────────────

interface AvailabilityRule {
  dayOfWeek?: string;
  specificDate?: string;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
  reason?: string;
}

interface Props {
  locationId: string;
  sportCategories: SportCategory[];
}

const STEPS: WizardStep[] = [
  { title: 'Basic Info', description: 'Name, sport, and description.' },
  { title: 'Attributes', description: 'Surface, environment, amenities.' },
  { title: 'Booking Settings', description: 'Duration, pricing, and policies.' },
  { title: 'Availability', description: 'Weekly overrides and blocked dates.' },
  { title: 'Review', description: 'Confirm and create the field.' },
];

export default function NewFieldWizard({ locationId, sportCategories }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Basic Info
  const [name, setName] = useState('');
  const [sportCategoryId, setSportCategoryId] = useState(sportCategories[0]?.id ?? '');
  const [description, setDescription] = useState('');

  // Step 2: Attributes
  const [surfaceType, setSurfaceType] = useState('');
  const [environment, setEnvironment] = useState('');
  const [size, setSize] = useState('');
  const [maxPlayers, setMaxPlayers] = useState('');
  const [format, setFormat] = useState('');
  const [booleanAttrs, setBooleanAttrs] = useState<Record<string, boolean>>(
    Object.fromEntries(BOOLEAN_ATTRS.map((a) => [a.key, false]))
  );

  // Step 3: Booking Settings
  const [slotDuration, setSlotDuration] = useState(60);
  const [bufferMinutes, setBufferMinutes] = useState(0);
  const [priceEur, setPriceEur] = useState(0);
  const [priceLocal, setPriceLocal] = useState<number | ''>('');
  const [minNotice, setMinNotice] = useState(1);
  const [maxAdvance, setMaxAdvance] = useState(30);
  const [autoConfirm, setAutoConfirm] = useState(true);
  const [cancellationHours, setCancellationHours] = useState(24);

  // Step 4: Availability
  const [availRules, setAvailRules] = useState<AvailabilityRule[]>([]);

  function addAvailRule() {
    setAvailRules([
      ...availRules,
      { dayOfWeek: 'monday', startTime: '08:00', endTime: '22:00', isAvailable: true },
    ]);
  }

  function updateAvailRule(index: number, patch: Partial<AvailabilityRule>) {
    setAvailRules(availRules.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function removeAvailRule(index: number) {
    setAvailRules(availRules.filter((_, i) => i !== index));
  }

  // ─── Validation ──────────────────────────────────

  const canAdvance = (() => {
    if (step === 0) return name.trim() !== '' && sportCategoryId !== '';
    return true;
  })();

  // ─── Build attributes array ──────────────────────

  function buildAttributes(): { key: string; value: string }[] {
    const attrs: { key: string; value: string }[] = [];
    if (surfaceType) attrs.push({ key: 'surface_type', value: surfaceType });
    if (environment) attrs.push({ key: 'environment', value: environment });
    if (size.trim()) attrs.push({ key: 'size', value: size.trim() });
    if (maxPlayers.trim()) attrs.push({ key: 'max_players', value: maxPlayers.trim() });
    if (format) attrs.push({ key: 'format', value: format });
    BOOLEAN_ATTRS.forEach((a) => {
      if (booleanAttrs[a.key]) attrs.push({ key: a.key, value: 'true' });
    });
    return attrs;
  }

  // ─── Submit ──────────────────────────────────────

  async function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const result = await createField({
        locationId,
        name: name.trim(),
        sportCategoryId,
        description: description.trim() || undefined,
        attributes: buildAttributes(),
        bookingSettings: {
          slotDurationMinutes: slotDuration,
          bufferMinutes,
          pricePerSlotEur: priceEur,
          pricePerSlotLocal: priceLocal === '' ? undefined : priceLocal,
          minBookingNoticeHours: minNotice,
          maxBookingAdvanceDays: maxAdvance,
          autoConfirm,
          cancellationPolicyHours: cancellationHours,
        },
        availability: availRules.length > 0 ? availRules : undefined,
      });

      if (!result.success) {
        toast.error(result.error ?? 'Failed to create field');
        setError(result.error ?? 'Failed to create field');
        return;
      }

      toast.success('Field created.');
      router.push(`/dashboard/locations/${locationId}`);
    });
  }

  const selectedSport = sportCategories.find((sc) => sc.id === sportCategoryId);

  return (
    <>
      {error && (
        <div className="bg-destructive/10 text-destructive mx-auto mb-4 flex max-w-2xl items-center justify-between rounded-md p-3 text-sm">
          {error}
          <button onClick={() => setError(null)}>
            <X className="size-4" />
          </button>
        </div>
      )}

      <Wizard
        steps={STEPS}
        currentStep={step}
        onStepChange={setStep}
        onSubmit={handleSubmit}
        isSubmitting={isPending}
        canAdvance={canAdvance}
        submitLabel="Create Field"
      >
        {/* ── Step 1: Basic Info ── */}
        {step === 0 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="field-name">Field Name *</Label>
              <Input
                id="field-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Pitch 1, Court A"
              />
            </div>
            <div className="space-y-2">
              <Label>Sport Category *</Label>
              <Select value={sportCategoryId} onValueChange={setSportCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select sport" />
                </SelectTrigger>
                <SelectContent>
                  {sportCategories.map((sc) => (
                    <SelectItem key={sc.id} value={sc.id}>
                      {sc.icon} {sc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="field-desc">Description</Label>
              <Input
                id="field-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
              />
            </div>
          </div>
        )}

        {/* ── Step 2: Attributes ── */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Surface Type</Label>
                <Select value={surfaceType} onValueChange={setSurfaceType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {SURFACE_TYPES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s.replace(/_/g, ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Environment</Label>
                <Select value={environment} onValueChange={setEnvironment}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {ENVIRONMENTS.map((e) => (
                      <SelectItem key={e} value={e}>
                        {e.charAt(0).toUpperCase() + e.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="attr-size">Size / Dimensions</Label>
                <Input
                  id="attr-size"
                  value={size}
                  onChange={(e) => setSize(e.target.value)}
                  placeholder="e.g. 40x20m"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="attr-players">Max Players</Label>
                <Input
                  id="attr-players"
                  type="number"
                  min={1}
                  value={maxPlayers}
                  onChange={(e) => setMaxPlayers(e.target.value)}
                  placeholder="e.g. 12"
                />
              </div>
              <div className="space-y-2">
                <Label>Format</Label>
                <Select value={format} onValueChange={setFormat}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {FORMATS.map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3">
              <Label>Amenities</Label>
              <div className="grid grid-cols-2 gap-3">
                {BOOLEAN_ATTRS.map((a) => (
                  <div
                    key={a.key}
                    className="flex items-center justify-between rounded-md border px-3 py-2"
                  >
                    <span className="text-sm">{a.label}</span>
                    <Switch
                      checked={booleanAttrs[a.key]}
                      onCheckedChange={(v) =>
                        setBooleanAttrs({ ...booleanAttrs, [a.key]: v })
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Step 3: Booking Settings ── */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Slot Duration</Label>
                <Select
                  value={String(slotDuration)}
                  onValueChange={(v) => setSlotDuration(Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 minutes</SelectItem>
                    <SelectItem value="60">60 minutes</SelectItem>
                    <SelectItem value="90">90 minutes</SelectItem>
                    <SelectItem value="120">120 minutes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bs-buffer">Buffer Between Bookings (min)</Label>
                <Input
                  id="bs-buffer"
                  type="number"
                  min={0}
                  value={bufferMinutes}
                  onChange={(e) => setBufferMinutes(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bs-price">Price per Slot (EUR) *</Label>
                <Input
                  id="bs-price"
                  type="number"
                  min={0}
                  step={0.5}
                  value={priceEur}
                  onChange={(e) => setPriceEur(Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bs-price-local">Price per Slot (BGN)</Label>
                <Input
                  id="bs-price-local"
                  type="number"
                  min={0}
                  step={0.5}
                  value={priceLocal}
                  onChange={(e) =>
                    setPriceLocal(e.target.value === '' ? '' : Number(e.target.value))
                  }
                  placeholder="Optional"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bs-notice">Min Booking Notice (hours)</Label>
                <Input
                  id="bs-notice"
                  type="number"
                  min={0}
                  value={minNotice}
                  onChange={(e) => setMinNotice(Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bs-advance">Max Booking Advance (days)</Label>
                <Input
                  id="bs-advance"
                  type="number"
                  min={1}
                  value={maxAdvance}
                  onChange={(e) => setMaxAdvance(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bs-cancel">Free Cancellation (hours before)</Label>
                <Input
                  id="bs-cancel"
                  type="number"
                  min={0}
                  value={cancellationHours}
                  onChange={(e) => setCancellationHours(Number(e.target.value))}
                />
              </div>
              <div className="flex items-center justify-between rounded-md border px-3 py-2">
                <span className="text-sm">Auto-confirm bookings</span>
                <Switch checked={autoConfirm} onCheckedChange={setAutoConfirm} />
              </div>
            </div>
          </div>
        )}

        {/* ── Step 4: Availability ── */}
        {step === 3 && (
          <div className="space-y-4">
            <p className="text-muted-foreground text-sm">
              By default, the field inherits the location schedule. Add overrides below to
              block specific times or set custom hours.
            </p>

            {availRules.map((rule, i) => (
              <div
                key={i}
                className="grid grid-cols-[110px_90px_90px_90px_40px] items-end gap-2 rounded-md border p-3"
              >
                <div className="space-y-1">
                  <Label className="text-xs">
                    {rule.specificDate ? 'Date' : 'Day'}
                  </Label>
                  <Select
                    value={rule.dayOfWeek ?? '__date__'}
                    onValueChange={(v) => {
                      if (v === '__date__') {
                        updateAvailRule(i, { dayOfWeek: undefined, specificDate: '' });
                      } else {
                        updateAvailRule(i, { dayOfWeek: v, specificDate: undefined });
                      }
                    }}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DAYS.map((d) => (
                        <SelectItem key={d} value={d}>
                          {DAY_LABELS[d]}
                        </SelectItem>
                      ))}
                      <SelectItem value="__date__">Specific date</SelectItem>
                    </SelectContent>
                  </Select>
                  {rule.specificDate !== undefined && (
                    <Input
                      type="date"
                      className="mt-1 h-8 text-xs"
                      value={rule.specificDate}
                      onChange={(e) => updateAvailRule(i, { specificDate: e.target.value })}
                    />
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">From</Label>
                  <Input
                    type="time"
                    className="h-9"
                    value={rule.startTime}
                    onChange={(e) => updateAvailRule(i, { startTime: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">To</Label>
                  <Input
                    type="time"
                    className="h-9"
                    value={rule.endTime}
                    onChange={(e) => updateAvailRule(i, { endTime: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Status</Label>
                  <Select
                    value={rule.isAvailable ? 'available' : 'blocked'}
                    onValueChange={(v) => updateAvailRule(i, { isAvailable: v === 'available' })}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="available">Available</SelectItem>
                      <SelectItem value="blocked">Blocked</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive size-9"
                  onClick={() => removeAvailRule(i)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}

            <Button type="button" variant="outline" size="sm" onClick={addAvailRule}>
              <Plus className="mr-2 size-4" />
              Add Override
            </Button>
          </div>
        )}

        {/* ── Step 5: Review ── */}
        {step === 4 && (
          <div className="space-y-6">
            <div className="rounded-md border p-4">
              <h3 className="mb-2 font-semibold">Basic Info</h3>
              <dl className="text-sm [&_dt]:text-muted-foreground grid grid-cols-[120px_1fr] gap-x-4 gap-y-1">
                <dt>Name</dt>
                <dd>{name}</dd>
                <dt>Sport</dt>
                <dd>{selectedSport?.icon} {selectedSport?.name}</dd>
                {description && (
                  <>
                    <dt>Description</dt>
                    <dd>{description}</dd>
                  </>
                )}
              </dl>
            </div>

            {buildAttributes().length > 0 && (
              <div className="rounded-md border p-4">
                <h3 className="mb-2 font-semibold">Attributes</h3>
                <div className="flex flex-wrap gap-2">
                  {buildAttributes().map((a) => (
                    <span
                      key={a.key}
                      className="bg-secondary text-secondary-foreground rounded-md px-2 py-1 text-xs"
                    >
                      {a.key.replace(/_/g, ' ')}: {a.value}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-md border p-4">
              <h3 className="mb-2 font-semibold">Booking Settings</h3>
              <dl className="text-sm [&_dt]:text-muted-foreground grid grid-cols-[180px_1fr] gap-x-4 gap-y-1">
                <dt>Slot Duration</dt>
                <dd>{slotDuration} minutes</dd>
                <dt>Buffer</dt>
                <dd>{bufferMinutes} minutes</dd>
                <dt>Price</dt>
                <dd>
                  {priceEur} EUR
                  {priceLocal !== '' && ` / ${priceLocal} BGN`}
                </dd>
                <dt>Min Notice</dt>
                <dd>{minNotice} hour(s)</dd>
                <dt>Max Advance</dt>
                <dd>{maxAdvance} day(s)</dd>
                <dt>Auto-confirm</dt>
                <dd>{autoConfirm ? 'Yes' : 'No'}</dd>
                <dt>Free Cancellation</dt>
                <dd>{cancellationHours} hours before</dd>
              </dl>
            </div>

            {availRules.length > 0 && (
              <div className="rounded-md border p-4">
                <h3 className="mb-2 font-semibold">
                  Availability Overrides ({availRules.length})
                </h3>
                <div className="space-y-1 text-sm">
                  {availRules.map((r, i) => (
                    <div key={i} className="text-muted-foreground">
                      {r.dayOfWeek
                        ? <span className="capitalize">{r.dayOfWeek}</span>
                        : r.specificDate}{' '}
                      {r.startTime}–{r.endTime}{' '}
                      <span className={r.isAvailable ? 'text-green-600' : 'text-red-600'}>
                        ({r.isAvailable ? 'available' : 'blocked'})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Wizard>
    </>
  );
}
