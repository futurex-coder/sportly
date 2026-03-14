import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * GET /api/cron/auto-complete-bookings
 *
 * Fallback cron endpoint that marks past confirmed bookings as completed
 * and auto-completes their linked group sessions.
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
    const { error } = await supabaseAdmin.rpc('auto_complete_past_bookings');

    if (error) {
      if (error.message?.includes('auto_complete_past_bookings')) {
        const { data: updated, error: updateError } = await supabaseAdmin
          .from('bookings')
          .update({
            status: 'completed' as const,
            updated_at: new Date().toISOString(),
          })
          .eq('status', 'confirmed')
          .lt('date', new Date().toISOString().split('T')[0])
          .select('id');

        if (updateError) {
          return NextResponse.json(
            { error: updateError.message },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          method: 'direct_query',
          completed: updated?.length ?? 0,
        });
      }

      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, method: 'rpc' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
