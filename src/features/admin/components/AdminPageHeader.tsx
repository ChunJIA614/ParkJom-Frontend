import type { ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';

interface AdminPageHeaderProps {
  title: string;
  description?: string;
  headingId?: string;
  isLoading?: boolean;
  onRefresh?: () => void | Promise<void>;
  children?: ReactNode;
}

export default function AdminPageHeader({ title, description, headingId, isLoading, onRefresh, children }: AdminPageHeaderProps) {
  return (
    <header className="workspace-heading workspace-heading--compact">
      <div>
        <h1 id={headingId}>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {(onRefresh || children) && (
        <div className="flex flex-wrap items-center gap-2">
          {onRefresh && (
            <button type="button" onClick={onRefresh} disabled={isLoading} className="workspace-button workspace-button--secondary">
              <RefreshCw size={15} className={isLoading ? 'motion-safe:animate-spin' : undefined} aria-hidden="true" />
              {isLoading ? 'Refreshing…' : 'Refresh'}
            </button>
          )}
          {children}
        </div>
      )}
    </header>
  );
}
