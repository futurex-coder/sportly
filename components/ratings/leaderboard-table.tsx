'use client';

import { useState, useTransition, useEffect } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Trophy, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import RatingStars from './rating-stars';
import { getLeaderboard } from '@/lib/actions/rating-actions';

interface Category {
  id: string;
  name: string;
  icon: string | null;
}

interface LeaderboardEntry {
  rank: number;
  user_id: string;
  rating: number;
  total_ratings_received: number;
  total_sessions_played: number;
  profiles: {
    id?: string;
    full_name: string | null;
    avatar_url: string | null;
    city: string | null;
  };
}

interface LeaderboardTableProps {
  /** Available sport categories for the filter. */
  categories: Category[];
  /** Pre-selected sport category ID. */
  initialCategoryId?: string;
  /** Pre-loaded entries to avoid an initial fetch. */
  initialEntries?: LeaderboardEntry[];
  initialTotal?: number;
  /** Highlight this user in the table. */
  currentUserId?: string | null;
  /** Rows per page. */
  pageSize?: number;
}

export default function LeaderboardTable({
  categories,
  initialCategoryId,
  initialEntries,
  initialTotal,
  currentUserId,
  pageSize = 20,
}: LeaderboardTableProps) {
  const [isPending, startTransition] = useTransition();
  const [categoryId, setCategoryId] = useState(
    initialCategoryId ?? categories[0]?.id ?? ''
  );
  const [entries, setEntries] = useState<LeaderboardEntry[]>(
    initialEntries ?? []
  );
  const [total, setTotal] = useState(initialTotal ?? 0);
  const [page, setPage] = useState(0);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function fetchPage(catId: string, p: number) {
    startTransition(async () => {
      const result = await getLeaderboard(catId, {
        limit: pageSize,
        offset: p * pageSize,
      });
      setEntries(result.entries as any);
      setTotal(result.total);
    });
  }

  // Refetch on category change
  useEffect(() => {
    if (!categoryId) return;
    // Skip initial if we have pre-loaded data for the same category
    if (
      initialEntries &&
      initialCategoryId === categoryId &&
      page === 0
    ) {
      return;
    }
    fetchPage(categoryId, page);
  }, [categoryId, page]);

  function handleCategoryChange(id: string) {
    setCategoryId(id);
    setPage(0);
  }

  const selectedCategory = categories.find((c) => c.id === categoryId);

  return (
    <div className="space-y-4">
      {/* Sport filter */}
      <div className="flex items-center gap-3">
        <Select value={categoryId} onValueChange={handleCategoryChange}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.icon} {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isPending && <Loader2 className="text-muted-foreground size-4 animate-spin" />}
        <span className="text-muted-foreground ml-auto text-xs">
          {total.toLocaleString()} player{total !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      {entries.length === 0 && !isPending ? (
        <div className="flex flex-col items-center rounded-md border border-dashed py-12">
          <Trophy className="text-muted-foreground mb-3 size-8" />
          <p className="text-muted-foreground text-sm">
            No ranked players for {selectedCategory?.name ?? 'this sport'} yet.
          </p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16 text-center">#</TableHead>
                <TableHead>Player</TableHead>
                <TableHead className="hidden sm:table-cell">City</TableHead>
                <TableHead className="text-center">Rating</TableHead>
                <TableHead className="hidden text-center md:table-cell">
                  Ratings
                </TableHead>
                <TableHead className="hidden text-center md:table-cell">
                  Sessions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((e) => {
                const prof = e.profiles;
                const isMe = e.user_id === currentUserId;
                return (
                  <TableRow
                    key={e.user_id}
                    className={isMe ? 'bg-primary/5' : undefined}
                  >
                    <TableCell className="text-center">
                      {e.rank <= 3 ? (
                        <Badge
                          variant={e.rank === 1 ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {e.rank === 1 ? '🥇' : e.rank === 2 ? '🥈' : '🥉'}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">
                          {e.rank}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="size-7">
                          <AvatarImage
                            src={prof?.avatar_url ?? undefined}
                          />
                          <AvatarFallback className="text-[10px]">
                            {prof?.full_name?.[0]?.toUpperCase() ?? '?'}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium">
                          {prof?.full_name ?? 'Unknown'}
                          {isMe && (
                            <Badge
                              variant="outline"
                              className="ml-2 text-[10px]"
                            >
                              You
                            </Badge>
                          )}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden text-sm sm:table-cell">
                      {prof?.city ?? '—'}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <RatingStars value={Number(e.rating)} size="size-3.5" />
                        <span className="ml-1 text-sm font-semibold">
                          {Number(e.rating).toFixed(1)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden text-center text-sm md:table-cell">
                      {e.total_ratings_received}
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden text-center text-sm md:table-cell">
                      {e.total_sessions_played}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0 || isPending}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft className="mr-1 size-4" /> Previous
          </Button>
          <span className="text-muted-foreground text-sm">
            Page {page + 1} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages - 1 || isPending}
            onClick={() => setPage((p) => p + 1)}
          >
            Next <ChevronRight className="ml-1 size-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
