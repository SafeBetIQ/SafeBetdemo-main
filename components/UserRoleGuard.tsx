'use client';

import { ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, ShieldAlert } from 'lucide-react';

export type UserRole = 'SUPPORT' | 'COMPLIANCE' | 'RISK_ANALYST' | 'EXECUTIVE' | 'REGULATOR';

interface UserRoleGuardProps {
  children: ReactNode;
  allowedRoles: UserRole[];
  module?: string;
  fallback?: ReactNode;
  showAlert?: boolean;
}

export function UserRoleGuard({
  children,
  allowedRoles,
  module,
  fallback,
  showAlert = true,
}: UserRoleGuardProps) {
  const { user } = useAuth();

  if (!user) {
    return fallback || (
      <Alert className="border-red-200 bg-red-50">
        <ShieldAlert className="h-4 w-4 text-red-600" />
        <AlertDescription className="text-red-800">
          Authentication required. Please log in to access this content.
        </AlertDescription>
      </Alert>
    );
  }

  const userRole = (user as any).user_role as UserRole | undefined;

  if (!userRole || !allowedRoles.includes(userRole)) {
    if (!showAlert) {
      return null;
    }

    return fallback || (
      <Alert className="border-amber-200 bg-amber-50">
        <AlertCircle className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800">
          <strong>Access Restricted:</strong> Your role ({userRole || 'Unknown'}) does not have permission to view this {module || 'content'}.
          <br />
          <span className="text-xs text-amber-700 mt-1 block">
            Required roles: {allowedRoles.join(', ')}
          </span>
        </AlertDescription>
      </Alert>
    );
  }

  return <>{children}</>;
}

interface ModuleAccessProps {
  module: string;
  children: ReactNode;
  fallback?: ReactNode;
}

export function ModuleAccess({ module, children, fallback }: ModuleAccessProps) {
  const modulePermissions: Record<string, UserRole[]> = {
    player_risk_score: ['SUPPORT', 'COMPLIANCE', 'RISK_ANALYST', 'REGULATOR'],
    operational_alerts: ['SUPPORT', 'COMPLIANCE', 'RISK_ANALYST'],
    interventions: ['COMPLIANCE', 'RISK_ANALYST'],
    behavioral_risk_intelligence: ['RISK_ANALYST', 'REGULATOR'],
    esg_dashboard: ['EXECUTIVE', 'RISK_ANALYST', 'REGULATOR'],
    casino_comparison: ['EXECUTIVE', 'REGULATOR'],
    financial_reports: ['EXECUTIVE'],
    demo_mode: ['RISK_ANALYST', 'EXECUTIVE', 'REGULATOR'],
    compliance_overview: ['COMPLIANCE', 'RISK_ANALYST', 'REGULATOR'],
    audit_logs: ['REGULATOR'],
  };

  const allowedRoles = modulePermissions[module] || [];

  return (
    <UserRoleGuard allowedRoles={allowedRoles} module={module} fallback={fallback}>
      {children}
    </UserRoleGuard>
  );
}

export function useUserRole(): UserRole | null {
  const { user } = useAuth();
  if (!user) return null;
  return (user as any).user_role as UserRole || null;
}

export function useHasAccess(module: string): boolean {
  const userRole = useUserRole();
  if (!userRole) return false;

  const modulePermissions: Record<string, UserRole[]> = {
    player_risk_score: ['SUPPORT', 'COMPLIANCE', 'RISK_ANALYST', 'REGULATOR'],
    operational_alerts: ['SUPPORT', 'COMPLIANCE', 'RISK_ANALYST'],
    interventions: ['COMPLIANCE', 'RISK_ANALYST'],
    behavioral_risk_intelligence: ['RISK_ANALYST', 'REGULATOR'],
    esg_dashboard: ['EXECUTIVE', 'RISK_ANALYST', 'REGULATOR'],
    casino_comparison: ['EXECUTIVE', 'REGULATOR'],
    financial_reports: ['EXECUTIVE'],
    demo_mode: ['RISK_ANALYST', 'EXECUTIVE', 'REGULATOR'],
    compliance_overview: ['COMPLIANCE', 'RISK_ANALYST', 'REGULATOR'],
    audit_logs: ['REGULATOR'],
  };

  const allowedRoles = modulePermissions[module] || [];
  return allowedRoles.includes(userRole);
}

export function LegalDisclaimer() {
  return (
    <Alert className="border-slate-300 bg-slate-50 mb-6">
      <AlertCircle className="h-4 w-4 text-slate-600" />
      <AlertDescription className="text-slate-700 text-sm">
        <strong>SafeBet IQ</strong> is strictly an internal AI compliance support tool.
        It does not automate decisions or contact players directly.
        All suggested actions require human review. This system is for internal use by
        compliance teams, risk analysts, executives, and regulators only.
      </AlertDescription>
    </Alert>
  );
}
