import { useState } from 'react';
import { format, parseISO, subDays } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import type { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useDateRangeStore } from '@/store/useDateRangeStore';

const presets = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
];

export function DateRangePicker({ compact = false }: { compact?: boolean }) {
  const { startDate, endDate, setRange } = useDateRangeStore();
  const [open, setOpen] = useState(false);

  const fromDate = parseISO(startDate);
  const toDate = parseISO(endDate);
  const selected: DateRange = { from: fromDate, to: toDate };

  const handleSelect = (range: DateRange | undefined) => {
    if (range?.from && range?.to) {
      setRange(format(range.from, 'yyyy-MM-dd'), format(range.to, 'yyyy-MM-dd'));
      setOpen(false);
    }
  };

  const applyPreset = (days: number) => {
    const today = new Date();
    setRange(format(subDays(today, days), 'yyyy-MM-dd'), format(today, 'yyyy-MM-dd'));
    setOpen(false);
  };

  const dateFmt = compact ? 'MMM d' : 'MMM d, yyyy';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          'inline-flex items-center gap-2 rounded-md border border-input bg-transparent font-medium shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
          compact ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm',
        )}
      >
        <CalendarIcon className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
        {format(fromDate, dateFmt)} — {format(toDate, dateFmt)}
      </PopoverTrigger>
      <PopoverContent
        className={cn('w-auto p-0', compact && 'max-w-[calc(100vw-2rem)]')}
        align={compact ? 'center' : 'end'}
      >
        {compact && (
          <div className="flex gap-1 border-b border-border p-2">
            {presets.map(({ label, days }) => (
              <Button key={label} variant="outline" size="xs" onClick={() => applyPreset(days)}>
                {label}
              </Button>
            ))}
          </div>
        )}
        <Calendar
          mode="range"
          selected={selected}
          onSelect={handleSelect}
          numberOfMonths={compact ? 1 : 2}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
