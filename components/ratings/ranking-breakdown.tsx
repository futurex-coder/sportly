'use client';

import { Progress } from '@/components/ui/progress';

interface CriteriaScore {
  criteriaName: string;
  avgScore: number;
  count: number;
}

interface RankingBreakdownProps {
  criteria: CriteriaScore[];
  /** Show the numeric average. Defaults to true. */
  showValue?: boolean;
  /** Show the count of ratings. Defaults to false. */
  showCount?: boolean;
}

export default function RankingBreakdown({
  criteria,
  showValue = true,
  showCount = false,
}: RankingBreakdownProps) {
  if (criteria.length === 0) return null;

  return (
    <div className="space-y-2.5">
      {criteria.map((c) => {
        const pct = (c.avgScore / 5) * 100;
        return (
          <div key={c.criteriaName} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{c.criteriaName}</span>
              <span className="font-medium">
                {showValue && c.avgScore.toFixed(1)}
                {showCount && (
                  <span className="text-muted-foreground ml-1 text-xs font-normal">
                    ({c.count})
                  </span>
                )}
              </span>
            </div>
            <Progress value={pct} className="h-2" />
          </div>
        );
      })}
    </div>
  );
}
