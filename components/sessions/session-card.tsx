'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  CalendarDays,
  Clock,
  MapPin,
  Users,
  Star,
  Eye,
  EyeOff,
  ChevronRight,
} from 'lucide-react';
import { getSessionStatus, getSessionStatusDisplay, type SessionStatus } from '@/lib/db/queries';

export interface SessionCardData {
  id: string;
  title: string;
  date: string;
  start_time: string;
  end_time: string;
  max_participants: number;
  current_participants: number;
  price_per_person_eur?: number | null;
  skill_level_min?: number | null;
  skill_level_max?: number | null;
  visibility?: string;
  organizer_id?: string | null;
  is_confirmed?: boolean | null;
  is_cancelled?: boolean | null;
  cancelled_reason?: string | null;
  completed_at?: string | null;
  profiles?: { full_name: string | null; avatar_url: string | null } | null;
  sport_categories?: {
    id?: string;
    name: string;
    slug?: string;
    icon: string | null;
    color_primary?: string | null;
  } | null;
  fields?: {
    name: string;
    locations?: { name: string; city: string; clubs?: { name: string; slug?: string } };
  };
}

interface SessionCardProps {
  session: SessionCardData;
  /** "browse" = public listing style (clickable row, organizer avatar, price, chevron).
   *  "dashboard" = /my/sessions style (role badge, rate button). */
  variant?: 'browse' | 'dashboard';
  /** For dashboard variant: the user's role in this session. */
  role?: 'Organizer' | 'Participant' | 'Invited';
  /** For dashboard variant: participant status string. */
  participantStatus?: string;
  /** Whether to show a "Rate Players" action. */
  canRate?: boolean;
}

const ROLE_COLORS: Record<string, string> = {
  Organizer: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  Invited: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  Participant: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
};

export default function SessionCard({
  session: s,
  variant = 'browse',
  role,
  participantStatus,
  canRate,
}: SessionCardProps) {
  if (!s) return null;

  const sc = s.sport_categories;
  const f = s.fields as any;
  const loc = f?.locations;
  const club = loc?.clubs;
  const org = s.profiles;

  const spotsLeft = s.max_participants - s.current_participants;
  const date = new Date(s.date + 'T12:00:00');
  const dateStr = date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  const price = s.price_per_person_eur != null ? Number(s.price_per_person_eur) : null;

  const status = getSessionStatus(s);
  const statusDisplay = getSessionStatusDisplay(status);

  // ─── Browse variant: full clickable card row ───────
  if (variant === 'browse') {
    return (
      <Link
        href={`/sessions/${s.id}`}
        className="group flex flex-col rounded-xl border bg-white p-4 transition-shadow hover:shadow-md sm:flex-row sm:items-start sm:gap-4 dark:bg-zinc-900"
      >
        <div className="flex items-start gap-3 sm:gap-4 sm:flex-1 sm:min-w-0">
          <SportIcon icon={sc?.icon} color={sc?.color_primary} />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold group-hover:underline">{s.title}</h3>
              <Badge variant="outline" className="text-[10px]">{sc?.name}</Badge>
              <Badge className={`border-0 text-[10px] ${statusDisplay.bgColor} ${statusDisplay.color}`}>
                {statusDisplay.label}
              </Badge>
            </div>
            <p className="text-muted-foreground text-sm">
              {f?.name} — {club?.name}
            </p>
            <MetaRow dateStr={dateStr} startTime={s.start_time} endTime={s.end_time} city={loc?.city} current={s.current_participants} max={s.max_participants} />
          </div>
        </div>

        {/* Mobile: price + spots row */}
        <div className="mt-3 flex items-center justify-between border-t pt-3 sm:mt-0 sm:border-0 sm:pt-0 sm:shrink-0 sm:text-right sm:flex-col sm:items-end sm:gap-0">
          {org && (
            <div className="hidden sm:mb-1 sm:flex sm:items-center sm:gap-2">
              <Avatar className="size-6">
                <AvatarImage src={org.avatar_url ?? undefined} />
                <AvatarFallback className="text-[10px]">
                  {org.full_name?.[0]?.toUpperCase() ?? '?'}
                </AvatarFallback>
              </Avatar>
              <span className="text-muted-foreground text-xs">{org.full_name ?? 'Organizer'}</span>
            </div>
          )}
          <PriceLabel price={price} />
          <SpotsLabel spotsLeft={spotsLeft} />
        </div>

        <ChevronRight className="text-muted-foreground mt-1 hidden size-5 shrink-0 sm:block" />
      </Link>
    );
  }

  // ─── Dashboard variant: compact row with role badge ──
  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-start sm:gap-4">
      <div className="flex items-start gap-3 sm:flex-1 sm:min-w-0 sm:gap-4">
        <div className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-lg text-lg sm:size-12">
          {sc?.icon ?? '🏅'}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/sessions/${s.id}`} className="font-semibold hover:underline">
              {s.title}
            </Link>
            {role && (
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${ROLE_COLORS[role] ?? ROLE_COLORS.Participant}`}>
                {role}
              </span>
            )}
            <Badge className={`border-0 text-[10px] ${statusDisplay.bgColor} ${statusDisplay.color}`}>
              {statusDisplay.label}
            </Badge>
            {s.visibility && (
              <Badge variant="outline" className="text-[10px]">
                {s.visibility === 'public' ? (
                  <><Eye className="mr-1 size-3" /> Public</>
                ) : (
                  <><EyeOff className="mr-1 size-3" /> Private</>
                )}
              </Badge>
            )}
          </div>
          {club && (
            <p className="text-muted-foreground text-sm">
              {f.name} — {club.name}
            </p>
          )}
          <MetaRow dateStr={dateStr} startTime={s.start_time} endTime={s.end_time} city={loc?.city} current={s.current_participants} max={s.max_participants} />
        </div>
      </div>
      {canRate && (
        <Button variant="outline" size="sm" className="w-full shrink-0 text-xs sm:w-auto" asChild>
          <Link href={`/sessions/${s.id}`}>
            <Star className="mr-1 size-3" /> Rate Players
          </Link>
        </Button>
      )}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────

