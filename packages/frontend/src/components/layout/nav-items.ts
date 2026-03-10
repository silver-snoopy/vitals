import { LayoutDashboard, Salad, Dumbbell, FileText } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

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
];
