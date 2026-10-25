import fs from 'fs';

let code = fs.readFileSync('src/features/profile/components/ProfileDialog.tsx', 'utf8');

function replaceNormalized(source, search, replacement) {
  if (source.includes(search)) {
    return source.replace(search, replacement);
  }
  const searchCRLF = search.replace(/\r?\n/g, '\r\n');
  const searchLF = search.replace(/\r?\n/g, '\n');
  if (source.includes(searchCRLF)) {
    return source.replace(searchCRLF, replacement.replace(/\r?\n/g, '\r\n'));
  }
  if (source.includes(searchLF)) {
    return source.replace(searchLF, replacement.replace(/\r?\n/g, '\n'));
  }
  console.warn('Could not find match for:', search.slice(0, 40));
  return source;
}

code = replaceNormalized(
  code,
  '<h3 className="flex items-center gap-2 text-[13px] font-semibold text-[#1d1d1f]">\n                  <UserRound size={15} className="text-[var(--workspace-accent,#007AFF)]" /> Account role',
  '<h3 className="flex items-center gap-2 text-[13px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">\n                  <UserRound size={15} className="text-[var(--workspace-accent,#007AFF)]" /> Account role'
);

code = replaceNormalized(
  code,
  '<h3 className="flex items-center gap-2 text-[13px] font-semibold text-[#1d1d1f]">\n              <SunMoon size={15} className="text-[var(--workspace-accent,#007AFF)]" /> Appearance',
  '<h3 className="flex items-center gap-2 text-[13px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">\n              <SunMoon size={15} className="text-[var(--workspace-accent,#007AFF)]" /> Appearance'
);

code = replaceNormalized(
  code,
  '<p className="mt-1 text-[11px] text-[#6e6e73]">\n              Choose how ParkJom looks.',
  '<p className="mt-1 text-[11px] text-[#6e6e73] dark:text-[#a1a1a6]">\n              Choose how ParkJom looks.'
);

code = replaceNormalized(
  code,
  '<div className="rounded-2xl border border-rose-200 bg-white p-4 sm:p-5">',
  '<div className="rounded-2xl border border-rose-200 dark:border-rose-900/40 bg-white dark:bg-[#1c1c1e] p-4 sm:p-5">'
);

code = replaceNormalized(
  code,
  '<p className="mt-1 text-[11px] text-[#6e6e73]">\n                    Not possible while you have',
  '<p className="mt-1 text-[11px] text-[#6e6e73] dark:text-[#a1a1a6]">\n                    Not possible while you have'
);

code = replaceNormalized(
  code,
  '<label className="flex items-start gap-2 text-[11px] text-[#3a3a3c]">',
  '<label className="flex items-start gap-2 text-[11px] text-[#3a3a3c] dark:text-[#f5f5f7]">'
);

fs.writeFileSync('src/features/profile/components/ProfileDialog.tsx', code, 'utf8');
console.log('ProfileDialog dark text updated!');
