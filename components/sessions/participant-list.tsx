'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users } from 'lucide-react';

export interface ParticipantData {
  id: string;
  user_id: string;
  status: string;
  joined_at: string;
  profiles: {
    full_name: string | null;
    avatar_url: string | null;
    city: string | null;
  } | null;
}

interface ParticipantListProps {
  participants: ParticipantData[];
  /** The organizer's user ID — their row gets an "Organizer" badge. */
  organizerId: string;
  /** If provided, displayed when the list is empty. */
  emptyText?: string;
}

export default function ParticipantList({
  participants,
  organizerId,
  emptyText = 'No participants yet. Be the first to join!',
}: ParticipantListProps) {
  const confirmed = participants.filter((p) => p.status === 'confirmed');
  const waitlisted = participants.filter((p) => p.status === 'waitlisted');
  const invited = participants.filter((p) => p.status === 'invited');
  const total = confirmed.length + waitlisted.length + invited.length;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">
          Participants ({total})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {confirmed.length > 0 && (
          <StatusGroup label="Confirmed" count={confirmed.length}>
            {confirmed.map((p) => (
              <ParticipantRow
                key={p.id}
                participant={p}
                isOrganizer={p.user_id === organizerId}
              />
            ))}
          </StatusGroup>
        )}
        {waitlisted.length > 0 && (
          <StatusGroup label="Waitlisted" count={waitlisted.length}>
            {waitlisted.map((p) => (
              <ParticipantRow key={p.id} participant={p} />
            ))}
          </StatusGroup>
        )}
        {invited.length > 0 && (
          <StatusGroup label="Invited" count={invited.length}>
            {invited.map((p) => (
              <ParticipantRow key={p.id} participant={p} />
            ))}
          </StatusGroup>
        )}
        {participants.length === 0 && (
          <div className="flex flex-col items-center justify-center py-6">
            <Users className="text-muted-foreground mb-2 size-6" />
            <p className="text-muted-foreground text-center text-sm">{emptyText}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatusGroup({
  label,
  count,
  children,
}: {
  label: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
        {label} ({count})
      </p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function ParticipantRow({
  participant,
  isOrganizer,
}: {
  participant: ParticipantData;
  isOrganizer?: boolean;
}) {
  const prof = participant.profiles;
  return (
    <div className="flex items-center gap-3">
      <Avatar className="size-8">
        <AvatarImage src={prof?.avatar_url ?? undefined} />
        <AvatarFallback className="text-xs">
          {prof?.full_name?.[0]?.toUpperCase() ?? '?'}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            {prof?.full_name ?? 'Unknown'}
          </span>
          {isOrganizer && (
            <Badge variant="outline" className="text-[10px]">Organizer</Badge>
          )}
        </div>
        {prof?.city && (
          <p className="text-muted-foreground text-xs">{prof.city}</p>
        )}
      </div>
      <Badge
        variant={participant.status === 'confirmed' ? 'default' : 'secondary'}
        className="shrink-0 text-[10px]"
      >
        {participant.status}
      </Badge>
    </div>
  );
}
