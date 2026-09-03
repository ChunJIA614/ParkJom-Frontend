import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';
import {
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Info,
  LogOut,
  Trash2,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type ModalVariant = 'danger' | 'warning' | 'info' | 'success';

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: ModalVariant;
  icon?: 'logout' | 'trash' | 'warning' | 'info' | 'danger' | 'success';
}

export interface AlertOptions {
  title?: string;
  message: string;
  buttonText?: string;
  variant?: ModalVariant;
  icon?: 'warning' | 'info' | 'danger' | 'success';
}

interface ModalContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  alert: (options: AlertOptions | string) => Promise<void>;
}

const ModalContext = createContext<ModalContextType | null>(null);

let globalConfirm: ((options: ConfirmOptions) => Promise<boolean>) | null = null;
let globalAlert: ((options: AlertOptions | string) => Promise<void>) | null = null;

export const showConfirm = (options: ConfirmOptions): Promise<boolean> => {
  if (globalConfirm) {
    return globalConfirm(options);
  }
  return Promise.resolve(window.confirm(options.message));
};

export const showAlert = (options: AlertOptions | string): Promise<void> => {
  const normalized = typeof options === 'string' ? { message: options } : options;
  if (globalAlert) {
    return globalAlert(normalized);
  }
  window.alert(normalized.message);
  return Promise.resolve();
};

interface ModalState {
  isOpen: boolean;
  type: 'confirm' | 'alert';
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  variant: ModalVariant;
  iconType: 'logout' | 'trash' | 'warning' | 'info' | 'danger' | 'success';
  resolve: (value: boolean) => void;
}

export function ModalProvider({ children }: { children: ReactNode }) {
  const [modal, setModal] = useState<ModalState | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setModal({
        isOpen: true,
        type: 'confirm',
        title: options.title || 'Are you sure?',
        message: options.message,
        confirmText: options.confirmText || 'Confirm',
        cancelText: options.cancelText || 'Cancel',
        variant: options.variant || 'danger',
        iconType: options.icon || (options.variant === 'warning' ? 'warning' : 'danger'),
        resolve,
      });
    });
  }, []);

  const alert = useCallback((options: AlertOptions | string): Promise<void> => {
    const opts = typeof options === 'string' ? { message: options } : options;
    return new Promise<void>((resolve) => {
      setModal({
        isOpen: true,
        type: 'alert',
        title: opts.title || (opts.variant === 'success' ? 'Success' : opts.variant === 'warning' ? 'Notice' : 'Information'),
        message: opts.message,
        confirmText: opts.buttonText || 'Got It',
        cancelText: '',
        variant: opts.variant || 'info',
        iconType: opts.icon || (opts.variant === 'success' ? 'success' : opts.variant === 'warning' ? 'warning' : 'info'),
        resolve: () => resolve(),
      });
    });
  }, []);

  useEffect(() => {
    globalConfirm = confirm;
    globalAlert = alert;
    return () => {
      globalConfirm = null;
      globalAlert = null;
    };
  }, [confirm, alert]);

  // Handle keyboard shortcuts (Escape to cancel, Enter to confirm)
  useEffect(() => {
    if (!modal?.isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        modal.resolve(false);
        setModal(null);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        modal.resolve(true);
        setModal(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modal]);

  const handleConfirm = () => {
    if (modal) {
      modal.resolve(true);
      setModal(null);
    }
  };

  const handleCancel = () => {
    if (modal) {
      modal.resolve(false);
      setModal(null);
    }
  };

  const renderIcon = () => {
    if (!modal) return null;
    switch (modal.iconType) {
      case 'logout':
        return <LogOut className="h-5 w-5 text-rose-600" />;
      case 'trash':
        return <Trash2 className="h-5 w-5 text-rose-600" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-amber-600" />;
      case 'success':
        return <CheckCircle2 className="h-5 w-5 text-emerald-600" />;
      case 'info':
        return <Info className="h-5 w-5 text-[#007AFF]" />;
      case 'danger':
      default:
        return <AlertCircle className="h-5 w-5 text-rose-600" />;
    }
  };

  const getIconBadgeClass = () => {
    if (!modal) return '';
    switch (modal.variant) {
      case 'danger':
        return 'bg-rose-50 border-rose-100 text-rose-600';
      case 'warning':
        return 'bg-amber-50 border-amber-100 text-amber-600';
      case 'success':
        return 'bg-emerald-50 border-emerald-100 text-emerald-600';
      case 'info':
      default:
        return 'bg-blue-50 border-blue-100 text-[#007AFF]';
    }
  };

  const getConfirmButtonClass = () => {
    if (!modal) return '';
    switch (modal.variant) {
      case 'danger':
        return 'bg-rose-600 hover:bg-rose-700 text-white focus:ring-rose-500/20';
      case 'warning':
        return 'bg-amber-600 hover:bg-amber-700 text-white focus:ring-amber-500/20';
      case 'success':
        return 'bg-emerald-600 hover:bg-emerald-700 text-white focus:ring-emerald-500/20';
      case 'info':
      default:
        return 'bg-[#0F172A] hover:bg-slate-800 text-white focus:ring-slate-500/20';
    }
  };

  return (
    <ModalContext.Provider value={{ confirm, alert }}>
      {children}

      {/* Modern ParkJom Custom Dialog */}
      {modal?.isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in-0 duration-150"
          onClick={handleCancel}
        >
          <div
            className="w-full max-w-sm sm:max-w-md rounded-lg border border-black/[0.08] bg-white p-5 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header: Icon + Title + Close Button */}
            <div className="flex items-start gap-3.5">
              <span
                className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-md border',
                  getIconBadgeClass()
                )}
              >
                {renderIcon()}
              </span>

              <div className="flex-1 min-w-0 pt-0.5">
                <h3 className="text-sm sm:text-base font-bold text-[#0F172A] leading-snug">
                  {modal.title}
                </h3>
              </div>

              <button
                type="button"
                onClick={handleCancel}
                aria-label="Close dialog"
                className="cursor-pointer -mr-1 -mt-1 p-1.5 text-slate-400 hover:text-slate-600 rounded-md transition hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Message Body */}
            <div className="pl-[50px] text-xs sm:text-sm text-[#475569] leading-relaxed whitespace-pre-line">
              {modal.message}
            </div>

            {/* Actions Toolbar */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-black/[0.06]">
              {modal.type === 'confirm' && (
                <button
                  type="button"
                  onClick={handleCancel}
                  className="cursor-pointer rounded-md border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition active:scale-[0.98]"
                >
                  {modal.cancelText}
                </button>
              )}

              <button
                type="button"
                onClick={handleConfirm}
                autoFocus
                className={cn(
                  'cursor-pointer rounded-md px-4 py-1.5 text-xs font-semibold shadow-xs transition active:scale-[0.98] focus:outline-none focus:ring-2',
                  getConfirmButtonClass()
                )}
              >
                {modal.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </ModalContext.Provider>
  );
}

export function useModal() {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModal must be used within a ModalProvider');
  }
  return context;
}
