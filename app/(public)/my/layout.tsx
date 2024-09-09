import Link from 'next/link';
import { requireAuth } from '@/lib/auth/helpers';

const tabs = [
  { href: '/my/bookings', label: 'Bookings' },
  { href: '/my/sessions', label: 'Sessions' },
  { href: '/my/rankings', label: 'Rankings' },
  { href: '/my/profile', label: 'Profile' },
];

export default async function MyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAuth();

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <h1 className="mb-6 text-2xl font-bold">My Account</h1>
      <nav className="mb-6 flex gap-1 border-b">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className="text-muted-foreground hover:text-foreground border-b-2 border-transparent px-4 py-2 text-sm font-medium transition-colors hover:border-current"
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
