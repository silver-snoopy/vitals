import { useCallback } from 'react';
import { NavLink } from 'react-router-dom';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { UploadModal } from '@/components/upload/UploadModal';
import { useSidebarStore } from '@/store/useSidebarStore';
import { useThemeStore, THEME_ICONS } from '@/store/useThemeStore';
import { navItems, navLinkClassName } from './nav-items';

export function MobileDrawer() {
  const { isOpen, close } = useSidebarStore();
  const { theme, cycleTheme } = useThemeStore();
  const ThemeIcon = THEME_ICONS[theme];
  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) close();
    },
    [close],
  );

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
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
              className={({ isActive }) => navLinkClassName(isActive, 'lg')}
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
