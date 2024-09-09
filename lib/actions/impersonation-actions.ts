'use server';

import {
  setImpersonatedClub,
  clearImpersonation,
  setActiveLocation,
} from '@/lib/auth/impersonation';
import { redirect } from 'next/navigation';
import { requireSuperAdmin, requireAuth } from '@/lib/auth/helpers';

export async function impersonateClub(clubId: string) {
  await requireSuperAdmin();
  await setImpersonatedClub(clubId);
  redirect('/dashboard');
}

export async function stopImpersonation() {
  await requireSuperAdmin();
  await clearImpersonation();
  redirect('/admin');
}

export async function switchActiveLocation(locationId: string | null) {
  await requireAuth();
  await setActiveLocation(locationId);
}
