import fs from 'node:fs';

function replaceNormalized(filePath, search, replacement) {
  let content = fs.readFileSync(filePath, 'utf8');
  const normSearchLF = search.replace(/\r\n/g, '\n');
  const normSearchCRLF = search.replace(/\r?\n/g, '\r\n');
  const normRepl = content.includes('\r\n')
    ? replacement.replace(/\r?\n/g, '\r\n')
    : replacement.replace(/\r\n/g, '\n');

  if (content.includes(normSearchCRLF)) {
    content = content.replace(normSearchCRLF, normRepl);
    fs.writeFileSync(filePath, content, 'utf8');
    return true;
  }
  if (content.includes(normSearchLF)) {
    content = content.replace(normSearchLF, normRepl);
    fs.writeFileSync(filePath, content, 'utf8');
    return true;
  }
  return false;
}

// =========================================================================
// 1. UPDATE index.css
// =========================================================================
console.log('1. Updating index.css...');
let css = fs.readFileSync('src/app/styles/index.css', 'utf8');

// A. Google Sign-in shell pill clipping
const oldGoogleCss = `.google-signin-shell {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 44px;
}`;

const newGoogleCss = `.google-signin-shell {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  max-width: 380px;
  min-height: 40px;
  border-radius: 9999px !important;
  overflow: hidden !important;
}

.google-signin-shell iframe {
  border-radius: 9999px !important;
  overflow: hidden !important;
}`;

replaceNormalized('src/app/styles/index.css', oldGoogleCss, newGoogleCss);

// B. Search results dropdown dark styles
const targetSearchResultSvg = `.workspace-header__search-result svg {
  color: #8e8e93;
}`;

const searchResultDarkCss = `.workspace-header__search-result svg {
  color: #8e8e93;
}

.dark .workspace-header__search-results,
.dark .workspace-header__mobile-search {
  background: #1c1c1e !important;
  border: 1px solid rgba(255, 255, 255, 0.12) !important;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.6) !important;
}

.dark .workspace-header__search-result {
  color: #f5f5f7 !important;
}

.dark .workspace-header__search-result svg {
  color: #8e8e93 !important;
}

.dark .workspace-header__search-result:hover,
.dark .workspace-header__search-result:focus-visible {
  background: rgba(255, 255, 255, 0.08) !important;
  color: #0a84ff !important;
}

.dark .workspace-header__search-result:hover svg,
.dark .workspace-header__search-result:focus-visible svg {
  color: #0a84ff !important;
}

.dark .workspace-header__search-empty {
  color: #8e8e93 !important;
}

.dark .workspace-header__mobile-search-field {
  border-color: rgba(255, 255, 255, 0.12) !important;
  color: #8e8e93 !important;
}

.dark .workspace-header__mobile-search-field input {
  color: #f5f5f7 !important;
}`;

if (!css.includes('.dark .workspace-header__search-results')) {
  replaceNormalized('src/app/styles/index.css', targetSearchResultSvg, searchResultDarkCss);
}

// C. Map control pills styling (consistent Apple floating pills for radius, lines, bus, legend)
const mapControlCss = `
/* ── Apple Floating Map Controls (Consistent pill styling across all controls) ── */
.workspace-map-control,
.map-capsule {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  height: 2.5rem !important;
  min-height: 2.5rem !important;
  border-radius: 9999px !important;
  padding-inline: 0.875rem !important;
  font-size: 0.8125rem !important;
  font-weight: 600 !important;
  letter-spacing: -0.01em !important;
  line-height: 1 !important;
  background-color: rgba(255, 255, 255, 0.92) !important;
  color: #1d1d1f !important;
  border: 1px solid rgba(0, 0, 0, 0.08) !important;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04) !important;
  backdrop-filter: blur(16px) saturate(180%) !important;
  -webkit-backdrop-filter: blur(16px) saturate(180%) !important;
  transition: all 180ms ease !important;
}

.workspace-map-control:hover,
.map-capsule:hover {
  background-color: #ffffff !important;
  border-color: rgba(0, 0, 0, 0.14) !important;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.12) !important;
}

.dark .workspace-map-control,
.dark .map-capsule {
  background-color: rgba(28, 28, 30, 0.88) !important;
  color: #f5f5f7 !important;
  border: 1px solid rgba(255, 255, 255, 0.14) !important;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.45) !important;
}

.dark .workspace-map-control:hover,
.dark .map-capsule:hover {
  background-color: rgba(44, 44, 46, 0.95) !important;
  border-color: rgba(255, 255, 255, 0.22) !important;
}

.dark .workspace-map-control.is-active-bus,
.dark .map-capsule.is-active-bus {
  background-color: #059669 !important;
  border-color: #10b981 !important;
  color: #ffffff !important;
}
`;

