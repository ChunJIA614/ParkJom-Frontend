import AppSidebar from '@/components/layout/AppSidebar';
import { OWNER_SIDEBAR_GROUPS } from '../lib/ownerNavigation';

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
      groups={OWNER_SIDEBAR_GROUPS}
      footer="Parking supply and availability in one workspace."
    />
  );
}
