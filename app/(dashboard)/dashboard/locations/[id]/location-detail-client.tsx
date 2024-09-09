'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import WeeklyScheduleEditor, {
  type ScheduleDay,
} from '@/components/forms/weekly-schedule-editor';
import {
  updateLocation,
  updateLocationSchedule,
  toggleLocationActive,
  deleteLocation,
} from '@/lib/actions/location-actions';
import {
  Save,
  Loader2,
  Trash2,
  Plus,
  ChevronRight,
  X,
  MapPin,
} from 'lucide-react';
import { toast } from 'sonner';

interface Location {
  id: string;
  name: string;
  slug: string;
  address: string;
  city: string;
  country: string | null;
  phone: string | null;
  email: string | null;
  description: string | null;
  is_active: boolean | null;
}

interface ScheduleRow {
  id: string;
  day_of_week: string;
  open_time: string;
  close_time: string;
  is_closed: boolean | null;
}

interface Field {
  id: string;
  name: string;
  slug: string;
  is_active: boolean | null;
  sport_categories: { name: string; icon: string | null } | null;
}

interface Props {
  location: Location;
  schedule: ScheduleRow[];
  fields: Field[];
}

const DAYS_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

export default function LocationDetailClient({ location, schedule, fields }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Info form state
  const [name, setName] = useState(location.name);
  const [address, setAddress] = useState(location.address);
  const [city, setCity] = useState(location.city);
  const [country, setCountry] = useState(location.country ?? 'Bulgaria');
  const [phone, setPhone] = useState(location.phone ?? '');
  const [email, setEmail] = useState(location.email ?? '');
  const [description, setDescription] = useState(location.description ?? '');

  // Schedule state
  const [schedData, setSchedData] = useState<ScheduleDay[]>(() => {
    return DAYS_ORDER.map((day) => {
      const existing = schedule.find((s) => s.day_of_week === day);
      return {
        dayOfWeek: day,
        openTime: existing?.open_time ?? '08:00',
        closeTime: existing?.close_time ?? '22:00',
        isClosed: existing?.is_closed ?? true,
      };
    });
  });

  function showMsg(msg: string, isError: boolean) {
    if (isError) { setError(msg); setSuccess(null); }
    else { setSuccess(msg); setError(null); }
    setTimeout(() => { setError(null); setSuccess(null); }, 3000);
  }

  async function handleSaveInfo() {
    startTransition(async () => {
      const result = await updateLocation(location.id, {
        name, address, city, country, phone, email, description,
      });
      if (!result.success) {
        toast.error(result.error ?? 'Failed to save location info');
        showMsg(result.error ?? 'Failed to save location info', true);
      } else {
        toast.success('Location info saved.');
        showMsg('Location info saved.', false);
        router.refresh();
      }
    });
  }

  async function handleSaveSchedule() {
    startTransition(async () => {
      const result = await updateLocationSchedule(location.id, schedData);
      if (!result.success) {
        toast.error(result.error ?? 'Failed to save schedule');
        showMsg(result.error ?? 'Failed to save schedule', true);
      } else {
        toast.success('Schedule saved.');
        showMsg('Schedule saved.', false);
        router.refresh();
      }
    });
  }

  async function handleToggleActive(isActive: boolean) {
    startTransition(async () => {
      const result = await toggleLocationActive(location.id, isActive);
      if (!result.success) {
        toast.error(result.error ?? 'Failed to toggle location status');
        showMsg(result.error ?? 'Failed to toggle location status', true);
      } else {
        toast.success(isActive ? 'Location activated.' : 'Location deactivated.');
        router.refresh();
      }
    });
  }

  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this location? This cannot be undone.')) return;
    startTransition(async () => {
      const result = await deleteLocation(location.id);
      if (!result?.success) {
        toast.error(result?.error ?? 'Failed to delete location');
        showMsg(result?.error ?? 'Failed to delete location', true);
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{location.name}</h1>
            <Badge variant={location.is_active ? 'default' : 'secondary'}>
              {location.is_active ? 'Active' : 'Inactive'}
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm">
            {location.address}, {location.city}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={location.is_active ?? true}
            onCheckedChange={handleToggleActive}
            disabled={isPending}
          />
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive"
            onClick={handleDelete}
            disabled={isPending}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      {(error || success) && (
        <div
          className={`flex items-center justify-between rounded-md p-3 text-sm ${
            error ? 'bg-destructive/10 text-destructive' : 'bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-400'
          }`}
        >
          {error ?? success}
          <button onClick={() => { setError(null); setSuccess(null); }}>
            <X className="size-4" />
          </button>
        </div>
      )}

      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">Info</TabsTrigger>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          <TabsTrigger value="fields">Fields ({fields.length})</TabsTrigger>
        </TabsList>

        {/* ── Info Tab ── */}
        <TabsContent value="info" className="space-y-4 pt-4">
          <div className="grid max-w-2xl grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>City</Label>
              <Input value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Address</Label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Country</Label>
              <Input value={country} onChange={(e) => setCountry(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Description</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </div>
          <Button onClick={handleSaveInfo} disabled={isPending} size="sm">
            {isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
            Save Info
          </Button>
        </TabsContent>

        {/* ── Schedule Tab ── */}
        <TabsContent value="schedule" className="space-y-4 pt-4">
          <div className="max-w-2xl">
            <WeeklyScheduleEditor schedule={schedData} onChange={setSchedData} />
          </div>
          <Button onClick={handleSaveSchedule} disabled={isPending} size="sm">
            {isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
            Save Schedule
          </Button>
        </TabsContent>

        {/* ── Fields Tab ── */}
        <TabsContent value="fields" className="space-y-4 pt-4">
          <div className="flex justify-end">
            <Button asChild size="sm">
              <Link href={`/dashboard/locations/${location.id}/fields/new`}>
                <Plus className="mr-2 size-4" />
                Add Field
              </Link>
            </Button>
          </div>

          {fields.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-md border border-dashed py-12">
              <MapPin className="text-muted-foreground mb-3 size-8" />
              <p className="text-muted-foreground mb-3 text-sm">No fields yet.</p>
              <Button asChild size="sm" variant="outline">
                <Link href={`/dashboard/locations/${location.id}/fields/new`}>
                  <Plus className="mr-2 size-4" />
                  Add First Field
                </Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {fields.map((field) => (
                <Link
                  key={field.id}
                  href={`/dashboard/locations/${location.id}/fields/${field.id}`}
                  className="group flex items-center justify-between rounded-lg border p-4 transition-colors hover:border-primary/50 hover:bg-accent/50"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">
                      {field.sport_categories?.icon ?? '🏅'}
                    </span>
                    <div>
                      <span className="font-medium">{field.name}</span>
                      <span className="text-muted-foreground ml-2 text-sm">
                        {field.sport_categories?.name}
                      </span>
                    </div>
                    <Badge variant={field.is_active ? 'default' : 'secondary'} className="ml-2">
                      {field.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <ChevronRight className="text-muted-foreground size-5 transition-transform group-hover:translate-x-0.5" />
                </Link>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
