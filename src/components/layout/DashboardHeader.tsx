import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, LogOut, Menu, Search } from 'lucide-react';
import BrandLogo from '@/components/ui/BrandLogo';

export type DashboardRole = 'commuter' | 'owner' | 'admin';

interface DashboardHeaderProps {
  role: DashboardRole;
  user?: DashboardHeaderUser | null;
  onSignOut: () => void;
  onBrandClick?: () => void;
  onMenuClick?: () => void;
  showMenuButton?: boolean;
  menuExpanded?: boolean;
  menuControls?: string;
  /** Extra controls rendered before the user / sign-out area (e.g. notifications) */
  actions?: ReactNode;
  /** Optional primary navigation rendered in the center on desktop */
  navigation?: React.ReactNode;
  /** Optional status line shown on sm+ screens (admin: system status, owner: location) */
  statusText?: string;
  /** Optional badge next to title (owner: Active) */
  badge?: { label: string; variant?: 'success' | 'warning' | 'info' };
  /** Hide the desktop brand when the persistent sidebar already owns it. */
  hideDesktopBrand?: boolean;
  /** Dashboard pages exposed through the header's client-side search. */
  searchItems?: DashboardSearchItem[];
  onSearchSelect?: (id: string) => void;
  searchPlaceholder?: string;
}

export interface DashboardSearchItem {
  id: string;
  label: string;
  keywords?: string[];
}

export interface DashboardHeaderUser {
  firstName?: string;
  lastName?: string;
  email?: string;
  picture?: string;
}

const ROLE_META: Record<
  DashboardRole,
  { portal: string }
> = {
  commuter: { portal: 'Transit Parking' },
  owner: { portal: 'Owner Portal' },
  admin: { portal: 'Admin Console' },
};

const BADGE_STYLES = {
  success: 'bg-[#f0fdf4] text-[#16a34a]',
  warning: 'bg-[#fefce8] text-[#a16207]',
  info: 'bg-[#e8f0fe] text-[#007AFF]',
};

