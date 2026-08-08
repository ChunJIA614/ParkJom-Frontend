import React from 'react';
import {
  LayoutDashboard,
  CalendarDays,
  PlusSquare,
  Sliders,
  ClipboardList,
  X,
} from 'lucide-react';
import BrandLogo from '@/components/ui/BrandLogo';

interface SidebarProps {
  activeView: string;
  onViewChange: (view: string) => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export default function Sidebar({ activeView, onViewChange, isOpen, setIsOpen }: SidebarProps) {
  const menuItems = [
    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
    { id: 'availability', label: 'Configure Parking', icon: CalendarDays },
    { id: 'registration', label: 'Register Property', icon: PlusSquare },
    { id: 'tickets', label: 'Support', icon: ClipboardList },
    { id: 'settings', label: 'Settings', icon: Sliders },
  ];

  return (
    <>
      <button
        type="button"
        className={`workspace-scrim lg:hidden ${isOpen ? 'is-visible' : ''}`}
        onClick={() => setIsOpen(false)}
        aria-label="Close owner navigation"
        tabIndex={isOpen ? 0 : -1}
      />
      <aside
        id="owner-workspace-navigation"
        className={`workspace-sidebar ${isOpen ? 'is-open' : ''}`}
      >
      <div className="workspace-sidebar__brand">
        <div className="workspace-wordmark">
          <BrandLogo alt="" className="workspace-wordmark__mark" />
          <div>
            <strong>ParkJom</strong>
            <span>Owner workspace</span>
          </div>
        </div>
        <button type="button" onClick={() => setIsOpen(false)} className="lg:hidden text-[#6e6e73] p-1.5" aria-label="Close menu">
          <X size={18} />
        </button>
      </div>

      <nav className="workspace-nav" aria-label="Owner workspace">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => { onViewChange(item.id); setIsOpen(false); }}
              className={isActive ? 'is-active' : ''}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon size={17} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="workspace-sidebar__footer">
        Parking supply, availability, and settlement in one workspace.
      </div>
      </aside>
    </>
  );
}
