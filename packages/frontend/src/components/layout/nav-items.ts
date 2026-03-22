import { LayoutDashboard, Salad, Dumbbell, FileText, MessageCircle, CheckSquare } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end: boolean;
}

export const navItems: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/nutrition', label: 'Nutrition', icon: Salad, end: false },
  { to: '/workouts', label: 'Workouts', icon: Dumbbell, end: false },
  { to: '/reports', label: 'Reports', icon: FileText, end: false },
  { to: '/actions', label: 'Actions', icon: CheckSquare, end: false },
  { to: '/chat', label: 'Chat', icon: MessageCircle, end: false },
];

export function navLinkClassName(isActive: boolean, size: 'default' | 'lg' = 'default') {
  return cn(
    'flex items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors',
    size === 'lg' ? 'py-2.5' : 'py-2',
    isActive
      ? 'bg-accent text-accent-foreground'
      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
  );
}
