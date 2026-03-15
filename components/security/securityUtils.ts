export interface SecurityEvent {
  id: string;
  event_type: string;
  severity: string;
  title: string;
  source_country: string | null;
  affected_system: string | null;
  source_ip_hash: string | null;
  created_at: string;
  casino_id: string | null;
}

export interface SecurityIncident {
  id: string;
  incident_number: string | null;
  title: string;
  description: string | null;
  severity: string;
  category: string;
  status: string;
  escalated: boolean | null;
  escalation_reason: string | null;
  affected_systems: string[] | null;
  impact_assessment: string | null;
  reporter_name: string | null;
  regulatory_notification_required: boolean | null;
  internal_notes: string | null;
  assigned_to: string | null;
  detected_at: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  affected_casino_id: string | null;
}

export interface APIActivity {
  id: string;
  casino_id: string | null;
  integration_name: string | null;
  endpoint: string;
  method: string | null;
  status_code: number | null;
  response_ms: number | null;
  country_code: string | null;
  is_rate_limited: boolean | null;
  is_blocked: boolean | null;
  is_anomalous: boolean | null;
  anomaly_reason: string | null;
  created_at: string;
}

export interface HealthMetric {
  service_name: string;
  metric_type: string;
  value: number;
  unit: string | null;
  status: string;
  recorded_at: string;
}

export interface TenantStatus {
  casino_id: string;
  security_score: number;
  threat_level: string;
  open_incidents: number;
  open_critical_events: number;
  failed_logins_24h: number;
  api_errors_24h: number;
  mfa_adoption_pct: number;
  compliance_score: number;
  ip_allowlist_active: boolean;
  rate_limiting_active: boolean;
  waf_active: boolean;
  updated_at: string;
}

export interface Casino {
  id: string;
  name: string;
}

export interface ComplianceSnap {
  framework: string;
  compliance_score: number;
  total_controls: number;
  compliant: number;
}

export interface DataSecurityEvent {
  id: string;
  casino_id: string | null;
  event_type: string;
  severity: string;
  table_name: string | null;
  rows_affected: number | null;
  actor_role: string | null;
  is_encrypted: boolean | null;
  integrity_verified: boolean | null;
  dlp_triggered: boolean | null;
  description: string | null;
  created_at: string;
}

export interface AIInsight {
  id: string;
  casino_id: string | null;
  insight_type: string;
  severity: string;
  title: string;
  description: string;
  confidence_score: number | null;
  affected_entity: string | null;
  recommended_action: string | null;
  is_acknowledged: boolean | null;
  auto_generated: boolean | null;
  created_at: string;
}

export interface AWSMetric {
  id: string;
  service: string;
  metric_name: string;
  value: number;
  unit: string | null;
  region: string | null;
  status: string;
  alarm_state: string;
  description: string | null;
  recorded_at: string;
}

export interface RGOverlay {
  id: string;
  casino_id: string | null;
  check_type: string;
  status: string;
  integrity_score: number;
  anomalies_detected: number;
  last_check_at: string;
  details: string | null;
}

export const SEV_CONFIG: Record<string, { dot: string; badge: string; text: string }> = {
  critical: { dot: 'bg-red-500', badge: 'bg-red-900/60 text-red-300 border-red-700', text: 'text-red-400' },
  high:     { dot: 'bg-orange-500', badge: 'bg-orange-900/60 text-orange-300 border-orange-700', text: 'text-orange-400' },
  medium:   { dot: 'bg-amber-500', badge: 'bg-amber-900/60 text-amber-300 border-amber-700', text: 'text-amber-400' },
  low:      { dot: 'bg-slate-500', badge: 'bg-slate-800 text-slate-400 border-slate-700', text: 'text-slate-400' },
  info:     { dot: 'bg-blue-500', badge: 'bg-blue-900/60 text-blue-300 border-blue-700', text: 'text-blue-400' },
};

export const STATUS_BADGE: Record<string, string> = {
  open:          'bg-red-900/60 text-red-300 border-red-700',
  investigating: 'bg-amber-900/60 text-amber-300 border-amber-700',
  contained:     'bg-blue-900/60 text-blue-300 border-blue-700',
  remediated:    'bg-teal-900/60 text-teal-300 border-teal-700',
  closed:        'bg-slate-800 text-slate-400 border-slate-700',
  false_positive:'bg-slate-800 text-slate-500 border-slate-700',
};

export const THREAT_LEVEL_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

export function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function formatEventType(t: string) {
  return t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
