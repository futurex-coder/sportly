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
  createSportCategory,
  updateSportCategory,
  toggleSportCategoryActive,
  deleteSportCategory,
  reorderSportCategories,
} from '@/lib/actions/admin-actions';
import { toast } from 'sonner';
import {
  Plus,
  ArrowUp,
  ArrowDown,
  Pencil,
  Trash2,
  Loader2,
  Save,
  X,
  Trophy,
} from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';

interface SportCategory {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  color_primary: string | null;
  color_accent: string | null;
  description: string | null;
  is_active: boolean | null;
  sort_order: number | null;
}

interface Props {
  initialCategories: SportCategory[];
  usageCounts: Record<string, number>;
}

export default function SportCategoriesClient({
  initialCategories,
  usageCounts,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [categories, setCategories] = useState(initialCategories);
  const [addOpen, setAddOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<SportCategory>>({});
  const [error, setError] = useState<string | null>(null);

  function startEditing(cat: SportCategory) {
    setEditingId(cat.id);
    setEditForm({
      name: cat.name,
      slug: cat.slug,
      icon: cat.icon,
      color_primary: cat.color_primary,
      color_accent: cat.color_accent,
      description: cat.description,
    });
  }

  function cancelEditing() {
    setEditingId(null);
    setEditForm({});
  }

  async function handleCreate(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createSportCategory(formData);
      if (!result.success) {
        toast.error(result.error ?? 'Failed to create category');
        setError(result.error ?? 'Failed to create category');
        return;
      }
      toast.success('Category created');
      setAddOpen(false);
      router.refresh();
    });
  }

  async function handleSaveEdit(id: string) {
    setError(null);
    const fd = new FormData();
    if (editForm.name) fd.set('name', editForm.name);
    if (editForm.slug) fd.set('slug', editForm.slug);
    if (editForm.icon !== undefined) fd.set('icon', editForm.icon ?? '');
    if (editForm.color_primary !== undefined) fd.set('colorPrimary', editForm.color_primary ?? '');
    if (editForm.color_accent !== undefined) fd.set('colorAccent', editForm.color_accent ?? '');
    if (editForm.description !== undefined) fd.set('description', editForm.description ?? '');

    startTransition(async () => {
      const result = await updateSportCategory(id, fd);
      if (!result.success) {
        toast.error(result.error ?? 'Failed to update category');
        setError(result.error ?? 'Failed to update category');
        return;
      }
      toast.success('Category updated');
      setEditingId(null);
      setEditForm({});
      router.refresh();
    });
  }

  async function handleToggle(id: string, isActive: boolean) {
    startTransition(async () => {
      await toggleSportCategoryActive(id, isActive);
      router.refresh();
    });
  }

  async function handleDelete(id: string) {
    const count = usageCounts[id] ?? 0;
    if (count > 0) {
      setError(`Cannot delete: ${count} field(s) use this category.`);
      return;
    }
    if (!confirm('Are you sure you want to delete this sport category?')) return;

    setError(null);
    startTransition(async () => {
      const result = await deleteSportCategory(id);
      if (!result.success) {
        toast.error(result.error ?? 'Failed to delete category');
        setError(result.error ?? 'Failed to delete category');
        return;
      }
      toast.success('Category deleted');
      router.refresh();
    });
  }

  async function handleMove(index: number, direction: 'up' | 'down') {
    const newCategories = [...categories];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= newCategories.length) return;

    [newCategories[index], newCategories[swapIndex]] = [
      newCategories[swapIndex],
      newCategories[index],
    ];
    setCategories(newCategories);

    const orderedIds = newCategories.map((c) => c.id);
    startTransition(async () => {
      await reorderSportCategories(orderedIds);
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
              Add Category
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Sport Category</DialogTitle>
            </DialogHeader>
            <form action={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="add-name">Name</Label>
                  <Input id="add-name" name="name" required placeholder="e.g. Football" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="add-slug">Slug</Label>
                  <Input id="add-slug" name="slug" placeholder="auto-generated" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="add-icon">Icon</Label>
                  <Input id="add-icon" name="icon" placeholder="⚽" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="add-primary">Primary Color</Label>
                  <Input id="add-primary" name="colorPrimary" type="color" defaultValue="#16a34a" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="add-accent">Accent Color</Label>
                  <Input id="add-accent" name="colorAccent" type="color" defaultValue="#dc2626" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-desc">Description</Label>
                <Input id="add-desc" name="description" placeholder="Optional description" />
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

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">Order</TableHead>
              <TableHead className="w-12">Icon</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead className="w-20">Color</TableHead>
              <TableHead className="w-16">Fields</TableHead>
              <TableHead className="w-20">Active</TableHead>
              <TableHead className="w-32 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.map((cat, index) => (
              <TableRow key={cat.id}>
                <TableCell>
                  <div className="flex gap-0.5">
                    <button
                      className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                      onClick={() => handleMove(index, 'up')}
                      disabled={index === 0 || isPending}
                    >
                      <ArrowUp className="size-4" />
                    </button>
                    <button
                      className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                      onClick={() => handleMove(index, 'down')}
                      disabled={index === categories.length - 1 || isPending}
                    >
                      <ArrowDown className="size-4" />
                    </button>
                  </div>
                </TableCell>

                <TableCell className="text-lg">
                  {editingId === cat.id ? (
                    <Input
                      className="h-8 w-12 text-center"
                      value={editForm.icon ?? ''}
                      onChange={(e) => setEditForm({ ...editForm, icon: e.target.value })}
                    />
                  ) : (
                    cat.icon ?? '🏅'
                  )}
                </TableCell>

                <TableCell>
                  {editingId === cat.id ? (
                    <Input
                      className="h-8"
                      value={editForm.name ?? ''}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    />
                  ) : (
                    <span className="font-medium">{cat.name}</span>
                  )}
                </TableCell>

                <TableCell>
                  {editingId === cat.id ? (
                    <Input
                      className="h-8"
                      value={editForm.slug ?? ''}
                      onChange={(e) => setEditForm({ ...editForm, slug: e.target.value })}
                    />
                  ) : (
                    <code className="text-muted-foreground text-xs">{cat.slug}</code>
                  )}
                </TableCell>

                <TableCell>
                  {editingId === cat.id ? (
                    <Input
                      type="color"
                      className="h-8 w-14"
                      value={editForm.color_primary ?? '#000000'}
                      onChange={(e) => setEditForm({ ...editForm, color_primary: e.target.value })}
                    />
                  ) : (
                    <div className="flex gap-1">
                      {cat.color_primary && (
                        <div
                          className="size-5 rounded"
                          style={{ backgroundColor: cat.color_primary }}
                          title={cat.color_primary}
                        />
                      )}
                      {cat.color_accent && (
                        <div
                          className="size-5 rounded"
                          style={{ backgroundColor: cat.color_accent }}
                          title={cat.color_accent}
                        />
                      )}
                    </div>
                  )}
                </TableCell>

                <TableCell>
                  <span className="text-muted-foreground text-sm">
                    {usageCounts[cat.id] ?? 0}
                  </span>
                </TableCell>

                <TableCell>
                  <Switch
                    checked={cat.is_active ?? true}
                    onCheckedChange={(checked) => handleToggle(cat.id, checked)}
                    disabled={isPending}
                  />
                </TableCell>

                <TableCell className="text-right">
                  {editingId === cat.id ? (
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => handleSaveEdit(cat.id)}
                        disabled={isPending}
                      >
                        {isPending ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Save className="size-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={cancelEditing}
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
                        onClick={() => startEditing(cat)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive size-8"
                        onClick={() => handleDelete(cat.id)}
                        disabled={isPending}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {categories.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-0">
                  <EmptyState
                    icon={Trophy}
                    title="No sport categories yet"
                    description="Add your first sport to get started."
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
