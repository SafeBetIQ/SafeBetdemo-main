import { supabase } from './supabase';

export interface RevenueProtectionMetrics {
  ltvSaved: number;
  fraudPrevented: number;
  chargebacksAvoided: number;
  vipRetained: number;
  dropoutPrevented: number;
  totalProtected: number;
  eventsCount: number;
  playersProtected: number;
  roiMultiple: number;
  month: string;
}

export interface RevenueProtectionEvent {
  id: string;
  eventType: string;
  eventDate: string;
  financialImpact: number;
  playerName?: string;
  interventionType?: string;
  confidenceScore: number;
  notes: string;
  calculationDetails: any;
}

export interface RPITrend {
  month: string;
  totalProtected: number;
  eventsCount: number;
}

export interface RPIComparison {
  withSafeBetIQ: number;
  withoutSafeBetIQ: number;
  difference: number;
  percentageImprovement: number;
}

/**
 * Get current month revenue protection metrics for a casino
 */
export async function getCurrentMonthMetrics(
  casinoId: string
): Promise<RevenueProtectionMetrics | null> {
  const currentMonth = new Date().toISOString().slice(0, 7) + '-01';

  console.log('[RPI Service] Fetching metrics for casino:', casinoId, 'Month:', currentMonth);

  const { data, error } = await supabase
    .from('revenue_protection_monthly')
    .select('*')
    .eq('casino_id', casinoId)
    .eq('month', currentMonth)
    .maybeSingle();

  console.log('[RPI Service] Query result:', { data, error });

  if (error) {
    console.error('[RPI Service] Error fetching current month metrics:', error);
    console.error('[RPI Service] Query params:', { casinoId, currentMonth });
    return null;
  }

  if (!data) {
    console.warn('[RPI Service] No data found for casino:', casinoId, 'month:', currentMonth);
    console.log('[RPI Service] Returning zero metrics');
    return {
      ltvSaved: 0,
      fraudPrevented: 0,
      chargebacksAvoided: 0,
      vipRetained: 0,
      dropoutPrevented: 0,
      totalProtected: 0,
      eventsCount: 0,
      playersProtected: 0,
      roiMultiple: 0,
      month: currentMonth,
    };
  }

  console.log('[RPI Service] Successfully fetched metrics:', {
    totalProtected: data.total_protected_zar,
    eventsCount: data.events_count,
    playersProtected: data.players_protected_count
  });

  return {
    ltvSaved: parseFloat(data.ltv_saved_zar || '0'),
    fraudPrevented: parseFloat(data.fraud_prevented_zar || '0'),
    chargebacksAvoided: parseFloat(data.chargebacks_avoided_zar || '0'),
    vipRetained: parseFloat(data.vip_retained_zar || '0'),
    dropoutPrevented: parseFloat(data.dropout_prevented_zar || '0'),
    totalProtected: parseFloat(data.total_protected_zar || '0'),
    eventsCount: data.events_count || 0,
    playersProtected: data.players_protected_count || 0,
    roiMultiple: parseFloat(data.roi_multiple || '0'),
    month: data.month,
  };
}

/**
 * Get revenue protection trends for last 6 months
 */
export async function getRevenueProtectionTrends(
  casinoId: string,
  months: number = 6
): Promise<RPITrend[]> {
  const { data, error } = await supabase
    .from('revenue_protection_monthly')
    .select('month, total_protected_zar, events_count')
    .eq('casino_id', casinoId)
    .order('month', { ascending: false })
    .limit(months);

  if (error) {
    console.error('Error fetching trends:', error);
    return [];
  }

  return (data || []).reverse().map((row) => ({
    month: new Date(row.month).toLocaleDateString('en-ZA', { month: 'short', year: 'numeric' }),
    totalProtected: parseFloat(row.total_protected_zar || '0'),
    eventsCount: row.events_count || 0,
  }));
}

/**
 * Get recent revenue protection events
 */
export async function getRecentProtectionEvents(
  casinoId: string,
  limit: number = 10
): Promise<RevenueProtectionEvent[]> {
  const { data, error } = await supabase
    .from('revenue_protection_events')
    .select(`
      id,
      event_type,
      event_date,
      financial_impact_zar,
      confidence_score,
      notes,
      calculation_details,
      players (first_name, last_name),
      ai_intervention_recommendations (recommended_intervention_type)
    `)
    .eq('casino_id', casinoId)
    .order('event_date', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching recent events:', error);
    return [];
  }

  return (data || []).map((event: any) => ({
    id: event.id,
    eventType: event.event_type,
    eventDate: event.event_date,
    financialImpact: parseFloat(event.financial_impact_zar || '0'),
    playerName: event.players
      ? `${event.players.first_name} ${event.players.last_name}`
      : 'Unknown',
    interventionType: event.ai_intervention_recommendations?.recommended_intervention_type,
    confidenceScore: parseFloat(event.confidence_score || '0'),
    notes: event.notes || '',
    calculationDetails: event.calculation_details || {},
  }));
}

