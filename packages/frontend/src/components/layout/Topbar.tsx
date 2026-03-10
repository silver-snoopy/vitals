import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useThemeStore, THEME_ICONS } from '@/store/useThemeStore';
import { DateRangePicker } from '@/components/ui/DateRangePicker';

export function Topbar({ className }: { className?: string }) {
  const { theme, cycleTheme } = useThemeStore();
  const ThemeIcon = THEME_ICONS[theme];

  return (
    <header
      className={cn(
        'flex h-14 items-center justify-end gap-3 border-b border-border px-6',
        className,
      )}
    >
      <DateRangePicker />
      <Button variant="ghost" size="icon" onClick={cycleTheme} title={`Theme: ${theme}`}>
        <ThemeIcon className="h-4 w-4" />
      </Button>
    </header>
  );
}
