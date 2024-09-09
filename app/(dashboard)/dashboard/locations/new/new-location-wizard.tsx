'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Wizard, { type WizardStep } from '@/components/forms/wizard';
import WeeklyScheduleEditor, {
  getDefaultSchedule,
  type ScheduleDay,
} from '@/components/forms/weekly-schedule-editor';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createLocation } from '@/lib/actions/location-actions';
import { createField } from '@/lib/actions/field-actions';
import { Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';

interface SportCategory {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
}

interface QuickField {
  name: string;
  sportCategoryId: string;
  slotDurationMinutes: number;
  pricePerSlotEur: number;
}

interface Props {
  clubId: string;
  sportCategories: SportCategory[];
}

const STEPS: WizardStep[] = [
  { title: 'Basic Info', description: 'Location name, address, and contact details.' },
  { title: 'Schedule', description: 'Set weekly operating hours.' },
  { title: 'Quick-Add Fields', description: 'Optionally add fields now, or do it later.' },
  { title: 'Review', description: 'Check everything and create your location.' },
];

export default function NewLocationWizard({ clubId, sportCategories }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Step 1 state
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('Bulgaria');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [description, setDescription] = useState('');

  // Step 2 state
  const [schedule, setSchedule] = useState<ScheduleDay[]>(getDefaultSchedule());

  // Step 3 state
  const [quickFields, setQuickFields] = useState<QuickField[]>([]);

  function addQuickField() {
    setQuickFields([
      ...quickFields,
      {
        name: '',
        sportCategoryId: sportCategories[0]?.id ?? '',
        slotDurationMinutes: 60,
        pricePerSlotEur: 0,
      },
    ]);
  }

  function updateQuickField(index: number, patch: Partial<QuickField>) {
    setQuickFields(
      quickFields.map((f, i) => (i === index ? { ...f, ...patch } : f))
    );
  }

  function removeQuickField(index: number) {
    setQuickFields(quickFields.filter((_, i) => i !== index));
  }

  const canAdvance = (() => {
    if (step === 0) return name.trim() !== '' && address.trim() !== '' && city.trim() !== '';
    if (step === 2) return quickFields.every((f) => f.name.trim() !== '' && f.sportCategoryId);
    return true;
  })();

  async function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const result = await createLocation({
        clubId,
        name: name.trim(),
        address: address.trim(),
        city: city.trim(),
        country: country.trim() || 'Bulgaria',
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        description: description.trim() || undefined,
        schedule,
      });

      if (!result.success) {
        toast.error(result.error ?? 'Failed to create location');
        setError(result.error ?? 'Failed to create location');
        return;
      }

      const locationId = result.data?.locationId;

      if (locationId && quickFields.length > 0) {
        for (const qf of quickFields) {
          const fieldResult = await createField({
            locationId,
            name: qf.name.trim(),
            sportCategoryId: qf.sportCategoryId,
            attributes: [],
            bookingSettings: {
              slotDurationMinutes: qf.slotDurationMinutes,
              bufferMinutes: 0,
              pricePerSlotEur: qf.pricePerSlotEur,
              minBookingNoticeHours: 1,
              maxBookingAdvanceDays: 30,
              autoConfirm: true,
              cancellationPolicyHours: 24,
            },
          });

          if (!fieldResult.success) {
            toast.error(`Field "${qf.name}" failed: ${fieldResult.error ?? 'Unknown error'}`);
            setError(`Location created but field "${qf.name}" failed: ${fieldResult.error ?? 'Unknown error'}`);
            router.push(`/dashboard/locations/${locationId}`);
            return;
          }
        }
      }

      toast.success('Location created.');
      router.push(
        locationId
          ? `/dashboard/locations/${locationId}`
          : '/dashboard/locations'
      );
    });
  }

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
        submitLabel="Create Location"
      >
        {/* Step 1: Basic Info */}
        {step === 0 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="loc-name">Location Name *</Label>
              <Input
                id="loc-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Sofia Central Sports Hall"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="loc-address">Address *</Label>
                <Input
                  id="loc-address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="123 Main Street"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="loc-city">City *</Label>
                <Input
                  id="loc-city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Sofia"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="loc-country">Country</Label>
                <Input
                  id="loc-country"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="loc-phone">Phone</Label>
                <Input
                  id="loc-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+359..."
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="loc-email">Email</Label>
              <Input
                id="loc-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="location@club.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="loc-desc">Description</Label>
              <Input
                id="loc-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
              />
            </div>
          </div>
        )}

        {/* Step 2: Schedule */}
        {step === 1 && (
          <WeeklyScheduleEditor schedule={schedule} onChange={setSchedule} />
        )}

        {/* Step 3: Quick-Add Fields */}
        {step === 2 && (
          <div className="space-y-4">
            {quickFields.length === 0 && (
              <p className="text-muted-foreground text-sm">
                No fields added yet. You can skip this step and add fields later.
              </p>
            )}
            {quickFields.map((qf, i) => (
              <div
                key={i}
                className="grid grid-cols-[1fr_1fr_80px_100px_40px] items-end gap-3 rounded-md border p-3"
              >
                <div className="space-y-1">
                  <Label className="text-xs">Name</Label>
                  <Input
                    value={qf.name}
                    onChange={(e) => updateQuickField(i, { name: e.target.value })}
                    placeholder="Pitch 1"
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Sport</Label>
                  <Select
                    value={qf.sportCategoryId}
                    onValueChange={(v) => updateQuickField(i, { sportCategoryId: v })}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
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
                <div className="space-y-1">
                  <Label className="text-xs">Duration</Label>
                  <Select
                    value={String(qf.slotDurationMinutes)}
                    onValueChange={(v) =>
                      updateQuickField(i, { slotDurationMinutes: Number(v) })
                    }
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30m</SelectItem>
                      <SelectItem value="60">60m</SelectItem>
                      <SelectItem value="90">90m</SelectItem>
                      <SelectItem value="120">120m</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Price (EUR)</Label>
                  <Input
                    type="number"
                    min={0}
                    step={0.5}
                    value={qf.pricePerSlotEur}
                    onChange={(e) =>
                      updateQuickField(i, { pricePerSlotEur: Number(e.target.value) })
                    }
                    className="h-9"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive size-9"
                  onClick={() => removeQuickField(i)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addQuickField}>
              <Plus className="mr-2 size-4" />
              Add Field
            </Button>
          </div>
        )}

        {/* Step 4: Review */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="rounded-md border p-4">
              <h3 className="mb-2 font-semibold">Location</h3>
              <dl className="text-sm [&_dt]:text-muted-foreground grid grid-cols-[120px_1fr] gap-x-4 gap-y-1">
                <dt>Name</dt>
                <dd>{name}</dd>
                <dt>Address</dt>
                <dd>{address}, {city}, {country}</dd>
                {phone && (
                  <>
                    <dt>Phone</dt>
                    <dd>{phone}</dd>
                  </>
                )}
                {email && (
                  <>
                    <dt>Email</dt>
                    <dd>{email}</dd>
                  </>
                )}
                {description && (
                  <>
                    <dt>Description</dt>
                    <dd>{description}</dd>
                  </>
                )}
              </dl>
            </div>

            <div className="rounded-md border p-4">
              <h3 className="mb-2 font-semibold">Schedule</h3>
              <div className="space-y-1 text-sm">
                {schedule.map((day) => (
                  <div
                    key={day.dayOfWeek}
                    className="flex items-center justify-between"
                  >
                    <span className="capitalize">{day.dayOfWeek}</span>
                    <span className="text-muted-foreground">
                      {day.isClosed ? 'Closed' : `${day.openTime} – ${day.closeTime}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {quickFields.length > 0 && (
              <div className="rounded-md border p-4">
                <h3 className="mb-2 font-semibold">
                  Fields ({quickFields.length})
                </h3>
                <div className="space-y-1 text-sm">
                  {quickFields.map((qf, i) => {
                    const sport = sportCategories.find(
                      (sc) => sc.id === qf.sportCategoryId
                    );
                    return (
                      <div key={i} className="flex items-center justify-between">
                        <span>
                          {sport?.icon} {qf.name}
                        </span>
                        <span className="text-muted-foreground">
                          {qf.slotDurationMinutes}min · {qf.pricePerSlotEur} EUR
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </Wizard>
    </>
  );
}
