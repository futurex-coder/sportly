'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  CalendarDays,
  MapPin,
  Users,
  Trophy,
  UserPlus,
  LogOut,
  XCircle,
  CheckCircle2,
  ArrowLeft,
  Pencil,
  ShieldCheck,
  UserCheck,
  UserX,
  Loader2,
} from 'lucide-react';
import {
  requestToJoinSession,
  confirmGroupSession,
  editGroupSession,
  approveJoinRequest,
  declineJoinRequest,
  leaveSession,
  cancelSession,
  markSessionComplete,
  acceptDirectInvite,
  declineDirectInvite,
} from '@/lib/actions/session-actions';
import {
  getSessionStatus,
  getSessionStatusDisplay,
  isDeadlinePassed,
} from '@/lib/db/queries';
import { toast } from 'sonner';
import ParticipantList, { type ParticipantData } from '@/components/sessions/participant-list';
import InviteModal, { type InviteData } from '@/components/sessions/invite-modal';
import RatePlayersForm from '@/components/ratings/rate-players-form';
import { useSessionDetailRealtime } from '@/lib/supabase/use-session-realtime';

interface Session {
  id: string;
  title: string;
  description: string | null;
  visibility: string;
  date: string;
  start_time: string;
  end_time: string;
  max_participants: number;
  current_participants: number;
  price_per_person_eur: number | null;
  skill_level_min: number | null;
  skill_level_max: number | null;
  is_cancelled: boolean;
  completed_at: string | null;
  is_confirmed: boolean | null;
  confirmation_deadline: string | null;
  cancelled_reason: string | null;
  organizer_id: string;
  booking_id: string | null;
  profiles: { id: string; full_name: string | null; avatar_url: string | null; city: string | null };
  sport_categories: { id: string; name: string; slug: string; icon: string | null; color_primary: string | null };
  fields: { id: string; name: string; slug: string; locations: { id: string; name: string; city: string; address: string; clubs: { id: string; name: string; slug: string } } };
}

interface RatablePlayer {
  userId: string;
  profile: { full_name: string | null; avatar_url: string | null; city: string | null } | null;
  alreadyRated: boolean;
}

interface RatingStatus {
  participants: RatablePlayer[];
  allRated: boolean;
  ratedCount: number;
  totalCount: number;
}

interface Criteria {
  id: string;
  name: string;
  description: string | null;
}

interface Props {
  session: Session;
  participants: ParticipantData[];
  invites: InviteData[];
  currentUserId: string | null;
  currentParticipant: ParticipantData | null;
  userRating: number | null;
  ratingStatus?: RatingStatus | null;
  ratingCriteria?: Criteria[];
}

