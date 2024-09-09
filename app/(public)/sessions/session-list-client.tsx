'use client';

import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Users, X, Plus } from 'lucide-react';
import Link from 'next/link';
import { EmptyState } from '@/components/ui/empty-state';
import SessionCard, { type SessionCardData } from '@/components/sessions/session-card';

interface Props {
  sessions: SessionCardData[];
  categories: { id: string; name: string; slug: string; icon: string | null }[];
  cities: string[];
  currentUserId: string | null;
}

export default function SessionListClient({ sessions, categories, cities, currentUserId }: Props) {
  const [search, setSearch] = useState('');
  const [sportFilter, setSportFilter] = useState('all');
  const [cityFilter, setCityFilter] = useState('all');

  const filtered = useMemo(() => {
    return sessions.filter((s) => {
      if (sportFilter !== 'all' && s.sport_categories?.id !== sportFilter) return false;
      const loc = (s.fields as any)?.locations;
      if (cityFilter !== 'all' && loc?.city !== cityFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !s.title.toLowerCase().includes(q) &&
          !(s.fields as any)?.name?.toLowerCase().includes(q) &&
          !loc?.clubs?.name?.toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [sessions, sportFilter, cityFilter, search]);

  const hasFilters = search || sportFilter !== 'all' || cityFilter !== 'all';

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="relative min-w-[180px] flex-1">
          <Search className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
          <Input
            placeholder="Search sessions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={sportFilter} onValueChange={setSportFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sports</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={cityFilter} onValueChange={setCityFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All cities</SelectItem>
            {cities.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setSportFilter('all'); setCityFilter('all'); }}>
            <X className="mr-1 size-4" /> Clear
          </Button>
        )}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No sessions found"
          description={hasFilters ? 'Try adjusting your filters.' : 'No public sessions yet. Create one!'}
          actionLabel={hasFilters ? undefined : 'Create a Session'}
          actionHref={hasFilters ? undefined : '/sessions/new'}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((s) => (
            <SessionCard key={s.id} session={s} variant="browse" />
          ))}
        </div>
      )}
    </div>
  );
}
