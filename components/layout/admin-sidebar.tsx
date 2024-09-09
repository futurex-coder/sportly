'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Building2, Trophy, Users, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/admin', label: 'Overview', icon: Shield },
  { href: '/admin/clubs', label: 'Clubs', icon: Building2 },
  { href: '/admin/sport-categories', label: 'Sport Categories', icon: Trophy },
  { href: '/admin/users', label: 'Users', icon: Users },
];

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <>
      <div className="flex h-14 items-center border-b px-6">
        <Link href="/admin" className="text-lg font-bold">
          Sportly <span className="text-muted-foreground text-xs font-normal">Admin</span>
        </Link>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const isActive =
            item.href === '/admin'
              ? pathname === '/admin'
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
