'use client';

import React, { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import {
  LayoutDashboard,
  Activity,
  Users,
  ShieldAlert,
  Brain,
  TrendingUp,
  CheckCircle,
  FileText,
  Lock,
  Settings,
  CreditCard,
  Plug,
  Search,
  Menu,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Bell,
  User,
  LogOut,
  Building2,
  Shield,
  GraduationCap,
  Target,
  Code,
  BookOpen,
  Webhook,
  FileCode,
  Globe,
  Database,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

interface NavItem {
  title: string;
  href?: string;
  icon: React.ElementType;
  badge?: string;
  roles?: string[];
  subItems?: NavItem[];
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const navigationGroups: NavGroup[] = [
  {
    title: 'Core',
    items: [
      { title: 'Dashboard', href: '/casino/dashboard', icon: LayoutDashboard, roles: ['casino_admin', 'casino_admin'] },
      { title: 'Dashboard', href: '/regulator/dashboard', icon: LayoutDashboard, roles: ['regulator'] },
      { title: 'Dashboard', href: '/admin', icon: LayoutDashboard, roles: ['super_admin'] },
      { title: 'Dashboard', href: '/staff/academy', icon: LayoutDashboard, roles: ['casino_staff'] },
      { title: 'Players', href: '/casino/players', icon: Users, roles: ['casino_admin', 'casino_admin'] },
    ],
  },
  {
    title: 'Intelligence',
    items: [
      { title: 'Live Monitor', href: '/behavioral-risk-intelligence', icon: Activity, roles: ['casino_admin', 'casino_admin', 'regulator', 'super_admin'] },
      { title: 'AI Intelligence', href: '/casino/ai-intelligence', icon: Brain, roles: ['casino_admin', 'casino_admin', 'regulator', 'super_admin'] },
      { title: 'Interventions', href: '/casino/interventions', icon: ShieldAlert, roles: ['casino_admin', 'casino_admin', 'regulator', 'super_admin'] },
      { title: 'GuardianLayer', href: '/casino/guardianlayer', icon: Shield, badge: 'NEW', roles: ['casino_admin'] },
      { title: 'GuardianLayer', href: '/regulator/guardianlayer', icon: Shield, badge: 'NEW', roles: ['regulator'] },
      { title: 'GuardianLayer', href: '/admin/guardianlayer', icon: Shield, badge: 'NEW', roles: ['super_admin'] },
    ],
  },
  {
    title: 'Governance',
    items: [
      { title: 'ESG Performance', href: '/esg-performance', icon: CheckCircle, roles: ['casino_admin', 'regulator', 'super_admin'] },
      { title: 'ESG Data Entry', href: '/casino/esg-data-entry', icon: FileText, roles: ['casino_admin', 'casino_admin'] },
      { title: 'Wellbeing Compliance', href: '/regulator/wellbeing-compliance', icon: Shield, roles: ['regulator', 'super_admin'] },
    ],
  },
  {
    title: 'Platform',
    items: [
      { title: 'Training Academy', href: '/casino/training', icon: GraduationCap, roles: ['casino_admin'] },
      { title: 'My Training', href: '/staff/academy', icon: GraduationCap, roles: ['casino_staff'] },
      { title: 'Course Management', href: '/admin/course-management', icon: GraduationCap, roles: ['super_admin'] },
      { title: 'Nova IQ', href: '/casino/wellbeing-games', icon: Target, roles: ['casino_admin', 'casino_admin'] },
      { title: 'Nova IQ Admin', href: '/admin/wellbeing-games', icon: Target, roles: ['super_admin'] },
      {
        title: 'SafePlay Connect',
        icon: Plug,
        roles: ['casino_admin', 'super_admin'],
        subItems: [
          { title: 'Overview', href: '/safeplay-connect/overview', icon: Globe },
          { title: 'API Documentation', href: '/safeplay-connect/api-docs', icon: Code },
          { title: 'Integration Demo', href: '/safeplay-connect/integration-demo', icon: Webhook },
          { title: 'Postman Samples', href: '/safeplay-connect/postman-samples', icon: FileCode },
          { title: 'CTO Brief', href: '/safeplay-connect/cto-brief', icon: BookOpen },
          { title: 'README', href: '/safeplay-connect/readme', icon: FileText },
          { title: 'ESG Integration', href: '/safeplay-connect/esg-data-integration', icon: Database },
        ]
      },
    ],
  },
  {
    title: 'Settings',
    items: [
      { title: 'Profile', href: '/staff/profile', icon: User, roles: ['casino_staff'] },
      { title: 'Staff Management', href: '/casino/staff', icon: Users, roles: ['casino_admin'] },
      { title: 'Integrations', href: '/admin/integrations', icon: Plug, roles: ['super_admin'] },
      { title: 'Module Management', href: '/admin/casino-modules', icon: Settings, roles: ['super_admin'] },
      { title: 'User Management', href: '/admin/user-roles', icon: Settings, roles: ['super_admin'] },
      { title: 'ESG Management', href: '/admin/esg-management', icon: Settings, roles: ['super_admin'] },
    ],
  },
];

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [originalUserEmail, setOriginalUserEmail] = useState('');
  const [expandedMenus, setExpandedMenus] = useState<string[]>(['SafePlay Connect']);
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();

  const toggleMenu = (title: string) => {
    setExpandedMenus((prev) =>
      prev.includes(title) ? prev.filter((t) => t !== title) : [...prev, title]
    );
  };

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const impersonatedBy = localStorage.getItem('impersonated_by');
      const originalEmail = localStorage.getItem('original_user_email');
      if (impersonatedBy && originalEmail) {
        setIsImpersonating(true);
        setOriginalUserEmail(originalEmail);
      }
    }
  }, []);

  const handleExitImpersonation = async () => {
    try {
      const originalEmail = localStorage.getItem('original_user_email');
      if (!originalEmail) {
        throw new Error('Original user email not found');
      }

      localStorage.removeItem('impersonated_by');
      localStorage.removeItem('original_user_email');

      const { error } = await supabase.auth.signInWithPassword({
        email: originalEmail,
        password: 'Casino123!',
      });

      if (error) throw error;

      setIsImpersonating(false);
      router.push('/casino/dashboard');
    } catch (error) {
      console.error('Failed to exit impersonation:', error);
    }
  };

  const handleLogout = async () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('impersonated_by');
      localStorage.removeItem('original_user_email');
    }
    await signOut();
    router.push('/login');
  };

  const filteredNavigation = navigationGroups.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      if (!item.roles || item.roles.length === 0) return true;
      return user?.role && item.roles.includes(user.role);
    }),
  })).filter((group) => group.items.length > 0);

  const SidebarContent = ({ mobile = false }: { mobile?: boolean }) => (
    <div className="flex h-full flex-col bg-sidebar-background text-sidebar-foreground">
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-sidebar-border px-4 bg-sidebar-background">
        {!sidebarCollapsed || mobile ? (
          <Link href="/" className="flex items-center">
            <img
              src="/safebet_website_logo copy copy.png"
              alt="Logo"
              className="h-10 w-auto object-contain"
              style={{ mixBlendMode: 'lighten' }}
            />
          </Link>
        ) : (
          <Link href="/" className="flex items-center mx-auto">
            <img
              src="/safebet_website_logo copy copy.png"
              alt="Logo"
              className="h-8 w-auto object-contain"
              style={{ mixBlendMode: 'lighten' }}
            />
          </Link>
        )}
      </div>

      {/* Search */}
      {(!sidebarCollapsed || mobile) && (
        <div className="p-4 bg-sidebar-background">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sidebar-foreground/60" />
            <Input
              placeholder="Search..."
              className="pl-9 bg-sidebar-hover border-sidebar-border text-sidebar-foreground placeholder:text-sidebar-foreground/60"
            />
          </div>
        </div>
      )}

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3 bg-sidebar-background">
        <div className="space-y-6 py-4">
          {filteredNavigation.map((group, groupIndex) => (
            <div key={groupIndex}>
              {(!sidebarCollapsed || mobile) && (
                <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/60">
                  {group.title}
                </h3>
              )}
              <nav className="space-y-1">
                {group.items.map((item, itemIndex) => {
                  const Icon = item.icon;
                  const hasSubItems = item.subItems && item.subItems.length > 0;
                  const isExpanded = expandedMenus.includes(item.title);
                  const isActive = item.href ? (pathname === item.href || pathname.startsWith(item.href + '/')) : false;
                  const isAnySubItemActive = hasSubItems && item.subItems?.some(sub => pathname === sub.href || pathname.startsWith(sub.href! + '/'));

                  if (hasSubItems) {
                    return (
                      <div key={itemIndex}>
                        <button
                          onClick={() => toggleMenu(item.title)}
                          className={cn(
                            'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-base w-full',
                            isAnySubItemActive
                              ? 'bg-sidebar-active text-sidebar-active-foreground'
                              : 'text-sidebar-foreground hover:bg-sidebar-hover'
                          )}
                        >
                          <Icon className="h-5 w-5 flex-shrink-0" />
                          {(!sidebarCollapsed || mobile) && (
                            <>
                              <span className="flex-1 text-left">{item.title}</span>
                              <ChevronDown
                                className={cn(
                                  'h-4 w-4 transition-transform',
                                  isExpanded && 'rotate-180'
                                )}
                              />
                            </>
                          )}
                        </button>
                        {(!sidebarCollapsed || mobile) && isExpanded && item.subItems && (
                          <div className="ml-8 mt-1 space-y-1">
                            {item.subItems.map((subItem, subIndex) => {
                              const SubIcon = subItem.icon;
                              const isSubActive = pathname === subItem.href || pathname.startsWith(subItem.href! + '/');
                              return (
                                <Link
                                  key={subIndex}
                                  href={subItem.href!}
                                  onClick={() => mobile && setMobileOpen(false)}
                                  className={cn(
                                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-base',
                                    isSubActive
                                      ? 'bg-sidebar-active text-sidebar-active-foreground'
                                      : 'text-sidebar-foreground hover:bg-sidebar-hover'
                                  )}
                                >
                                  <SubIcon className="h-4 w-4 flex-shrink-0" />
                                  <span className="flex-1">{subItem.title}</span>
                                </Link>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  }

                  return (
                    <Link
                      key={itemIndex}
                      href={item.href!}
                      onClick={() => mobile && setMobileOpen(false)}
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-base',
                        isActive
                          ? 'bg-sidebar-active text-sidebar-active-foreground'
                          : 'text-sidebar-foreground hover:bg-sidebar-hover'
                      )}
                    >
                      <Icon className="h-5 w-5 flex-shrink-0" />
                      {(!sidebarCollapsed || mobile) && (
                        <>
                          <span className="flex-1">{item.title}</span>
                          {item.badge && (
                            <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
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
      <div className="border-t border-sidebar-border p-4 bg-sidebar-background">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className={cn(
                'w-full justify-start gap-3 hover:bg-sidebar-hover text-sidebar-foreground',
                sidebarCollapsed && !mobile && 'justify-center'
              )}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground flex-shrink-0">
                <User className="h-4 w-4" />
              </div>
              {(!sidebarCollapsed || mobile) && (
                <div className="flex flex-col items-start text-sm">
                  <span className="font-medium text-sidebar-foreground">{user?.email || 'User'}</span>
                  <span className="text-xs text-sidebar-foreground/60 capitalize">
                    {user?.role?.replace('_', ' ') || 'Role'}
                  </span>
                </div>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push('/staff/profile')}>
              <User className="mr-2 h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push('/admin/user-roles')}>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Collapse Toggle - Desktop only */}
      {!mobile && (
        <div className="border-t border-sidebar-border p-2 bg-sidebar-background">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="w-full hover:bg-sidebar-hover text-sidebar-foreground"
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
          sidebarCollapsed ? 'w-16' : 'w-[260px]'
        )}
      >
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[260px] p-0 bg-sidebar-background">
          <SidebarContent mobile />
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile Header */}
        <header className="flex h-16 items-center gap-4 border-b border-border bg-card px-4 md:hidden">
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
              alt="Logo"
              className="h-8 w-auto object-contain"
              style={{ mixBlendMode: 'lighten' }}
            />
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="icon">
              <Bell className="h-5 w-5" />
            </Button>
          </div>
        </header>

        {/* Impersonation Banner */}
        {isImpersonating && (
          <div className="bg-yellow-500 text-yellow-900 px-4 py-3 flex items-center justify-between shadow-md">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5" />
              <span className="text-sm font-medium">
                Viewing as <strong>{user?.email}</strong> - You are impersonating this staff member
              </span>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExitImpersonation}
              className="bg-white hover:bg-gray-100 text-yellow-900"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Exit & Return to Dashboard
            </Button>
          </div>
        )}

        {/* Page Content */}
        <main className="flex-1 overflow-auto custom-scrollbar">
          {children}
        </main>
      </div>
    </div>
  );
}
