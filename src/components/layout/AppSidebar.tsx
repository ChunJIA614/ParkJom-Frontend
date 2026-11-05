import type { CSSProperties, ReactNode } from 'react';
import {
  PanelLeftClose,
  PanelLeftOpen,
  X,
  type LucideIcon,
} from 'lucide-react';
import BrandLogo from '@/components/ui/BrandLogo';
import { Button } from '@/components/ui/button';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar';

export interface AppSidebarItem {
  id: string;
  label: string;
  icon: LucideIcon;
  badge?: string | number | null;
  badgeTone?: 'neutral' | 'danger';
  dot?: boolean;
}

export interface AppSidebarGroup {
  label?: string;
  items: AppSidebarItem[];
}

interface AppSidebarProps {
  id: string;
  workspaceLabel: string;
  groups: AppSidebarGroup[];
  activeId: string;
  onNavigate: (id: string) => void;
  onBrandClick: () => void;
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  footer?: ReactNode;
}

interface SidebarNavigationProps extends Pick<
  AppSidebarProps,
  'id' | 'workspaceLabel' | 'groups' | 'activeId' | 'onNavigate' | 'footer'
  | 'onBrandClick'
> {}

function SidebarNavigation({
  id,
  workspaceLabel,
  groups,
  activeId,
  onNavigate,
  onBrandClick,
  footer,
}: SidebarNavigationProps) {
  const { state, setOpenMobile, toggleSidebar } = useSidebar();
  const collapsed = state === 'collapsed';

  return (
    <Sidebar collapsible="icon" className="border-sidebar-border/80">
      <div id={id} className="flex h-full min-h-0 flex-col">
        <SidebarHeader className="h-14 min-h-14 justify-center border-b border-sidebar-border/80 bg-[rgba(250,250,252,0.82)] dark:bg-[rgba(22,22,26,0.82)] p-2 group-data-[collapsible=icon]:p-0 backdrop-blur-[24px] backdrop-saturate-[180%]">
          <SidebarMenu>
            <SidebarMenuItem className="flex justify-center items-center">
              <SidebarMenuButton
                size="lg"
                tooltip="ParkJom"
                className="workspace-sidebar-brand !h-10 group-data-[collapsible=icon]:!size-11 group-data-[collapsible=icon]:!p-0 group-data-[collapsible=icon]:mx-auto flex items-center justify-center !rounded-xl !bg-transparent hover:!bg-transparent active:!bg-transparent focus-visible:!ring-0"
                onClick={() => {
                  onBrandClick();
                  setOpenMobile(false);
                }}
              >
                <BrandLogo alt="" className="size-8.5 shrink-0 shadow-sm rounded-xl" />
                <span className="grid min-w-0 flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
                  <strong className="truncate text-sm font-semibold tracking-[-0.02em]">ParkJom</strong>
                  <span className="truncate text-[11px] text-sidebar-foreground/60">{workspaceLabel}</span>
                </span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="absolute right-3 top-3 md:hidden"
            onClick={() => setOpenMobile(false)}
            aria-label={`Close ${workspaceLabel} navigation`}
          >
            <X aria-hidden="true" />
          </Button>
        </SidebarHeader>

        <SidebarContent className="gap-1 py-1">
          {groups.map((group) => (
            <SidebarGroup key={group.label ?? group.items[0]?.id} className="py-1.5 group-data-[collapsible=icon]:py-2">
              {group.label && (
                <SidebarGroupLabel className="h-7 px-2.5 text-[11px] font-semibold text-sidebar-foreground/50">
                  {group.label}
                </SidebarGroupLabel>
              )}
              <SidebarGroupContent>
                <SidebarMenu className="gap-1">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeId === item.id;
                    const hasBadge = item.badge !== null && item.badge !== undefined && item.badge !== 0;

                    return (
                      <SidebarMenuItem key={item.id} className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
                        <SidebarMenuButton
                          type="button"
                          isActive={isActive}
                          tooltip={item.label}
                          aria-current={isActive ? 'page' : undefined}
                          onClick={() => {
                            onNavigate(item.id);
                            setOpenMobile(false);
                          }}
                          className="h-10 rounded-xl px-2.5 text-[13px] text-sidebar-foreground/70 group-data-[collapsible=icon]:!size-11 group-data-[collapsible=icon]:!p-0 group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:justify-center data-active:bg-sidebar-accent data-active:font-semibold data-active:text-sidebar-accent-foreground data-active:[&_svg]:text-sidebar-primary transition-all"
                        >
                          <Icon aria-hidden="true" className="!size-5.5 shrink-0" />
                          <span className="group-data-[collapsible=icon]:hidden">{item.label}</span>
                        </SidebarMenuButton>
                        {item.dot && (
                          <SidebarMenuBadge className="right-2 w-5 px-0" aria-label="Active parking session">
                            <span className="size-2 rounded-full bg-success" />
                          </SidebarMenuBadge>
                        )}
                        {!item.dot && hasBadge && (
                          <SidebarMenuBadge
                            className={item.badgeTone === 'danger'
                              ? 'right-2 max-w-24 bg-destructive/10 text-destructive'
                              : 'right-2 max-w-24 bg-sidebar-accent text-sidebar-foreground/70'}
                          >
                            {item.badge}
                          </SidebarMenuBadge>
                        )}
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>

        <SidebarFooter className="min-h-14 flex-row items-center border-t border-sidebar-border/80 p-2.5 group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:justify-center">
          {footer && (
            <div className="min-w-0 flex-1 text-[11px] leading-relaxed text-sidebar-foreground/50 group-data-[collapsible=icon]:hidden">
              {footer}
            </div>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="ml-auto hidden shrink-0 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground md:inline-flex group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:!size-11 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:justify-center !rounded-xl"
            onClick={toggleSidebar}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <PanelLeftOpen size={20} aria-hidden="true" /> : <PanelLeftClose size={20} aria-hidden="true" />}
          </Button>
        </SidebarFooter>
      </div>
      <SidebarRail />
    </Sidebar>
  );
}

export default function AppSidebar({
  collapsed,
  onCollapsedChange,
  mobileOpen,
  onMobileOpenChange,
  ...props
}: AppSidebarProps) {
  return (
    <SidebarProvider
      open={!collapsed}
      onOpenChange={(open) => onCollapsedChange(!open)}
      openMobile={mobileOpen}
      onOpenMobileChange={onMobileOpenChange}
      className="parkjom-sidebar-provider min-h-0 w-auto shrink-0"
      style={{
        '--sidebar-width': '14rem',
        '--sidebar-width-icon': '4.25rem',
      } as CSSProperties}
    >
      <SidebarNavigation {...props} />
    </SidebarProvider>
  );
}
