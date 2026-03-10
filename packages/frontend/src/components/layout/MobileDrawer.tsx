import { NavLink } from 'react-router-dom';
import { Moon, Sun, Monitor, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { UploadModal } from '@/components/upload/UploadModal';
import { useSidebarStore } from '@/store/useSidebarStore';
import { useThemeStore } from '@/store/useThemeStore';
import { navItems } from './nav-items';

export function MobileDrawer() {
  const { isOpen, close } = useSidebarStore();
  const { theme, setTheme } = useThemeStore();

  const cycleTheme = () => {
    const next = theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system';
    setTheme(next);
  };

  const ThemeIcon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && close()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Vitals</SheetTitle>
        </SheetHeader>

        <nav className="flex flex-1 flex-col gap-1 px-3">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={close}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )
              }
            >
              <Icon className="h-5 w-5" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-2 border-t border-border p-4">
          <UploadModal
            trigger={
              <Button variant="outline" size="sm" className="w-full gap-2">
                <Upload className="h-4 w-4" />
                Upload Data
              </Button>
            }
          />

          <Button variant="ghost" size="sm" className="w-full gap-2" onClick={cycleTheme}>
            <ThemeIcon className="h-4 w-4" />
            Theme: {theme}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
