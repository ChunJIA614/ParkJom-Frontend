import fs from 'node:fs';

const path = 'src/components/layout/DashboardHeader.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  '<div id="dashboard-account-menu" role="menu" className="workspace-header__account-menu">',
  '<div id="dashboard-account-menu" role="menu" className="workspace-header__account-menu bg-white dark:bg-[#1c1c1e] text-[#1d1d1f] dark:text-[#f5f5f7] border-black/[0.08] dark:border-white/[0.12]">'
);

content = content.replace(
  '<div className="border-b border-[#f1f3f4] px-3 py-2.5">',
  '<div className="border-b border-[#f1f3f4] dark:border-white/[0.08] px-3 py-2.5">'
);

content = content.replace(
  '<p className="truncate text-[12px] font-semibold text-[#111]">{displayName}</p>',
  '<p className="truncate text-[12px] font-semibold text-[#111] dark:text-[#f5f5f7]">{displayName}</p>'
);

content = content.replace(
  '{user.email && <p className="mt-0.5 truncate text-[10px] text-[#8e8e93]">{user.email}</p>}',
  '{user.email && <p className="mt-0.5 truncate text-[10px] text-[#8e8e93] dark:text-[#a1a1a6]">{user.email}</p>}'
);

content = content.replace(
  'className="workspace-header__account-menu-item"',
  'className="workspace-header__account-menu-item hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-[#3a3a3c] dark:text-[#f5f5f7]"'
);

content = content.replace(
  '<button type="button" role="menuitem" onClick={handleSignOut} className="workspace-header__account-menu-item">',
  '<button type="button" role="menuitem" onClick={handleSignOut} className="workspace-header__account-menu-item hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600 dark:text-red-400">'
);

fs.writeFileSync(path, content, 'utf8');
console.log('Finished updating account menu in DashboardHeader.tsx');
