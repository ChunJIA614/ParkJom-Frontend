import fs from 'node:fs';

const path = 'src/components/layout/DashboardHeader.tsx';
let content = fs.readFileSync(path, 'utf8');

const oldBlock = `<div className="workspace-header__appearance">
                    <div className="workspace-header__appearance-head">
                      <SunMoon size={16} aria-hidden="true" />
                      <span>Appearance</span>
                    </div>
                    <ThemeSegmentedControl />
                  </div>`;

const newBlock = `<div className="border-t border-b border-[#f1f3f4] dark:border-white/[0.08] px-3 py-2.5 space-y-2">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#8e8e93] dark:text-[#a1a1a6] tracking-wide">
                      <SunMoon size={14} aria-hidden="true" className="text-[var(--system-primary,#0071e3)] dark:text-[#0a84ff]" />
                      <span>Appearance</span>
                    </div>
                    <ThemeSegmentedControl size="compact" />
                  </div>`;

// Replace ignoring line ending differences
content = content.replace(new RegExp(oldBlock.replace(/\r?\n\s*/g, '\\s*')), newBlock);
fs.writeFileSync(path, content, 'utf8');
console.log('Patched DashboardHeader.tsx successfully');
