import fs from 'node:fs';

const filePath = 'src/components/layout/DashboardHeader.tsx';
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

// 1. Brand title & subtitle
const targetBrand = `<span className="font-semibold text-[15px] text-[#111] tracking-[-0.02em] truncate">
                  ParkJom
                </span>
                {badge && (
                  <span
                    className={\`hidden sm:inline text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0 \${
                      BADGE_STYLES[badge.variant ?? 'success']
                    }\`}
                  >
                    {badge.label}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#6e6e73] font-medium leading-none mt-0.5 truncate hidden sm:block">
                {meta.portal}
              </p>`;

const replacementBrand = `<span className="font-semibold text-[15px] text-[#111] dark:text-[#f5f5f7] tracking-[-0.02em] truncate">
                  ParkJom
                </span>
                {badge && (
                  <span
                    className={\`hidden sm:inline text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0 \${
                      BADGE_STYLES[badge.variant ?? 'success']
                    }\`}
                  >
                    {badge.label}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#6e6e73] dark:text-[#a1a1a6] font-medium leading-none mt-0.5 truncate hidden sm:block">
                {meta.portal}
              </p>`;

// 2. Account button display name
const targetUser = `<span className="hidden lg:inline max-w-[150px] truncate text-[13px] font-semibold text-[#333]">
                  {displayName}
                </span>`;

const replacementUser = `<span className="hidden lg:inline max-w-[150px] truncate text-[13px] font-semibold text-[#333] dark:text-[#f5f5f7]">
                  {displayName}
                </span>`;

let r = replaceNormalized(content, targetBrand, replacementBrand);
if (r) {
  content = r;
  console.log('✓ Updated brand title in DashboardHeader');
} else {
  console.log('✗ Failed brand title');
}

r = replaceNormalized(content, targetUser, replacementUser);
if (r) {
  content = r;
  console.log('✓ Updated account user text in DashboardHeader');
} else {
  console.log('✗ Failed account user text');
}

fs.writeFileSync(filePath, content, 'utf8');