function SportIcon({ icon, color }: { icon?: string | null; color?: string | null }) {
  return (
    <div
      className="flex size-12 shrink-0 items-center justify-center rounded-lg text-lg"
      style={{ backgroundColor: `${color ?? '#16a34a'}20` }}
    >
      {icon ?? '🏅'}
    </div>
  );
}

function MetaRow({
  dateStr,
  startTime,
  endTime,
  city,
  current,
  max,
}: {
  dateStr: string;
  startTime: string;
  endTime: string;
  city?: string;
  current: number;
  max: number;
}) {
  return (
    <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-3 text-xs">
      <span className="flex items-center gap-1">
        <CalendarDays className="size-3" /> {dateStr}
      </span>
      <span className="flex items-center gap-1">
        <Clock className="size-3" /> {startTime?.slice(0, 5)} – {endTime?.slice(0, 5)}
      </span>
      {city && (
        <span className="flex items-center gap-1">
          <MapPin className="size-3" /> {city}
        </span>
      )}
      <span className="flex items-center gap-1">
        <Users className="size-3" /> {current}/{max}
      </span>
    </div>
  );
}

function PriceLabel({ price }: { price: number | null }) {
  if (price != null && price > 0) {
    return <div className="text-sm font-semibold">{price.toFixed(2)}€ / person</div>;
  }
  if (price === 0) {
    return <div className="text-sm font-medium text-emerald-600">Free</div>;
  }
  return null;
}

function SpotsLabel({ spotsLeft }: { spotsLeft: number }) {
  return (
    <div className={`text-xs ${spotsLeft <= 3 && spotsLeft > 0 ? 'font-medium text-orange-600' : 'text-muted-foreground'}`}>
      {spotsLeft > 0 ? `${spotsLeft} spot${spotsLeft !== 1 ? 's' : ''} left` : 'Full'}
    </div>
  );
}
