'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, Users, Trophy } from 'lucide-react';
import { formatPrice } from '@/lib/utils/price';
import { createPublicBooking } from '@/lib/actions/booking-actions';
import { createGroupSession, requestToJoinSession } from '@/lib/actions/session-actions';
import { type SlotSession } from '@/lib/booking/slot-generator';
import { toast } from 'sonner';

interface BookingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fieldId: string;
  fieldName: string;
  locationName: string;
  locationAddress?: string;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  priceEur: number | null;
  priceLocal: number | null;
  sessions: SlotSession[];
  onSuccess?: () => void;
}

function formatDisplayDate(d: string): string {
  const dt = new Date(d + 'T12:00:00');
  return dt.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export default function BookingModal({
  open,
  onOpenChange,
  fieldId,
  fieldName,
  locationName,
  locationAddress,
  date,
  startTime,
  endTime,
  durationMinutes,
  priceEur,
  priceLocal,
  sessions,
  onSuccess,
}: BookingModalProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('book');

  // Book Directly state
  const [notes, setNotes] = useState('');
  const [createSession, setCreateSession] = useState(false);
  const [sessionTitle, setSessionTitle] = useState('');
  const [sessionDesc, setSessionDesc] = useState('');
  const [sessionVisibility, setSessionVisibility] = useState<'public' | 'private'>('public');
  const [maxParticipants, setMaxParticipants] = useState(10);
  const [pricePerPerson, setPricePerPerson] = useState(0);
  const [minSkill, setMinSkill] = useState(0);
  const [maxSkill, setMaxSkill] = useState(5);

  // Join Session state
  const [joiningSessionId, setJoiningSessionId] = useState<string | null>(null);

  function resetForm() {
    setNotes('');
    setError(null);
    setCreateSession(false);
    setSessionTitle('');
    setSessionDesc('');
    setSessionVisibility('public');
    setMaxParticipants(10);
    setPricePerPerson(0);
    setMinSkill(0);
    setMaxSkill(5);
    setJoiningSessionId(null);
    setActiveTab('book');
  }

  function handleBookDirectly() {
    setError(null);
    startTransition(async () => {
      if (createSession) {
        if (!sessionTitle.trim()) {
          setError('Session title is required');
          return;
        }
        const result = await createGroupSession({
          fieldId,
          date,
          startTime,
          endTime,
          title: sessionTitle.trim(),
          description: sessionDesc.trim() || undefined,
          visibility: sessionVisibility,
          maxParticipants,
          pricePerPersonEur: pricePerPerson,
          skillLevelMin: minSkill,
          skillLevelMax: maxSkill,
        });

        if (!result.success) {
          toast.error(result.error ?? 'Failed to create session');
          setError(result.error ?? 'Failed to create session');
          return;
        }
        toast.success('Draft session created! Confirm it to reserve the slot.');
        resetForm();
        onOpenChange(false);
        router.push(`/sessions/${result.data!.sessionId}`);
        return;
      }

      const result = await createPublicBooking({
        fieldId,
        date,
        startTime,
        endTime,
        notes: notes || undefined,
      });

      if (!result.success) {
        toast.error(result.error ?? 'Booking failed');
        setError(result.error ?? 'Booking failed');
        return;
      }
      toast.success('Booking confirmed!');
      resetForm();
      onOpenChange(false);
      onSuccess?.();
    });
  }

  function handleRequestToJoin(sessionId: string) {
    setError(null);
    setJoiningSessionId(sessionId);
    startTransition(async () => {
      const result = await requestToJoinSession(sessionId);
      setJoiningSessionId(null);

      if (!result.success) {
        toast.error(result.error ?? 'Failed to request to join');
        setError(result.error ?? 'Failed to request to join');
        return;
      }
      toast.success('Join request sent! The organizer will review it.');
      resetForm();
      onOpenChange(false);
      onSuccess?.();
    });
  }

  const sessionCount = sessions.length;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) resetForm();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">{fieldName} — {locationName}</DialogTitle>
          {locationAddress && (
            <p className="text-muted-foreground text-xs">{locationAddress}</p>
          )}
        </DialogHeader>

        {/* Slot summary */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span className="text-muted-foreground">{formatDisplayDate(date)}</span>
          <span className="font-medium">{startTime} — {endTime}</span>
          <span className="text-muted-foreground">{durationMinutes} min</span>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-1">
          <TabsList className="w-full">
            <TabsTrigger value="book" className="flex-1">
              Book Directly
            </TabsTrigger>
            <TabsTrigger value="join" className="flex-1 gap-1.5">
              Join Session
              {sessionCount > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5 text-[10px]">
                  {sessionCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ─── Tab 1: Book Directly ─── */}
          <TabsContent value="book" className="space-y-4 pt-2">
            <div className="flex items-baseline justify-between">
              <span className="text-muted-foreground text-sm">Slot price</span>
              <span className="text-lg font-semibold">
                {formatPrice(priceEur, priceLocal)}
              </span>
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Notes (optional)</Label>
              <Input
                placeholder="Any special requests..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={createSession}
              />
            </div>

            <Separator />

            {/* Group session toggle */}
            <div className="flex items-start gap-3 rounded-md border p-3">
              <Checkbox
                id="create-session"
                checked={createSession}
                onCheckedChange={(v) => setCreateSession(v === true)}
              />
              <div>
                <label htmlFor="create-session" className="cursor-pointer text-sm font-medium leading-none">
                  Create a group session (draft)
                </label>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  Creates a draft session. You&apos;ll need to confirm it to reserve the slot.
                </p>
              </div>
            </div>

            {/* Session form expansion */}
            {createSession && (
              <div className="space-y-3 rounded-md border bg-accent/30 p-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Title *</Label>
                  <Input
                    value={sessionTitle}
                    onChange={(e) => setSessionTitle(e.target.value)}
                    placeholder="e.g. Friday Football 5v5"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Description</Label>
                  <Input
                    value={sessionDesc}
                    onChange={(e) => setSessionDesc(e.target.value)}
                    placeholder="Open to all skill levels"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Visibility</Label>
                  <RadioGroup
                    value={sessionVisibility}
                    onValueChange={(v) => setSessionVisibility(v as 'public' | 'private')}
                    className="flex gap-4"
                  >
                    <div className="flex items-center gap-1.5">
                      <RadioGroupItem value="public" id="vis-public" />
                      <Label htmlFor="vis-public" className="text-xs font-normal">Public</Label>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <RadioGroupItem value="private" id="vis-private" />
                      <Label htmlFor="vis-private" className="text-xs font-normal">Private</Label>
                    </div>
                  </RadioGroup>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Max participants</Label>
                    <Input
                      type="number"
                      min={2}
                      max={50}
                      value={maxParticipants}
                      onChange={(e) => setMaxParticipants(Number(e.target.value))}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Price / person (EUR)</Label>
                    <Input
                      type="number"
                      min={0}
                      step={0.5}
                      value={pricePerPerson}
                      onChange={(e) => setPricePerPerson(Number(e.target.value))}
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Min skill (0–5)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={5}
                      step={0.5}
                      value={minSkill}
                      onChange={(e) => setMinSkill(Number(e.target.value))}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Max skill (0–5)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={5}
                      step={0.5}
                      value={maxSkill}
                      onChange={(e) => setMaxSkill(Number(e.target.value))}
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
              </div>
            )}

            {error && activeTab === 'book' && (
              <p className="bg-destructive/10 text-destructive rounded-md p-2 text-sm">{error}</p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isPending}>
                Cancel
              </Button>
              <Button onClick={handleBookDirectly} disabled={isPending}>
                {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                {createSession ? 'Create Draft Session' : `Book Now — ${formatPrice(priceEur, priceLocal)}`}
              </Button>
            </div>
          </TabsContent>

          {/* ─── Tab 2: Join Session ─── */}
          <TabsContent value="join" className="space-y-3 pt-2">
            {sessionCount === 0 ? (
              <div className="py-8 text-center">
                <Users className="text-muted-foreground mx-auto mb-2 size-8" />
                <p className="text-muted-foreground text-sm">
                  No public sessions available for this slot.
                </p>
                <p className="text-muted-foreground mt-1 text-xs">
                  Switch to &quot;Book Directly&quot; to create your own session.
                </p>
              </div>
            ) : (
              sessions.map((s) => (
                <SessionJoinCard
                  key={s.id}
                  session={s}
                  isPending={isPending && joiningSessionId === s.id}
                  isDisabled={isPending}
                  onRequestJoin={() => handleRequestToJoin(s.id)}
                />
              ))
            )}

            {error && activeTab === 'join' && (
              <p className="bg-destructive/10 text-destructive rounded-md p-2 text-sm">{error}</p>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// ─── Session card for the Join tab ──────────────────

function SessionJoinCard({
  session,
  isPending,
  isDisabled,
  onRequestJoin,
}: {
  session: SlotSession;
  isPending: boolean;
  isDisabled: boolean;
  onRequestJoin: () => void;
}) {
  const spotsLeft = session.maxParticipants - session.currentParticipants;
  const isFull = spotsLeft <= 0;

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {session.sportCategoryIcon && (
              <span className="text-sm">{session.sportCategoryIcon}</span>
            )}
            <h4 className="truncate text-sm font-semibold">{session.title}</h4>
          </div>
          <p className="text-muted-foreground mt-0.5 text-xs">
            by {session.organizerName}
          </p>
        </div>
        <Badge variant={session.isConfirmed ? 'default' : 'secondary'} className="shrink-0 text-[10px]">
          {session.isConfirmed ? 'Active' : 'Draft'}
        </Badge>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Users className="size-3" />
          {session.currentParticipants}/{session.maxParticipants}
          {spotsLeft > 0 && (
            <span className="text-green-600 dark:text-green-400">
              ({spotsLeft} {spotsLeft === 1 ? 'spot' : 'spots'} left)
            </span>
          )}
          {isFull && (
            <span className="text-red-500">Full</span>
          )}
        </span>
        {session.pricePerPersonEur > 0 && (
          <span>€{session.pricePerPersonEur.toFixed(2)}/person</span>
        )}
        {(session.skillLevelMin > 0 || session.skillLevelMax < 5) && (
          <span className="flex items-center gap-1">
            <Trophy className="size-3" />
            {session.skillLevelMin}–{session.skillLevelMax}
          </span>
        )}
      </div>

      <Button
        size="sm"
        className="mt-1 w-full"
        disabled={isDisabled || isFull}
        onClick={onRequestJoin}
      >
        {isPending ? (
          <Loader2 className="mr-2 size-3.5 animate-spin" />
        ) : null}
        {isFull ? 'Session Full' : 'Request to Join'}
      </Button>
    </div>
  );
}
