'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, CalendarDays, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import SessionCard, { type SessionCardData } from '@/components/sessions/session-card';
import { getParticipantStatusDisplay, type ParticipantStatus } from '@/lib/db/queries';
import { acceptDirectInvite, declineDirectInvite } from '@/lib/actions/session-actions';
import { toast } from 'sonner';

interface SessionWithLifecycle extends SessionCardData {
  completed_at?: string | null;
  is_confirmed?: boolean | null;
  is_cancelled?: boolean | null;
  cancelled_reason?: string | null;
  confirmation_deadline?: string | null;
  organizer_id?: string | null;
}

interface Participation {
  id: string;
  status: string;
  group_sessions: SessionWithLifecycle;
}

interface Props {
  participations: Participation[];
  fullyRatedSessionIds: string[];
  today: string;
  currentUserId: string;
}

export default function MySessionsClient({
  participations,
  fullyRatedSessionIds,
  today,
  currentUserId,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const fullyRatedSet = new Set(fullyRatedSessionIds);

  function isExpiredDraft(s: SessionWithLifecycle): boolean {
    return (
      !s.is_confirmed &&
      !s.is_cancelled &&
      !!s.confirmation_deadline &&
      new Date(s.confirmation_deadline) < new Date()
    );
  }

  function getRole(p: Participation): 'Organizer' | 'Participant' | 'Invited' {
    if ((p.group_sessions as any)?.organizer_id === currentUserId) return 'Organizer';
    if (p.status === 'invited') return 'Invited';
    return 'Participant';
  }

  const upcoming = participations.filter((p) => {
    const sess = p.group_sessions as SessionWithLifecycle;
    return (
      sess?.date >= today &&
      !sess.is_cancelled &&
      !isExpiredDraft(sess) &&
      p.status !== 'invited' &&
      p.status !== 'requested'
    );
  });

  const past = participations.filter((p) => {
    const sess = p.group_sessions as SessionWithLifecycle;
    return (
      (sess?.date < today || sess?.is_cancelled || isExpiredDraft(sess)) &&
      p.status !== 'invited' &&
      p.status !== 'requested'
    );
  });

  const invites = participations.filter((p) => p.status === 'invited');
  const requested = participations.filter((p) => p.status === 'requested');

  return (
    <Tabs defaultValue="upcoming">
      <TabsList className="flex-wrap">
        <TabsTrigger value="upcoming">
          Upcoming ({upcoming.length})
        </TabsTrigger>
        <TabsTrigger value="past">
          Past ({past.length})
        </TabsTrigger>
        {requested.length > 0 && (
          <TabsTrigger value="requested">
            Pending ({requested.length})
          </TabsTrigger>
        )}
        {invites.length > 0 && (
          <TabsTrigger value="invites">
            Invites ({invites.length})
          </TabsTrigger>
        )}
      </TabsList>

      <TabsContent value="upcoming" className="space-y-3 pt-4">
        {upcoming.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="No upcoming sessions"
            description="Join a public session or create your own!"
            actionLabel="Browse Sessions"
            actionHref="/sessions"
          />
        ) : (
          upcoming.map((p) => {
            const role = getRole(p);
            return (
              <div key={p.id} className="relative">
                <SessionCard
                  session={p.group_sessions}
                  variant="dashboard"
                  role={role}
                  participantStatus={p.status}
                />
                {role !== 'Organizer' && <ParticipantStatusBadge status={p.status} />}
              </div>
            );
          })
        )}
      </TabsContent>

      <TabsContent value="past" className="space-y-3 pt-4">
        {past.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No past sessions"
            description="Sessions you've played in will appear here."
          />
        ) : (
          past.map((p) => {
            const sess = p.group_sessions;
            const role = getRole(p);
            return (
              <SessionCard
                key={p.id}
                session={sess}
                variant="dashboard"
                role={role}
                participantStatus={p.status}
                canRate={!!sess?.completed_at && !fullyRatedSet.has(sess.id)}
              />
            );
          })
        )}
      </TabsContent>

      {requested.length > 0 && (
        <TabsContent value="requested" className="space-y-3 pt-4">
          <p className="text-muted-foreground mb-2 text-sm">
            Your join requests that are awaiting organizer approval.
          </p>
          {requested.map((p) => (
            <div key={p.id} className="relative">
              <SessionCard
                session={p.group_sessions}
                variant="dashboard"
                role="Participant"
                participantStatus={p.status}
              />
              <ParticipantStatusBadge status={p.status} />
            </div>
          ))}
        </TabsContent>
      )}

      {invites.length > 0 && (
        <TabsContent value="invites" className="space-y-3 pt-4">
          <p className="text-muted-foreground mb-2 text-sm">
            You&apos;ve been invited to these sessions.
          </p>
          {invites.map((p) => (
            <InviteCard
              key={p.id}
              participation={p}
              isPending={isPending}
              onAccept={() => {
                startTransition(async () => {
                  const result = await acceptDirectInvite((p.group_sessions as any).id);
                  if (result.success) {
                    toast.success('Invite accepted!');
                    router.refresh();
                  } else {
                    toast.error(result.error ?? 'Failed to accept invite');
                  }
                });
              }}
              onDecline={() => {
                startTransition(async () => {
                  const result = await declineDirectInvite((p.group_sessions as any).id);
                  if (result.success) {
                    toast.success('Invite declined.');
                    router.refresh();
                  } else {
                    toast.error(result.error ?? 'Failed to decline invite');
                  }
                });
              }}
            />
          ))}
        </TabsContent>
      )}
    </Tabs>
  );
}

function InviteCard({
  participation,
  isPending,
  onAccept,
  onDecline,
}: {
  participation: Participation;
  isPending: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <div className="relative">
      <SessionCard
        session={participation.group_sessions}
        variant="dashboard"
        role="Invited"
        participantStatus={participation.status}
      />
      <div className="mt-2 flex gap-2 pl-14">
        <Button size="sm" onClick={onAccept} disabled={isPending}>
          {isPending ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : <CheckCircle2 className="mr-1 size-3.5" />}
          Accept
        </Button>
        <Button size="sm" variant="outline" onClick={onDecline} disabled={isPending}>
          <XCircle className="mr-1 size-3.5" /> Decline
        </Button>
      </div>
    </div>
  );
}

function ParticipantStatusBadge({ status }: { status: string }) {
  const validStatuses: ParticipantStatus[] = ['invited', 'requested', 'confirmed', 'declined', 'waitlisted'];
  if (!validStatuses.includes(status as ParticipantStatus)) return null;

  const display = getParticipantStatusDisplay(status as ParticipantStatus);
  return (
    <Badge className={`absolute right-3 top-3 border-0 text-[10px] ${display.bgColor} ${display.color}`}>
      {display.label}
    </Badge>
  );
}
