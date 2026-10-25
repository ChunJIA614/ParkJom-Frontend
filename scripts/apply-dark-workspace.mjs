import fs from 'node:fs';

const filePath = 'src/app/styles/index.css';
let css = fs.readFileSync(filePath, 'utf8');

function replaceNormalized(source, search, replacement) {
  const normSearchLF = search.replace(/\r\n/g, '\n');
  const normSearchCRLF = search.replace(/\r?\n/g, '\r\n');
  const normRepl = source.includes('\r\n')
    ? replacement.replace(/\r?\n/g, '\r\n')
    : replacement.replace(/\r\n/g, '\n');

  if (source.includes(normSearchCRLF)) {
    return source.replace(normSearchCRLF, normRepl);
  }
  if (source.includes(normSearchLF)) {
    return source.replace(normSearchLF, normRepl);
  }
  return null;
}

// 1. Update .page-shell and .app-workspace block
const targetWorkspace = `.page-shell {
  min-height: 100dvh;
  background: var(--color-bg-secondary);
}

/* ── Authenticated product: Apple-minimal operating system ── */
.app-workspace {
  --workspace-accent: #007aff;
  --workspace-accent-soft: #e8f0fe;
  --workspace-text: #1d1d1f;
  --workspace-text-secondary: #6e6e73;
  --workspace-text-tertiary: #8e8e93;
  --workspace-surface: #ffffff;
  --workspace-surface-muted: #f5f5f7;
  --workspace-border: rgba(0, 0, 0, 0.08);
  min-height: 100dvh;
  background: var(--workspace-surface-muted);
  color: var(--workspace-text);
  font-family: var(--font-sans);
  font-size: 0.875rem;
  line-height: 1.45;
  letter-spacing: -0.01em;
}`;

const replacementWorkspace = `.page-shell {
  min-height: 100dvh;
  background: var(--color-bg-secondary);
}

.dark body,
.dark .page-shell {
  background-color: #000000 !important;
  color: #f5f5f7 !important;
}

/* ── Authenticated product: Apple-minimal operating system ── */
.app-workspace {
  --workspace-accent: #007aff;
  --workspace-accent-soft: #e8f0fe;
  --workspace-text: #1d1d1f;
  --workspace-text-secondary: #6e6e73;
  --workspace-text-tertiary: #8e8e93;
  --workspace-surface: #ffffff;
  --workspace-surface-muted: #f5f5f7;
  --workspace-border: rgba(0, 0, 0, 0.08);
  min-height: 100dvh;
  background: var(--workspace-surface-muted);
  color: var(--workspace-text);
  font-family: var(--font-sans);
  font-size: 0.875rem;
  line-height: 1.45;
  letter-spacing: -0.01em;
}

.dark .app-workspace {
  --workspace-accent: #0a84ff;
  --workspace-accent-soft: rgba(10, 132, 255, 0.15);
  --workspace-text: #f5f5f7;
  --workspace-text-secondary: #a1a1a6;
  --workspace-text-tertiary: #636366;
  --workspace-surface: #1c1c1e;
  --workspace-surface-muted: #000000;
  --workspace-border: rgba(255, 255, 255, 0.12);
  background: var(--workspace-surface-muted) !important;
  color: var(--workspace-text) !important;
}`;

const r1 = replaceNormalized(css, targetWorkspace, replacementWorkspace);
if (r1) {
  css = r1;
  console.log('✓ Replaced workspace base tokens');
} else {
  console.log('✗ Could not find targetWorkspace');
}

// 2. Update typography normalization in .app-workspace
const targetTypo = `.app-workspace :where(.text-slate-950, .text-slate-900, .text-slate-800),
.app-workspace [class~="text-[#111]"],
.app-workspace [class~="text-[#1E293B]"],
.app-workspace [class~="text-[#1e293b]"] { color: var(--workspace-text) !important; }

.app-workspace :where(.text-slate-700, .text-slate-600, .text-slate-500),
.app-workspace [class~="text-[#333]"],
.app-workspace [class~="text-[#5f6368]"] { color: var(--workspace-text-secondary) !important; }

.app-workspace :where(.text-slate-400, .text-slate-300),
.app-workspace [class~="text-[#9ca3af]"] { color: var(--workspace-text-tertiary) !important; }`;

