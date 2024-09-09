'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Share2, Copy, Check } from 'lucide-react';
import { inviteToSession } from '@/lib/actions/session-actions';
import { toast } from 'sonner';

export interface InviteData {
  id: string;
  invited_user_id: string | null;
  invited_email: string | null;
  invite_code: string | null;
  status: string;
  expires_at: string | null;
}

interface InviteModalProps {
  sessionId: string;
  /** Pre-fetched invite records to display history. */
  invites?: InviteData[];
  /** Disables the trigger button (e.g. session cancelled). */
  disabled?: boolean;
}

export default function InviteModal({
  sessionId,
  invites = [],
  disabled,
}: InviteModalProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleSendEmail() {
    if (!email.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await inviteToSession(sessionId, { emails: [email.trim()] });
      if (!result.success) {
        toast.error(result.error ?? 'Failed to send invite');
        setError(result.error ?? 'Failed to send invite');
        return;
      }
      toast.success('Invite sent');
      setEmail('');
      router.refresh();
    });
  }

  function handleGenerateLink() {
    setError(null);
    startTransition(async () => {
      const result = await inviteToSession(sessionId, { generateLink: true });
      if (!result.success) {
        toast.error(result.error ?? 'Failed to generate link');
        setError(result.error ?? 'Failed to generate link');
        return;
      }
      if (result.data?.inviteCode) {
        const link = `${window.location.origin}/sessions/${sessionId}?invite=${result.data.inviteCode}`;
        setShareLink(link);
        toast.success('Invite link generated');
        router.refresh();
      }
    });
  }

  function copyLink() {
    if (!shareLink) return;
    navigator.clipboard.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={disabled}>
          <Share2 className="mr-2 size-4" /> Invite
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite Players</DialogTitle>
        </DialogHeader>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="space-y-4">
          {/* Email invite */}
          <div>
            <label className="mb-1 block text-sm font-medium">Invite by email</label>
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="player@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendEmail()}
              />
              <Button onClick={handleSendEmail} disabled={isPending || !email.trim()}>
                Send
              </Button>
            </div>
          </div>

          <Separator />

          {/* Shareable link */}
          <div>
            <label className="mb-1 block text-sm font-medium">Shareable link</label>
            {shareLink ? (
              <div className="flex gap-2">
                <Input value={shareLink} readOnly className="text-xs" />
                <Button variant="outline" size="icon" onClick={copyLink}>
                  {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                </Button>
              </div>
            ) : (
              <Button variant="outline" onClick={handleGenerateLink} disabled={isPending}>
                Generate invite link
              </Button>
            )}
          </div>

          {/* Invite history */}
          {invites.length > 0 && (
            <>
              <Separator />
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Sent Invites ({invites.length})
                </label>
                <div className="max-h-40 space-y-1.5 overflow-y-auto">
                  {invites.map((inv) => (
                    <div
                      key={inv.id}
                      className="flex items-center justify-between rounded-md border px-3 py-1.5 text-sm"
                    >
                      <span className="truncate">
                        {inv.invited_email
                          ? inv.invited_email
                          : inv.invite_code
                            ? 'Link invite'
                            : 'User invite'}
                      </span>
                      <Badge
                        variant={inv.status === 'accepted' ? 'default' : 'secondary'}
                        className="ml-2 shrink-0 text-[10px]"
                      >
                        {inv.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
