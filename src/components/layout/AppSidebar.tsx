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
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  footer?: ReactNode;
}

interface SidebarNavigationProps extends Pick<
  AppSidebarProps,
  'id' | 'workspaceLabel' | 'groups' | 'activeId' | 'onNavigate' | 'footer'
> {}

function SidebarNavigation({
  id,
  workspaceLabel,
  groups,
  activeId,
  onNavigate,
  footer,
}: SidebarNavigationProps) {
  const { state, setOpenMobile, toggleSidebar } = useSidebar();
  const collapsed = state === 'collapsed';

  return (
    <Sidebar collapsible="icon" className="border-sidebar-border/80">
      <div id={id} className="flex h-full min-h-0 flex-col">
        <SidebarHeader className="min-h-15 justify-center border-b border-sidebar-border/80 p-2">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                size="lg"
                tooltip="ParkJom"
                className="h-11 rounded-xl px-2.5 hover:bg-sidebar-accent"
              >
                <BrandLogo alt="" className="size-8 shrink-0 shadow-sm" />
                <span className="grid min-w-0 flex-1 text-left leading-tight">
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
            <SidebarGroup key={group.label ?? group.items[0]?.id} className="py-1.5">
              {group.label && (
                <SidebarGroupLabel className="h-7 px-2.5 text-[11px] font-semibold text-sidebar-foreground/50">
                  {group.label}
                </SidebarGroupLabel>
              )}
              <SidebarGroupContent>
                <SidebarMenu className="gap-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeId === item.id;
                    const hasBadge = item.badge !== null && item.badge !== undefined && item.badge !== 0;

                    return (
                      <SidebarMenuItem key={item.id}>
                        <SidebarMenuButton
                          type="button"
                          isActive={isActive}
                          tooltip={item.label}
                          aria-current={isActive ? 'page' : undefined}
                          onClick={() => {
                            onNavigate(item.id);
                            setOpenMobile(false);
                          }}
                          className="h-9 rounded-lg px-2.5 text-[13px] text-sidebar-foreground/70 data-active:bg-sidebar-accent data-active:font-semibold data-active:text-sidebar-accent-foreground data-active:[&_svg]:text-sidebar-primary"
                        >
                          <Icon aria-hidden="true" />
                          <span>{item.label}</span>
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

        <SidebarFooter className="min-h-14 flex-row items-center border-t border-sidebar-border/80 p-2.5">
          {footer && (
            <div className="min-w-0 flex-1 text-[11px] leading-relaxed text-sidebar-foreground/50 group-data-[collapsible=icon]:hidden">
              {footer}
            </div>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="ml-auto hidden shrink-0 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground md:inline-flex"
            onClick={toggleSidebar}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <PanelLeftOpen aria-hidden="true" /> : <PanelLeftClose aria-hidden="true" />}
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
