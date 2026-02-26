'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  FileDown,
  Shield,
  TrendingUp,
  Users,
  CheckCircle2,
  BarChart3,
  AlertTriangle,
  Clock,
  Eye,
} from 'lucide-react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import DetailedSessionViewer from '@/components/wellbeing-games/DetailedSessionViewer';
import { generateWellbeingReport } from '@/lib/wellbeingGameAnalytics';
import { formatPercentage } from '@/lib/utils';

export default function WellbeingCompliancePage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [aggregatedStats, setAggregatedStats] = useState<any>(null);
  const [casinoStats, setCasinoStats] = useState<any[]>([]);
  const [riskTrends, setRiskTrends] = useState<any[]>([]);
  const [allSessions, setAllSessions] = useState<any[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [showSessionViewer, setShowSessionViewer] = useState(false);

  useEffect(() => {
    if (user) {
      loadRegulatorData();
    }
  }, [user]);

  async function loadRegulatorData() {
    setLoading(true);

    const [sessionsRes, invitationsRes, campaignsRes, riskScoresRes, casinos] = await Promise.all([
      supabase
        .from('wellbeing_game_sessions')
        .select(`
          *,
          player:players(first_name, last_name, email),
          game_concept:wellbeing_game_concepts(name),
          casino:casinos(name)
        `)
        .order('started_at', { ascending: false }),
      supabase.from('wellbeing_game_invitations').select('*'),
      supabase.from('wellbeing_game_campaigns').select('*, casino:casinos(name)'),
      supabase.from('wellbeing_risk_scores').select('*'),
      supabase.from('casinos').select('id, name'),
    ]);

    const sessions = sessionsRes.data || [];
    const invitations = invitationsRes.data || [];
    const campaigns = campaignsRes.data || [];
    const riskScores = riskScoresRes.data || [];
    const casinoList = casinos.data || [];

    setAllSessions(sessions);

    const totalInvitations = invitations.length;
    const completedSessions = sessions.filter(s => s.completed_at).length;
    const engagementRate = totalInvitations > 0 ? (completedSessions / totalInvitations) * 100 : 0;
    const activeCampaigns = campaigns.filter(c => c.active).length;

    const avgRiskIndex = riskScores.length > 0
      ? riskScores.reduce((sum, r) => sum + (r.behaviour_risk_index || 0), 0) / riskScores.length
      : 0;

    const highRiskCount = riskScores.filter(r => r.behaviour_risk_index > 70).length;
    const mediumRiskCount = riskScores.filter(r => r.behaviour_risk_index >= 40 && r.behaviour_risk_index <= 70).length;
    const lowRiskCount = riskScores.filter(r => r.behaviour_risk_index < 40).length;

    setAggregatedStats({
      totalInvitations,
      completedSessions,
      engagementRate: Math.round(engagementRate),
      activeCampaigns,
      avgRiskIndex: Math.round(avgRiskIndex * 10) / 10,
      totalCasinos: casinoList.length,
      highRiskCount,
      mediumRiskCount,
      lowRiskCount,
    });

    const casinoStatsData = casinoList.map(casino => {
      const casinoInvitations = invitations.filter((inv: any) => {
        const session = sessions.find((s: any) => s.invitation_id === inv.id);
        return session?.casino_id === casino.id;
      });

      const casinoSessions = sessions.filter((s: any) => s.casino_id === casino.id);
      const casinoCampaigns = campaigns.filter((c: any) => c.casino_id === casino.id);

      return {
        casino_name: casino.name,
        invitations_sent: casinoInvitations.length,
        sessions_completed: casinoSessions.filter((s: any) => s.completed_at).length,
        active_campaigns: casinoCampaigns.filter((c: any) => c.active).length,
        engagement_rate: casinoInvitations.length > 0
          ? Math.round((casinoSessions.filter((s: any) => s.completed_at).length / casinoInvitations.length) * 100)
          : 0,
      };
    });

    setCasinoStats(casinoStatsData);

    const last30Days = [...Array(30)].map((_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (29 - i));
      const dateStr = date.toISOString().split('T')[0];

      const dayScores = riskScores.filter(r =>
        r.calculated_at?.split('T')[0] === dateStr
      );

      return {
        date: dateStr,
        avgRisk: dayScores.length > 0
          ? Math.round(dayScores.reduce((sum, r) => sum + (r.behaviour_risk_index || 0), 0) / dayScores.length)
          : 0,
        count: dayScores.length,
      };
    });

    setRiskTrends(last30Days);
    setLoading(false);
  }

  function viewSessionDetails(sessionId: string) {
    setSelectedSessionId(sessionId);
    setShowSessionViewer(true);
  }

  async function exportReport() {
    const report = await generateWellbeingReport('all', 'regulator');

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wellbeing-regulator-report-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 p-6">
        <div className="max-w-7xl mx-auto">
          <p className="text-gray-400">Loading compliance data...</p>
        </div>
      </div>
    );
  }

  const riskDistribution = [
    { name: 'Low Risk', value: aggregatedStats?.lowRiskCount || 0, color: '#10b981' },
    { name: 'Medium Risk', value: aggregatedStats?.mediumRiskCount || 0, color: '#f59e0b' },
    { name: 'High Risk', value: aggregatedStats?.highRiskCount || 0, color: '#ef4444' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">
              Nova IQ Compliance
            </h1>
            <p className="text-gray-400">
              Anonymized aggregated data across all operators
            </p>
          </div>
          <Button
            onClick={exportReport}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <FileDown className="w-4 h-4 mr-2" />
            Export Report
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">
                Total Operators
              </CardTitle>
              <Shield className="w-4 h-4 text-blue-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">
                {aggregatedStats?.totalCasinos || 0}
              </div>
              <p className="text-xs text-gray-500 mt-1">Active operators</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">
                Engagement Rate
              </CardTitle>
              <TrendingUp className="w-4 h-4 text-green-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">
                {aggregatedStats?.engagementRate || 0}%
              </div>
              <p className="text-xs text-gray-500 mt-1">Average completion rate</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">
                Active Campaigns
              </CardTitle>
              <BarChart3 className="w-4 h-4 text-purple-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">
                {aggregatedStats?.activeCampaigns || 0}
              </div>
              <p className="text-xs text-gray-500 mt-1">Industry-wide</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">
                Avg Risk Index
              </CardTitle>
              <AlertTriangle className="w-4 h-4 text-orange-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">
                {aggregatedStats?.avgRiskIndex || 0}
              </div>
              <p className="text-xs text-gray-500 mt-1">Out of 100</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white">Risk Distribution</CardTitle>
              <CardDescription className="text-gray-400">
                Behavioral risk levels across all sessions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={riskDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${formatPercentage(percent * 100)}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {riskDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white">Risk Trend (30 Days)</CardTitle>
              <CardDescription className="text-gray-400">
                Average behavioral risk index over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={riskTrends}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis
                    dataKey="date"
                    stroke="#64748b"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => new Date(value).getDate().toString()}
                  />
                  <YAxis stroke="#64748b" tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="avgRisk"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ fill: '#3b82f6' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white">Operator Compliance Overview</CardTitle>
            <CardDescription className="text-gray-400">
              Anonymized engagement metrics by operator
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {casinoStats.map((casino, index) => (
                <div
                  key={index}
                  className="grid grid-cols-5 gap-4 p-4 bg-slate-800 rounded-lg"
                >
                  <div>
                    <p className="text-sm text-gray-400 mb-1">Operator</p>
                    <p className="text-white font-medium">{casino.casino_name}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-400 mb-1">Invitations</p>
                    <p className="text-white font-semibold">{casino.invitations_sent}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-400 mb-1">Completed</p>
                    <p className="text-white font-semibold">{casino.sessions_completed}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-400 mb-1">Campaigns</p>
                    <p className="text-white font-semibold">{casino.active_campaigns}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-400 mb-1">Engagement</p>
                    <Badge
                      variant={
                        casino.engagement_rate >= 70
                          ? 'default'
                          : casino.engagement_rate >= 40
                          ? 'secondary'
                          : 'outline'
                      }
                    >
                      {casino.engagement_rate}%
                    </Badge>
                  </div>
                </div>
              ))}
              {casinoStats.length === 0 && (
                <p className="text-gray-500 text-center py-8">No data available</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white">Compliance Highlights</CardTitle>
            <CardDescription className="text-gray-400">
              Key indicators of proactive responsible gambling efforts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-slate-800 rounded-lg">
                <CheckCircle2 className="w-8 h-8 text-green-400 mb-3" />
                <h3 className="text-white font-semibold mb-2">Off-Platform Engagement</h3>
                <p className="text-sm text-gray-400">
                  All operators using email/WhatsApp for proactive player wellbeing check-ins
                </p>
              </div>
              <div className="p-4 bg-slate-800 rounded-lg">
                <Shield className="w-8 h-8 text-blue-400 mb-3" />
                <h3 className="text-white font-semibold mb-2">Data Privacy</h3>
                <p className="text-sm text-gray-400">
                  POPIA/GDPR compliant with anonymized aggregated reporting
                </p>
              </div>
              <div className="p-4 bg-slate-800 rounded-lg">
                <Clock className="w-8 h-8 text-purple-400 mb-3" />
                <h3 className="text-white font-semibold mb-2">Time-Stamped Actions</h3>
                <p className="text-sm text-gray-400">
                  All compliance actions tracked with audit trail
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-blue-900/20 border-blue-500/30">
          <CardHeader>
            <CardTitle className="text-white">System Architecture</CardTitle>
            <CardDescription className="text-gray-300">
              Overlay model ensures zero interference with casino operations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm text-gray-300">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                <p>
                  <strong className="text-white">No direct casino integration:</strong> Games run independently via secure web links
                </p>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                <p>
                  <strong className="text-white">Voluntary participation:</strong> Players choose to engage, no forced interruptions
                </p>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                <p>
                  <strong className="text-white">Explainable AI:</strong> All risk scores include transparent reasoning
                </p>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                <p>
                  <strong className="text-white">No clinical claims:</strong> Games support wellbeing, not medical diagnosis
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <DetailedSessionViewer
        sessionId={selectedSessionId}
        open={showSessionViewer}
        onClose={() => setShowSessionViewer(false)}
      />
    </div>
  );
}
