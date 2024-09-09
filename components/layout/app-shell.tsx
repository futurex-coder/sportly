'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from '@/components/ui/sheet';
import { Menu } from 'lucide-react';

interface AppShellProps {
  sidebar: React.ReactNode;
  topBar?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export default function AppShell({
  sidebar,
  topBar,
  children,
  className,
}: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="bg-card hidden w-64 shrink-0 border-r md:block">
        <div className="flex h-full flex-col">{sidebar}</div>
      </aside>

      {/* Mobile sidebar drawer */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="flex h-full flex-col" onClick={() => setSidebarOpen(false)}>
            {sidebar}
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="bg-card flex h-14 shrink-0 items-center gap-4 border-b px-4 md:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="size-5" />
            <span className="sr-only">Open menu</span>
          </Button>
          {topBar}
        </header>
        <main className={cn('flex-1 overflow-y-auto p-4 md:p-6', className)}>
          {children}
        </main>
      </div>
    </div>
  );
}
