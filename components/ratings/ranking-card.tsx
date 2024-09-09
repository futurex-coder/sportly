'use client';

import { Hash } from 'lucide-react';
import RatingStars from './rating-stars';
import RankingBreakdown from './ranking-breakdown';

export interface RankingCardData {
  sportCategory: {
    id?: string;
    name: string;
    icon: string | null;
    slug?: string;
    color_primary?: string | null;
  };
  rating: number;
  totalRatingsReceived: number;
  totalSessionsPlayed: number;
  position?: { rank: number; total: number };
  criteriaBreakdown?: { criteriaName: string; avgScore: number; count: number }[];
}

interface RankingCardProps {
  data: RankingCardData;
}

export default function RankingCard({ data }: RankingCardProps) {
  const {
    sportCategory: sc,
    rating,
    totalRatingsReceived,
    totalSessionsPlayed,
    position,
    criteriaBreakdown,
  } = data;

  return (
    <div className="rounded-xl border p-5">
      {/* Header */}
      <div className="mb-3 flex items-center gap-3">
        <span className="text-3xl">{sc.icon ?? '🏅'}</span>
        <div>
          <h3 className="text-lg font-bold">{sc.name}</h3>
          <div className="flex items-center gap-1">
            <RatingStars value={rating} showValue showMax />
          </div>
        </div>
      </div>

      {/* Stats */}
      <p className="text-muted-foreground mb-3 text-sm">
        Based on {totalRatingsReceived} rating{totalRatingsReceived !== 1 ? 's' : ''} from{' '}
        {totalSessionsPlayed} session{totalSessionsPlayed !== 1 ? 's' : ''}
      </p>

      {/* Criteria breakdown */}
      {criteriaBreakdown && criteriaBreakdown.length > 0 && (
        <div className="mb-3">
          <RankingBreakdown criteria={criteriaBreakdown} />
        </div>
      )}

      {/* Leaderboard position */}
      {position && (
        <div className="text-muted-foreground flex items-center gap-1 text-sm">
          <Hash className="size-4" />
          You&apos;re{' '}
          <strong className="text-foreground">#{position.rank}</strong> out of{' '}
          {position.total.toLocaleString()} {sc.name} players
        </div>
      )}
    </div>
  );
}