/**
 * Calculate comparison between with and without SafeBet IQ
 */
export async function getRevenueComparison(
  casinoId: string
): Promise<RPIComparison> {
  const metrics = await getCurrentMonthMetrics(casinoId);

  if (!metrics) {
    return {
      withSafeBetIQ: 0,
      withoutSafeBetIQ: 0,
      difference: 0,
      percentageImprovement: 0,
    };
  }

  const withSafeBetIQ = metrics.totalProtected;

  // Simulate "without SafeBet IQ" scenario
  // Assume 75% of protection events wouldn't have been caught
  const withoutSafeBetIQ = withSafeBetIQ * 0.25;
  const difference = withSafeBetIQ - withoutSafeBetIQ;
  const percentageImprovement = withoutSafeBetIQ > 0
    ? ((difference / withoutSafeBetIQ) * 100)
    : 300;

  return {
    withSafeBetIQ,
    withoutSafeBetIQ,
    difference,
    percentageImprovement,
  };
}

/**
 * Get platform-wide metrics for super admin
 */
export async function getPlatformWideMetrics(): Promise<{
  totalProtected: number;
  averageROI: number;
  casinoMetrics: Array<{
    casinoName: string;
    totalProtected: number;
    roiMultiple: number;
  }>;
}> {
  const currentMonth = new Date().toISOString().slice(0, 7) + '-01';

  const { data, error } = await supabase
    .from('revenue_protection_monthly')
    .select(`
      total_protected_zar,
      roi_multiple,
      casinos (name)
    `)
    .eq('month', currentMonth);

  if (error) {
    console.error('Error fetching platform metrics:', error);
    return {
      totalProtected: 0,
      averageROI: 0,
      casinoMetrics: [],
    };
  }

  const totalProtected = (data || []).reduce(
    (sum, row) => sum + parseFloat(row.total_protected_zar || '0'),
    0
  );

  const averageROI = (data || []).reduce(
    (sum, row) => sum + parseFloat(row.roi_multiple || '0'),
    0
  ) / (data?.length || 1);

  const casinoMetrics = (data || []).map((row: any) => ({
    casinoName: row.casinos?.name || 'Unknown',
    totalProtected: parseFloat(row.total_protected_zar || '0'),
    roiMultiple: parseFloat(row.roi_multiple || '0'),
  }));

  return {
    totalProtected,
    averageROI,
    casinoMetrics,
  };
}

/**
 * Get event type breakdown
 */
export async function getEventTypeBreakdown(casinoId: string): Promise<{
  eventType: string;
  count: number;
  totalValue: number;
  percentage: number;
}[]> {
  const currentMonth = new Date().toISOString().slice(0, 7) + '-01';
  const endOfMonth = new Date(new Date(currentMonth).getFullYear(), new Date(currentMonth).getMonth() + 1, 0).toISOString().slice(0, 10);

  console.log('[RPI Service] Fetching event breakdown for casino:', casinoId);
  console.log('[RPI Service] Date range:', currentMonth, 'to', endOfMonth);

  const { data, error } = await supabase
    .from('revenue_protection_events')
    .select('event_type, financial_impact_zar')
    .eq('casino_id', casinoId)
    .gte('event_date', currentMonth)
    .lte('event_date', endOfMonth);

  if (error) {
    console.error('[RPI Service] Error fetching event breakdown:', error);
    return [];
  }

  console.log('[RPI Service] Found', data?.length || 0, 'events');

  const breakdown = (data || []).reduce((acc: any, event: any) => {
    const type = event.event_type;
    if (!acc[type]) {
      acc[type] = { count: 0, totalValue: 0 };
    }
    acc[type].count += 1;
    acc[type].totalValue += parseFloat(event.financial_impact_zar || '0');
    return acc;
  }, {});

  const total = Object.values(breakdown).reduce(
    (sum: number, item: any) => sum + item.totalValue,
    0
  );

  const result = Object.entries(breakdown).map(([eventType, stats]: [string, any]) => ({
    eventType,
    count: stats.count,
    totalValue: stats.totalValue,
    percentage: total > 0 ? (stats.totalValue / total) * 100 : 0,
  }));

  console.log('[RPI Service] Breakdown result:', result);

  return result;
}

/**
 * Format event type for display
 */
export function formatEventType(eventType: string): string {
  const typeMap: { [key: string]: string } = {
    ltv_saved: 'LTV Saved',
    fraud_prevented: 'Fraud Prevented',
    chargeback_avoided: 'Chargeback Avoided',
    vip_retained: 'VIP Retained',
    dropout_prevented: 'Dropout Prevented',
  };
  return typeMap[eventType] || eventType;
}

/**
 * Format currency in ZAR
 */
export function formatZAR(amount: number): string {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
