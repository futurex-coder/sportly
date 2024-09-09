'use client';

import { useState, useTransition, useMemo } from 'react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
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
import { Search, Trophy, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import RatingStars from '@/components/ratings/rating-stars';
import { getLeaderboard } from '@/lib/actions/rating-actions';

interface Category {
  id: string;
  name: string;
  slug: string;
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

interface Props {
  categories: Category[];
  initialCategoryId: string;
  initialEntries: LeaderboardEntry[];
  initialTotal: number;
  currentUserId: string | null;
}

const PAGE_SIZE = 20;

export default function PlayersClient({
  categories,
  initialCategoryId,
  initialEntries,
  initialTotal,
  currentUserId,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [categoryId, setCategoryId] = useState(initialCategoryId);
  const [entries, setEntries] = useState<LeaderboardEntry[]>(initialEntries);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(0);
  const [nameFilter, setNameFilter] = useState('');
  const [initialized, setInitialized] = useState(true);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function fetchPage(catId: string, p: number) {
    startTransition(async () => {
      const result = await getLeaderboard(catId, {
        limit: PAGE_SIZE,
        offset: p * PAGE_SIZE,
      });
      setEntries(result.entries as any);
      setTotal(result.total);
    });
  }

  function handleCategoryChange(id: string) {
    setCategoryId(id);
    setPage(0);
    setInitialized(false);
    fetchPage(id, 0);
  }

  function handlePageChange(p: number) {
    setPage(p);
    fetchPage(categoryId, p);
  }

  // Client-side name filtering on current page
  const filtered = useMemo(() => {
    if (!nameFilter) return entries;
    const q = nameFilter.toLowerCase();
    return entries.filter((e) =>
      e.profiles?.full_name?.toLowerCase().includes(q) ||
      e.profiles?.city?.toLowerCase().includes(q)
    );
  }, [entries, nameFilter]);

  const selectedCategory = categories.find((c) => c.id === categoryId);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
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
        <div className="relative min-w-[180px] flex-1">
          <Search className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
          <Input
            placeholder="Search by name or city..."
            value={nameFilter}
            onChange={(e) => setNameFilter(e.target.value)}
            className="pl-9"
          />
        </div>
        {isPending && <Loader2 className="text-muted-foreground size-4 animate-spin" />}
        <span className="text-muted-foreground text-xs">
          {total.toLocaleString()} player{total !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      {filtered.length === 0 && !isPending ? (
        <EmptyState
          icon={Trophy}
          title="No ranked players"
          description={
            nameFilter
              ? 'No players match your search.'
              : `No ranked players for ${selectedCategory?.name ?? 'this sport'} yet. Play a session to start building your ranking!`
          }
          actionLabel={nameFilter ? undefined : 'Browse Sessions'}
          actionHref={nameFilter ? undefined : '/sessions'}
        />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16 text-center">#</TableHead>
                <TableHead>Player</TableHead>
                <TableHead className="hidden sm:table-cell">City</TableHead>
                <TableHead className="text-center">Rating</TableHead>
                <TableHead className="hidden text-center md:table-cell">Ratings</TableHead>
                <TableHead className="hidden text-center md:table-cell">Sessions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((e) => {
                const prof = e.profiles;
                const isMe = e.user_id === currentUserId;
                return (
                  <TableRow key={e.user_id} className={isMe ? 'bg-primary/5' : undefined}>
                    <TableCell className="text-center">
                      {e.rank <= 3 ? (
                        <Badge variant={e.rank === 1 ? 'default' : 'secondary'} className="text-xs">
                          {e.rank === 1 ? '🥇' : e.rank === 2 ? '🥈' : '🥉'}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">{e.rank}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Link href={`/players/${e.user_id}`} className="flex items-center gap-2 hover:underline">
                        <Avatar className="size-7">
                          <AvatarImage src={prof?.avatar_url ?? undefined} />
                          <AvatarFallback className="text-[10px]">
                            {prof?.full_name?.[0]?.toUpperCase() ?? '?'}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium">
                          {prof?.full_name ?? 'Unknown'}
                          {isMe && (
                            <Badge variant="outline" className="ml-2 text-[10px]">You</Badge>
                          )}
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden text-sm sm:table-cell">
                      {prof?.city ?? '—'}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <RatingStars value={Number(e.rating)} size="size-3.5" />
                        <span className="ml-1 text-sm font-semibold">{Number(e.rating).toFixed(1)}</span>
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
          <Button variant="outline" size="sm" disabled={page === 0 || isPending} onClick={() => handlePageChange(page - 1)}>
            <ChevronLeft className="mr-1 size-4" /> Previous
          </Button>
          <span className="text-muted-foreground text-sm">Page {page + 1} of {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages - 1 || isPending} onClick={() => handlePageChange(page + 1)}>
            Next <ChevronRight className="ml-1 size-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
