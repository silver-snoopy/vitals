import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Salad, Dumbbell, FileText, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { UploadModal } from '@/components/upload/UploadModal';

const navItems = [
  { to: '/',          label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/nutrition', label: 'Nutrition',  icon: Salad,           end: false },
  { to: '/workouts',  label: 'Workouts',   icon: Dumbbell,        end: false },
  { to: '/reports',   label: 'Reports',    icon: FileText,        end: false },
];

export function Sidebar() {
  return (
    <aside className="flex w-56 flex-col border-r border-border bg-card px-3 py-4">
      <div className="mb-6 px-2">
        <span className="text-lg font-bold tracking-tight">Vitals</span>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </nav>

      <UploadModal
        trigger={
          <Button variant="outline" size="sm" className="mt-4 w-full gap-2">
            <Upload className="h-4 w-4" />
            Upload Data
          </Button>
        }
      />
    </aside>
  );
}