const replacementTypo = `.app-workspace :where(.text-slate-950, .text-slate-900, .text-slate-800),
.app-workspace [class~="text-[#111]"],
.app-workspace [class~="text-[#1d1d1f]"],
.app-workspace [class~="text-[#1E293B]"],
.app-workspace [class~="text-[#1e293b]"] { color: var(--workspace-text) !important; }

.app-workspace :where(.text-slate-700, .text-slate-600, .text-slate-500),
.app-workspace [class~="text-[#333]"],
.app-workspace [class~="text-[#5f6368]"],
.app-workspace [class~="text-[#6e6e73]"],
.app-workspace [class~="text-[#64748B]"] { color: var(--workspace-text-secondary) !important; }

.app-workspace :where(.text-slate-400, .text-slate-300),
.app-workspace [class~="text-[#9ca3af]"],
.app-workspace [class~="text-[#8e8e93]"] { color: var(--workspace-text-tertiary) !important; }

/* ── Dark workspace surface, card, badge, and input cascading ── */
.dark .app-workspace :where(.bg-white, [class~="bg-white"], [class*="bg-white/"]) {
  background-color: var(--workspace-surface) !important;
}

.dark .app-workspace :where(.bg-slate-50, .bg-slate-100, [class~="bg-slate-50"], [class~="bg-slate-100"], [class~="bg-[#f2f2f7]"], [class~="bg-[#f5f5f7]"], [class~="bg-[#f1f3f4]"]) {
  background-color: rgba(255, 255, 255, 0.06) !important;
}

.dark .app-workspace :where(.border-slate-100, .border-slate-200, .border-slate-300, [class*="border-slate-"], [class*="border-black/"]) {
  border-color: var(--workspace-border) !important;
}

.dark .app-workspace :where(input, select, textarea):not(.leaflet-popup-content *) {
  background-color: rgba(255, 255, 255, 0.06) !important;
  color: #f5f5f7 !important;
  border-color: rgba(255, 255, 255, 0.12) !important;
}

.dark .app-workspace :where(input, select, textarea)::placeholder {
  color: #8e8e93 !important;
}

.dark .app-workspace :where(input, select, textarea):focus {
  background-color: rgba(255, 255, 255, 0.09) !important;
  border-color: #0a84ff !important;
}

.dark .app-workspace :where(button.bg-white, button[class~="bg-white"]) {
  background-color: rgba(255, 255, 255, 0.08) !important;
  border-color: rgba(255, 255, 255, 0.12) !important;
  color: #f5f5f7 !important;
}

.dark .app-workspace :where(button.bg-white:hover, button[class~="bg-white"]:hover) {
  background-color: rgba(255, 255, 255, 0.12) !important;
}

.dark .app-workspace :where(button.bg-slate-100, button[class~="bg-slate-100"]) {
  background-color: rgba(255, 255, 255, 0.08) !important;
  color: #f5f5f7 !important;
}

.dark .app-workspace :where(button.bg-slate-100:hover, button[class~="bg-slate-100"]:hover) {
  background-color: rgba(255, 255, 255, 0.14) !important;
}

.dark .app-workspace :where(.bg-emerald-50, .bg-green-50, [class~="bg-emerald-50"], [class~="bg-green-50"]) {
  background-color: rgba(52, 199, 89, 0.15) !important;
  color: #30d158 !important;
  border-color: rgba(52, 199, 89, 0.25) !important;
}

.dark .app-workspace :where(.bg-amber-50, [class~="bg-amber-50"]) {
  background-color: rgba(255, 159, 10, 0.15) !important;
  color: #ff9f0a !important;
  border-color: rgba(255, 159, 10, 0.25) !important;
}

.dark .app-workspace :where(.bg-rose-50, .bg-red-50, [class~="bg-rose-50"], [class~="bg-red-50"]) {
  background-color: rgba(255, 69, 58, 0.15) !important;
  color: #ff453a !important;
  border-color: rgba(255, 69, 58, 0.25) !important;
}

.dark .app-workspace :where(.bg-blue-50, [class~="bg-blue-50"], [class~="bg-indigo-50"]) {
  background-color: rgba(10, 132, 255, 0.15) !important;
  color: #0a84ff !important;
  border-color: rgba(10, 132, 255, 0.25) !important;
}

.dark .app-workspace table {
  color: #f5f5f7 !important;
}

.dark .app-workspace th {
  color: #8e8e93 !important;
  border-color: rgba(255, 255, 255, 0.08) !important;
}

.dark .app-workspace td {
  border-color: rgba(255, 255, 255, 0.06) !important;
}

.dark .app-workspace tr:hover td {
  background-color: rgba(255, 255, 255, 0.03) !important;
}

.dark .recharts-default-tooltip {
  background-color: #1c1c1e !important;
  border-color: rgba(255, 255, 255, 0.12) !important;
  color: #f5f5f7 !important;
}

.dark .recharts-tooltip-label {
  color: #f5f5f7 !important;
}

.dark .recharts-tooltip-item {
  color: #a1a1a6 !important;
}

.dark .recharts-cartesian-grid line {
  stroke: rgba(255, 255, 255, 0.08) !important;
}

.dark .recharts-text {
  fill: #8e8e93 !important;
}`;

