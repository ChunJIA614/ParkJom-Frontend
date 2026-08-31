import { CalendarDays, ClipboardList, LayoutDashboard, MessageSquare, PlusSquare, Sliders } from 'lucide-react';
import AppSidebar from '@/components/layout/AppSidebar';

interface SidebarProps {
  activeView: string;
  onViewChange: (view: string) => void;
  onBrandClick: () => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  isCollapsed: boolean;
  setIsCollapsed: (isCollapsed: boolean) => void;
}

export default function Sidebar({
  activeView,
  onViewChange,
  onBrandClick,
  isOpen,
  setIsOpen,
  isCollapsed,
  setIsCollapsed,
}: SidebarProps) {
  return (
    <AppSidebar
      id="owner-workspace-navigation"
      workspaceLabel="Owner workspace"
      activeId={activeView}
      onNavigate={onViewChange}
      onBrandClick={onBrandClick}
      mobileOpen={isOpen}
      onMobileOpenChange={setIsOpen}
      collapsed={isCollapsed}
      onCollapsedChange={setIsCollapsed}
      groups={[
        {
          label: 'Parking',
          items: [
            { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
            { id: 'availability', label: 'Configure Parking', icon: CalendarDays },
            { id: 'reviews', label: 'Reviews', icon: MessageSquare },
            { id: 'registration', label: 'Register Property', icon: PlusSquare },
          ],
        },
        {
          label: 'Account',
          items: [
            { id: 'tickets', label: 'Support', icon: ClipboardList },
            { id: 'settings', label: 'Settings', icon: Sliders },
          ],
        },
      ]}
      footer="Parking supply and availability in one workspace."
    />
  );
}
