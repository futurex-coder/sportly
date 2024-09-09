import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ClubDetailClient from './club-detail-client';

export default async function ClubDetailPage({
  params,
}: {
  params: Promise<{ clubSlug: string }>;
}) {
  const { clubSlug } = await params;
  const supabase = await createClient();

  // ── Club ──
  const { data: club } = await supabase
    .from('clubs')
    .select('*')
    .eq('slug', clubSlug)
    .eq('is_active', true)
    .single();

  if (!club) notFound();

  // ── Locations + schedules ──
  const { data: locations } = await supabase
    .from('locations')
    .select('id, name, slug, address, city, country, phone, email, description, cover_image_url, is_active')
    .eq('club_id', club.id)
    .eq('is_active', true)
    .order('created_at');

  const locationIds = (locations ?? []).map((l) => l.id);

  // ── Schedules for all locations ──
  let schedules: Record<string, any[]> = {};
  if (locationIds.length > 0) {
    const { data: allScheds } = await supabase
      .from('location_schedules')
      .select('*')
      .in('location_id', locationIds);
    (allScheds ?? []).forEach((s) => {
      if (!schedules[s.location_id]) schedules[s.location_id] = [];
      schedules[s.location_id].push(s);
    });
  }

  // ── Fields with sport category + attributes + booking settings ──
  let fields: any[] = [];
  if (locationIds.length > 0) {
    const { data: allFields } = await supabase
      .from('fields')
      .select(
        `id, name, slug, location_id, sport_category_id, description, cover_image_url, is_active, sort_order,
         sport_categories(id, name, slug, icon, color_primary),
         field_attributes(attribute_key, attribute_value),
         field_booking_settings(slot_duration_minutes, price_per_slot_eur, price_per_slot_local, currency_local)`
      )
      .in('location_id', locationIds)
      .eq('is_active', true)
      .order('sort_order');
    fields = allFields ?? [];
  }

  // ── Location images ──
  let images: Record<string, { url: string; caption: string | null }[]> = {};
  if (locationIds.length > 0) {
    const { data: allImages } = await supabase
      .from('location_images')
      .select('location_id, image_url, caption, sort_order')
      .in('location_id', locationIds)
      .order('sort_order');
    (allImages ?? []).forEach((img) => {
      if (!images[img.location_id]) images[img.location_id] = [];
      images[img.location_id].push({ url: img.image_url, caption: img.caption });
    });
  }

  // ── Trainers (club members with role = trainer) ──
  const { data: trainers } = await supabase
    .from('club_members')
    .select('id, user_id, role, profiles(id, full_name, avatar_url, phone, city)')
    .eq('club_id', club.id)
    .eq('role', 'trainer')
    .eq('is_active', true);

  return (
    <ClubDetailClient
      club={club}
      locations={locations ?? []}
      schedules={schedules}
      fields={fields}
      images={images}
      trainers={trainers ?? []}
    />
  );
}
