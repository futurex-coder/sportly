'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

/**
 * Subscribe to Supabase Realtime changes on group_sessions and
 * session_participants for a set of session IDs.
 * On any change, shows a toast and triggers a Next.js router refresh.
 */
export function useSessionListRealtime(sessionIds: string[]) {
  const router = useRouter();

  useEffect(() => {
    if (sessionIds.length === 0) return;

    const supabase = createClient();
    const channel = supabase
      .channel('my-sessions-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'group_sessions',
          filter: `id=in.(${sessionIds.join(',')})`,
        },
        () => {
          toast.info('A session was updated.');
          router.refresh();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'session_participants',
          filter: `session_id=in.(${sessionIds.join(',')})`,
        },
        () => {
          toast.info('Session participants changed.');
          router.refresh();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionIds.join(','), router]);
}

/**
 * Subscribe to Supabase Realtime changes for a single session.
 * Ideal for the session detail page.
 */
export function useSessionDetailRealtime(sessionId: string) {
  const router = useRouter();

  useEffect(() => {
    if (!sessionId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`session-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'group_sessions',
          filter: `id=eq.${sessionId}`,
        },
        () => {
          toast.info('Session updated.');
          router.refresh();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'session_participants',
          filter: `session_id=eq.${sessionId}`,
        },
        () => {
          toast.info('Participants updated.');
          router.refresh();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, router]);
}
