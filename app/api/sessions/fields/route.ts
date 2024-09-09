import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const sportCategoryId = request.nextUrl.searchParams.get('sportCategoryId');
  if (!sportCategoryId) {
    return NextResponse.json({ fields: [] });
  }

  const supabase = await createClient();

  const { data: fields } = await supabase
    .from('fields')
    .select(
      `id, name, sport_category_id,
       locations!inner(name, city, clubs!inner(name))`
    )
    .eq('sport_category_id', sportCategoryId)
    .eq('is_active', true)
    .order('name');

  const mapped = (fields ?? []).map((f) => {
    const loc = f.locations as any;
    return {
      id: f.id,
      name: f.name,
      sport_category_id: f.sport_category_id,
      location_name: loc?.name ?? '',
      city: loc?.city ?? '',
      club_name: loc?.clubs?.name ?? '',
    };
  });

  return NextResponse.json({ fields: mapped });
}
