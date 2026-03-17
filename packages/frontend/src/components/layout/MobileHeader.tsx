import { Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { DateRangePicker } from '@/components/ui/DateRangePicker';
import { UploadModal } from '@/components/upload/UploadModal';
import { useThemeStore, THEME_ICONS } from '@/store/useThemeStore';

export function MobileHeader({ className }: { className?: string }) {
  const { theme, cycleTheme } = useThemeStore();
  const ThemeIcon = THEME_ICONS[theme];

  return (
    <header
      className={cn(
        'flex h-14 items-center justify-between border-b border-border px-4',
        className,
      )}
    >
      <span className="text-lg font-bold tracking-tight">Vitals</span>

      <div className="flex items-center gap-1">
        <DateRangePicker compact />
        <UploadModal
          trigger={
            <Button variant="ghost" size="icon" aria-label="Upload data">
              <Upload className="h-4 w-4" />
            </Button>
          }
        />
        <Button variant="ghost" size="icon" onClick={cycleTheme} aria-label="Toggle theme">
          <ThemeIcon className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
