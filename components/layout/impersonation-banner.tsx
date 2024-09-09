'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { AlertTriangle, X } from 'lucide-react';

interface ImpersonationBannerProps {
  clubName: string;
  onExit: () => Promise<void>;
}

export default function ImpersonationBanner({
  clubName,
  onExit,
}: ImpersonationBannerProps) {
  const router = useRouter();

  async function handleExit() {
    await onExit();
    router.refresh();
  }

  return (
    <div className="flex items-center justify-between gap-4 bg-yellow-400 px-4 py-2 text-yellow-950">
      <div className="flex items-center gap-2 text-sm font-medium">
        <AlertTriangle className="size-4" />
        <span>
          Viewing as: <strong>{clubName}</strong>
        </span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 gap-1 text-yellow-950 hover:bg-yellow-500 hover:text-yellow-950"
        onClick={handleExit}
      >
        <X className="size-3" />
        Exit Impersonation
      </Button>
    </div>
  );
}