export default function DashboardHeader({
  role,
  user = null,
  onSignOut,
  onBrandClick,
  onMenuClick,
  showMenuButton = false,
  menuExpanded,
  menuControls,
  actions,
  navigation,
  statusText,
  badge,
  hideDesktopBrand = false,
  searchItems = [],
  onSearchSelect,
  searchPlaceholder = 'Search dashboard pages',
}: DashboardHeaderProps) {
  const meta = ROLE_META[role];
  const [profileImageFailed, setProfileImageFailed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const mobileSearchRef = useRef<HTMLDivElement>(null);
  const mobileSearchInputRef = useRef<HTMLInputElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setProfileImageFailed(false);
  }, [user?.picture]);

  useEffect(() => {
    if (!searchOpen && !accountOpen) return;

    const closePopovers = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        !searchRef.current?.contains(target)
        && !mobileSearchRef.current?.contains(target)
        && !accountRef.current?.contains(target)
      ) {
        setSearchOpen(false);
        setAccountOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setSearchOpen(false);
      setAccountOpen(false);
    };

    document.addEventListener('pointerdown', closePopovers);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closePopovers);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [accountOpen, searchOpen]);

  const handleSignOut = () => {
    const confirmed = window.confirm(
      'Are you sure you want to sign out? You will need to sign in again to access your ParkJom account.',
    );
    if (confirmed) onSignOut();
  };

  const handleBrandClick = () => {
    onBrandClick?.();
  };

  const displayName = user ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email : '';
  const initials = (user?.firstName?.charAt(0) || user?.email?.charAt(0))?.toUpperCase() ?? '?';
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredSearchItems = useMemo(() => searchItems.filter((item) => {
    if (!normalizedQuery) return true;
    return [item.label, ...(item.keywords ?? [])]
      .some((value) => value.toLowerCase().includes(normalizedQuery));
  }).slice(0, 8), [normalizedQuery, searchItems]);

  const selectSearchItem = (item: DashboardSearchItem) => {
    setSearchQuery(item.label);
    setSearchOpen(false);
    onSearchSelect?.(item.id);
  };

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && filteredSearchItems[0]) {
      event.preventDefault();
      selectSearchItem(filteredSearchItems[0]);
    }
  };

  const renderSearchResults = (id: string) => (
    <div id={id} role="listbox" aria-label="Dashboard pages" className="workspace-header__search-results">
      {filteredSearchItems.length > 0 ? filteredSearchItems.map((item) => (
        <button
          key={item.id}
          type="button"
          role="option"
          aria-selected="false"
          onClick={() => selectSearchItem(item)}
          className="workspace-header__search-result"
        >
          <Search size={14} aria-hidden="true" />
          <span>{item.label}</span>
        </button>
      )) : (
        <p className="workspace-header__search-empty">No dashboard pages found.</p>
      )}
    </div>
  );

  return (
    <header
      className="workspace-header sticky top-0 z-40 shrink-0 glass-bar"
      data-workspace-role={role}
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <div className={`workspace-header__inner relative max-w-screen-2xl mx-auto h-14 px-3 sm:px-6 lg:px-8 flex items-center justify-between gap-2 sm:gap-3 ${navigation ? 'has-navigation' : ''}`}>
        {/* Left: menu + brand */}
        <div className="flex items-center gap-2.5 min-w-0">
          {showMenuButton && onMenuClick && (
            <button
              type="button"
              onClick={onMenuClick}
              aria-label="Open menu"
              aria-expanded={menuExpanded}
              aria-controls={menuControls}
              className="workspace-icon-button workspace-menu-button md:hidden -ml-1 text-[#5f6368] hover:text-[#111] hover:bg-black/[0.04]"
            >
              <Menu size={20} strokeWidth={2} />
            </button>
          )}

          <button
            type="button"
            onClick={handleBrandClick}
            aria-label={`ParkJom ${meta.portal} home`}
            className={`workspace-brand-button items-center gap-2.5 min-w-0 group !rounded-none !bg-transparent hover:!bg-transparent active:!bg-transparent focus-visible:!ring-0 ${hideDesktopBrand ? 'flex md:hidden' : 'flex'}`}
          >
            <BrandLogo alt="" className="h-8 w-8 shadow-sm transition-transform group-active:scale-95" />
            <div className="min-w-0 text-left">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-[15px] text-[#111] tracking-[-0.02em] truncate">
                  ParkJom
                </span>
                {badge && (
                  <span
                    className={`hidden sm:inline text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0 ${
                      BADGE_STYLES[badge.variant ?? 'success']
                    }`}
                  >
                    {badge.label}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#6e6e73] font-medium leading-none mt-0.5 truncate hidden sm:block">
                {meta.portal}
              </p>
            </div>
          </button>
        </div>

        {navigation && (
          <nav className="workspace-header__navigation items-center gap-1" aria-label="Primary">
            {navigation}
          </nav>
        )}

        {/* Center status — desktop only */}
        {statusText && (
          <div className="workspace-header__status hidden xl:flex items-center gap-2 text-[12px] font-medium text-[#5f6368] mx-4">
            <span className="w-1.5 h-1.5 rounded-full bg-[#34c759] shrink-0" />
            <span className="truncate">{statusText}</span>
          </div>
        )}

        {/* Right: search + notifications + account */}
        <div className="workspace-header__actions flex items-center gap-1 sm:gap-2 shrink-0">
          {searchItems.length > 0 && onSearchSelect && (
            <>
              <div ref={searchRef} className="workspace-header__search hidden sm:block">
                <Search size={16} className="workspace-header__search-icon" aria-hidden="true" />
                <input
                  type="search"
                  value={searchQuery}
                  placeholder={searchPlaceholder}
                  aria-label={searchPlaceholder}
                  aria-expanded={searchOpen}
                  aria-controls="dashboard-search-results"
                  role="combobox"
                  autoComplete="off"
                  onFocus={() => setSearchOpen(true)}
                  onChange={(event) => {
                    setSearchQuery(event.target.value);
                    setSearchOpen(true);
                  }}
                  onKeyDown={handleSearchKeyDown}
                />
                {searchOpen && renderSearchResults('dashboard-search-results')}
              </div>

              <button
                type="button"
                aria-label="Search dashboard pages"
                aria-expanded={searchOpen}
                onClick={() => {
                  setAccountOpen(false);
                  setSearchOpen(true);
                  window.setTimeout(() => mobileSearchInputRef.current?.focus(), 0);
                }}
                className="workspace-icon-button sm:hidden text-[#5f6368] hover:bg-black/[0.04] hover:text-[#111]"
              >
                <Search size={18} aria-hidden="true" />
              </button>

              {searchOpen && (
                <div ref={mobileSearchRef} className="workspace-header__mobile-search sm:hidden">
                  <div className="workspace-header__mobile-search-field">
                    <Search size={16} aria-hidden="true" />
                    <input
                      ref={mobileSearchInputRef}
                      type="search"
                      value={searchQuery}
                      placeholder={searchPlaceholder}
                      aria-label={searchPlaceholder}
                      aria-expanded="true"
                      aria-controls="mobile-dashboard-search-results"
                      role="combobox"
                      autoComplete="off"
                      onChange={(event) => setSearchQuery(event.target.value)}
                      onKeyDown={handleSearchKeyDown}
                    />
                  </div>
                  {renderSearchResults('mobile-dashboard-search-results')}
                </div>
              )}
            </>
          )}

          {actions}

          {user && (
            <div ref={accountRef} className="workspace-header__account relative min-w-0">
              <button
                type="button"
                onClick={() => {
                  setSearchOpen(false);
                  setAccountOpen((current) => !current);
                }}
                aria-label="Open account menu"
                aria-expanded={accountOpen}
                aria-controls="dashboard-account-menu"
                className="workspace-header__account-button"
              >
                <span className="hidden lg:inline max-w-[150px] truncate text-[13px] font-semibold text-[#333]">
                  {displayName}
                </span>
                {user.picture && !profileImageFailed ? (
                  <img
                    src={user.picture}
                    alt=""
                    className="h-8 w-8 rounded-full object-cover ring-1 ring-black/[0.08]"
                    onError={() => setProfileImageFailed(true)}
                  />
                ) : (
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-bold ring-1 ring-black/[0.08]"
                    style={{
                      backgroundColor: 'var(--workspace-accent-soft)',
                      color: 'var(--workspace-accent)',
                    }}
                  >
                    {initials}
                  </span>
                )}
                <ChevronDown size={14} className="hidden lg:block text-[#8e8e93]" aria-hidden="true" />
              </button>

              {accountOpen && (
                <div id="dashboard-account-menu" role="menu" className="workspace-header__account-menu">
                  <div className="border-b border-[#f1f3f4] px-3 py-2.5">
                    <p className="truncate text-[12px] font-semibold text-[#111]">{displayName}</p>
                    {user.email && <p className="mt-0.5 truncate text-[10px] text-[#8e8e93]">{user.email}</p>}
                  </div>
                  <button type="button" role="menuitem" onClick={handleSignOut} className="workspace-header__account-menu-item">
                    <LogOut size={16} aria-hidden="true" />
                    <span>Sign out</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
