'use client';

import { useState, useTransition, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Wizard, { type WizardStep } from '@/components/forms/wizard';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Search,
  MapPin,
  Calendar,
  Clock,
  Users,
  Trophy,
  Globe,
  Lock,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { createGroupSession, inviteToSession } from '@/lib/actions/session-actions';
import { toast } from 'sonner';

interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  color_primary: string | null;
}

interface FieldOption {
  id: string;
  name: string;
  location_name: string;
  club_name: string;
  city: string;
  sport_category_id: string;
}

interface SlotSession {
  id: string;
  title: string;
  organizerName: string;
  visibility: 'public' | 'private';
  isConfirmed: boolean;
  currentParticipants: number;
  maxParticipants: number;
}

interface SlotOption {
  startTime: string;
  endTime: string;
  status: 'available' | 'booked' | 'blocked' | 'past' | 'closed';
  priceEur: number | null;
  priceLocal: number | null;
  sessions: SlotSession[];
}

const STEPS: WizardStep[] = [
  { title: 'Sport', description: 'Choose a sport category' },
  { title: 'Field', description: 'Pick a field to play on' },
  { title: 'Slot', description: 'Choose date and time' },
  { title: 'Details', description: 'Session info and settings' },
  { title: 'Review', description: 'Confirm and create' },
];

