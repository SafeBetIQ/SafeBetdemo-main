'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { DashboardLayout } from '@/components/DashboardLayout';
import { PageHeader } from '@/components/saas/PageHeader';
import { KPICard } from '@/components/saas/KPICard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Users, Search, AlertTriangle, TrendingUp, Download, Eye, Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import Link from 'next/link';
import { exportBehavioralRiskData, type PlayerBehavioralRiskData } from '@/lib/exportUtils';

interface Player {
  id: string;
  player_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  risk_score: number;
  total_wagered: number;
  total_won: number;
  session_count: number;
  avg_session_duration: number;
  last_active: string;
  status: string;
  signup_date: string;
  player_sessions?: any[];
}

export default function PlayersPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [players, setPlayers] = useState<Player[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [riskFilter, setRiskFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    if (user) {
      loadPlayers();
    }
  }, [user]);

  async function loadPlayers() {
    try {
      setLoading(true);
      const casinoId = user?.casino_id;
      if (!casinoId) return;

      const { data, error } = await supabase
        .from('players')
        .select('*')
        .eq('casino_id', casinoId)
        .order('risk_score', { ascending: false });

      if (error) throw error;

      setPlayers(data || []);
    } catch (error: any) {
      setPlayers([]);
    } finally {
      setLoading(false);
    }
  }

  const getRiskBadge = (score: number) => {
    if (score >= 80) return { label: 'Critical', className: 'bg-red-100 text-red-800 hover:bg-red-100' };
    if (score >= 60) return { label: 'High', className: 'bg-orange-100 text-orange-800 hover:bg-orange-100' };
    if (score >= 40) return { label: 'Medium', className: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100' };
    return { label: 'Low', className: 'bg-green-100 text-green-800 hover:bg-green-100' };
  };

  const filteredPlayers = players.filter((player) => {
    const matchesSearch =
      player.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      player.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      player.email.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesRisk =
      riskFilter === 'all' ||
      (riskFilter === 'critical' && player.risk_score >= 80) ||
      (riskFilter === 'high' && player.risk_score >= 60 && player.risk_score < 80) ||
      (riskFilter === 'medium' && player.risk_score >= 40 && player.risk_score < 60) ||
      (riskFilter === 'low' && player.risk_score < 40);

    const matchesStatus = statusFilter === 'all' || player.status === statusFilter;

    return matchesSearch && matchesRisk && matchesStatus;
  });

  const stats = {
    total: players.length,
    active: players.filter((p) => p.status === 'active').length,
    highRisk: players.filter((p) => p.risk_score >= 60).length,
    criticalRisk: players.filter((p) => p.risk_score >= 80).length,
    avgRiskScore: players.length > 0
      ? Math.round(players.reduce((sum, p) => sum + p.risk_score, 0) / players.length)
      : 0,
  };

  const handleExport = () => {
    const exportData: PlayerBehavioralRiskData[] = filteredPlayers.map((player) => ({
      playerId: player.id,
      playerName: `${player.first_name} ${player.last_name}`,
      game: 'Various',
      betAmount: 0,
      totalWagered: player.total_wagered || 0,
      sessionDuration: player.avg_session_duration || 0,
      riskScore: player.risk_score,
      riskLevel: getRiskBadge(player.risk_score).label,
      impulseLevel: 0,
      fatigueIndex: 0,
      trend: 'stable',
      isActive: player.status === 'active',
      lastBetTime: new Date(player.last_active),
    }));

    exportBehavioralRiskData(exportData, user?.casino_id || 'Casino');
  };

  return (
    <DashboardLayout>
      <TooltipProvider>
      <div className="flex h-full flex-col">
        <PageHeader
          title="Players"
          subtitle="View and manage all casino players"
          actions={
            <Button onClick={handleExport} variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Export Players
            </Button>
          }
        />

        <div className="flex-1 overflow-auto p-6">
          <div className="space-y-6">
            {/* Statistics Cards */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <KPICard
                title="Total Players"
                value={stats.total}
                icon={Users}
                tooltip="Total number of registered players in your casino, including active, suspended, and self-excluded accounts."
              />
              <KPICard
                title="Active Players"
                value={stats.active}
                change={{
                  value: stats.total > 0 ? ((stats.active / stats.total) * 100) : 0,
                  type: 'neutral',
                  label: 'of total'
                }}
                icon={TrendingUp}
                tooltip="Number of players currently active on the platform with no restrictions or exclusions applied to their accounts."
              />
              <KPICard
                title="High Risk Players"
                value={stats.highRisk}
                change={{
                  value: stats.total > 0 ? ((stats.highRisk / stats.total) * 100) : 0,
                  type: stats.highRisk > 5 ? 'increase' : 'neutral',
                  label: 'of total'
                }}
                icon={AlertTriangle}
                tooltip="Players with risk scores of 60 or higher, indicating elevated gambling harm patterns that require monitoring and potential intervention."
              />
              <KPICard
                title="Average Risk Score"
                value={stats.avgRiskScore}
                icon={Eye}
                tooltip="Mean risk score across all players, calculated using AI analysis of betting patterns, session behaviors, and other risk indicators."
              />
            </div>

            {/* Players Table */}
            <Card className="relative">
              <div className="absolute top-4 right-4 z-10">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help hover:text-foreground transition-colors" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>Comprehensive list of all casino players with real-time risk scoring, activity monitoring, and filtering options. Use this to identify players who may need support or interventions.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <CardHeader>
                <CardTitle>All Players</CardTitle>
                <CardDescription>
                  View detailed information about all registered players
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Filters */}
                <div className="mb-6 flex flex-col gap-4 sm:flex-row">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search players by name or email..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Select value={riskFilter} onValueChange={setRiskFilter}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                      <SelectValue placeholder="Filter by risk" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Risk Levels</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                      <SelectItem value="excluded">Self-Excluded</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Table */}
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="text-center">
                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
                      <p className="mt-4 text-sm text-muted-foreground">Loading players...</p>
                    </div>
                  </div>
                ) : filteredPlayers.length === 0 ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="text-center">
                      <Users className="mx-auto h-12 w-12 text-muted-foreground" />
                      <h3 className="mt-4 text-lg font-semibold">No players found</h3>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {searchTerm || riskFilter !== 'all' || statusFilter !== 'all'
                          ? 'Try adjusting your filters'
                          : 'No players registered yet'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Player</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Risk Score</TableHead>
                          <TableHead className="text-right">Total Wagered</TableHead>
                          <TableHead className="text-right">Sessions</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Last Active</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredPlayers.map((player) => {
                          const riskBadge = getRiskBadge(player.risk_score);
                          return (
                            <TableRow key={player.id}>
                              <TableCell>
                                <div className="font-medium">{player.first_name} {player.last_name}</div>
                                <div className="font-mono text-xs text-muted-foreground">{player.player_id}</div>
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {player.email}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold">{player.risk_score}</span>
                                  <Badge className={riskBadge.className}>
                                    {riskBadge.label}
                                  </Badge>
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                R{(player.total_wagered || 0).toLocaleString()}
                              </TableCell>
                              <TableCell className="text-right">
                                {player.session_count || 0}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={
                                    player.status === 'active'
                                      ? 'default'
                                      : player.status === 'suspended'
                                      ? 'secondary'
                                      : 'destructive'
                                  }
                                >
                                  {player.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {player.last_active
                                  ? new Date(player.last_active).toLocaleDateString()
                                  : 'Never'}
                              </TableCell>
                              <TableCell>
                                <Link href={`/behavioral-risk-intelligence?player=${player.id}`}>
                                  <Button variant="ghost" size="sm">
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </Link>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {/* Results Summary */}
                {!loading && filteredPlayers.length > 0 && (
                  <div className="mt-4 text-sm text-muted-foreground">
                    Showing {filteredPlayers.length} of {players.length} players
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      </TooltipProvider>
    </DashboardLayout>
  );
}
