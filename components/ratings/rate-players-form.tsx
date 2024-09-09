'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { CheckCircle2, Loader2 } from 'lucide-react';
import RatingStars from './rating-stars';
import { ratePlayer } from '@/lib/actions/rating-actions';
import { toast } from 'sonner';

interface RatablePlayer {
  userId: string;
  profile: {
    id?: string;
    full_name: string | null;
    avatar_url: string | null;
    city: string | null;
  } | null;
  alreadyRated: boolean;
}

interface Criteria {
  id: string;
  name: string;
  description: string | null;
}

interface RatePlayersFormProps {
  sessionId: string;
  participants: RatablePlayer[];
  criteria: Criteria[];
}

interface PlayerRatingState {
  overall: number;
  skill: number;
  sportsmanship: number;
  criteriaScores: Record<string, number>;
  comment: string;
}

export default function RatePlayersForm({
  sessionId,
  participants,
  criteria,
}: RatePlayersFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<Set<string>>(new Set());

  const [ratings, setRatings] = useState<Record<string, PlayerRatingState>>(
    () => {
      const init: Record<string, PlayerRatingState> = {};
      participants.forEach((p) => {
        if (!p.alreadyRated) {
          init[p.userId] = {
            overall: 0,
            skill: 0,
            sportsmanship: 0,
            criteriaScores: {},
            comment: '',
          };
        }
      });
      return init;
    }
  );

  function updateRating(
    userId: string,
    field: keyof PlayerRatingState,
    value: any
  ) {
    setRatings((prev) => ({
      ...prev,
      [userId]: { ...prev[userId], [field]: value },
    }));
  }

  function updateCriteriaScore(
    userId: string,
    criteriaId: string,
    score: number
  ) {
    setRatings((prev) => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        criteriaScores: { ...prev[userId].criteriaScores, [criteriaId]: score },
      },
    }));
  }

  function handleSubmitOne(userId: string) {
    const r = ratings[userId];
    if (!r || r.overall === 0) return;
    setError(null);

    const criteriaScores = Object.entries(r.criteriaScores)
      .filter(([, score]) => score > 0)
      .map(([criteriaId, score]) => ({ criteriaId, score }));

    startTransition(async () => {
      const result = await ratePlayer({
        sessionId,
        ratedUserId: userId,
        rating: r.overall,
        skillRating: r.skill || undefined,
        sportsmanshipRating: r.sportsmanship || undefined,
        comment: r.comment || undefined,
        criteriaScores: criteriaScores.length > 0 ? criteriaScores : undefined,
      });

      if (!result.success) {
        toast.error(result.error ?? 'Failed to submit rating');
        setError(result.error ?? 'Failed to submit rating');
        return;
      }
      toast.success('Rating submitted');
      setSubmitted((prev) => new Set(prev).add(userId));
      router.refresh();
    });
  }

  const unrated = participants.filter(
    (p) => !p.alreadyRated && !submitted.has(p.userId)
  );
  const alreadyDone = participants.filter(
    (p) => p.alreadyRated || submitted.has(p.userId)
  );

  if (unrated.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-md border border-dashed py-10">
        <CheckCircle2 className="mb-3 size-8 text-emerald-500" />
        <p className="font-medium">All players rated!</p>
        <p className="text-muted-foreground text-sm">
          Thank you for your feedback.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      {unrated.map((p) => {
        const r = ratings[p.userId];
        if (!r) return null;
        const prof = p.profile;
        const canSubmit = r.overall > 0;

        return (
          <Card key={p.userId}>
            <CardContent className="space-y-4 p-4">
              {/* Player header */}
              <div className="flex items-center gap-3">
                <Avatar className="size-10">
                  <AvatarImage src={prof?.avatar_url ?? undefined} />
                  <AvatarFallback>
                    {prof?.full_name?.[0]?.toUpperCase() ?? '?'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">
                    {prof?.full_name ?? 'Unknown'}
                  </p>
                  {prof?.city && (
                    <p className="text-muted-foreground text-xs">
                      {prof.city}
                    </p>
                  )}
                </div>
              </div>

              {/* Overall rating */}
              <div>
                <Label className="mb-1 block text-sm">
                  Overall Rating <span className="text-red-500">*</span>
                </Label>
                <RatingStars
                  value={r.overall}
                  onChange={(v) => updateRating(p.userId, 'overall', v)}
                  size="size-6"
                  showValue
                />
              </div>

              {/* Quick ratings: Skill + Sportsmanship */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label className="mb-1 block text-xs">Skill</Label>
                  <RatingStars
                    value={r.skill}
                    onChange={(v) => updateRating(p.userId, 'skill', v)}
                    size="size-5"
                  />
                </div>
                <div>
                  <Label className="mb-1 block text-xs">Sportsmanship</Label>
                  <RatingStars
                    value={r.sportsmanship}
                    onChange={(v) => updateRating(p.userId, 'sportsmanship', v)}
                    size="size-5"
                  />
                </div>
              </div>

              {/* Per-criteria scores */}
              {criteria.length > 0 && (
                <>
                  <Separator />
                  <div className="grid gap-3 sm:grid-cols-2">
                    {criteria.map((c) => (
                      <div key={c.id}>
                        <Label className="mb-1 block text-xs">
                          {c.name}
                          {c.description && (
                            <span className="text-muted-foreground ml-1 font-normal">
                              — {c.description}
                            </span>
                          )}
                        </Label>
                        <RatingStars
                          value={r.criteriaScores[c.id] ?? 0}
                          onChange={(v) =>
                            updateCriteriaScore(p.userId, c.id, v)
                          }
                          size="size-4"
                        />
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Comment */}
              <div>
                <Label className="mb-1 block text-xs">
                  Comment (optional)
                </Label>
                <Textarea
                  rows={2}
                  placeholder="How was it playing with them?"
                  value={r.comment}
                  onChange={(e) =>
                    updateRating(p.userId, 'comment', e.target.value)
                  }
                />
              </div>

              {/* Submit */}
              <div className="flex justify-end">
                <Button
                  size="sm"
                  disabled={!canSubmit || isPending}
                  onClick={() => handleSubmitOne(p.userId)}
                >
                  {isPending && (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  )}
                  Submit Rating
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Already rated */}
      {alreadyDone.length > 0 && (
        <div>
          <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
            Already Rated ({alreadyDone.length})
          </p>
          <div className="space-y-2">
            {alreadyDone.map((p) => (
              <div
                key={p.userId}
                className="flex items-center gap-3 rounded-md border px-3 py-2"
              >
                <Avatar className="size-7">
                  <AvatarImage src={p.profile?.avatar_url ?? undefined} />
                  <AvatarFallback className="text-xs">
                    {p.profile?.full_name?.[0]?.toUpperCase() ?? '?'}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm">
                  {p.profile?.full_name ?? 'Unknown'}
                </span>
                <Badge
                  variant="default"
                  className="ml-auto text-[10px]"
                >
                  <CheckCircle2 className="mr-1 size-3" /> Rated
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
