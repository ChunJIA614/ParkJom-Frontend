import React, { useState, useRef, useEffect, useMemo, useId } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';

export interface SystemSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SystemSelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  value?: string | number;
  onChange?: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  options?: SystemSelectOption[];
  placeholder?: string;
  leadingIcon?: React.ReactNode;
  variant?: 'default' | 'ghost';
}

function extractOptionsFromChildren(children: React.ReactNode): SystemSelectOption[] {
  const result: SystemSelectOption[] = [];

  const visit = (node: React.ReactNode) => {
    React.Children.forEach(node, (child) => {
      if (!React.isValidElement(child)) return;
      if (child.type === React.Fragment) {
        visit((child.props as { children?: React.ReactNode }).children);
        return;
      }
      if (child.type === 'option') {
        const props = child.props as React.OptionHTMLAttributes<HTMLOptionElement>;
        const rawValue = props.value !== undefined ? String(props.value) : '';
        const text = React.Children.toArray(props.children)
          .map((c) => (typeof c === 'string' || typeof c === 'number' ? String(c) : ''))
          .join('')
          .trim();
        result.push({
          value: rawValue,
          label: text || rawValue,
          disabled: Boolean(props.disabled),
        });
      }
    });
  };

  visit(children);
  return result;
}

export default function SystemSelect({
  value,
  onChange,
  options: propOptions,
  children,
  disabled = false,
  className = '',
  id,
  name,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  placeholder,
  leadingIcon,
  variant = 'default',
}: SystemSelectProps) {
  const generatedId = useId();
  const selectId = id || `system-select-${generatedId}`;
  const listboxId = `${selectId}-listbox`;

  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});

  const options = useMemo(
    () => propOptions ?? extractOptionsFromChildren(children),
    [propOptions, children],
  );

  const normalizedValue = value !== undefined && value !== null ? String(value) : '';
  const selectedOption =
    options.find((opt) => opt.value === normalizedValue) ??
    options[0] ??
    ({ value: '', label: placeholder || 'Select…' } as SystemSelectOption);

  const updatePosition = () => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
    const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
    const estimatedHeight = Math.min(options.length * 44 + 12, 260);
    const spaceBelow = Math.max(0, viewportHeight - rect.bottom - 18);
    const spaceAbove = Math.max(0, rect.top - 18);
    const openUpward = spaceBelow < estimatedHeight && spaceAbove > spaceBelow;
    const maxHeight = Math.min(260, openUpward ? spaceAbove : spaceBelow);
    const width = Math.min(Math.max(rect.width, 156), viewportWidth - 24);
    const left = Math.max(12, Math.min(rect.left, viewportWidth - width - 12));

    setMenuStyle({
      position: 'fixed',
      top: openUpward ? undefined : `${Math.round(rect.bottom + 6)}px`,
      bottom: openUpward ? `${Math.round(viewportHeight - rect.top + 6)}px` : undefined,
      left: `${Math.round(left)}px`,
      width: `${Math.round(width)}px`,
      maxWidth: 'calc(100vw - 24px)',
      maxHeight,
      zIndex: 1350,
    });
  };

  useEffect(() => {
    if (!open) return;
    updatePosition();

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    const handleViewportChange = () => {
      updatePosition();
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown, { passive: true });
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [open, options.length]);

  const handleSelect = (opt: SystemSelectOption) => {
    if (opt.disabled) return;
    const syntheticEvent = {
      target: { value: opt.value, name: name ?? '' },
      currentTarget: { value: opt.value, name: name ?? '' },
      preventDefault: () => {},
      stopPropagation: () => {},
    } as unknown as React.ChangeEvent<HTMLSelectElement>;

    onChange?.(syntheticEvent);
    setOpen(false);
  };

  const isFullWidth = className.includes('w-full');

  return (
    <>
      <button
        ref={triggerRef}
        id={selectId}
        type="button"
        disabled={disabled}
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listboxId}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        onClick={() => {
          if (disabled) return;
          if (!open) updatePosition();
          setOpen((prev) => !prev);
        }}
        className={`system-select-trigger inline-flex items-center justify-between gap-1.5 text-left text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 transition-all ${
          variant === 'ghost'
            ? `variant-ghost !bg-transparent !border-0 !border-none !shadow-none !outline-none !ring-0 p-0 text-[#1d1d1f] dark:text-white hover:text-[#007AFF] dark:hover:text-[#3894FF] ${
                open ? 'text-[#007AFF] dark:text-[#3894FF]' : ''
              }`
            : `rounded-xl border border-black/[0.09] dark:border-white/10 bg-white/95 dark:bg-[#18181C] px-3 py-1.5 text-[#1d1d1f] dark:text-white shadow-[0_1px_2px_rgba(0,0,0,0.03)] hover:border-black/[0.18] dark:hover:border-white/20 hover:bg-white dark:hover:bg-[#202025] ${
                open ? 'is-open border-[#007aff] dark:border-[#0071E3] bg-white dark:bg-[#18181C] ring-3 ring-[#007aff]/14 dark:ring-[#0071E3]/20' : ''
              }`
        } ${isFullWidth ? 'w-full' : ''} ${className}`}
      >
        <span className="inline-flex items-center gap-1.5 min-w-0">
          {leadingIcon}
          <span className="truncate">{selectedOption?.label ?? ''}</span>
        </span>
        <ChevronDown
          className={`h-3 w-3 shrink-0 text-[#8e8e93] dark:text-[#A1A1AA] transition-transform duration-150 ${
            open ? 'rotate-180 text-[#007aff] dark:text-[#3894FF]' : ''
          }`}
          aria-hidden="true"
        />
      </button>

      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={menuRef}
            id={listboxId}
            role="listbox"
            aria-labelledby={ariaLabelledBy || selectId}
            style={menuStyle}
            className="system-select-popover workspace-popover max-h-64 overflow-y-auto no-scrollbar rounded-2xl border border-black/[0.08] dark:border-white/10 bg-white/98 dark:bg-[#18181C] p-1 shadow-[0_12px_34px_rgba(15,23,42,0.14),0_2px_8px_rgba(15,23,42,0.06)] dark:shadow-[0_16px_36px_rgba(0,0,0,0.6)] backdrop-blur-xl"
          >
            {options.map((opt) => {
              const isSelected = opt.value === normalizedValue;
              return (
                <button
                  key={`${opt.value}-${opt.label}`}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  disabled={opt.disabled}
                  onClick={() => handleSelect(opt)}
                  className={`system-select-option flex min-h-11 w-full items-center justify-between gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs transition-colors ${
                    opt.disabled
                      ? 'cursor-not-allowed opacity-40 text-[#8e8e93] dark:text-[#71717A]'
                      : isSelected
                      ? 'bg-[#e8f2ff] dark:bg-[#1c1c1e] font-semibold text-[#007aff] dark:text-[#3894FF]'
                      : 'font-medium text-[#1d1d1f] dark:text-white hover:bg-black/[0.045] dark:hover:bg-white/[0.06]'
                  }`}
                >
                  <span className="min-w-0 break-words">{opt.label}</span>
                  {isSelected && (
                    <Check className="h-3.5 w-3.5 shrink-0 text-[#007aff] dark:text-[#3894FF]" aria-hidden="true" />
                  )}
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </>
  );
}
