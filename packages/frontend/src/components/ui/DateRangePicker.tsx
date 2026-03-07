import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import type { DateRange } from 'react-day-picker';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useDateRangeStore } from '@/store/useDateRangeStore';

export function DateRangePicker() {
  const { startDate, endDate, setRange } = useDateRangeStore();
  const [open, setOpen] = useState(false);

  const selected: DateRange = {
    from: parseISO(startDate),
    to: parseISO(endDate),
  };

  const handleSelect = (range: DateRange | undefined) => {
    if (range?.from && range?.to) {
      setRange(format(range.from, 'yyyy-MM-dd'), format(range.to, 'yyyy-MM-dd'));
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {/* Base UI uses render prop instead of asChild */}
      <PopoverTrigger className="inline-flex items-center gap-2 rounded-md border border-input bg-transparent px-3 py-1.5 text-sm font-medium shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
        <CalendarIcon className="h-4 w-4" />
        {format(parseISO(startDate), 'MMM d, yyyy')} — {format(parseISO(endDate), 'MMM d, yyyy')}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        <Calendar
          mode="range"
          selected={selected}
          onSelect={handleSelect}
          numberOfMonths={2}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
