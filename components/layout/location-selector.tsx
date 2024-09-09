'use client';

import { useRouter } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { MapPin, ChevronDown, Check } from 'lucide-react';

interface Location {
  id: string;
  name: string;
}

interface LocationSelectorProps {
  locations: Location[];
  activeLocationId: string | null;
  onSelect: (locationId: string | null) => Promise<void>;
}

export default function LocationSelector({
  locations,
  activeLocationId,
  onSelect,
}: LocationSelectorProps) {
  const router = useRouter();

  const activeLocation = locations.find((l) => l.id === activeLocationId);

  async function handleSelect(locationId: string | null) {
    await onSelect(locationId);
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <MapPin className="size-4" />
          <span className="max-w-[160px] truncate">
            {activeLocation?.name ?? 'All Locations'}
          </span>
          <ChevronDown className="size-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuItem onClick={() => handleSelect(null)}>
          {!activeLocationId && <Check className="mr-2 size-4" />}
          <span className={!activeLocationId ? '' : 'pl-6'}>All Locations</span>
        </DropdownMenuItem>
        {locations.map((loc) => (
          <DropdownMenuItem
            key={loc.id}
            onClick={() => handleSelect(loc.id)}
          >
            {activeLocationId === loc.id && <Check className="mr-2 size-4" />}
            <span className={activeLocationId === loc.id ? '' : 'pl-6'}>
              {loc.name}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
