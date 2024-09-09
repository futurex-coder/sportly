import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * GET /api/cron/auto-cancel
 *
 * Fallback cron endpoint that cancels expired draft group sessions.
 * Use this when pg_cron is unavailable (e.g., Vercel Cron, external scheduler).
 *
 * Protected by CRON_SECRET header — set CRON_SECRET in your environment variables.
 * Vercel Cron automatically sends this header when configured in vercel.json.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = supabaseAdmin;

    const { data, error } = await supabase.rpc('auto_cancel_expired_sessions');

    if (error) {
      // If the RPC function doesn't exist, fall back to a direct query
      if (error.message?.includes('auto_cancel_expired_sessions')) {
        const { data: updated, error: updateError } = await supabase
          .from('group_sessions')
          .update({
            is_cancelled: true,
            cancelled_reason: 'deadline_expired',
            updated_at: new Date().toISOString(),
          })
          .eq('is_confirmed', false)
          .eq('is_cancelled', false)
          .not('confirmation_deadline', 'is', null)
          .lt('confirmation_deadline', new Date().toISOString())
          .select('id');

        if (updateError) {
          return NextResponse.json(
            { error: updateError.message },
            { status: 500 }
          );
        }

        return NextResponse.json({
          ok: true,
          method: 'direct_query',
          cancelled: updated?.length ?? 0,
        });
      }

      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, method: 'rpc' });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message ?? 'Unknown error' },
      { status: 500 }
    );
  }
}
