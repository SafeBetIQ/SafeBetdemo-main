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
import { LayoutDashboard, Users, ShieldAlert, Activity, FileText, Plug, Menu, ChevronLeft, ChevronRight, Bell, User, LogOut, Shield, BookOpen, ChartBar as BarChart3, Network, Lock, CircleCheck as CheckCircle, Radio, HelpCircle, Briefcase, Lightbulb, Gauge, ClipboardCheck, Scale, Rocket, Building2 } from 'lucide-react';
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

// Navigation lists ONLY certified enterprise capabilities (Consumer Platform
// surfaces + governed admin/commercial). Every item maps to a live route and a
// clear job-to-be-done; it is role-filtered so each audience sees one coherent
// workspace. Legacy / demo / duplicate surfaces were removed in the v1.5 UI
// rationalisation audit — nothing here is a "nice-to-have".
const ALL_REGULATORS = ['regulator', 'national_regulator', 'provincial_regulator'];
const OPERATOR = ['casino_admin', 'compliance_officer'];

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Overview',
    items: [
      { title: 'Platform Overview',            href: '/admin',                            icon: LayoutDashboard,  roles: ['super_admin'] },
      { title: 'Operator Dashboard',           href: '/casino/dashboard',                 icon: LayoutDashboard,  roles: ['casino_admin', 'compliance_officer'] },
      { title: 'National Intelligence',        href: '/regulator/dashboard',              icon: LayoutDashboard,  roles: ['regulator', 'national_regulator'] },
      { title: 'Provincial Intelligence',      href: '/regulator/intelligence',           icon: LayoutDashboard,  roles: ['provincial_regulator'] },
    ],
  },
  {
    title: 'Live Intelligence',
    items: [
      { title: 'Live Casino Feed',             href: '/casino/live-feed',                 icon: Radio,            roles: ['casino_admin', 'compliance_officer', 'super_admin'], badge: 'LIVE' },
      { title: 'Player Risk Monitor',          href: '/casino/players',                   icon: Users,            roles: ['casino_admin', 'compliance_officer', 'super_admin'] },
      { title: 'Explainable Intelligence',     href: '/casino/explainability',            icon: Lightbulb,        roles: ['casino_admin', 'compliance_officer', 'super_admin'] },
      // UAT-OP-1 (P1-4): Self-Exclusion Network reachable from the operator workflow
      // (previously only linked from the marketing navigation).
      { title: 'Self-Exclusion Network',       href: '/features/self-exclusion-network',  icon: Shield,           roles: ['casino_admin', 'compliance_officer', 'super_admin'] },
    ],
  },
  {
    title: 'Cases & Workflow',
    items: [
      { title: 'Case Management',              href: '/casino/cases',                     icon: Briefcase,        roles: ['casino_admin', 'compliance_officer', 'super_admin'] },
      { title: 'Compliance Workflow',          href: '/casino/compliance-workflow',       icon: ClipboardCheck,   roles: ['casino_admin', 'compliance_officer'] },
      { title: 'Executive Operations',         href: '/casino/operations',                icon: Gauge,            roles: ['casino_admin', 'super_admin'] },
      { title: 'Notifications',                href: '/casino/notifications',             icon: Bell,             roles: ['casino_admin', 'compliance_officer'] },
    ],
  },
  {
    title: 'Regulator',
    items: [
      { title: 'Regulator Intelligence',       href: '/regulator/intelligence',           icon: Network,          roles: ALL_REGULATORS },
      { title: 'Investigations',               href: '/regulator/cases',                  icon: Scale,            roles: ALL_REGULATORS },
      { title: 'Regulatory Reports',           href: '/regulator/reports',                icon: FileText,         roles: ALL_REGULATORS },
    ],
  },
  {
    title: 'Compliance & Reporting',
    items: [
      { title: 'Reporting Centre',             href: '/casino/reports',                   icon: FileText,         roles: ['casino_admin', 'compliance_officer'] },
      { title: 'Compliance Overview',          href: '/admin/compliance-overview',        icon: Shield,           roles: ['super_admin', 'regulator', 'national_regulator'] },
      { title: 'Audit Centre',                 href: '/admin/audit',                      icon: BookOpen,         roles: ['super_admin', 'casino_admin', 'compliance_officer', 'national_regulator', 'regulator'] },
    ],
  },
  {
    title: 'Integration',
    items: [
      { title: 'Integration Health',           href: '/casino/integration',               icon: Network,          roles: ['casino_admin', 'super_admin'] },
      { title: 'API Centre',                   href: '/casino/api-centre',                icon: Plug,             roles: ['casino_admin', 'super_admin'] },
    ],
  },
  {
    title: 'Commercial',
    items: [
      { title: 'Customer Success',             href: '/admin/customer-success',           icon: Building2,        roles: ['super_admin'] },
      { title: 'Onboarding',                   href: '/casino/onboarding',                icon: Rocket,           roles: ['casino_admin'] },
    ],
  },
  {
    title: 'Administration',
    items: [
      { title: 'User Management',              href: '/admin/user-roles',                 icon: Users,            roles: ['super_admin'] },
      { title: 'Access Control',               href: '/admin/access-control',             icon: Lock,             roles: ['super_admin'] },
      { title: 'Security Audit Log',           href: '/admin/security',                   icon: Lock,             roles: ['super_admin', 'compliance_officer'] },
    ],
  },
  {
    title: 'Help & Support',
    items: [
      { title: 'Help Centre',                  href: '/help',                             icon: HelpCircle,       roles: ['super_admin', 'casino_admin', 'compliance_officer', 'national_regulator', 'provincial_regulator', 'regulator'] },
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
                        <>
                          <span className="flex-1 truncate">{item.title}</span>
                          {item.badge && (
                            <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500 text-white leading-none animate-pulse">
                              {item.badge}
                            </span>
                          )}
                        </>
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
        <header className="flex h-14 items-center gap-4 border-b border-sidebar-border bg-sidebar-background px-4 md:hidden">
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
        <main className="flex-1 overflow-y-auto overflow-x-auto min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
