import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

let _admin: SupabaseClient | null = null;
let _adminVerified = false;
let _adminValid = false;

function buildAdmin(): SupabaseClient {
  if (serviceKey) return createClient(url, serviceKey);
  console.warn('[supabaseAdmin] SUPABASE_SERVICE_ROLE_KEY is not set — using anon key (RLS applies).');
  return createClient(url, anonKey);
}

/**
 * Service-role Supabase client. Falls back to the anon key (with a warning)
 * if the service role key is missing or invalid.
 */
export const supabaseAdmin: SupabaseClient = buildAdmin();

/**
 * Returns a Supabase client suitable for server-side reads.
 * Uses the service-role client when valid; otherwise falls back to the anon
 * client so that public-read RLS policies still work.
 */
export async function getReadClient(): Promise<SupabaseClient> {
  if (!_admin) _admin = buildAdmin();

  if (!_adminVerified) {
    _adminVerified = true;
    try {
      const { error } = await _admin.from('fields').select('id').limit(1);
      _adminValid = !error;
      if (error) {
        console.error(
          `[supabaseAdmin] Service-role key is INVALID (${error.message}). ` +
          'Falling back to anon key for reads. Fix SUPABASE_SERVICE_ROLE_KEY in .env.'
        );
      }
    } catch {
      _adminValid = false;
    }
  }

  if (_adminValid) return _admin;
  return createClient(url, anonKey);
}