css = fs.readFileSync('src/app/styles/index.css', 'utf8');
if (!css.includes('/* ── Apple Floating Map Controls')) {
  css += '\n' + mapControlCss;
  fs.writeFileSync('src/app/styles/index.css', css, 'utf8');
  console.log('✓ Added Apple Floating Map Controls CSS');
}

// D. Expand dark surface remapping to include bg-[#f8f9fa], bg-slate-50/*, bg-slate-100/*
const oldSurfaceRule = `.dark .app-workspace :where(.bg-slate-50, .bg-slate-100, [class~="bg-slate-50"], [class~="bg-slate-100"], [class~="bg-[#f2f2f7]"], [class~="bg-[#f5f5f7]"], [class~="bg-[#f1f3f4]"]) {
  background-color: rgba(255, 255, 255, 0.06) !important;
}`;

const newSurfaceRule = `.dark .app-workspace :where(
  .bg-slate-50, .bg-slate-100,
  [class~="bg-slate-50"], [class~="bg-slate-100"],
  [class*="bg-slate-50/"], [class*="bg-slate-100/"],
  [class~="bg-[#f2f2f7]"], [class~="bg-[#f5f5f7]"], [class~="bg-[#f1f3f4]"],
  [class~="bg-[#f8f9fa]"], [class*="bg-[#f8f9fa]"],
  [class~="bg-[#eff6ff]"], [class*="bg-[#eff6ff]"],
  [class~="bg-[#f9fafb]"], [class*="bg-[#f9fafb]"]
) {
  background-color: rgba(255, 255, 255, 0.05) !important;
}

/* Table row hover fix for dark mode */
.dark .app-workspace tr,
.dark .app-workspace tbody tr {
  transition: background-color 150ms ease;
}

.dark .app-workspace :where(tr[class*="hover:bg-"], tbody tr):hover,
.dark .app-workspace tr:hover,
.dark .app-workspace tr[class*="hover:bg-slate-50"]:hover,
.dark .app-workspace [class*="hover:bg-slate-50\/50"]:hover,
.dark .app-workspace [class*="hover:bg-slate-50\/70"]:hover {
  background-color: rgba(255, 255, 255, 0.04) !important;
}

.dark .app-workspace tr:hover td {
  background-color: transparent !important;
}`;

replaceNormalized('src/app/styles/index.css', oldSurfaceRule, newSurfaceRule);
console.log('✓ Updated dark surface and table hover remapping in index.css');


// =========================================================================
// 2. UPDATE CommuterMap.tsx (Consistent Apple Pill Controls)
// =========================================================================
console.log('2. Updating CommuterMap.tsx...');
let commuterMap = fs.readFileSync('src/features/commuter/components/CommuterMap.tsx', 'utf8');

// Update Legend button to be identical pill to Lines and Bus Routes
const oldLegendBtn = `<button
            type="button"
            data-map-control
            onClick={() => setOpenPanel((panel) => panel === 'legend' ? null : 'legend')}
            aria-expanded={openPanel === 'legend'}
            aria-controls="map-legend-modal"
            className="workspace-map-control hidden sm:flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white/95 px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-xs backdrop-blur hover:bg-slate-50"
          >
            <Info className="h-3.5 w-3.5 text-blue-600" />
            Legend
          </button>`;

