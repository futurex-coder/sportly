'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';

interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
}

export default function HeroSearch({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const [city, setCity] = useState('');
  const [sport, setSport] = useState('');

  function handleSearch() {
    const slug = sport || 'football';
    const params = new URLSearchParams();
    if (city.trim()) params.set('city', city.trim());
    const qs = params.toString();
    router.push(`/sports/${slug}/clubs${qs ? `?${qs}` : ''}`);
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl bg-white/10 p-4 backdrop-blur-sm sm:flex-row sm:items-end">
      <div className="flex-1 space-y-1">
        <label className="text-xs font-medium text-emerald-100">City</label>
        <Input
          placeholder="e.g. Sofia, Plovdiv..."
          value={city}
          onChange={(e) => setCity(e.target.value)}
          className="border-white/20 bg-white/10 text-white placeholder:text-emerald-200"
        />
      </div>
      <div className="w-full space-y-1 sm:w-48">
        <label className="text-xs font-medium text-emerald-100">Sport</label>
        <Select value={sport} onValueChange={setSport}>
          <SelectTrigger className="border-white/20 bg-white/10 text-white">
            <SelectValue placeholder="All sports" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.slug}>
                {c.icon} {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button
        onClick={handleSearch}
        size="lg"
        className="bg-white text-emerald-700 hover:bg-emerald-50"
      >
        <Search className="mr-2 size-4" />
        Search
      </Button>
    </div>
  );
}
