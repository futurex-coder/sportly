import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getActiveClubId } from '@/lib/auth/impersonation';
import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, Plus, ChevronRight } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';

export default async function LocationsPage() {
  const clubId = await getActiveClubId();
  if (!clubId) redirect('/');

  const supabase = await createClient();

  const { data: locations } = await supabase
    .from('locations')
    .select('id, name, slug, address, city, phone, is_active')
    .eq('club_id', clubId)
    .order('created_at', { ascending: false });

  const locIds = locations?.map((l) => l.id) ?? [];
  let fieldCounts: Record<string, number> = {};

  if (locIds.length > 0) {
    const { data: fields } = await supabase
      .from('fields')
      .select('location_id')
      .in('location_id', locIds);
    fields?.forEach((f) => {
      fieldCounts[f.location_id] = (fieldCounts[f.location_id] || 0) + 1;
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Locations</h1>
          <p className="text-muted-foreground text-sm">
            Manage your venues and their fields.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/locations/new">
            <Plus className="mr-2 size-4" />
            Add Location
          </Link>
        </Button>
      </div>

      {(!locations || locations.length === 0) ? (
        <EmptyState
          icon={MapPin}
          title="No locations yet"
          description="Add your first venue to start managing fields and bookings."
          actionLabel="Add Location"
          actionHref="/dashboard/locations/new"
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {locations.map((loc) => (
            <Link
              key={loc.id}
              href={`/dashboard/locations/${loc.id}`}
              className="group rounded-lg border p-4 transition-colors hover:border-primary/50 hover:bg-accent/50"
            >
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <h3 className="font-semibold">{loc.name}</h3>
                  <p className="text-muted-foreground text-sm">
                    {loc.address}, {loc.city}
                  </p>
                </div>
                <ChevronRight className="text-muted-foreground size-5 transition-transform group-hover:translate-x-0.5" />
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={loc.is_active ? 'default' : 'secondary'}>
                  {loc.is_active ? 'Active' : 'Inactive'}
                </Badge>
                <span className="text-muted-foreground text-xs">
                  {fieldCounts[loc.id] ?? 0} field(s)
                </span>
                {loc.phone && (
                  <span className="text-muted-foreground text-xs">{loc.phone}</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
