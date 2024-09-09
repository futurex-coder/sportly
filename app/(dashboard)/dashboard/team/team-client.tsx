'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  inviteTeamMember,
  changeTeamMemberRole,
  removeTeamMember,
  toggleTeamMemberActive,
} from '@/lib/actions/team-actions';
import { UserPlus, Loader2, Trash2, Users, X } from 'lucide-react';
import { toast } from 'sonner';

// ─── Types ──────────────────────────────────────────

type ClubRole = 'club_admin' | 'staff' | 'trainer';

interface Member {
  id: string;
  user_id: string;
  role: string;
  is_active: boolean | null;
  created_at: string;
  profiles: {
    id: string;
    full_name: string | null;
    email: string;
    avatar_url: string | null;
    phone: string | null;
  } | null;
}

interface Props {
  members: Member[];
  clubName: string;
  currentUserId: string;
}

const ROLE_OPTIONS: { value: ClubRole; label: string }[] = [
  { value: 'club_admin', label: 'Admin' },
  { value: 'staff', label: 'Staff' },
  { value: 'trainer', label: 'Trainer' },
];

const ROLE_COLORS: Record<string, string> = {
  club_admin: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  staff: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  trainer: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
};

// ─── Component ──────────────────────────────────────

export default function TeamClient({ members, clubName, currentUserId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Invite modal
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invEmail, setInvEmail] = useState('');
  const [invRole, setInvRole] = useState<ClubRole>('staff');

  function showMsg(msg: string, isError: boolean) {
    if (isError) { setError(msg); setSuccess(null); }
    else { setSuccess(msg); setError(null); }
    setTimeout(() => { setError(null); setSuccess(null); }, 4000);
  }

  function handleInvite() {
    if (!invEmail.trim()) return;
    startTransition(async () => {
      const result = await inviteTeamMember(invEmail.trim(), invRole);
      if (!result.success) {
        toast.error(result.error ?? 'Failed to invite member');
        showMsg(result.error ?? 'Failed to invite member', true);
      } else {
        toast.success(`Invited ${invEmail} as ${invRole.replace('_', ' ')}.`);
        showMsg(`Invited ${invEmail} as ${invRole.replace('_', ' ')}.`, false);
        setInviteOpen(false);
        setInvEmail('');
        setInvRole('staff');
        router.refresh();
      }
    });
  }

  function handleRoleChange(memberId: string, role: ClubRole) {
    startTransition(async () => {
      const result = await changeTeamMemberRole(memberId, role);
      if (!result.success) {
        toast.error(result.error ?? 'Failed to change role');
        showMsg(result.error ?? 'Failed to change role', true);
      } else {
        toast.success('Role updated.');
        router.refresh();
      }
    });
  }

  function handleToggleActive(memberId: string, isActive: boolean) {
    startTransition(async () => {
      const result = await toggleTeamMemberActive(memberId, isActive);
      if (!result.success) {
        toast.error(result.error ?? 'Failed to update status');
        showMsg(result.error ?? 'Failed to update status', true);
      } else {
        toast.success(isActive ? 'Member activated.' : 'Member deactivated.');
        router.refresh();
      }
    });
  }

  function handleRemove(member: Member) {
    const name = member.profiles?.full_name ?? member.profiles?.email ?? 'this member';
    if (!confirm(`Remove ${name} from the team? This cannot be undone.`)) return;
    startTransition(async () => {
      const result = await removeTeamMember(member.id);
      if (!result.success) {
        toast.error(result.error ?? 'Failed to remove member');
        showMsg(result.error ?? 'Failed to remove member', true);
      } else {
        toast.success('Member removed.');
        showMsg('Member removed.', false);
        router.refresh();
      }
    });
  }

  function initials(name: string | null | undefined): string {
    if (!name) return '?';
    return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
  }

  const activeCount = members.filter((m) => m.is_active).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Team</h1>
          <p className="text-muted-foreground text-sm">
            {activeCount} active member{activeCount !== 1 ? 's' : ''} at {clubName}
          </p>
        </div>
        <Button onClick={() => setInviteOpen(true)}>
          <UserPlus className="mr-2 size-4" />
          Invite Member
        </Button>
      </div>

      {/* Messages */}
      {(error || success) && (
        <div
          className={`flex items-center justify-between rounded-md p-3 text-sm ${
            error
              ? 'bg-destructive/10 text-destructive'
              : 'bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-400'
          }`}
        >
          {error ?? success}
          <button onClick={() => { setError(null); setSuccess(null); }}>
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Table */}
      {members.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-md border border-dashed py-16">
          <Users className="text-muted-foreground mb-4 size-10" />
          <h3 className="mb-1 text-lg font-semibold">No team members yet</h3>
          <p className="text-muted-foreground mb-4 text-sm">
            Invite your first team member to get started.
          </p>
          <Button onClick={() => setInviteOpen(true)}>
            <UserPlus className="mr-2 size-4" />
            Invite Member
          </Button>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="w-[60px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => {
                const p = m.profiles;
                const isSelf = m.user_id === currentUserId;
                return (
                  <TableRow key={m.id} className={!m.is_active ? 'opacity-60' : ''}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-9">
                          <AvatarImage src={p?.avatar_url ?? undefined} />
                          <AvatarFallback className="text-xs">
                            {initials(p?.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center gap-2 font-medium">
                            {p?.full_name ?? 'Unknown'}
                            {isSelf && (
                              <span className="text-muted-foreground text-xs">(you)</span>
                            )}
                          </div>
                          <div className="text-muted-foreground text-xs">{p?.email}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {isSelf ? (
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_COLORS[m.role] ?? ''}`}
                        >
                          {m.role.replace('_', ' ')}
                        </span>
                      ) : (
                        <Select
                          value={m.role}
                          onValueChange={(v) => handleRoleChange(m.id, v as ClubRole)}
                          disabled={isPending}
                        >
                          <SelectTrigger className="h-8 w-[120px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ROLE_OPTIONS.map((r) => (
                              <SelectItem key={r.value} value={r.value}>
                                {r.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                    <TableCell>
                      {isSelf ? (
                        <Badge variant="default">Active</Badge>
                      ) : (
                        <button
                          onClick={() => handleToggleActive(m.id, !m.is_active)}
                          disabled={isPending}
                        >
                          <Badge variant={m.is_active ? 'default' : 'secondary'} className="cursor-pointer">
                            {m.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </button>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(m.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {!isSelf && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive size-8"
                          onClick={() => handleRemove(m)}
                          disabled={isPending}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* ── Invite Modal ── */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Email address</Label>
              <Input
                type="email"
                placeholder="member@example.com"
                value={invEmail}
                onChange={(e) => setInvEmail(e.target.value)}
              />
              <p className="text-muted-foreground text-xs">
                The user must already have a Sportly account.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={invRole} onValueChange={(v) => setInvRole(v as ClubRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setInviteOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleInvite} disabled={!invEmail.trim() || isPending}>
              {isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <UserPlus className="mr-2 size-4" />}
              Invite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