const r2 = replaceNormalized(css, targetTypo, replacementTypo);
if (r2) {
  css = r2;
  console.log('✓ Replaced typography and added dark workspace overrides');
} else {
  console.log('✗ Could not find targetTypo');
}

// 3. Update .glass-bar and .workspace-header
const targetGlassBar = `.glass-bar {
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}`;

const replacementGlassBar = `.glass-bar {
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

.dark .glass-bar {
  background: rgba(22, 22, 26, 0.82) !important;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;
}`;

const r3 = replaceNormalized(css, targetGlassBar, replacementGlassBar);
if (r3) {
  css = r3;
  console.log('✓ Added .dark .glass-bar');
} else {
  console.log('✗ Could not find targetGlassBar');
}

// 4. Update .workspace-header rules
const targetHeader = `.workspace-header {
  z-index: 1100 !important;
  border-bottom: 0;
  background: rgba(250, 250, 252, 0.82);
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.06), 0 12px 28px rgba(28, 28, 30, 0.035);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
}`;

const replacementHeader = `.workspace-header {
  z-index: 1100 !important;
  border-bottom: 0;
  background: rgba(250, 250, 252, 0.82);
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.06), 0 12px 28px rgba(28, 28, 30, 0.035);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
}

.dark .workspace-header {
  background: rgba(22, 22, 26, 0.82) !important;
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.06), 0 12px 28px rgba(0, 0, 0, 0.35) !important;
}

.dark .workspace-header [class~="text-[#111]"] {
  color: #f5f5f7 !important;
}

.dark .workspace-header [class~="text-[#333]"] {
  color: #f5f5f7 !important;
}

.dark .workspace-header [class~="text-[#6e6e73]"] {
  color: #a1a1a6 !important;
}

.dark .workspace-header [class~="text-[#5f6368]"] {
  color: #a1a1a6 !important;
}

.dark .workspace-icon-button {
  color: #a1a1a6 !important;
}

.dark .workspace-icon-button:hover {
  color: #f5f5f7 !important;
  background: rgba(255, 255, 255, 0.08) !important;
}

.dark .workspace-header__account-button:hover,
.dark .workspace-header__account-button[aria-expanded="true"] {
  background: rgba(255, 255, 255, 0.08) !important;
}`;

const r4 = replaceNormalized(css, targetHeader, replacementHeader);
if (r4) {
  css = r4;
  console.log('✓ Added dark .workspace-header rules');
} else {
  console.log('✗ Could not find targetHeader');
}

// 5. Update .dashboard-bottom-nav
const targetBottomNav = `.dashboard-bottom-nav {
  min-height: var(--workspace-bottom-nav-height);
  padding: 0.35rem 0.45rem max(0.35rem, env(safe-area-inset-bottom));
  border-top: 0;
  border-bottom: 0;
  background: rgba(250, 250, 252, 0.88);
  box-shadow: 0 -1px 0 rgba(0, 0, 0, 0.07), 0 -14px 32px rgba(28, 28, 30, 0.045);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
}`;

const replacementBottomNav = `.dashboard-bottom-nav {
  min-height: var(--workspace-bottom-nav-height);
  padding: 0.35rem 0.45rem max(0.35rem, env(safe-area-inset-bottom));
  border-top: 0;
  border-bottom: 0;
  background: rgba(250, 250, 252, 0.88);
  box-shadow: 0 -1px 0 rgba(0, 0, 0, 0.07), 0 -14px 32px rgba(28, 28, 30, 0.045);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
}

.dark .dashboard-bottom-nav {
  background: rgba(22, 22, 26, 0.88) !important;
  box-shadow: 0 -1px 0 rgba(255, 255, 255, 0.08), 0 -14px 32px rgba(0, 0, 0, 0.5) !important;
}

.dark .dashboard-bottom-nav__item {
  color: #8e8e93 !important;
}

.dark .dashboard-bottom-nav__item.is-active {
  color: #0a84ff !important;
}

.dark .dashboard-bottom-nav__active-pill {
  background: rgba(10, 132, 255, 0.16) !important;
}`;

const r5 = replaceNormalized(css, targetBottomNav, replacementBottomNav);
if (r5) {
  css = r5;
  console.log('✓ Added dark .dashboard-bottom-nav rules');
} else {
  console.log('✗ Could not find targetBottomNav');
}

fs.writeFileSync(filePath, css, 'utf8');
console.log('Done applying dark workspace styles to index.css');
