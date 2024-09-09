import { getAvailableSlots } from '@/lib/booking/slot-generator';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const fieldId = request.nextUrl.searchParams.get('fieldId');
  const date = request.nextUrl.searchParams.get('date');

  if (!fieldId || !date) {
    return NextResponse.json({ slots: [] });
  }

  const allSlots = await getAvailableSlots(fieldId, date);

  return NextResponse.json({ slots: allSlots });
}
