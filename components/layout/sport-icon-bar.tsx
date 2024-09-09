'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

interface SportCategory {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  color_primary: string | null;
}

interface SportIconBarProps {
  categories: SportCategory[];
}

export default function SportIconBar({ categories }: SportIconBarProps) {
  const pathname = usePathname();

  return (
    <div className="bg-card border-b">
      <div className="mx-auto max-w-7xl px-4">
        <div className="scrollbar-none flex gap-1 overflow-x-auto py-2">
          {categories.map((cat) => {
            const href = `/sports/${cat.slug}/clubs`;
            const isActive = pathname.includes(`/sports/${cat.slug}`);
            return (
              <Link
                key={cat.id}
                href={href}
                className={cn(
                  'flex shrink-0 flex-col items-center gap-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
                style={isActive && cat.color_primary ? { color: cat.color_primary } : undefined}
              >
                <span className="text-lg leading-none">{cat.icon ?? '🏅'}</span>
                <span className="whitespace-nowrap">{cat.name}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
