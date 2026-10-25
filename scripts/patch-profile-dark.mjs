import fs from 'node:fs';

const filePath = 'src/features/profile/components/ProfileDialog.tsx';
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

// 1. inputClass
const oldInput = `const inputClass = 'w-full rounded-xl border border-black/[0.08] bg-white px-3.5 py-2.5 text-[13px] text-[#1d1d1f] transition-colors focus:border-[var(--workspace-accent,#007AFF)] focus:outline-none focus:ring-2 focus:ring-[var(--workspace-accent-soft,#e8f0fe)] disabled:bg-[#f5f5f7] disabled:text-[#8e8e93]';`;
const newInput = `const inputClass = 'w-full rounded-xl border border-black/[0.08] dark:border-white/[0.12] bg-white dark:bg-[#1c1c1e] px-3.5 py-2.5 text-[13px] text-[#1d1d1f] dark:text-[#f5f5f7] transition-colors focus:border-[var(--workspace-accent,#007AFF)] focus:outline-none focus:ring-2 focus:ring-[var(--workspace-accent-soft,#e8f0fe)] disabled:bg-[#f5f5f7] dark:disabled:bg-white/[0.04] disabled:text-[#8e8e93]';`;

let r = replaceNormalized(content, oldInput, newInput);
if (r) { content = r; console.log('✓ Updated inputClass in ProfileDialog'); }

// 2. Dialog section container & header
const oldHeader = `      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-dialog-title"
        className="relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl bg-[#f5f5f7] shadow-[0_24px_60px_rgba(15,23,42,0.25)] sm:max-w-2xl sm:rounded-3xl"
      >
        <header className="flex items-center justify-between border-b border-black/[0.06] bg-white px-5 py-4">
          <div>
            <h2 id="profile-dialog-title" className="text-[16px] font-semibold text-[#1d1d1f]">My profile</h2>
            <p className="text-[11px] text-[#6e6e73]">Manage your personal details, role, and account.</p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            disabled={isBusy}
            aria-label="Close"
            className="rounded-full p-2 text-[#6e6e73] transition-colors hover:bg-black/[0.05] hover:text-[#1d1d1f] disabled:opacity-40"
          >
            <X size={18} />
          </button>
        </header>`;

const newHeader = `      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-dialog-title"
        className="relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl bg-[#f5f5f7] dark:bg-[#121214] shadow-[0_24px_60px_rgba(15,23,42,0.25)] sm:max-w-2xl sm:rounded-3xl border border-transparent dark:border-white/[0.08]"
      >
        <header className="flex items-center justify-between border-b border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-[#1c1c1e] px-5 py-4">
          <div>
            <h2 id="profile-dialog-title" className="text-[16px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">My profile</h2>
            <p className="text-[11px] text-[#6e6e73] dark:text-[#a1a1a6]">Manage your personal details, role, and account.</p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            disabled={isBusy}
            aria-label="Close"
            className="rounded-full p-2 text-[#6e6e73] dark:text-[#a1a1a6] transition-colors hover:bg-black/[0.05] dark:hover:bg-white/[0.08] hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7] disabled:opacity-40"
          >
            <X size={18} />
          </button>
        </header>`;

r = replaceNormalized(content, oldHeader, newHeader);
if (r) { content = r; console.log('✓ Updated dialog container & header in ProfileDialog'); }

// 3. Identity card
const oldIdentity = `<div className="rounded-2xl border border-black/[0.06] bg-white p-4 sm:p-5">`;
const newIdentity = `<div className="rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-[#1c1c1e] p-4 sm:p-5">`;
r = replaceNormalized(content, oldIdentity, newIdentity);
if (r) { content = r; console.log('✓ Updated identity card in ProfileDialog'); }

fs.writeFileSync(filePath, content, 'utf8');