export default function NewSessionWizard({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Sport
  const [sportId, setSportId] = useState<string | null>(null);

  // Step 2: Field
  const [fields, setFields] = useState<FieldOption[]>([]);
  const [fieldsLoading, setFieldsLoading] = useState(false);
  const [fieldSearch, setFieldSearch] = useState('');
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);

  // Step 3: Slot
  const [date, setDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [slots, setSlots] = useState<SlotOption[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<SlotOption | null>(null);

  // Step 4: Details
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [maxParticipants, setMaxParticipants] = useState(10);
  const [pricePerPerson, setPricePerPerson] = useState(0);
  const [skillMin, setSkillMin] = useState(0);
  const [skillMax, setSkillMax] = useState(5);

  // Step 5: Invite emails (optional)
  const [inviteEmails, setInviteEmails] = useState('');

  // Load fields when sport is selected
  useEffect(() => {
    if (!sportId) return;
    setFieldsLoading(true);
    setSelectedFieldId(null);
    setSelectedSlot(null);

    fetch(`/api/sessions/fields?sportCategoryId=${sportId}`)
      .then((r) => r.json())
      .then((data) => setFields(data.fields ?? []))
      .catch(() => setFields([]))
      .finally(() => setFieldsLoading(false));
  }, [sportId]);

  // Load slots when field + date are set
  useEffect(() => {
    if (!selectedFieldId || !date) return;
    setSlotsLoading(true);
    setSelectedSlot(null);

    fetch(`/api/sessions/slots?fieldId=${selectedFieldId}&date=${date}`)
      .then((r) => r.json())
      .then((data) => setSlots(data.slots ?? []))
      .catch(() => setSlots([]))
      .finally(() => setSlotsLoading(false));
  }, [selectedFieldId, date]);

  const filteredFields = useMemo(() => {
    if (!fieldSearch) return fields;
    const q = fieldSearch.toLowerCase();
    return fields.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        f.club_name.toLowerCase().includes(q) ||
        f.city.toLowerCase().includes(q)
    );
  }, [fields, fieldSearch]);

  const selectedCategory = categories.find((c) => c.id === sportId);
  const selectedField = fields.find((f) => f.id === selectedFieldId);

  const canAdvance = (() => {
    switch (step) {
      case 0: return !!sportId;
      case 1: return !!selectedFieldId;
      case 2: return !!selectedSlot;
      case 3: return title.trim().length >= 3 && maxParticipants >= 2;
      case 4: return true;
      default: return false;
    }
  })();

  async function handleSubmit() {
    if (!selectedFieldId || !selectedSlot || !sportId) return;
    setError(null);

    const emails = inviteEmails
      .split(/[,;\n]/)
      .map((e) => e.trim())
      .filter(Boolean);

    startTransition(async () => {
      const result = await createGroupSession({
        fieldId: selectedFieldId,
        date,
        startTime: selectedSlot.startTime,
        endTime: selectedSlot.endTime,
        title: title.trim(),
        description: description.trim() || undefined,
        visibility,
        maxParticipants,
        pricePerPersonEur: pricePerPerson,
        skillLevelMin: skillMin,
        skillLevelMax: skillMax,
      });

      if (!result.success) {
        toast.error(result.error ?? 'Failed to create session');
        setError(result.error ?? 'Failed to create session');
        return;
      }

      toast.success('Draft session created! Confirm it to reserve the slot.');

      const sessionId = result.data?.sessionId;

      if (emails.length > 0 && sessionId) {
        await inviteToSession(sessionId, { emails });
      }

      router.push(`/sessions/${sessionId}`);
    });
  }

  return (
    <Wizard
      steps={STEPS}
      currentStep={step}
      onStepChange={setStep}
      onSubmit={handleSubmit}
      isSubmitting={isPending}
      canAdvance={canAdvance}
      submitLabel="Create Draft Session"
    >
      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Step 1: Sport */}
      {step === 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSportId(cat.id)}
              className={`flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-all hover:shadow-sm ${
                sportId === cat.id
                  ? 'border-primary bg-primary/5 ring-primary ring-2'
                  : 'border-border'
              }`}
            >
              <span className="text-2xl">{cat.icon ?? '🏅'}</span>
              <span className="text-sm font-medium">{cat.name}</span>
            </button>
          ))}
        </div>
      )}

      {/* Step 2: Field */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="relative">
            <Search className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
            <Input
              placeholder="Search by name, club, or city..."
              value={fieldSearch}
              onChange={(e) => setFieldSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {fieldsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="text-muted-foreground size-6 animate-spin" />
            </div>
          ) : filteredFields.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-muted-foreground text-sm">
                No fields found for this sport.
              </p>
            </div>
          ) : (
            <div className="max-h-[400px] space-y-2 overflow-y-auto">
              {filteredFields.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setSelectedFieldId(f.id)}
                  className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-all hover:shadow-sm ${
                    selectedFieldId === f.id
                      ? 'border-primary bg-primary/5 ring-primary ring-2'
                      : 'border-border'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{f.name}</p>
                    <p className="text-muted-foreground text-sm">{f.club_name}</p>
                    <p className="text-muted-foreground flex items-center gap-1 text-xs">
                      <MapPin className="size-3" /> {f.location_name}, {f.city}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step 3: Slot — shows ALL slots, greyed-out if unavailable */}
      {step === 2 && (
        <TooltipProvider>
          <div className="space-y-4">
            <div>
              <Label>Date</Label>
              <Input
                type="date"
                value={date}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            {slotsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="text-muted-foreground size-6 animate-spin" />
              </div>
            ) : slots.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-muted-foreground text-sm">
                  No slots for this date. Try another day.
                </p>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <span className="flex items-center gap-1">
                    <span className="inline-block size-3 rounded border border-green-300 bg-green-50" /> Available
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="bg-muted inline-block size-3 rounded border" /> Booked / Blocked
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="size-3 text-blue-500" /> Has sessions
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                  {slots.map((s) => {
                    const isAvailable = s.status === 'available';
                    const isSelected =
                      selectedSlot?.startTime === s.startTime &&
                      selectedSlot?.endTime === s.endTime;
                    const publicSessions = s.sessions?.filter((ss) => ss.visibility === 'public') ?? [];
                    const sessionCount = publicSessions.length;

                    if (isAvailable) {
                      return (
                        <button
                          key={s.startTime}
                          type="button"
                          onClick={() => setSelectedSlot(s)}
                          className={`rounded-lg border p-3 text-center transition-all hover:shadow-sm ${
                            isSelected
                              ? 'border-primary bg-primary/5 ring-primary ring-2'
                              : 'border-green-200 bg-green-50/50 hover:border-green-300 dark:border-green-900 dark:bg-green-950/20'
                          }`}
                        >
                          <p className="text-sm font-medium">{s.startTime.slice(0, 5)}</p>
                          <p className="text-muted-foreground text-[10px]">{s.endTime.slice(0, 5)}</p>
                          {s.priceEur != null && (
                            <p className="mt-1 text-xs font-medium text-emerald-600">
                              {Number(s.priceEur).toFixed(0)}€
                            </p>
                          )}
                          {sessionCount > 0 && (
                            <div className="mt-1 flex items-center justify-center gap-0.5 text-[10px] text-blue-600">
                              <Users className="size-2.5" />
                              <span>{sessionCount} session{sessionCount !== 1 ? 's' : ''}</span>
                            </div>
                          )}
                        </button>
                      );
                    }

                    const reason =
                      s.status === 'booked'
                        ? 'This slot has a confirmed booking'
                        : s.status === 'past'
                          ? 'This time has already passed'
                          : s.status === 'blocked'
                            ? 'This slot is blocked'
                            : 'Closed';

                    return (
                      <Tooltip key={s.startTime}>
                        <TooltipTrigger asChild>
                          <div
                            className="bg-muted/60 text-muted-foreground cursor-not-allowed rounded-lg border p-3 text-center opacity-50"
                          >
                            <p className="text-sm font-medium">{s.startTime.slice(0, 5)}</p>
                            <p className="text-[10px]">{s.endTime.slice(0, 5)}</p>
                            <p className="mt-1 text-[10px] capitalize">{s.status}</p>
                            {sessionCount > 0 && (
                              <div className="mt-1 flex items-center justify-center gap-0.5 text-[10px] text-blue-500">
                                <Users className="size-2.5" />
                                <span>{sessionCount}</span>
                              </div>
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">
                          {reason}
                          {sessionCount > 0 && (
                            <span className="block text-blue-400">
                              {sessionCount} public session{sessionCount !== 1 ? 's' : ''} on this slot
                            </span>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </TooltipProvider>
      )}

      {/* Step 4: Details */}
      {step === 3 && (
        <div className="space-y-4">
          <div>
            <Label htmlFor="title">Session Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={`${selectedCategory?.name ?? 'Sport'} session`}
            />
          </div>
          <div>
            <Label htmlFor="desc">Description (optional)</Label>
            <Textarea
              id="desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Details about the session, rules, what to bring..."
              rows={3}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Visibility</Label>
              <div className="mt-2 flex gap-2">
                <Button
                  type="button"
                  variant={visibility === 'public' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setVisibility('public')}
                >
                  <Globe className="mr-1 size-4" /> Public
                </Button>
                <Button
                  type="button"
                  variant={visibility === 'private' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setVisibility('private')}
                >
                  <Lock className="mr-1 size-4" /> Private
                </Button>
              </div>
            </div>
            <div>
              <Label htmlFor="max">Max Participants</Label>
              <Input
                id="max"
                type="number"
                min={2}
                max={100}
                value={maxParticipants}
                onChange={(e) => setMaxParticipants(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="price">Price per Person (€)</Label>
              <Input
                id="price"
                type="number"
                min={0}
                step={0.5}
                value={pricePerPerson}
                onChange={(e) => setPricePerPerson(Number(e.target.value))}
              />
            </div>
          </div>

          <Separator />

          <div>
            <Label className="mb-2 block">Skill Level Range</Label>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <Label className="text-muted-foreground text-xs">Min</Label>
                <Input
                  type="number"
                  min={0}
                  max={5}
                  step={0.5}
                  value={skillMin}
                  onChange={(e) => setSkillMin(Number(e.target.value))}
                />
              </div>
              <span className="text-muted-foreground pt-4">–</span>
              <div className="flex-1">
                <Label className="text-muted-foreground text-xs">Max</Label>
                <Input
                  type="number"
                  min={0}
                  max={5}
                  step={0.5}
                  value={skillMax}
                  onChange={(e) => setSkillMax(Number(e.target.value))}
                />
              </div>
            </div>
          </div>

          <Separator />

          <div>
            <Label htmlFor="invites">Invite Players (optional)</Label>
            <Textarea
              id="invites"
              value={inviteEmails}
              onChange={(e) => setInviteEmails(e.target.value)}
              placeholder="Enter email addresses, separated by commas..."
              rows={2}
            />
            <p className="text-muted-foreground mt-1 text-xs">
              You can also invite players after creating the session.
            </p>
          </div>
        </div>
      )}

      {/* Step 5: Review */}
      {step === 4 && (
        <div className="space-y-4">
          {/* Draft notice */}
          <div className="flex items-start gap-3 rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-900 dark:bg-yellow-950/30">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-yellow-600" />
            <div className="text-sm">
              <p className="font-medium text-yellow-800 dark:text-yellow-300">
                This creates a draft session
              </p>
              <p className="text-yellow-700 dark:text-yellow-400">
                The slot is <strong>not reserved</strong> until you confirm the session.
                You must confirm before the deadline (2 hours before start time),
                otherwise it will be automatically cancelled.
              </p>
            </div>
          </div>

          <Card>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center gap-3">
                <span
                  className="flex size-10 items-center justify-center rounded-lg text-lg"
                  style={{ backgroundColor: `${selectedCategory?.color_primary ?? '#16a34a'}20` }}
                >
                  {selectedCategory?.icon ?? '🏅'}
                </span>
                <div>
                  <h3 className="font-semibold">{title || 'Untitled Session'}</h3>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {selectedCategory?.name}
                    </Badge>
                    <Badge className="bg-yellow-100 text-yellow-800 text-xs">
                      Draft
                    </Badge>
                  </div>
                </div>
              </div>

              {description && (
                <p className="text-muted-foreground text-sm">{description}</p>
              )}

              <Separator />

              <div className="grid gap-2 text-sm sm:grid-cols-2">
                <div className="flex items-center gap-2">
                  <MapPin className="text-muted-foreground size-4" />
                  <span>
                    {selectedField?.name} — {selectedField?.club_name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="text-muted-foreground size-4" />
                  <span>
                    {new Date(date + 'T12:00:00').toLocaleDateString('en-GB', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="text-muted-foreground size-4" />
                  <span>
                    {selectedSlot?.startTime?.slice(0, 5)} – {selectedSlot?.endTime?.slice(0, 5)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="text-muted-foreground size-4" />
                  <span>Max {maxParticipants} players</span>
                </div>
              </div>

              <Separator />

              <div className="flex flex-wrap gap-2">
                <Badge variant={visibility === 'public' ? 'default' : 'secondary'}>
                  {visibility === 'public' ? (
                    <><Globe className="mr-1 size-3" /> Public</>
                  ) : (
                    <><Lock className="mr-1 size-3" /> Private</>
                  )}
                </Badge>
                {pricePerPerson > 0 ? (
                  <Badge variant="outline">{pricePerPerson.toFixed(2)}€ / person</Badge>
                ) : (
                  <Badge variant="outline" className="text-emerald-600">Free</Badge>
                )}
                {(skillMin > 0 || skillMax < 5) && (
                  <Badge variant="outline">
                    <Trophy className="mr-1 size-3" />
                    Skill: {skillMin.toFixed(1)} – {skillMax.toFixed(1)}
                  </Badge>
                )}
              </div>

              {inviteEmails.trim() && (
                <>
                  <Separator />
                  <div>
                    <p className="text-muted-foreground mb-1 text-xs font-medium">Invites will be sent to:</p>
                    <div className="flex flex-wrap gap-1">
                      {inviteEmails
                        .split(/[,;\n]/)
                        .map((e) => e.trim())
                        .filter(Boolean)
                        .map((email) => (
                          <Badge key={email} variant="secondary" className="text-xs">
                            {email}
                          </Badge>
                        ))}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </Wizard>
  );
}
