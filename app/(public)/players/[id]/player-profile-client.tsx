'use client';

import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  MapPin,
  Users,
  MessageSquare,
} from 'lucide-react';
import RatingStars from '@/components/ratings/rating-stars';
import RankingBreakdown from '@/components/ratings/ranking-breakdown';

interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  city: string | null;
  created_at: string;
}

interface Ranking {
  id: string;
  rating: number;
  total_ratings_received: number;
  total_sessions_played: number;
  sport_category_id: string;
  sport_categories: {
    id: string;
    name: string;
    slug: string;
    icon: string | null;
    color_primary: string | null;
  } | null;
}

interface RecentSession {
  id: string;
  title: string;
  date: string;
  start_time: string;
  end_time: string;
  max_participants: number;
  current_participants: number;
  completed_at: string | null;
  sport_categories: { name: string; icon: string | null } | null;
  fields: { name: string; locations: { name: string; city: string; clubs: { name: string; slug: string } } };
}

interface RecentRating {
  id: string;
  rating: number;
  skill_rating: number | null;
  sportsmanship_rating: number | null;
  comment: string | null;
  created_at: string;
  profiles: { full_name: string | null; avatar_url: string | null } | null;
  group_sessions: { title: string; date: string } | null;
  sport_categories: { name: string; icon: string | null } | null;
}

interface Props {
  profile: Profile;
  rankings: Ranking[];
  criteriaBreakdowns: Record<string, { criteriaName: string; avgScore: number; count: number }[]>;
  recentSessions: RecentSession[];
  recentRatings: RecentRating[];
}

export default function PlayerProfileClient({
  profile,
  rankings,
  criteriaBreakdowns,
  recentSessions,
  recentRatings,
}: Props) {
  const memberSince = new Date(profile.created_at).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="space-y-6">
      <Link href="/players" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm">
        <ArrowLeft className="size-4" /> All Players
      </Link>

      {/* Profile header */}
      <div className="flex items-center gap-4">
        <Avatar className="size-16">
          <AvatarImage src={profile.avatar_url ?? undefined} />
          <AvatarFallback className="text-xl">
            {profile.full_name?.[0]?.toUpperCase() ?? '?'}
          </AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-2xl font-bold">{profile.full_name ?? 'Unknown'}</h1>
          <div className="text-muted-foreground flex flex-wrap items-center gap-3 text-sm">
            {profile.city && (
              <span className="flex items-center gap-1">
                <MapPin className="size-3" /> {profile.city}
              </span>
            )}
            <span className="flex items-center gap-1">
              <CalendarDays className="size-3" /> Member since {memberSince}
            </span>
          </div>
        </div>
      </div>

      {/* Rankings per sport */}
      {rankings.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Sport Rankings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {rankings.map((r) => {
              const sc = r.sport_categories;
              const rating = Number(r.rating);
              const breakdown = criteriaBreakdowns[r.sport_category_id];

              return (
                <div key={r.id}>
                  <div className="mb-2 flex items-center gap-3">
                    <span className="text-2xl">{sc?.icon ?? '🏅'}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{sc?.name ?? 'Sport'}</span>
                        <RatingStars value={rating} size="size-4" showValue showMax />
                      </div>
                      <p className="text-muted-foreground text-xs">
                        {r.total_ratings_received} rating{r.total_ratings_received !== 1 ? 's' : ''} from{' '}
                        {r.total_sessions_played} session{r.total_sessions_played !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>

                  {breakdown && breakdown.length > 0 && (
                    <div className="ml-11">
                      <RankingBreakdown criteria={breakdown} showCount />
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground text-sm">No sport rankings yet.</p>
          </CardContent>
        </Card>
      )}

      {/* Recent sessions */}
      {recentSessions.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Recent Sessions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentSessions.map((s) => {
              if (!s) return null;
              const sc = s.sport_categories;
              const f = s.fields as any;
              const loc = f?.locations;
              const club = loc?.clubs;
              const date = new Date(s.date + 'T12:00:00');
              const dateStr = date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

              return (
                <Link
                  key={s.id}
                  href={`/sessions/${s.id}`}
                  className="flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                >
                  <div className="bg-muted flex size-9 items-center justify-center rounded-lg text-sm">
                    {sc?.icon ?? '🏅'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{s.title}</p>
                    {club && (
                      <p className="text-muted-foreground text-xs">
                        {f.name} — {club.name}
                      </p>
                    )}
                    <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-2 text-[11px]">
                      <span className="flex items-center gap-1">
                        <CalendarDays className="size-3" /> {dateStr}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="size-3" /> {s.start_time?.slice(0, 5)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="size-3" /> {s.current_participants}/{s.max_participants}
                      </span>
                    </div>
                  </div>
                  {s.completed_at && (
                    <Badge variant="default" className="shrink-0 text-[10px]">Completed</Badge>
                  )}
                </Link>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Recent ratings received */}
      {recentRatings.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Recent Ratings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentRatings.map((r) => {
              const rater = r.profiles;
              const session = r.group_sessions;
              const sc = r.sport_categories;
              const date = r.created_at
                ? new Date(r.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                : '';

              return (
                <div key={r.id} className="rounded-lg border p-3">
                  <div className="mb-2 flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Avatar className="size-7">
                        <AvatarImage src={rater?.avatar_url ?? undefined} />
                        <AvatarFallback className="text-[10px]">
                          {rater?.full_name?.[0]?.toUpperCase() ?? '?'}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <span className="text-sm font-medium">{rater?.full_name ?? 'Anonymous'}</span>
                        <div className="text-muted-foreground flex items-center gap-2 text-[11px]">
                          {sc && <span>{sc.icon} {sc.name}</span>}
                          {session && <span>— {session.title}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <RatingStars value={r.rating} size="size-3.5" />
                      <p className="text-muted-foreground text-[10px]">{date}</p>
                    </div>
                  </div>

                  {/* Sub-ratings */}
                  {(r.skill_rating || r.sportsmanship_rating) && (
                    <div className="text-muted-foreground mb-2 flex flex-wrap gap-3 text-xs">
                      {r.skill_rating && (
                        <span>Skill: <strong className="text-foreground">{r.skill_rating}</strong>/5</span>
                      )}
                      {r.sportsmanship_rating && (
                        <span>Sportsmanship: <strong className="text-foreground">{r.sportsmanship_rating}</strong>/5</span>
                      )}
                    </div>
                  )}

                  {r.comment && (
                    <div className="text-muted-foreground flex items-start gap-2 text-xs">
                      <MessageSquare className="mt-0.5 size-3 shrink-0" />
                      <span className="italic">&ldquo;{r.comment}&rdquo;</span>
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
