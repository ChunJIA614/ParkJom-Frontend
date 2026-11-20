import type { LucideIcon } from 'lucide-react';

interface WorkspaceEmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
}

export default function WorkspaceEmptyState({ icon: Icon, title, description }: WorkspaceEmptyStateProps) {
  return (
    <div className="grid justify-items-center gap-2 px-4 py-8 text-center">
      <Icon size={24} className="text-muted-foreground" aria-hidden="true" />
      <p className="font-semibold">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}
