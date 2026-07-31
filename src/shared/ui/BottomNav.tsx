import type { LucideIcon } from 'lucide-react';

export interface BottomNavItem {
  id: string;
  icon: LucideIcon;
  label: string;
  dot?: boolean;
  count?: number | null;
}

interface BottomNavProps {
  items: BottomNavItem[];
  activeId: string;
  onChange: (id: string) => void;
}

export default function BottomNav({ items, activeId, onChange }: BottomNavProps) {
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 glass-bar z-50 px-1 pt-1 bottom-nav-safe shadow-[0_-1px_20px_rgba(0,0,0,0.06)]">
      <div className="flex items-center justify-around max-w-lg mx-auto">
        {items.map(({ id, icon: Icon, label, dot, count }) => {
          const active = activeId === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              className={`relative flex flex-col items-center gap-0.5 py-1.5 px-3 rounded-2xl transition-all duration-200 ${
                active ? 'text-[#007AFF]' : 'text-[#8e8e93] hover:text-[#48484a]'
              }`}
              style={{ transitionTimingFunction: 'cubic-bezier(0.32, 0.72, 0, 1)' }}
            >
              <Icon size={active ? 22 : 20} strokeWidth={active ? 2.5 : 1.8} />
              <span className={`text-[9px] font-semibold ${active ? 'font-bold' : ''}`}>{label}</span>
              {dot && (
                <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-[#34c759] ring-2 ring-white" />
              )}
              {count != null && count > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-[#ff3b30] text-white text-[8px] font-bold flex items-center justify-center leading-none shadow-sm">
                  {count > 9 ? '9+' : count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
