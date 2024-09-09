'use client';

import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

const DAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

const DAY_LABELS: Record<string, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};

export interface ScheduleDay {
  dayOfWeek: string;
  openTime: string;
  closeTime: string;
  isClosed: boolean;
}

interface WeeklyScheduleEditorProps {
  schedule: ScheduleDay[];
  onChange: (schedule: ScheduleDay[]) => void;
}

const DEFAULT_SCHEDULE: ScheduleDay[] = DAYS.map((day) => ({
  dayOfWeek: day,
  openTime: '08:00',
  closeTime: '22:00',
  isClosed: day === 'sunday',
}));

export function getDefaultSchedule(): ScheduleDay[] {
  return DEFAULT_SCHEDULE.map((d) => ({ ...d }));
}

export default function WeeklyScheduleEditor({
  schedule,
  onChange,
}: WeeklyScheduleEditorProps) {
  function updateDay(index: number, patch: Partial<ScheduleDay>) {
    const updated = schedule.map((day, i) =>
      i === index ? { ...day, ...patch } : day
    );
    onChange(updated);
  }

  return (
    <div className="space-y-3">
      <div className="text-muted-foreground grid grid-cols-[120px_1fr_1fr_80px] gap-3 text-xs font-medium">
        <span>Day</span>
        <span>Opens</span>
        <span>Closes</span>
        <span className="text-center">Open</span>
      </div>
      {schedule.map((day, i) => (
        <div
          key={day.dayOfWeek}
          className="grid grid-cols-[120px_1fr_1fr_80px] items-center gap-3"
        >
          <Label className="text-sm font-medium">
            {DAY_LABELS[day.dayOfWeek] ?? day.dayOfWeek}
          </Label>
          <Input
            type="time"
            value={day.openTime}
            onChange={(e) => updateDay(i, { openTime: e.target.value })}
            disabled={day.isClosed}
            className="h-9"
          />
          <Input
            type="time"
            value={day.closeTime}
            onChange={(e) => updateDay(i, { closeTime: e.target.value })}
            disabled={day.isClosed}
            className="h-9"
          />
          <div className="flex justify-center">
            <Switch
              checked={!day.isClosed}
              onCheckedChange={(open) => updateDay(i, { isClosed: !open })}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
