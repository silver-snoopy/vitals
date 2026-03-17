import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { navItems } from './nav-items';

export function BottomNav({ className }: { className?: string }) {
  return (
    <nav
      role="navigation"
      aria-label="Main navigation"
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center justify-around border-t border-border bg-background/95 pb-safe backdrop-blur-sm',
        className,
      )}
    >
      {navItems.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            cn(
              'flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors',
              isActive ? 'text-primary' : 'text-muted-foreground',
            )
          }
        >
          <Icon className="h-5 w-5" />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
