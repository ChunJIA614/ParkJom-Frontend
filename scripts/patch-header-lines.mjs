import fs from 'node:fs';

const path = 'src/components/layout/DashboardHeader.tsx';
const lines = fs.readFileSync(path, 'utf8').split(/\r?\n/);

const startIdx = lines.findIndex(l => l.includes('className="workspace-header__appearance"'));
if (startIdx !== -1) {
  const endIdx = lines.findIndex((l, i) => i >= startIdx && l.includes('</div>') && lines[i - 1]?.includes('<ThemeSegmentedControl'));
  if (endIdx !== -1) {
    const replacement = [
      '                  <div className="border-t border-b border-[#f1f3f4] dark:border-white/[0.08] px-3 py-2.5 space-y-2">',
      '                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#8e8e93] dark:text-[#a1a1a6] tracking-wide">',
      '                      <SunMoon size={14} aria-hidden="true" className="text-[var(--system-primary,#0071e3)] dark:text-[#0a84ff]" />',
      '                      <span>Appearance</span>',
      '                    </div>',
      '                    <ThemeSegmentedControl size="compact" />',
      '                  </div>'
    ];
    lines.splice(startIdx, endIdx - startIdx + 1, ...replacement);
    fs.writeFileSync(path, lines.join('\r\n'), 'utf8');
    console.log('Successfully replaced lines in DashboardHeader.tsx');
  } else {
    console.log('endIdx not found');
  }
} else {
  console.log('startIdx not found');
}