const newLegendBtn = `<button
            type="button"
            data-map-control
            onClick={() => setOpenPanel((panel) => panel === 'legend' ? null : 'legend')}
            aria-expanded={openPanel === 'legend'}
            aria-controls="map-legend-modal"
            className="map-capsule workspace-map-control hidden sm:flex items-center gap-1.5 whitespace-nowrap px-3.5 text-[13px] font-semibold"
          >
            <Info className="h-3.5 w-3.5 text-blue-600" />
            Legend
          </button>`;

replaceNormalized('src/features/commuter/components/CommuterMap.tsx', oldLegendBtn, newLegendBtn);
console.log('✓ Updated Legend button in CommuterMap.tsx to match pill group');


// =========================================================================
// 3. UPDATE TransitHubSheet.tsx (Transit Explorer Dark Mode Contrast)
// =========================================================================
console.log('3. Updating TransitHubSheet.tsx...');
let transitHub = fs.readFileSync('src/features/commuter/components/TransitHubSheet.tsx', 'utf8');

// Station header card: replace bg-slate-50/70 with dark:bg-white/[0.05]
transitHub = transitHub.replace(
  'className="bg-slate-50/70 rounded-xl p-3 border border-slate-200/80"',
  'className="bg-slate-50/70 dark:bg-white/[0.05] rounded-xl p-3 border border-slate-200/80 dark:border-white/[0.08]"'
);

// Station name text
transitHub = transitHub.replace(
  'className="text-sm font-bold text-slate-900 truncate"',
  'className="text-sm font-bold text-slate-900 dark:text-[#f5f5f7] truncate"'
);

// Accessible badge
transitHub = transitHub.replace(
  'className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-white text-slate-600 border border-slate-200"',
  'className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-white dark:bg-white/[0.08] text-slate-600 dark:text-[#f5f5f7] border border-slate-200 dark:border-white/[0.12]"'
);

// Route name text
transitHub = transitHub.replace(
  'className="text-[11px] text-slate-500 mt-0.5 truncate"',
  'className="text-[11px] text-slate-500 dark:text-[#a1a1a6] mt-0.5 truncate"'
);

// Operating hours text
transitHub = transitHub.replace(
  'className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-500"',
  'className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-500 dark:text-[#a1a1a6]"'
);

// Search input
transitHub = transitHub.replace(
  'className="w-full h-8 pl-8 pr-7 bg-white border border-slate-200 rounded-lg text-xs font-normal text-slate-900 placeholder-slate-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"',
  'className="w-full h-8 pl-8 pr-7 bg-white dark:bg-white/[0.06] border border-slate-200 dark:border-white/[0.12] rounded-lg text-xs font-normal text-slate-900 dark:text-[#f5f5f7] placeholder-slate-400 dark:placeholder-[#8e8e93] outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"'
);

// All Lines button
transitHub = transitHub.replace(
  `className={\`h-6 px-2.5 rounded-md text-[11px] font-semibold whitespace-nowrap transition-colors \${
              selectedLineFilter === 'ALL'
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-100'
            }\`}`,
  `className={\`h-6 px-2.5 rounded-md text-[11px] font-semibold whitespace-nowrap transition-colors \${
              selectedLineFilter === 'ALL'
                ? 'bg-slate-900 dark:bg-[#0a84ff] text-white'
                : 'bg-white dark:bg-white/[0.08] text-slate-600 dark:text-[#a1a1a6] border border-slate-200/80 dark:border-white/[0.12] hover:bg-slate-100 dark:hover:bg-white/[0.14]'
            }\`}`
);

