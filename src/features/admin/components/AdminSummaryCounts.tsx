interface AdminSummaryCountsProps {
  items: { label: string; value: number }[];
}

export default function AdminSummaryCounts({ items }: AdminSummaryCountsProps) {
  return (
    <dl className="workspace-panel flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3">
      {items.map(({ label, value }) => (
        <div className="flex items-baseline gap-1.5" key={label}>
          <dt className="text-sm text-muted-foreground">{label}</dt>
          <dd className="font-semibold tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
