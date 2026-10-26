import React from 'react';
import { Clock, Sparkles, CheckCircle2, AlertCircle, ArrowUpRight } from 'lucide-react';

interface ServiceUpcomingProps {
  title: string;
  description: string;
  badge?: string;
  plannedFeatures?: string[];
  technicalNote?: string;
  icon?: React.ElementType;
  className?: string;
}

export default function ServiceUpcoming({
  title,
  description,
  badge = 'Service Upcoming',
  plannedFeatures = [],
  technicalNote,
  icon: Icon = Clock,
  className = '',
}: ServiceUpcomingProps) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#141417] p-6 shadow-xs sm:p-8 ${className}`}>
      {/* Decorative top accent gradient */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-[#0A84FF] ring-1 ring-blue-100 dark:ring-blue-900/30">
            <Icon className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">{title}</h3>
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-950/40 px-2.5 py-0.5 text-[11px] font-bold text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-900/40">
                <Sparkles className="h-3 w-3" />
                {badge}
              </span>
            </div>
            <p className="mt-1.5 text-xs text-slate-500 dark:text-[#A1A1AA] leading-relaxed max-w-2xl">
              {description}
            </p>
          </div>
        </div>
      </div>

      {plannedFeatures.length > 0 && (
        <div className="mt-6 rounded-xl border border-slate-100 dark:border-white/[0.06] bg-slate-50/60 dark:bg-[#1A1A1E] p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#71717A]">
            Planned Capabilities in this Module
          </p>
          <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {plannedFeatures.map((feat, index) => (
              <div key={index} className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-blue-600 dark:text-[#0A84FF] mt-0.5" />
                <span>{feat}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {technicalNote && (
        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-slate-200/60 dark:border-white/[0.06] bg-white dark:bg-[#17171B] p-3.5 text-xs text-slate-500 dark:text-[#8E8E93]">
          <AlertCircle className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500 mt-0.5" />
          <div className="text-[11px] leading-relaxed">
            <strong className="font-semibold text-slate-700 dark:text-slate-300">Engineering Status: </strong>
            {technicalNote}
          </div>
        </div>
      )}
    </div>
  );
}
