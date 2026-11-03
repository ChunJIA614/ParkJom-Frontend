import { NotificationBell } from '@/features/notifications';
import DashboardHeader, {
  type DashboardHeaderUser,
  type DashboardSearchItem,
} from '@/components/layout/DashboardHeader';
import { Notification } from '../types';

interface HeaderProps {
  notifications?: Notification[];
  user: DashboardHeaderUser | null;
  onSignOut: () => void;
  onBrandClick: () => void;
  onMarkAllRead?: () => void;
  onToggleSidebar: () => void;
  isSidebarOpen: boolean;
  searchItems: DashboardSearchItem[];
  onSearchSelect: (id: string) => void;
}

export default function Header({
  user,
  onSignOut,
  onBrandClick,
  onToggleSidebar,
  isSidebarOpen,
  searchItems,
  onSearchSelect,
}: HeaderProps) {
  const notificationActions = (
    <NotificationBell
      onNavigate={(url) => {
        window.location.href = url;
      }}
    />
  );

  return (
    <DashboardHeader
      role="owner"
      user={user}
      onSignOut={onSignOut}
      onBrandClick={onBrandClick}
      showMenuButton
      onMenuClick={onToggleSidebar}
      menuExpanded={isSidebarOpen}
      menuControls="owner-workspace-navigation"
      actions={notificationActions}
      hideDesktopBrand
      searchItems={searchItems}
      onSearchSelect={onSearchSelect}
    />
  );
}