// Route chips
transitHub = transitHub.replace(
  `className={\`h-6 px-2 rounded-md text-[11px] font-medium flex items-center gap-1.5 whitespace-nowrap transition-all border \${
                  isSelected
                    ? 'bg-slate-900 text-white border-slate-900 font-semibold'
                    : 'bg-white text-slate-700 border-slate-200/80 hover:bg-slate-50'
                }\`}`,
  `className={\`h-6 px-2 rounded-md text-[11px] font-medium flex items-center gap-1.5 whitespace-nowrap transition-all border \${
                  isSelected
                    ? 'bg-slate-900 dark:bg-[#0a84ff] text-white border-slate-900 dark:border-[#0a84ff] font-semibold'
                    : 'bg-white dark:bg-white/[0.08] text-slate-700 dark:text-[#f5f5f7] border border-slate-200/80 dark:border-white/[0.12] hover:bg-slate-50 dark:hover:bg-white/[0.14]'
                }\`}`
);

// Segmented sub-tabs
transitHub = transitHub.replace(
  'className="flex bg-slate-100 p-0.5 rounded-lg text-xs font-semibold"',
  'className="flex bg-slate-100 dark:bg-white/[0.06] p-0.5 rounded-lg text-xs font-semibold"'
);

// Departures tab active
transitHub = transitHub.replace(
  "stationTab === 'departures'\n                    ? 'bg-white text-slate-900 shadow-xs'\n                    : 'text-slate-500 hover:text-slate-800'",
  "stationTab === 'departures'\n                    ? 'bg-white dark:bg-[#2c2c2e] text-slate-900 dark:text-[#f5f5f7] shadow-xs'\n                    : 'text-slate-500 dark:text-[#a1a1a6] hover:text-slate-800 dark:hover:text-[#f5f5f7]'"
);

// Feeders tab active
transitHub = transitHub.replace(
  "stationTab === 'feeders'\n                    ? 'bg-white text-emerald-800 shadow-xs'\n                    : 'text-slate-500 hover:text-slate-800'",
  "stationTab === 'feeders'\n                    ? 'bg-white dark:bg-[#2c2c2e] text-emerald-800 dark:text-emerald-400 shadow-xs'\n                    : 'text-slate-500 dark:text-[#a1a1a6] hover:text-slate-800 dark:hover:text-[#f5f5f7]'"
);

// Bays tab active
transitHub = transitHub.replace(
  "stationTab === 'bays'\n                    ? 'bg-white text-slate-900 shadow-xs'\n                    : 'text-slate-500 hover:text-slate-800'",
  "stationTab === 'bays'\n                    ? 'bg-white dark:bg-[#2c2c2e] text-slate-900 dark:text-[#f5f5f7] shadow-xs'\n                    : 'text-slate-500 dark:text-[#a1a1a6] hover:text-slate-800 dark:hover:text-[#f5f5f7]'"
);

// Main transit hub container dark classes
transitHub = transitHub.replace(
  'className={`transit-hub-panel flex flex-col h-full bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden ${className}`}',
  'className={`transit-hub-panel flex flex-col h-full bg-white dark:bg-[#1c1c1e] rounded-2xl border border-slate-200/80 dark:border-white/[0.12] shadow-xs overflow-hidden ${className}`}'
);

transitHub = transitHub.replace(
  'className="px-4 py-3 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white"',
  'className="px-4 py-3 border-b border-slate-100 dark:border-white/[0.08] flex items-center justify-between shrink-0 bg-white dark:bg-[#1c1c1e]"'
);

transitHub = transitHub.replace(
  'className="text-xs font-bold text-slate-900 tracking-tight"',
  'className="text-xs font-bold text-slate-900 dark:text-[#f5f5f7] tracking-tight"'
);

transitHub = transitHub.replace(
  'className="px-4 py-2.5 shrink-0 space-y-2 border-b border-slate-100 bg-slate-50/40"',
  'className="px-4 py-2.5 shrink-0 space-y-2 border-b border-slate-100 dark:border-white/[0.08] bg-slate-50/40 dark:bg-white/[0.02]"'
);

