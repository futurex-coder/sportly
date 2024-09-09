'use client';

import { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Building2, ChevronDown, Search } from 'lucide-react';

interface Club {
  id: string;
  name: string;
  slug: string;
}

interface ClubSelectorProps {
  clubs: Club[];
  onSelect: (clubId: string) => Promise<void>;
}

export default function ClubSelector({ clubs, onSelect }: ClubSelectorProps) {
  const [search, setSearch] = useState('');

  const filtered = clubs.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Building2 className="size-4" />
          Impersonate Club
          <ChevronDown className="size-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <div className="p-2">
          <div className="relative">
            <Search className="text-muted-foreground absolute left-2.5 top-2.5 size-4" />
            <Input
              placeholder="Search clubs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 pl-8"
            />
          </div>
        </div>
        <div className="max-h-64 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="text-muted-foreground px-2 py-4 text-center text-sm">
              No clubs found.
            </p>
          ) : (
            filtered.map((club) => (
              <DropdownMenuItem
                key={club.id}
                onClick={() => onSelect(club.id)}
              >
                <Building2 className="mr-2 size-4 opacity-50" />
                <div className="flex flex-col">
                  <span>{club.name}</span>
                  <span className="text-muted-foreground text-xs">/{club.slug}</span>
                </div>
              </DropdownMenuItem>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
