import { Monitor, Moon, Sun, type LucideIcon } from 'lucide-react';
import { useTheme, type ThemePreference } from '@/app/theme/ThemeContext';

interface ThemeOption {
  value: ThemePreference;
  label: string;
  icon: LucideIcon;
  hint: string;
}

const THEME_OPTIONS: ThemeOption[] = [
  { value: 'light', label: 'Light', icon: Sun, hint: 'Always use the light appearance' },
  { value: 'dark', label: 'Dark', icon: Moon, hint: 'Always use the dark appearance' },
  { value: 'system', label: 'System', icon: Monitor, hint: 'Match this device’s appearance setting' },
];

interface ThemeSegmentedControlProps {
  /** `compact` sits inside the account menu; `panel` is the profile settings block. */
  size?: 'compact' | 'panel';
  className?: string;
}

/**
 * Appearance picker shared by the account menu and the profile dialog so a user
 * can switch the whole product between light, dark, and system at any time.
 * Built with Apple HIG segmented control tactile styling.
 */
export default function ThemeSegmentedControl({ size = 'compact', className = '' }: ThemeSegmentedControlProps) {
  const { preference, setPreference } = useTheme();

  return (
    <div
      className={`theme-switch grid grid-cols-3 gap-1 p-1 rounded-xl bg-[#f1f3f4] dark:bg-[#141417] border border-black/[0.04] dark:border-white/[0.06] select-none ${className}`.trim()}
      data-size={size}
      role="radiogroup"
      aria-label="Appearance"
    >
      {THEME_OPTIONS.map(({ value, label, icon: Icon, hint }) => {
        const active = preference === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            title={hint}
            onClick={() => setPreference(value)}
            className={`theme-switch__option flex items-center justify-center gap-1.5 rounded-lg transition-all duration-150 cursor-pointer ${
              active
                ? 'is-active bg-white dark:bg-[#2C2C31] text-[#1d1d1f] dark:text-white shadow-[0_1px_3px_rgba(0,0,0,0.4)] font-bold border-none'
                : 'text-[#6e6e73] dark:text-[#A1A1AA] hover:text-[#1d1d1f] dark:hover:text-white bg-transparent border-none'
            } ${size === 'panel' ? 'py-2 px-3 text-[13px]' : 'py-1 px-1.5 text-[11px]'}`}
          >
            <Icon
              size={size === 'panel' ? 15 : 13}
              strokeWidth={2.2}
              aria-hidden="true"
              className={active ? 'text-[var(--system-primary,#0071e3)] dark:text-[#0A84FF]' : 'text-current opacity-80'}
            />
            <span className="leading-none">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
