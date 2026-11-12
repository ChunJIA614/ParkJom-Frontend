import React from 'react';

interface AppleCapacityBadgeProps {
  available: number;
  total: number;
  size?: 'sm' | 'md' | 'lg';
  showPercent?: boolean;
}

export const AppleCapacityBadge: React.FC<AppleCapacityBadgeProps> = ({
  available,
  total,
  size = 'md',
  showPercent = false,
}) => {
  const isFull = available <= 0;
  const isLow = !isFull && available <= Math.max(2, Math.floor(total * 0.15));

  const statusColor = isFull
    ? 'text-[#ff3b30] bg-[#ff3b30]/10 border-[#ff3b30]/20 dark:bg-[#ff453a]/15 dark:border-[#ff453a]/30'
    : isLow
    ? 'text-[#ff9500] bg-[#ff9500]/10 border-[#ff9500]/20 dark:bg-[#ff9f0a]/15 dark:border-[#ff9f0a]/30'
    : 'text-[#34c759] bg-[#34c759]/10 border-[#34c759]/20 dark:bg-[#30d158]/15 dark:border-[#30d158]/30';

  const dotColor = isFull
    ? 'bg-[#ff3b30] dark:bg-[#ff453a]'
    : isLow
    ? 'bg-[#ff9500] dark:bg-[#ff9f0a]'
    : 'bg-[#34c759] dark:bg-[#30d158]';

  const sizeClasses = {
    sm: 'text-xs px-2.5 py-1 gap-1.5',
    md: 'text-sm px-3.5 py-1.5 gap-2 font-medium',
    lg: 'text-base px-4 py-2 gap-2.5 font-semibold',
  }[size];

  const percentAvailable = total > 0 ? Math.round((available / total) * 100) : 0;

  return (
    <div
      className={`inline-flex items-center rounded-full border backdrop-blur-md transition-all duration-300 shadow-xs ${statusColor} ${sizeClasses}`}
    >
      <span className="relative flex h-2 w-2">
        {!isFull && (
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${dotColor}`}
          />
        )}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${dotColor}`} />
      </span>

      <span>
        {isFull ? (
          'Lot Full'
        ) : (
          <>
            <strong className="font-semibold">{available}</strong> of {total} Left
          </>
        )}
      </span>

      {showPercent && (
        <span className="opacity-70 text-[11px] font-mono ml-0.5">({percentAvailable}%)</span>
      )}
    </div>
  );
};
