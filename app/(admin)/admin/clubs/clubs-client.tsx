'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  createClub,
  updateClub,
  toggleClubActive,
  deleteClub,
  inviteClubAdmin,
} from '@/lib/actions/admin-actions';
import { impersonateClub } from '@/lib/actions/impersonation-actions';
import { toast } from 'sonner';
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Save,
  X,
  Eye,
  MapPin,
  Users,
  UserPlus,
  Building2,
} from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';

interface Club {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  email: string | null;
  phone: string | null;
  logo_url: string | null;
  is_active: boolean | null;
  created_at: string;
}

interface Props {
  initialClubs: Club[];
  locationCounts: Record<string, number>;
  memberCounts: Record<string, number>;
}

export default function ClubsClient({
  initialClubs,
  locationCounts,
  memberCounts,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [addOpen, setAddOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Club>>({});
  const [error, setError] = useState<string | null>(null);
  const [successClubId, setSuccessClubId] = useState<string | null>(null);

  function startEditing(club: Club) {
    setEditingId(club.id);
    setEditForm({
      name: club.name,
      slug: club.slug,
      email: club.email,
      phone: club.phone,
      description: club.description,
    });
  }

  async function handleCreate(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createClub(formData);
      if (!result.success) {
        toast.error(result.error ?? 'Failed to create club');
        setError(result.error ?? 'Failed to create club');
        return;
      }
      toast.success('Club created');
      setAddOpen(false);
      setSuccessClubId(result.data?.clubId ?? null);
      setInviteOpen(result.data?.clubId ?? null);
      router.refresh();
    });
  }

  async function handleSaveEdit(id: string) {
    setError(null);
    const fd = new FormData();
    if (editForm.name) fd.set('name', editForm.name);
    if (editForm.slug) fd.set('slug', editForm.slug);
    if (editForm.email !== undefined) fd.set('email', editForm.email ?? '');
    if (editForm.phone !== undefined) fd.set('phone', editForm.phone ?? '');
    if (editForm.description !== undefined) fd.set('description', editForm.description ?? '');

    startTransition(async () => {
      const result = await updateClub(id, fd);
      if (!result.success) {
        toast.error(result.error ?? 'Failed to update club');
        setError(result.error ?? 'Failed to update club');
        return;
      }
      toast.success('Club updated');
      setEditingId(null);
      setEditForm({});
      router.refresh();
    });
  }

  async function handleToggle(id: string, isActive: boolean) {
    startTransition(async () => {
      await toggleClubActive(id, isActive);
      router.refresh();
    });
  }

  async function handleDelete(id: string) {
    const locCount = locationCounts[id] ?? 0;
    if (locCount > 0) {
      setError(`Cannot delete: club has ${locCount} location(s). Remove them first.`);
      return;
    }
    if (!confirm('Are you sure you want to delete this club?')) return;

    setError(null);
    startTransition(async () => {
      const result = await deleteClub(id);
      if (!result.success) {
        toast.error(result.error ?? 'Failed to delete club');
        setError(result.error ?? 'Failed to delete club');
        return;
      }
      toast.success('Club deleted');
      router.refresh();
    });
  }

  async function handleImpersonate(clubId: string) {
    startTransition(async () => {
      await impersonateClub(clubId);
    });
  }

  async function handleInvite() {
    if (!inviteOpen || !inviteEmail.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await inviteClubAdmin(inviteOpen, inviteEmail.trim());
      if (!result.success) {
        toast.error(result.error ?? 'Failed to invite admin');
        setError(result.error ?? 'Failed to invite admin');
        return;
      }
      toast.success('Admin invited');
      setInviteOpen(null);
      setInviteEmail('');
      setSuccessClubId(null);
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

      <div className="flex justify-end">
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-2 size-4" />
              Create Club
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Club</DialogTitle>
            </DialogHeader>
            <form action={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="club-name">Name</Label>
                  <Input id="club-name" name="name" required placeholder="e.g. Sofia Sports Center" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="club-slug">Slug</Label>
                  <Input id="club-slug" name="slug" placeholder="auto-generated" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="club-email">Email</Label>
                  <Input id="club-email" name="email" type="email" placeholder="contact@club.com" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="club-phone">Phone</Label>
                  <Input id="club-phone" name="phone" placeholder="+359..." />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="club-desc">Description</Label>
                <Input id="club-desc" name="description" placeholder="Optional description" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="club-logo">Logo URL</Label>
                <Input id="club-logo" name="logoUrl" placeholder="https://..." />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                  Create
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Invite club admin dialog */}
      <Dialog open={inviteOpen !== null} onOpenChange={(open) => { if (!open) { setInviteOpen(null); setInviteEmail(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {successClubId ? 'Club Created! Invite an Admin' : 'Invite Club Admin'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {successClubId && (
              <p className="text-muted-foreground text-sm">
                The club was created successfully. You can now invite the first club admin.
              </p>
            )}
            <div className="space-y-2">
              <Label htmlFor="invite-email">Admin Email</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="admin@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
              <p className="text-muted-foreground text-xs">
                The user must already have a Sportly account.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setInviteOpen(null); setInviteEmail(''); setSuccessClubId(null); }}
            >
              {successClubId ? 'Skip for now' : 'Cancel'}
            </Button>
            <Button onClick={handleInvite} disabled={isPending || !inviteEmail.trim()}>
              {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              <UserPlus className="mr-2 size-4" />
              Invite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead className="w-24">
                <div className="flex items-center gap-1">
                  <MapPin className="size-3" /> Locations
                </div>
              </TableHead>
              <TableHead className="w-24">
                <div className="flex items-center gap-1">
                  <Users className="size-3" /> Members
                </div>
              </TableHead>
              <TableHead className="w-20">Active</TableHead>
              <TableHead className="w-40 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {initialClubs.map((club) => (
              <TableRow key={club.id}>
                <TableCell>
                  {editingId === club.id ? (
                    <Input
                      className="h-8"
                      value={editForm.name ?? ''}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    />
                  ) : (
                    <span className="font-medium">{club.name}</span>
                  )}
                </TableCell>

                <TableCell>
                  {editingId === club.id ? (
                    <Input
                      className="h-8"
                      value={editForm.slug ?? ''}
                      onChange={(e) => setEditForm({ ...editForm, slug: e.target.value })}
                    />
                  ) : (
                    <code className="text-muted-foreground text-xs">{club.slug}</code>
                  )}
                </TableCell>

                <TableCell>
                  {editingId === club.id ? (
                    <div className="space-y-1">
                      <Input
                        className="h-8"
                        placeholder="Email"
                        value={editForm.email ?? ''}
                        onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                      />
                      <Input
                        className="h-8"
                        placeholder="Phone"
                        value={editForm.phone ?? ''}
                        onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                      />
                    </div>
                  ) : (
                    <div className="text-muted-foreground text-xs">
                      {club.email && <div>{club.email}</div>}
                      {club.phone && <div>{club.phone}</div>}
                      {!club.email && !club.phone && '—'}
                    </div>
                  )}
                </TableCell>

                <TableCell className="text-center">
                  {locationCounts[club.id] ?? 0}
                </TableCell>

                <TableCell className="text-center">
                  {memberCounts[club.id] ?? 0}
                </TableCell>

                <TableCell>
                  <Switch
                    checked={club.is_active ?? true}
                    onCheckedChange={(checked) => handleToggle(club.id, checked)}
                    disabled={isPending}
                  />
                </TableCell>

                <TableCell className="text-right">
                  {editingId === club.id ? (
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => handleSaveEdit(club.id)}
                        disabled={isPending}
                      >
                        {isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => { setEditingId(null); setEditForm({}); }}
                      >
                        <X className="size-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        title="Impersonate"
                        onClick={() => handleImpersonate(club.id)}
                        disabled={isPending}
                      >
                        <Eye className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        title="Invite admin"
                        onClick={() => { setInviteOpen(club.id); setSuccessClubId(null); }}
                      >
                        <UserPlus className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        title="Edit"
                        onClick={() => startEditing(club)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive size-8"
                        title="Delete"
                        onClick={() => handleDelete(club.id)}
                        disabled={isPending}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {initialClubs.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-0">
                  <EmptyState
                    icon={Building2}
                    title="No clubs yet"
                    description="Create the first club to get started."
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
