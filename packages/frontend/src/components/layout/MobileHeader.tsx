import { Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { DateRangePicker } from '@/components/ui/DateRangePicker';
import { useSidebarStore } from '@/store/useSidebarStore';

export function MobileHeader({ className }: { className?: string }) {
  const openSidebar = useSidebarStore((s) => s.open);

  return (
    <header
      className={cn(
        'flex h-14 items-center justify-between border-b border-border px-4',
        className,
      )}
    >
      <Button variant="ghost" size="icon" onClick={openSidebar} aria-label="Open menu">
        <Menu className="h-5 w-5" />
      </Button>

      <DateRangePicker compact />

      <span className="text-lg font-bold tracking-tight">Vitals</span>
    </header>
  );
}
