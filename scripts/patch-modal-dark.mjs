import fs from 'node:fs';

const filePath = 'src/contexts/ModalContext.tsx';
let content = fs.readFileSync(filePath, 'utf8');

function replaceNormalized(source, search, replacement) {
  const normSearchLF = search.replace(/\r\n/g, '\n');
  const normSearchCRLF = search.replace(/\r?\n/g, '\r\n');
  const normRepl = source.includes('\r\n')
    ? replacement.replace(/\r?\n/g, '\r\n')
    : replacement.replace(/\r\n/g, '\n');

  if (source.includes(normSearchCRLF)) return source.replace(normSearchCRLF, normRepl);
  if (source.includes(normSearchLF)) return source.replace(normSearchLF, normRepl);
  return null;
}

const targetModal = `          <div
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
              )}`;

const replacementModal = `          <div
            className="w-full max-w-sm sm:max-w-md rounded-lg border border-black/[0.08] dark:border-white/[0.12] bg-white dark:bg-[#1c1c1e] p-5 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150"
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
                <h3 className="text-sm sm:text-base font-bold text-[#0F172A] dark:text-[#f5f5f7] leading-snug">
                  {modal.title}
                </h3>
              </div>

              <button
                type="button"
                onClick={handleCancel}
                aria-label="Close dialog"
                className="cursor-pointer -mr-1 -mt-1 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-[#f5f5f7] rounded-md transition hover:bg-slate-100 dark:hover:bg-white/[0.08]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Message Body */}
            <div className="pl-[50px] text-xs sm:text-sm text-[#475569] dark:text-[#a1a1a6] leading-relaxed whitespace-pre-line">
              {modal.message}
            </div>

            {/* Actions Toolbar */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-black/[0.06] dark:border-white/[0.08]">
              {modal.type === 'confirm' && (
                <button
                  type="button"
                  onClick={handleCancel}
                  className="cursor-pointer rounded-md border border-slate-200 dark:border-white/[0.12] bg-white dark:bg-white/[0.08] px-3.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-[#f5f5f7] shadow-2xs hover:bg-slate-50 dark:hover:bg-white/[0.12] transition active:scale-[0.98]"
                >
                  {modal.cancelText}
                </button>
              )}`;

const r = replaceNormalized(content, targetModal, replacementModal);
if (r) {
  content = r;
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✓ Updated ModalContext dark styling');
} else {
  console.log('✗ Could not match targetModal in ModalContext');
}