export default function SessionDetailClient({
  session,
  participants,
  invites,
  currentUserId,
  currentParticipant,
  userRating,
  ratingStatus,
  ratingCriteria = [],
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  useSessionDetailRealtime(session.id);

  const sc = session.sport_categories;
  const field = session.fields;
  const loc = field.locations;
  const club = loc.clubs;
  const org = session.profiles;

  const sessionStatus = getSessionStatus(session);
  const statusDisplay = getSessionStatusDisplay(sessionStatus);

  const date = new Date(session.date + 'T12:00:00');
  const dateStr = date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const spotsLeft = session.max_participants - session.current_participants;
  const isOrganizer = currentUserId === session.organizer_id;
  const isParticipant = !!currentParticipant;
  const isPast = new Date(session.date + 'T23:59:59') < new Date();
  const isCompleted = sessionStatus === 'completed';
  const isCancelled = sessionStatus === 'cancelled' || sessionStatus === 'expired';
  const isDraft = sessionStatus === 'draft';
  const isActive = sessionStatus === 'active';

  const price = session.price_per_person_eur != null ? Number(session.price_per_person_eur) : null;
  const minSkill = Number(session.skill_level_min ?? 0);
  const maxSkill = Number(session.skill_level_max ?? 5);

  const deadlinePassed = isDeadlinePassed(session.confirmation_deadline);

  const canRequestJoin =
    currentUserId &&
    !isParticipant &&
    session.visibility === 'public' &&
    !isCancelled &&
    !isCompleted &&
    !isPast &&
    spotsLeft > 0;

  const meetsSkill =
    userRating === null ||
    (userRating >= minSkill && userRating <= maxSkill);

  const pendingRequests = participants.filter((p) => p.status === 'requested');

  function handleAction(
    action: () => Promise<{ success: boolean; error?: string; data?: any }>,
    successMsg = 'Done'
  ) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.success) {
        toast.error(result.error ?? 'Something went wrong');
        setError(result.error ?? 'Something went wrong');
        return;
      }
      toast.success(successMsg);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link href="/sessions" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm">
        <ArrowLeft className="size-4" /> All Sessions
      </Link>

      {/* Status banner */}
      <div className={`rounded-md border p-3 text-sm ${statusDisplay.bgColor} ${statusDisplay.color}`}>
        <span className="font-semibold">{statusDisplay.label}</span>
        {sessionStatus === 'draft' && (
          <span className="ml-1">
            — Slot is not reserved yet.
            {session.confirmation_deadline && !deadlinePassed && (
              <> Must be confirmed by{' '}
              <strong>
                {new Date(session.confirmation_deadline).toLocaleString('en-GB', {
                  day: '2-digit', month: '2-digit', year: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })}
              </strong>.
              </>
            )}
            {deadlinePassed && ' Confirmation deadline has passed.'}
          </span>
        )}
        {sessionStatus === 'active' && ' — Slot is reserved.'}
        {sessionStatus === 'expired' && ' — Was not confirmed before the deadline.'}
        {sessionStatus === 'cancelled' && session.cancelled_reason === 'slot_taken' && (
          ' — The slot was booked by someone else.'
        )}
      </div>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span
              className="flex size-10 items-center justify-center rounded-lg text-lg"
              style={{ backgroundColor: `${sc?.color_primary ?? '#16a34a'}20` }}
            >
              {sc?.icon ?? '🏅'}
            </span>
            <Badge variant="outline">{sc?.name}</Badge>
            <Badge variant={session.visibility === 'public' ? 'default' : 'secondary'}>
              {session.visibility}
            </Badge>
            <Badge className={`${statusDisplay.bgColor} ${statusDisplay.color} border-0`}>
              {statusDisplay.label}
            </Badge>
          </div>
          <h1 className="text-2xl font-bold">{session.title}</h1>
          {session.description && (
            <p className="text-muted-foreground mt-1 max-w-xl text-sm">{session.description}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          {/* Request to Join (public sessions) */}
          {canRequestJoin && meetsSkill && (
            <Button
              onClick={() => handleAction(
                () => requestToJoinSession(session.id),
                'Join request sent! The organizer will review it.'
              )}
              disabled={isPending}
            >
              {isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <UserPlus className="mr-2 size-4" />}
              Request to Join
            </Button>
          )}
          {canRequestJoin && !meetsSkill && (
            <Button disabled variant="outline" title={`Your rating: ${userRating?.toFixed(1)}`}>
              Skill mismatch
            </Button>
          )}

          {/* Participant: Leave */}
          {isParticipant && !isOrganizer && !isCancelled && !isCompleted && !isPast && (
            <Button
              variant="outline"
              onClick={() => handleAction(() => leaveSession(session.id), 'You left the session.')}
              disabled={isPending}
            >
              <LogOut className="mr-2 size-4" /> Leave
            </Button>
          )}

          {/* Organizer actions */}
          {isOrganizer && !isCancelled && !isCompleted && (
            <>
              {/* Confirm (draft only) */}
              {isDraft && !deadlinePassed && (
                <Button
                  onClick={() => handleAction(
                    () => confirmGroupSession(session.id),
                    'Session confirmed! Slot is now reserved.'
                  )}
                  disabled={isPending}
                >
                  {isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <ShieldCheck className="mr-2 size-4" />}
                  Confirm Session
                </Button>
              )}

              {/* Edit */}
              <Button
                variant="outline"
                onClick={() => setIsEditing(!isEditing)}
                disabled={isPending}
              >
                <Pencil className="mr-2 size-4" /> Edit
              </Button>

              {/* Invite */}
              <InviteModal
                sessionId={session.id}
                invites={invites}
                disabled={isPast}
              />

              {/* Mark Complete (active + past) */}
              {isActive && isPast && (
                <Button
                  onClick={() => handleAction(
                    () => markSessionComplete(session.id),
                    'Session marked as complete!'
                  )}
                  disabled={isPending}
                >
                  <CheckCircle2 className="mr-2 size-4" /> Mark Complete
                </Button>
              )}

              {/* Cancel */}
              <Button
                variant="destructive"
                onClick={() => {
                  if (confirm('Cancel this session? This cannot be undone.')) {
                    handleAction(() => cancelSession(session.id), 'Session cancelled.');
                  }
                }}
                disabled={isPending}
              >
                <XCircle className="mr-2 size-4" /> Cancel
              </Button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Edit form (inline) */}
      {isEditing && isOrganizer && (
        <EditSessionForm
          session={session}
          isPending={isPending}
          onSave={(data) => {
            handleAction(
              () => editGroupSession(session.id, data),
              'Session updated!'
            );
            setIsEditing(false);
          }}
          onCancel={() => setIsEditing(false)}
        />
      )}

      {/* Info grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardContent className="flex items-start gap-3 p-4">
            <CalendarDays className="text-muted-foreground mt-0.5 size-5 shrink-0" />
            <div>
              <p className="text-sm font-medium">{dateStr}</p>
              <p className="text-muted-foreground text-xs">
                {session.start_time.slice(0, 5)} – {session.end_time.slice(0, 5)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-start gap-3 p-4">
            <MapPin className="text-muted-foreground mt-0.5 size-5 shrink-0" />
            <div>
              <Link href={`/clubs/${club.slug}`} className="text-sm font-medium hover:underline">
                {club.name}
              </Link>
              <p className="text-muted-foreground text-xs">
                {loc.name} — {field.name}
              </p>
              <p className="text-muted-foreground text-xs">{loc.city}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-start gap-3 p-4">
            <Users className="text-muted-foreground mt-0.5 size-5 shrink-0" />
            <div>
              <p className="text-sm font-medium">
                {session.current_participants} / {session.max_participants} players
              </p>
              <p className={`text-xs ${spotsLeft <= 3 && spotsLeft > 0 ? 'font-medium text-orange-600' : 'text-muted-foreground'}`}>
                {spotsLeft > 0 ? `${spotsLeft} spot${spotsLeft !== 1 ? 's' : ''} remaining` : 'Session is full'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Details row */}
      <div className="flex flex-wrap gap-4">
        {price != null && price > 0 && (
          <Badge variant="secondary" className="text-sm">
            {price.toFixed(2)}€ per person
          </Badge>
        )}
        {price === 0 && (
          <Badge variant="secondary" className="text-sm text-emerald-600">
            Free
          </Badge>
        )}
        {(minSkill > 0 || maxSkill < 5) && (
          <Badge variant="outline" className="text-sm">
            <Trophy className="mr-1 size-3" />
            Skill: {minSkill.toFixed(1)} – {maxSkill.toFixed(1)}
          </Badge>
        )}
        {userRating !== null && (
          <Badge
            variant="outline"
            className={`text-sm ${meetsSkill ? 'border-emerald-300 text-emerald-700' : 'border-red-300 text-red-700'}`}
          >
            Your rating: {userRating.toFixed(1)}
          </Badge>
        )}
      </div>

      {/* Pending join requests (organizer only) */}
      {isOrganizer && pendingRequests.length > 0 && !isCancelled && !isCompleted && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              Pending Join Requests ({pendingRequests.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingRequests.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Avatar className="size-8">
                    <AvatarImage src={p.profiles?.avatar_url ?? undefined} />
                    <AvatarFallback>{p.profiles?.full_name?.[0]?.toUpperCase() ?? '?'}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">{p.profiles?.full_name ?? 'Unknown'}</p>
                    {p.profiles?.city && (
                      <p className="text-muted-foreground text-xs">{p.profiles.city}</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <Button
                    size="sm"
                    onClick={() => handleAction(
                      () => approveJoinRequest(session.id, p.user_id),
                      `${p.profiles?.full_name ?? 'User'} approved!`
                    )}
                    disabled={isPending}
                  >
                    <UserCheck className="mr-1 size-3.5" /> Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleAction(
                      () => declineJoinRequest(session.id, p.user_id),
                      `${p.profiles?.full_name ?? 'User'} declined.`
                    )}
                    disabled={isPending}
                  >
                    <UserX className="mr-1 size-3.5" /> Decline
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Participants */}
      <ParticipantList
        participants={participants}
        organizerId={session.organizer_id}
        showFullList={isOrganizer || isParticipant}
        maxParticipants={session.max_participants}
        currentCount={session.current_participants}
      />

      {/* Rate Players */}
      {ratingStatus && ratingStatus.totalCount > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              Rate Players
              {ratingStatus.allRated
                ? ' — All Done!'
                : ` (${ratingStatus.ratedCount}/${ratingStatus.totalCount} rated)`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RatePlayersForm
              sessionId={session.id}
              participants={ratingStatus.participants}
              criteria={ratingCriteria}
            />
          </CardContent>
        </Card>
      )}

      {/* Participant waiting for approval */}
      {currentParticipant?.status === 'requested' && (
        <div className="rounded-md border border-yellow-200 bg-yellow-50 p-4 text-center dark:border-yellow-800 dark:bg-yellow-950">
          <p className="text-sm font-medium text-yellow-700 dark:text-yellow-300">
            Your join request is pending. The organizer will review it.
          </p>
        </div>
      )}

      {/* Invited — accept or decline */}
      {currentParticipant?.status === 'invited' && !isCancelled && !isCompleted && (
        <div className="rounded-md border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950">
          <p className="mb-3 text-center text-sm font-medium text-blue-700 dark:text-blue-300">
            You&apos;ve been invited to this session.
          </p>
          <div className="flex justify-center gap-2">
            <Button
              size="sm"
              onClick={() => handleAction(
                () => acceptDirectInvite(session.id),
                'Invite accepted!'
              )}
              disabled={isPending}
            >
              {isPending ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : <CheckCircle2 className="mr-1 size-3.5" />}
              Accept
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleAction(
                () => declineDirectInvite(session.id),
                'Invite declined.'
              )}
              disabled={isPending}
            >
              <XCircle className="mr-1 size-3.5" /> Decline
            </Button>
          </div>
        </div>
      )}

      {/* Not logged in prompt */}
      {!currentUserId && !isCancelled && !isCompleted && !isPast && spotsLeft > 0 && session.visibility === 'public' && (
        <div className="rounded-md border border-blue-200 bg-blue-50 p-4 text-center dark:border-blue-800 dark:bg-blue-950">
          <p className="mb-2 text-sm font-medium text-blue-700 dark:text-blue-300">
            Want to join this session?
          </p>
          <Button asChild>
            <Link href={`/auth/login?redirect=/sessions/${session.id}`}>Log in to join</Link>
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Inline Edit Form ───────────────────────────────

function EditSessionForm({
  session,
  isPending,
  onSave,
  onCancel,
}: {
  session: Session;
  isPending: boolean;
  onSave: (data: {
    title?: string;
    description?: string;
    maxParticipants?: number;
    pricePerPersonEur?: number;
    skillLevelMin?: number;
    skillLevelMax?: number;
  }) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(session.title);
  const [description, setDescription] = useState(session.description ?? '');
  const [maxParticipants, setMaxParticipants] = useState(session.max_participants);
  const [pricePerPerson, setPricePerPerson] = useState(Number(session.price_per_person_eur ?? 0));
  const [minSkill, setMinSkill] = useState(Number(session.skill_level_min ?? 0));
  const [maxSkill, setMaxSkill] = useState(Number(session.skill_level_max ?? 5));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Edit Session</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium">Title</label>
          <input
            className="border-input bg-background h-8 w-full rounded-md border px-3 text-sm"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium">Description</label>
          <input
            className="border-input bg-background h-8 w-full rounded-md border px-3 text-sm"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Max participants</label>
            <input
              type="number"
              min={2}
              max={50}
              className="border-input bg-background h-8 w-full rounded-md border px-3 text-sm"
              value={maxParticipants}
              onChange={(e) => setMaxParticipants(Number(e.target.value))}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Price/person (EUR)</label>
            <input
              type="number"
              min={0}
              step={0.5}
              className="border-input bg-background h-8 w-full rounded-md border px-3 text-sm"
              value={pricePerPerson}
              onChange={(e) => setPricePerPerson(Number(e.target.value))}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Min skill</label>
            <input
              type="number"
              min={0}
              max={5}
              step={0.5}
              className="border-input bg-background h-8 w-full rounded-md border px-3 text-sm"
              value={minSkill}
              onChange={(e) => setMinSkill(Number(e.target.value))}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Max skill</label>
            <input
              type="number"
              min={0}
              max={5}
              step={0.5}
              className="border-input bg-background h-8 w-full rounded-md border px-3 text-sm"
              value={maxSkill}
              onChange={(e) => setMaxSkill(Number(e.target.value))}
            />
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <Button
            size="sm"
            disabled={isPending || !title.trim()}
            onClick={() =>
              onSave({
                title: title.trim(),
                description: description.trim(),
                maxParticipants,
                pricePerPersonEur: pricePerPerson,
                skillLevelMin: minSkill,
                skillLevelMax: maxSkill,
              })
            }
          >
            Save Changes
          </Button>
          <Button size="sm" variant="ghost" onClick={onCancel} disabled={isPending}>
            Cancel
          </Button>
        </div>
        <p className="text-muted-foreground text-xs">
          Note: Date, time, and field cannot be changed.
        </p>
      </CardContent>
    </Card>
  );
}
