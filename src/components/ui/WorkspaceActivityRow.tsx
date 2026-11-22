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
    <article className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#141417] p-4 shadow-sm transition-colors hover:border-slate-300 dark:hover:border-white/15">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1 basis-32 break-words">
          <p className="font-semibold text-slate-900 dark:text-white">{title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
          {status && <span className={`workspace-status mt-2 inline-flex${pending ? ' workspace-status--warning' : ''}`}>{status}</span>}
        </div>
        <div className="ml-auto shrink-0 text-right">
          {amountLabel && <p className="text-xs font-medium text-muted-foreground">{amountLabel}</p>}
          <p className="font-bold tabular-nums text-slate-900 dark:text-white">{amount}</p>
        </div>
      </div>
      {children}
    </article>
  );
}
