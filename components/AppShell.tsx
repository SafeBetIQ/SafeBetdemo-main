'use client';

import React, { useState, useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LayoutDashboard, Users, ShieldAlert, Activity, FileText, Settings, Plug, Menu, ChevronLeft, ChevronRight, Bell, User, LogOut, Building2, Shield, Globe, ChartBar as BarChart3, TriangleAlert as AlertTriangle, ShieldOff, Network, Brain, Lock, Server, CircleCheck as CheckCircle, Eye, Layers, MapPin, Key } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
  roles: string[];
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Core',
    items: [
      { title: 'Platform Overview',         href: '/admin',                          icon: LayoutDashboard,  roles: ['super_admin'] },
      { title: 'Operator Compliance',        href: '/casino/dashboard',               icon: LayoutDashboard,  roles: ['casino_admin', 'compliance_officer'] },
      { title: 'National Intelligence',      href: '/regulator/dashboard',            icon: LayoutDashboard,  roles: ['regulator', 'national_regulator'] },
      { title: 'Provincial Intelligence',    href: '/regulator/provincial-dashboard', icon: LayoutDashboard,  roles: ['provincial_regulator'] },
      { title: 'My Profile',                 href: '/staff/profile',                  icon: User,             roles: ['staff'] },
    ],
  },
  {
    title: 'Behavioural Intelligence',
    items: [
      { title: 'Player Risk Monitor',        href: '/casino/players',                 icon: Users,            roles: ['casino_admin', 'compliance_officer', 'super_admin'] },
      { title: 'Intervention Engine',        href: '/casino/interventions',           icon: ShieldAlert,      roles: ['casino_admin', 'compliance_officer', 'super_admin'] },
      { title: 'Session Analytics',          href: '/behavioral-risk-intelligence',   icon: Activity,         roles: ['casino_admin', 'compliance_officer', 'regulator', 'national_regulator', 'provincial_regulator', 'super_admin'] },
      { title: 'AI Intelligence',            href: '/casino/ai-intelligence',         icon: Brain,            roles: ['casino_admin', 'super_admin'] },
      { title: 'Nova IQ XAI',                href: '/casino/nova-iq-xai',             icon: Eye,              roles: ['casino_admin', 'super_admin'] },
    ],
  },
  {
    title: 'Network Intelligence',
    items: [
      { title: 'Cross-Operator Intelligence',href: '/admin/integrations',             icon: Network,          roles: ['super_admin', 'regulator', 'national_regulator'] },
      { title: 'Self-Exclusion Network',     href: '/regulator/wellbeing-compliance', icon: ShieldOff,        roles: ['regulator', 'national_regulator', 'provincial_regulator', 'super_admin'] },
      { title: 'High-Risk Player Analytics', href: '/regulator/dashboard',            icon: AlertTriangle,    roles: ['regulator', 'national_regulator', 'provincial_regulator'] },
    ],
  },
  {
    title: 'Compliance',
    items: [
      { title: 'Compliance Reports',         href: '/admin/compliance-overview',      icon: FileText,         roles: ['super_admin', 'regulator', 'national_regulator'] },
      { title: 'Compliance Controls',        href: '/admin/compliance',               icon: CheckCircle,      roles: ['super_admin', 'casino_admin'] },
    ],
  },
  {
    title: 'Platform Management',
    items: [
      { title: 'Nova IQ (Wellbeing)',        href: '/casino/wellbeing-games',         icon: Shield,           roles: ['casino_admin', 'super_admin'] },
      { title: 'Integrations',              href: '/casino/integrations',            icon: Plug,             roles: ['casino_admin'] },
      { title: 'SafePlay Connect (API)',     href: '/safeplay-connect',               icon: Globe,            roles: ['casino_admin', 'super_admin'] },
    ],
  },
  {
    title: 'Security & Admin',
    items: [
      { title: 'Security Command Center',    href: '/security-command-center',        icon: ShieldAlert,      roles: ['super_admin'] },
      { title: 'Module Management',          href: '/admin/casino-modules',           icon: Layers,           roles: ['super_admin'] },
      { title: 'User Management',            href: '/admin/user-roles',               icon: Users,            roles: ['super_admin'] },
      { title: 'Access Control',             href: '/admin/access-control',           icon: Key,              roles: ['super_admin'] },
      { title: 'Data Governance',            href: '/admin/data-governance',          icon: Lock,             roles: ['super_admin'] },
      { title: 'Infrastructure',             href: '/admin/infrastructure',           icon: Server,           roles: ['super_admin'] },
      { title: 'Performance',                href: '/admin/performance',              icon: BarChart3,        roles: ['super_admin'] },
      { title: 'Threat Monitoring',          href: '/admin/threat-monitoring',        icon: AlertTriangle,    roles: ['super_admin'] },
      { title: 'Wellbeing Games Admin',      href: '/admin/wellbeing-games',          icon: Shield,           roles: ['super_admin'] },
      { title: 'Integrations Admin',         href: '/admin/integrations',             icon: Plug,             roles: ['super_admin'] },
    ],
  },
];

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
    router.push('/login');
  };

  const filteredNavigation = useMemo(() => {
    const role = user?.role || '';
    return NAV_GROUPS
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => item.roles.includes(role)),
      }))
      .filter((group) => group.items.length > 0);
  }, [user?.role]);

  const roleLabel: Record<string, string> = {
    super_admin: 'Super Admin',
    casino_admin: 'Casino Admin',
    compliance_officer: 'Compliance Officer',
    regulator: 'National Regulator',
    national_regulator: 'National Regulator',
    provincial_regulator: 'Provincial Regulator',
    staff: 'Staff Member',
  };

  const SidebarContent = ({ mobile = false }: { mobile?: boolean }) => (
    <div className="flex h-full flex-col bg-sidebar-background text-sidebar-foreground">
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-sidebar-border px-4">
        {!sidebarCollapsed || mobile ? (
          <Link href="/" className="flex items-center">
            <img
              src="/safebet_website_logo copy copy.png"
              alt="SafeBet IQ"
              className="h-10 w-auto object-contain"
              style={{ mixBlendMode: 'lighten' }}
            />
          </Link>
        ) : (
          <Link href="/" className="flex items-center mx-auto">
            <img
              src="/safebet_website_logo copy copy.png"
              alt="SafeBet IQ"
              className="h-8 w-auto object-contain"
              style={{ mixBlendMode: 'lighten' }}
            />
          </Link>
        )}
      </div>

      {/* Role Indicator */}
      {(!sidebarCollapsed || mobile) && user && (
        <div className="px-4 py-2 border-b border-sidebar-border">
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-sidebar-hover">
            <div className="h-2 w-2 rounded-full bg-emerald-400" />
            <span className="text-xs font-medium text-sidebar-foreground/80">
              {roleLabel[user.role] || user.role}
            </span>
          </div>
        </div>
      )}

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3">
        <div className="space-y-5 py-4">
          {filteredNavigation.map((group, groupIndex) => (
            <div key={groupIndex}>
              {(!sidebarCollapsed || mobile) && (
                <h3 className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-widest text-sidebar-foreground/40">
                  {group.title}
                </h3>
              )}
              <nav className="space-y-0.5">
                {group.items.map((item, itemIndex) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                  return (
                    <Link
                      key={itemIndex}
                      href={item.href}
                      onClick={() => mobile && setMobileOpen(false)}
                      title={sidebarCollapsed && !mobile ? item.title : undefined}
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-sidebar-active text-sidebar-active-foreground'
                          : 'text-sidebar-foreground/70 hover:bg-sidebar-hover hover:text-sidebar-foreground'
                      )}
                    >
                      <Icon className="h-4 w-4 flex-shrink-0" />
                      {(!sidebarCollapsed || mobile) && (
                        <span className="flex-1 truncate">{item.title}</span>
                      )}
                    </Link>
                  );
                })}
              </nav>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* User Menu */}
      <div className="border-t border-sidebar-border p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className={cn(
                'w-full justify-start gap-3 hover:bg-sidebar-hover text-sidebar-foreground h-auto py-2',
                sidebarCollapsed && !mobile && 'justify-center px-2'
              )}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground flex-shrink-0 text-xs font-bold">
                {user?.email?.charAt(0).toUpperCase() || 'U'}
              </div>
              {(!sidebarCollapsed || mobile) && (
                <div className="flex flex-col items-start text-xs min-w-0">
                  <span className="font-medium text-sidebar-foreground truncate max-w-[140px]">
                    {user?.full_name || user?.email || 'User'}
                  </span>
                  <span className="text-sidebar-foreground/50 truncate max-w-[140px]">
                    {user?.email}
                  </span>
                </div>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              {roleLabel[user?.role || ''] || user?.role}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Collapse Toggle */}
      {!mobile && (
        <div className="border-t border-sidebar-border p-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="w-full hover:bg-sidebar-hover text-sidebar-foreground/60 text-xs"
          >
            {sidebarCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4 mr-2" />
                Collapse
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          'hidden md:flex flex-col border-r border-sidebar-border bg-sidebar-background transition-all duration-300',
          sidebarCollapsed ? 'w-16' : 'w-[240px]'
        )}
      >
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[260px] p-0 bg-sidebar-background border-r border-sidebar-border">
          <SidebarContent mobile />
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile Header */}
        <header className="flex h-14 items-center gap-4 border-b border-border bg-card px-4 md:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
          </Sheet>
          <Link href="/" className="flex items-center">
            <img
              src="/safebet_website_logo copy copy.png"
              alt="SafeBet IQ"
              className="h-7 w-auto object-contain"
              style={{ mixBlendMode: 'multiply' }}
            />
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-4 w-4" />
            </Button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
