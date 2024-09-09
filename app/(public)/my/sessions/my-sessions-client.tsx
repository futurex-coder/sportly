'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Users, CalendarDays } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import SessionCard, { type SessionCardData } from '@/components/sessions/session-card';
import { getParticipantStatusDisplay, type ParticipantStatus } from '@/lib/db/queries';

interface SessionWithLifecycle extends SessionCardData {
  completed_at?: string | null;
  is_confirmed?: boolean | null;
  is_cancelled?: boolean | null;
  cancelled_reason?: string | null;
}

interface Participation {
  id: string;
  status: string;
  group_sessions: SessionWithLifecycle;
}

interface Props {
  organized: SessionWithLifecycle[];
  participations: Participation[];
  fullyRatedSessionIds: string[];
  today: string;
  currentUserId: string;
}

export default function MySessionsClient({
  organized,
  participations,
  fullyRatedSessionIds,
  today,
}: Props) {
  const fullyRatedSet = new Set(fullyRatedSessionIds);

  const upcomingOrg = organized.filter((s) => s.date >= today && !s.is_cancelled);
  const pastOrg = organized.filter((s) => s.date < today || s.is_cancelled);

  const upcomingPart = participations.filter(
    (p) => (p.group_sessions as any)?.date >= today && p.status !== 'invited' && p.status !== 'requested'
  );
  const pastPart = participations.filter(
    (p) => (p.group_sessions as any)?.date < today && p.status !== 'invited' && p.status !== 'requested'
  );

  const invites = participations.filter((p) => p.status === 'invited');
  const requested = participations.filter((p) => p.status === 'requested');

  return (
    <Tabs defaultValue="upcoming">
      <TabsList className="flex-wrap">
        <TabsTrigger value="upcoming">
          Upcoming ({upcomingOrg.length + upcomingPart.length})
        </TabsTrigger>
        <TabsTrigger value="past">
          Past ({pastOrg.length + pastPart.length})
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
        {upcomingOrg.length + upcomingPart.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="No upcoming sessions"
            description="Join a public session or create your own!"
            actionLabel="Browse Sessions"
            actionHref="/sessions"
          />
        ) : (
          <>
            {upcomingOrg.map((s) => (
              <SessionCard key={s.id} session={s} variant="dashboard" role="Organizer" />
            ))}
            {upcomingPart.map((p) => (
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
          </>
        )}
      </TabsContent>

      <TabsContent value="past" className="space-y-3 pt-4">
        {pastOrg.length + pastPart.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No past sessions"
            description="Sessions you've played in will appear here."
          />
        ) : (
          <>
            {pastOrg.map((s) => (
              <SessionCard
                key={s.id}
                session={s}
                variant="dashboard"
                role="Organizer"
                canRate={!!s.completed_at && !fullyRatedSet.has(s.id)}
              />
            ))}
            {pastPart.map((p) => {
              const sess = p.group_sessions;
              return (
                <SessionCard
                  key={p.id}
                  session={sess}
                  variant="dashboard"
                  role="Participant"
                  participantStatus={p.status}
                  canRate={!!sess?.completed_at && !fullyRatedSet.has(sess.id)}
                />
              );
            })}
          </>
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
          {invites.map((p) => (
            <SessionCard
              key={p.id}
              session={p.group_sessions}
              variant="dashboard"
              role="Invited"
              participantStatus={p.status}
            />
          ))}
        </TabsContent>
      )}
    </Tabs>
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
