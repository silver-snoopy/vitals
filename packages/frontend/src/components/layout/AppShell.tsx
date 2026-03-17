import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { MobileHeader } from './MobileHeader';
import { BottomNav } from './BottomNav';

export function AppShell() {
  return (
    <div className="flex h-screen bg-background text-foreground">
      {/* Desktop sidebar — hidden on mobile */}
      <div className="hidden md:flex">
        <Sidebar />
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        <MobileHeader className="md:hidden" />
        <Topbar className="hidden md:flex" />
        <main className="flex-1 overflow-y-auto p-4 pb-20 md:p-6 md:pb-6">
          <Outlet />
        </main>
        <BottomNav className="md:hidden" />
      </div>
    </div>
  );
}