fs.writeFileSync('src/features/commuter/components/TransitHubSheet.tsx', transitHub, 'utf8');
console.log('✓ Updated TransitHubSheet.tsx dark mode contrast');


// =========================================================================
// 4. UPDATE CommuterDashboard.tsx (Parking Card Contrast)
// =========================================================================
console.log('4. Updating CommuterDashboard.tsx...');
let commuterDash = fs.readFileSync('src/features/commuter/pages/CommuterDashboard.tsx', 'utf8');

const oldDailyRateCard = `<div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-[#f8f9fa] p-3 text-[11px]"><div><span className="block text-[10px] text-[#9ca3af]">Daily rate</span><strong className="mt-0.5 block text-[#111]">{spot.dailyRate === null ? 'Not set' : \`RM \${spot.dailyRate.toFixed(2)}\`}</strong></div><div><span className="block text-[10px] text-[#9ca3af]">To station</span><strong className="mt-0.5 block text-[#111]">{(spot.distanceToStation ?? 0).toFixed(2)} km</strong></div></div>`;

const newDailyRateCard = `<div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-[#f8f9fa] dark:bg-white/[0.06] p-3 text-[11px]"><div><span className="block text-[10px] text-[#9ca3af] dark:text-[#a1a1a6]">Daily rate</span><strong className="mt-0.5 block text-[#111] dark:text-[#f5f5f7]">{spot.dailyRate === null ? 'Not set' : \`RM \${spot.dailyRate.toFixed(2)}\`}</strong></div><div><span className="block text-[10px] text-[#9ca3af] dark:text-[#a1a1a6]">To station</span><strong className="mt-0.5 block text-[#111] dark:text-[#f5f5f7]">{(spot.distanceToStation ?? 0).toFixed(2)} km</strong></div></div>`;

commuterDash = commuterDash.replace(oldDailyRateCard, newDailyRateCard);

// Favorite spot card dark background
commuterDash = commuterDash.replace(
  'className="overflow-hidden rounded-2xl border border-[#e8eaed] bg-white shadow-[0_6px_18px_rgba(15,23,42,0.06)]"',
  'className="overflow-hidden rounded-2xl border border-[#e8eaed] dark:border-white/[0.08] bg-white dark:bg-[#1c1c1e] shadow-[0_6px_18px_rgba(15,23,42,0.06)]"'
);

commuterDash = commuterDash.replace(
  'className="truncate text-[15px] font-semibold text-[#111]"',
  'className="truncate text-[15px] font-semibold text-[#111] dark:text-[#f5f5f7]"'
);

commuterDash = commuterDash.replace(
  'className="mt-1 text-[11px] text-[#5f6368]"',
  'className="mt-1 text-[11px] text-[#5f6368] dark:text-[#a1a1a6]"'
);

commuterDash = commuterDash.replace(
  'className="mt-2 line-clamp-2 text-[11px] text-[#6e6e73]"',
  'className="mt-2 line-clamp-2 text-[11px] text-[#6e6e73] dark:text-[#a1a1a6]"'
);

fs.writeFileSync('src/features/commuter/pages/CommuterDashboard.tsx', commuterDash, 'utf8');
console.log('✓ Updated CommuterDashboard.tsx parking card contrast');


// =========================================================================
// 5. UPDATE GoogleLoginButton.tsx (Pill border clipping)
// =========================================================================
console.log('5. Updating GoogleLoginButton.tsx...');
let googleBtn = fs.readFileSync('src/features/auth/components/GoogleLoginButton.tsx', 'utf8');

googleBtn = googleBtn.replace(
  'className="flex justify-center shrink-0"',
  'className="flex justify-center shrink-0 rounded-full overflow-hidden"'
);

fs.writeFileSync('src/features/auth/components/GoogleLoginButton.tsx', googleBtn, 'utf8');
console.log('✓ Updated GoogleLoginButton.tsx wrapper to rounded-full overflow-hidden');

console.log('All design fixes successfully applied!');
