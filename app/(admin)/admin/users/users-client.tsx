'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { updateUserRole } from '@/lib/actions/admin-actions';
import { toast } from 'sonner';
import {
  Search,
  ChevronDown,
  Shield,
  Building2,
  Briefcase,
  Dumbbell,
  User as UserIcon,
  X,
  Loader2,
  Users,
} from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';

const ROLES = [
  { value: 'super_admin', label: 'Super Admin', icon: Shield },
  { value: 'club_admin', label: 'Club Admin', icon: Building2 },
  { value: 'staff', label: 'Staff', icon: Briefcase },
  { value: 'trainer', label: 'Trainer', icon: Dumbbell },
  { value: 'client', label: 'Client', icon: UserIcon },
] as const;

type RoleValue = (typeof ROLES)[number]['value'];

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  city: string | null;
  role: string;
  is_active: boolean | null;
  created_at: string;
}

interface ClubMembership {
  clubName: string;
  role: string;
}

interface Props {
  initialUsers: UserProfile[];
  memberships: Record<string, ClubMembership[]>;
}

function getRoleConfig(role: string) {
  return ROLES.find((r) => r.value === role) ?? ROLES[4];
}

function roleBadgeClass(role: string): string {
  switch (role) {
    case 'super_admin':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
    case 'club_admin':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
    case 'staff':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
    case 'trainer':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
  }
}

export default function UsersClient({ initialUsers, memberships }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleValue | 'all'>('all');
  const [error, setError] = useState<string | null>(null);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  const filtered = initialUsers.filter((u) => {
    const matchesSearch =
      !search ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.full_name?.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  async function handleRoleChange(userId: string, newRole: RoleValue) {
    setError(null);
    setPendingUserId(userId);
    startTransition(async () => {
      const result = await updateUserRole(userId, newRole);
      setPendingUserId(null);
      if (!result.success) {
        toast.error(result.error ?? 'Failed to update role');
        setError(result.error ?? 'Failed to update role');
        return;
      }
      toast.success('Role updated');
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-destructive/10 text-destructive flex items-center justify-between rounded-md p-3 text-sm">
          {error}
          <button onClick={() => setError(null)}>
            <X className="size-4" />
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
          <Input
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              {roleFilter === 'all' ? 'All Roles' : getRoleConfig(roleFilter).label}
              <ChevronDown className="size-3 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setRoleFilter('all')}>
              All Roles
            </DropdownMenuItem>
            {ROLES.map((r) => (
              <DropdownMenuItem key={r.value} onClick={() => setRoleFilter(r.value)}>
                <r.icon className="mr-2 size-4" />
                {r.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <span className="text-muted-foreground text-sm">
          {filtered.length} user{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>City</TableHead>
              <TableHead className="w-40">Role</TableHead>
              <TableHead className="w-32">Clubs</TableHead>
              <TableHead className="w-28">Joined</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((user) => {
              const userMemberships = memberships[user.id] ?? [];
              const roleConfig = getRoleConfig(user.role);
              return (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">
                    {user.full_name || <span className="text-muted-foreground italic">No name</span>}
                  </TableCell>

                  <TableCell>
                    <span className="text-muted-foreground text-sm">{user.email}</span>
                  </TableCell>

                  <TableCell>
                    <span className="text-muted-foreground text-sm">{user.city || '—'}</span>
                  </TableCell>

                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${roleBadgeClass(user.role)}`}
                          disabled={isPending && pendingUserId === user.id}
                        >
                          {isPending && pendingUserId === user.id ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            <roleConfig.icon className="size-3" />
                          )}
                          {roleConfig.label}
                          <ChevronDown className="size-3 opacity-50" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        {ROLES.map((r) => (
                          <DropdownMenuItem
                            key={r.value}
                            onClick={() => handleRoleChange(user.id, r.value)}
                            disabled={user.role === r.value}
                          >
                            <r.icon className="mr-2 size-4" />
                            {r.label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>

                  <TableCell>
                    {userMemberships.length === 0 ? (
                      <span className="text-muted-foreground text-xs">None</span>
                    ) : (
                      <button
                        className="text-primary text-xs underline-offset-2 hover:underline"
                        onClick={() =>
                          setExpandedUser(expandedUser === user.id ? null : user.id)
                        }
                      >
                        {userMemberships.length} club{userMemberships.length !== 1 ? 's' : ''}
                      </button>
                    )}
                    {expandedUser === user.id && userMemberships.length > 0 && (
                      <div className="mt-1 space-y-0.5">
                        {userMemberships.map((m, i) => (
                          <div key={i} className="text-muted-foreground text-xs">
                            {m.clubName}{' '}
                            <span className={`rounded px-1 py-0.5 text-[10px] ${roleBadgeClass(m.role)}`}>
                              {m.role}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </TableCell>

                  <TableCell>
                    <span className="text-muted-foreground text-xs">
                      {new Date(user.created_at).toLocaleDateString()}
                    </span>
                  </TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-0">
                  <EmptyState
                    icon={Users}
                    title={search || roleFilter !== 'all' ? 'No users match your filters' : 'No users yet'}
                    description={search || roleFilter !== 'all' ? 'Try adjusting your search or role filter.' : 'Users will appear here once they sign up.'}
                  />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
