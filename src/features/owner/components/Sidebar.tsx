import React from 'react';
import {
  LayoutDashboard,
  CalendarDays,
  PlusSquare,
  Sliders,
  ClipboardList,
  X,
} from 'lucide-react';

interface SidebarProps {
  activeView: string;
  onViewChange: (view: string) => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export default function Sidebar({ activeView, onViewChange, isOpen, setIsOpen }: SidebarProps) {
  const menuItems = [
    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
    { id: 'availability', label: 'Availability', icon: CalendarDays },
    { id: 'registration', label: 'Register Property', icon: PlusSquare },
    { id: 'tickets', label: 'Support', icon: ClipboardList },
    { id: 'settings', label: 'Settings', icon: Sliders },
  ];

  return (
    <aside
      className={`fixed top-0 left-0 h-screen bg-[#0f1115] text-[#9ca3af] flex flex-col z-50 transition-transform duration-300 w-60 border-r border-white/[0.06]
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}
    >
      {/* Brand */}
      <div className="px-5 py-5 border-b border-white/[0.06] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center font-extrabold text-[#111] text-[13px]">PJ</div>
          <div>
            <span className="text-white font-bold text-[15px] tracking-[-0.02em]">ParkJom</span>
            <span className="text-[10px] text-[#6b7280] font-medium tracking-wider uppercase block leading-none mt-0.5">Owner Portal</span>
          </div>
        </div>
        <button onClick={() => setIsOpen(false)} className="lg:hidden text-[#6b7280] hover:text-white p-1">
          <X size={18} />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-3 space-y-0.5">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => { onViewChange(item.id); setIsOpen(false); }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 text-left ${
                isActive
                  ? 'bg-white text-[#111]'
                  : 'text-[#9ca3af] hover:bg-white/[0.04] hover:text-[#d1d5db]'
              }`}
            >
              <Icon size={17} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#007AFF] flex items-center justify-center text-white font-bold text-[12px]">CC</div>
          <div>
            <span className="text-[11px] text-[#6b7280] font-semibold uppercase tracking-wider block">Owner</span>
            <span className="text-[13px] text-white font-semibold">Chaw Chun Jia</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
