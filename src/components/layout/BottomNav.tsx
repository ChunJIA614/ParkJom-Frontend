import type { LucideIcon } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';

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
  const prefersReducedMotion = useReducedMotion();

  return (
    <nav
      className="dashboard-bottom-nav lg:hidden fixed bottom-0 left-0 right-0 glass-bar z-50 bottom-nav-safe"
      aria-label="Dashboard navigation"
    >
      <div className="dashboard-bottom-nav__inner" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map(({ id, icon: Icon, label, dot, count }) => {
          const active = activeId === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              aria-current={active ? 'page' : undefined}
              className={`dashboard-bottom-nav__item ${active ? 'is-active' : ''}`}
            >
              {active && (
                <motion.span
                  layoutId="dashboard-bottom-nav-active"
                  className="dashboard-bottom-nav__active-pill"
                  transition={prefersReducedMotion
                    ? { duration: 0 }
                    : { type: 'spring', bounce: 0, duration: 0.34 }}
                />
              )}
              <motion.span
                className="dashboard-bottom-nav__content"
                animate={{ y: active && !prefersReducedMotion ? -1 : 0 }}
                transition={{ type: 'spring', bounce: 0, duration: 0.28 }}
              >
                <Icon size={21} strokeWidth={active ? 2.35 : 1.9} aria-hidden="true" />
                <span>{label}</span>
              </motion.span>
              {dot && (
                <span className="dashboard-bottom-nav__dot" aria-label="Active" />
              )}
              {count != null && count > 0 && (
                <span className="dashboard-bottom-nav__count" aria-label={`${count} pending items`}>
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
