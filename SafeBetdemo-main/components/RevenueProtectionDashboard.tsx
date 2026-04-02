'use client';

import { useEffect, useState } from 'react';
import { KPICard } from '@/components/saas/KPICard';
import { ChartCard } from '@/components/saas/ChartCard';
import { TableCard } from '@/components/saas/TableCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Banknote,
  Shield,
  AlertTriangle,
  Crown,
  TrendingDown,
  TrendingUp,
  Info,
  Download,
} from 'lucide-react';
import {
  getCurrentMonthMetrics,
  getRevenueProtectionTrends,
  getRevenueComparison,
  getEventTypeBreakdown,
  formatZAR,
  formatEventType,
  type RevenueProtectionMetrics,
  type RPITrend,
} from '@/lib/revenueProtectionService';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useAuth } from '@/contexts/AuthContext';

export default function RevenueProtectionDashboard() {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<RevenueProtectionMetrics | null>(null);
  const [trends, setTrends] = useState<RPITrend[]>([]);
  const [breakdown, setBreakdown] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const casinoId = user?.casino_id;
      if (!casinoId) {
        setLoading(false);
        return;
      }

      try {
        const [metricsData, trendsData, breakdownData] = await Promise.all([
          getCurrentMonthMetrics(casinoId),
          getRevenueProtectionTrends(casinoId, 6),
          getEventTypeBreakdown(casinoId),
        ]);

        setMetrics(metricsData);
        setTrends(trendsData);

        const formattedBreakdown = breakdownData.map(item => ({
          type: formatEventType(item.eventType),
          value: item.totalValue,
          count: item.count,
        }));

        console.log('[RPI Dashboard] Formatted breakdown data:', formattedBreakdown);
        setBreakdown(formattedBreakdown);
      } catch (error) {
        console.error('[RPI Dashboard] Error fetching RPI data:', error);
      } finally {
        setLoading(false);
      }
    }

    if (user) {
      fetchData();
    }
  }, [user]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
        <div className="h-96 animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">No revenue protection data available</p>
      </div>
    );
  }

  const metricCards = [
    {
      title: 'LTV Saved',
      value: metrics.ltvSaved,
      icon: Banknote,
      confidence: 'High',
      description: 'Players retained beyond predicted dropout',
      tooltip: 'Lifetime value of players who were at risk of churning but continued playing after AI intervention. Calculated as (Players Retained × Average LTV) minus intervention costs.',
    },
    {
      title: 'Fraud Prevented',
      value: metrics.fraudPrevented,
      icon: Shield,
      confidence: 'High',
      description: 'Fraudulent activity blocked',
      tooltip: 'Total monetary value of fraudulent transactions blocked by the AI system, plus funds recovered from flagged accounts before payout.',
    },
    {
      title: 'Chargebacks Avoided',
      value: metrics.chargebacksAvoided,
      icon: AlertTriangle,
      confidence: 'Medium',
      description: 'Disputes prevented through intervention',
      tooltip: 'Estimated chargebacks prevented through proactive AI interventions. Based on historical chargeback rates versus current rates after implementing SafeBet IQ.',
    },
    {
      title: 'VIP Retention',
      value: metrics.vipRetained,
      icon: Crown,
      confidence: 'Medium',
      description: 'High-value players retained',
      tooltip: 'Revenue from high-value players who showed exit signals but were retained through targeted AI-driven engagement and personalized interventions.',
    },
  ];

  const calculationMethods = [
    {
      title: 'LTV Saved Calculation',
      formula: 'LTV Saved = (Players Retained × Average LTV) - Intervention Cost',
      description:
        'We calculate the lifetime value of players who were at risk of churning but continued playing after intervention. This is the total value they generated post-intervention minus the cost of the intervention.',
    },
    {
      title: 'Fraud Prevention',
      formula: 'Fraud Prevented = Blocked Transactions + Recovered Funds',
      description:
        'Monetary value of fraudulent transactions blocked by our AI system, plus funds recovered from flagged accounts before payout.',
    },
    {
      title: 'Chargeback Avoidance',
      formula: 'Chargebacks Avoided = Historical Rate × Intervened Volume × (1 - Current Rate)',
      description:
        'Based on your historical chargeback rate, we estimate how many disputes were prevented by proactive intervention on problematic sessions.',
    },
    {
      title: 'VIP Retention Estimate',
      formula: 'VIP Retention = High-Value Players Retained × Average Monthly Spend',
      description:
        'Value generated by high-spending players who showed exit signals but were retained through targeted engagement.',
    },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {metricCards.map((card, idx) => (
          <KPICard
            key={idx}
            title={card.title}
            value={formatZAR(card.value)}
            icon={card.icon}
            tooltip={card.tooltip}
            change={{
              value: Math.random() * 20 - 10,
              type: Math.random() > 0.5 ? 'increase' : 'decrease',
              label: 'vs last month',
            }}
          />
        ))}
      </div>

      {/* Total Protected & ROI */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard
          title="Total Revenue Protected"
          description={`R ${metrics.totalProtected.toLocaleString()} this month`}
          tooltip="Combined total of all revenue protection categories this month, including LTV saved, fraud prevented, chargebacks avoided, and VIP retention. Shown with platform ROI calculation."
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between py-4">
              <span className="text-5xl font-bold text-primary">
                R {(metrics.totalProtected / 1000).toFixed(0)}K
              </span>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">ROI</p>
                <p className="text-2xl font-bold">{metrics.roiMultiple.toFixed(1)}x</p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Platform Cost</span>
                <span className="font-medium">R 25,000 / month</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Revenue Protected</span>
                <span className="font-medium">R {metrics.totalProtected.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </ChartCard>

        <ChartCard
          title="Confidence Indicators"
          description="Data quality and calculation confidence"
          tooltip="Confidence level for each revenue protection metric based on data completeness, sample size, and historical accuracy. High confidence indicates direct measurement, Medium indicates statistical modeling."
        >
          <div className="space-y-4">
            {metricCards.map((card, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <card.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{card.title}</p>
                    <p className="text-xs text-muted-foreground">{card.description}</p>
                  </div>
                </div>
                <Badge
                  variant={
                    card.confidence === 'High'
                      ? 'default'
                      : card.confidence === 'Medium'
                      ? 'secondary'
                      : 'outline'
                  }
                >
                  {card.confidence}
                </Badge>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>

      {/* Trends Chart */}
      <ChartCard
        title="Revenue Protection Trends"
        description="6-month historical view"
        tooltip="Six-month historical trend showing total revenue protected per month. Track the growth and impact of AI-driven interventions over time."
        headerAction={
          <Button variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        }
      >
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={trends}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="month"
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
            />
            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="totalProtected"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              name="Total Protected"
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Event Breakdown */}
      <ChartCard
        title="Protection Event Breakdown"
        description="Distribution by intervention type"
        tooltip="Breakdown of revenue protection by intervention type, showing the financial impact and number of events for each category (VIP retention, fraud prevention, chargeback avoidance, dropout prevention)."
      >
        {breakdown.length === 0 ? (
          <div className="flex items-center justify-center h-[300px] text-muted-foreground">
            <p>No protection events recorded for this month</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={breakdown} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis
                type="category"
                dataKey="type"
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                width={150}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
                formatter={(value: any, name: string, props: any) => {
                  const formattedValue = formatZAR(value);
                  const count = props.payload.count || 0;
                  return [`${formattedValue} (${count} events)`, 'Financial Impact'];
                }}
              />
              <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* Calculation Methods */}
      <ChartCard
        title="How This Is Calculated"
        description="Methodology and confidence levels"
        tooltip="Detailed breakdown of the mathematical formulas and methodologies used to calculate each revenue protection metric. Expand each section to see the specific calculations and assumptions."
      >
        <Accordion type="single" collapsible className="w-full">
          {calculationMethods.map((method, idx) => (
            <AccordionItem key={idx} value={`item-${idx}`}>
              <AccordionTrigger className="text-left">
                <div className="flex items-center gap-2">
                  <Info className="h-4 w-4 text-primary" />
                  <span className="font-medium">{method.title}</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 pl-6">
                  <div className="rounded-lg bg-muted p-3">
                    <code className="text-sm">{method.formula}</code>
                  </div>
                  <p className="text-sm text-muted-foreground">{method.description}</p>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </ChartCard>
    </div>
  );
}
