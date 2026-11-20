import type { ReactNode } from 'react';

interface WorkspaceActivityRowProps {
  title: string;
  detail: ReactNode;
  amount: string;
  amountLabel?: string;
  status?: string;
  pending?: boolean;
  children?: ReactNode;
}

export default function WorkspaceActivityRow({ title, detail, amount, amountLabel, status, pending, children }: WorkspaceActivityRowProps) {
  return (
    <article className="border-t border-border py-3">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1 basis-32 break-words">
          <p className="font-semibold">{title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
          {status && <span className={`workspace-status mt-2${pending ? ' workspace-status--warning' : ''}`}>{status}</span>}
        </div>
        <div className="ml-auto shrink-0 text-right">
          {amountLabel && <p className="text-sm text-muted-foreground">{amountLabel}</p>}
          <p className="font-semibold tabular-nums">{amount}</p>
        </div>
      </div>
      {children}
    </article>
  );
}
