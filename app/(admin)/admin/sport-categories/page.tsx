import { createClient } from '@/lib/supabase/server';
import SportCategoriesClient from './sport-categories-client';

export default async function AdminSportCategoriesPage() {
  const supabase = await createClient();

  const { data: categories } = await supabase
    .from('sport_categories')
    .select('*')
    .order('sort_order');

  const { data: fieldCounts } = await supabase
    .from('fields')
    .select('sport_category_id');

  const usageCounts: Record<string, number> = {};
  fieldCounts?.forEach((f) => {
    usageCounts[f.sport_category_id] = (usageCounts[f.sport_category_id] || 0) + 1;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Sport Categories</h1>
        <p className="text-muted-foreground text-sm">
          Manage the global list of sports available on the platform.
        </p>
      </div>
      <SportCategoriesClient
        initialCategories={categories ?? []}
        usageCounts={usageCounts}
      />
    </div>
  );
}
