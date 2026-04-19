'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { DollarSign, TrendingUp, Building2, Award, BarChart3 } from 'lucide-react';
import { getPlatformWideMetrics, formatZAR } from '@/lib/revenueProtectionService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { motion } from 'framer-motion';

export default function PlatformRevenueProtectionAnalytics() {
  const [platformData, setPlatformData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const data = await getPlatformWideMetrics();
        setPlatformData(data);
      } catch (error) {
        console.error('Error fetching platform RPI data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="h-32 bg-muted rounded"></div>
        </div>
      </Card>
    );
  }

  if (!platformData) {
    return null;
  }

  const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

  return (
    <div className="space-y-6">
      {/* Platform-Wide Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="p-8 border-primary/20">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-2">
                🌍 Platform-Wide Revenue Protection
              </h2>
              <p className="text-muted-foreground">
                Aggregated financial impact across all casino operators
              </p>
            </div>
            <div className="flex items-center gap-2 text-primary">
              <TrendingUp className="w-6 h-6" />
              <span className="text-sm font-medium">
                {platformData.averageROI.toFixed(1)}x Avg ROI
              </span>
            </div>
          </div>

          {/* Total Protected Value */}
          <div className="mb-6">
            <motion.div
              className="text-6xl font-bold text-primary text-center"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              {formatZAR(platformData.totalProtected)}
            </motion.div>
            <p className="text-muted-foreground mt-2 text-center">Total Revenue Protected This Month</p>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-4 bg-primary/10 border-0">
              <div className="flex items-center gap-3">
                <Building2 className="w-8 h-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold text-primary">
                    {platformData.casinoMetrics.length}
                  </p>
                  <p className="text-sm text-muted-foreground">Active Casinos</p>
                </div>
              </div>
            </Card>

            <Card className="p-4 bg-chart-2/10 border-0">
              <div className="flex items-center gap-3">
                <Award className="w-8 h-8 text-chart-2" />
                <div>
                  <p className="text-2xl font-bold text-chart-2">
                    {platformData.averageROI.toFixed(1)}x
                  </p>
                  <p className="text-sm text-muted-foreground">Average ROI</p>
                </div>
              </div>
            </Card>

            <Card className="p-4 bg-chart-3/10 border-0">
              <div className="flex items-center gap-3">
                <DollarSign className="w-8 h-8 text-chart-3" />
                <div>
                  <p className="text-2xl font-bold text-chart-3">
                    {formatZAR(platformData.totalProtected / platformData.casinoMetrics.length)}
                  </p>
                  <p className="text-sm text-muted-foreground">Avg Per Casino</p>
                </div>
              </div>
            </Card>
          </div>
        </Card>
      </motion.div>

      {/* Casino Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar Chart by Casino */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-foreground">Revenue Protection by Casino</h3>
            <BarChart3 className="w-5 h-5 text-primary" />
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={platformData.casinoMetrics}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="casinoName"
                stroke="hsl(var(--muted-foreground))"
                style={{ fontSize: '12px' }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis stroke="hsl(var(--muted-foreground))" style={{ fontSize: '12px' }} />
              <Tooltip
                contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                formatter={(value: any) => formatZAR(value)}
              />
              <Bar dataKey="totalProtected" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} name="Protected Revenue" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* ROI by Casino */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-foreground">ROI Performance by Casino</h3>
            <TrendingUp className="w-5 h-5 text-primary" />
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={platformData.casinoMetrics}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="casinoName"
                stroke="hsl(var(--muted-foreground))"
                style={{ fontSize: '12px' }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis stroke="hsl(var(--muted-foreground))" style={{ fontSize: '12px' }} />
              <Tooltip
                contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                formatter={(value: any) => `${value.toFixed(2)}x`}
              />
              <Bar dataKey="roiMultiple" fill="hsl(var(--chart-2))" radius={[8, 8, 0, 0]} name="ROI Multiple" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Casino Performance Table */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Detailed Casino Performance</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 text-sm font-semibold text-muted-foreground">Casino</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-muted-foreground">Revenue Protected</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-muted-foreground">ROI Multiple</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-muted-foreground">Performance</th>
              </tr>
            </thead>
            <tbody>
              {platformData.casinoMetrics
                .sort((a: any, b: any) => b.totalProtected - a.totalProtected)
                .map((casino: any, index: number) => (
                  <motion.tr
                    key={casino.casinoName}
                    className="border-b border-border hover:bg-muted/50 transition-colors"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <td className="py-3 px-4 text-foreground font-medium">{casino.casinoName}</td>
                    <td className="py-3 px-4 text-right text-primary font-bold">
                      {formatZAR(casino.totalProtected)}
                    </td>
                    <td className="py-3 px-4 text-right text-chart-2 font-bold">
                      {casino.roiMultiple.toFixed(2)}x
                    </td>
                    <td className="py-3 px-4 text-right">
                      {casino.roiMultiple >= 10 ? (
                        <span className="inline-flex items-center gap-1 text-primary text-sm font-semibold">
                          <TrendingUp className="w-4 h-4" />
                          Excellent
                        </span>
                      ) : casino.roiMultiple >= 5 ? (
                        <span className="inline-flex items-center gap-1 text-chart-2 text-sm font-semibold">
                          <TrendingUp className="w-4 h-4" />
                          Good
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-chart-3 text-sm font-semibold">
                          <BarChart3 className="w-4 h-4" />
                          Average
                        </span>
                      )}
                    </td>
                  </motion.tr>
                ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Value Proposition */}
      <Card className="p-6 border-primary/30">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-primary/10 rounded-lg">
            <Award className="w-8 h-8 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Revenue Protection ROI Analysis
            </h3>
            <p className="text-muted-foreground mb-4">
              SafeBet IQ has protected <span className="text-primary font-bold">{formatZAR(platformData.totalProtected)}</span> in
              potential revenue losses this month across all casino operators. With an average ROI of{' '}
              <span className="text-primary font-bold">{platformData.averageROI.toFixed(1)}x</span>, the platform
              demonstrates clear financial value beyond compliance.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground mb-1">Average Protection Per Casino</p>
                <p className="text-foreground font-bold">
                  {formatZAR(platformData.totalProtected / platformData.casinoMetrics.length)}/month
                </p>
              </div>
              <div>
                <p className="text-muted-foreground mb-1">Platform Cost Efficiency</p>
                <p className="text-foreground font-bold">{platformData.averageROI.toFixed(1)}x return on investment</p>
              </div>
              <div>
                <p className="text-muted-foreground mb-1">Risk Mitigation Value</p>
                <p className="text-foreground font-bold">Fraud + Chargeback Prevention</p>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
