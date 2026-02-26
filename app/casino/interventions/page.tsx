'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { InterventionModal } from '@/components/InterventionModal';
import { InterventionHistoryTable } from '@/components/InterventionHistoryTable';
import { ShieldAlert, AlertTriangle, Search, Send, Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface Player {
  id: string;
  player_id: string;
  first_name: string;
  last_name: string;
  risk_score?: number;
  last_active?: string;
  total_wagered?: number;
}

interface InterventionHistory {
  id: string;
  player_id: string;
  intervention_type: string;
  trigger_reason: string;
  risk_score_at_trigger: number;
  delivery_method: string;
  message_sent: string | null;
  player_response: string | null;
  intervention_successful: boolean;
  triggered_at: string;
  staff_member?: string;
}

export default function InterventionsPage() {
  const { user } = useAuth();
  const [players, setPlayers] = useState<Player[]>([]);
  const [interventions, setInterventions] = useState<InterventionHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [interventionModalOpen, setInterventionModalOpen] = useState(false);
  const [casinoName, setCasinoName] = useState<string>('SafeBet IQ');

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  async function loadData() {
    await Promise.all([loadPlayers(), loadInterventions(), loadCasinoName()]);
    setLoading(false);
  }

  async function loadCasinoName() {
    if (!user?.casino_id) return;

    try {
      const { data, error } = await supabase
        .from('casinos')
        .select('name')
        .eq('id', user.casino_id)
        .single();

      if (error) throw error;
      if (data?.name) {
        setCasinoName(data.name);
      }
    } catch (error) {
      console.error('Error loading casino name:', error);
    }
  }

  async function loadPlayers() {
    try {
      let playerQuery = supabase
        .from('players')
        .select('id, player_id, first_name, last_name, risk_score, last_active, total_wagered')
        .order('risk_score', { ascending: false })
        .limit(100);

      // Filter by casino if casino admin
      if (user?.role === 'casino_admin' && user?.casino_id) {
        playerQuery = playerQuery.eq('casino_id', user.casino_id);
      }

      const { data, error } = await playerQuery;

      if (error) throw error;

      setPlayers(data || []);
    } catch (error) {
      console.error('Error loading players:', error);
      toast.error('Failed to load players');
    }
  }

  async function loadInterventions() {
    try {
      let query = supabase
        .from('intervention_history')
        .select('*')
        .order('triggered_at', { ascending: false })
        .limit(100);

      // Filter by casino if casino admin
      if (user?.role === 'casino_admin' && user?.casino_id) {
        query = query.eq('casino_id', user.casino_id);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Transform data to add staff_member as 'System' for now
      const transformedData = (data || []).map(item => ({
        ...item,
        staff_member: 'System'
      }));

      setInterventions(transformedData);
    } catch (error) {
      console.error('Error loading interventions:', error);
      toast.error('Failed to load intervention history');
    }
  }

  async function handleSendIntervention(data: {
    interventionType: string;
    deliveryMethod: string;
    message: string;
    customMessage?: string;
  }) {
    if (!selectedPlayer || !user?.casino_id) return;

    try {
      const interventionData = {
        player_id: selectedPlayer.id,
        casino_id: user.casino_id,
        intervention_type: data.interventionType,
        trigger_reason: `Manual intervention - Risk Score: ${selectedPlayer.risk_score || 'N/A'}`,
        risk_score_at_trigger: selectedPlayer.risk_score || 0,
        delivery_method: data.deliveryMethod,
        message_sent: data.message,
        triggered_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('intervention_history')
        .insert(interventionData);

      if (error) throw error;

      toast.success('Intervention sent successfully');
      await loadInterventions();
      setSelectedPlayer(null);
    } catch (error) {
      console.error('Error sending intervention:', error);
      toast.error('Failed to send intervention');
    }
  }

  function getDefaultMessage(type: string): string {
    const messages: Record<string, string> = {
      break_suggestion: 'We care about your wellbeing. Consider taking a short break.',
      session_limit: 'We recommend setting session limits for responsible gambling.',
      cooling_off: 'Take a cooling-off period to ensure responsible play.',
      self_exclusion: 'Consider self-exclusion options for your protection.',
      contact_support: 'Our support team is here to help. Please reach out.',
      educational_content: 'Learn more about responsible gambling practices.',
    };
    return messages[type] || 'Stay safe and gamble responsibly.';
  }

  const filteredPlayers = players.filter((player) =>
    `${player.first_name} ${player.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    player.player_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const highRiskPlayers = filteredPlayers.filter(p => (p.risk_score || 0) >= 70);
  const mediumRiskPlayers = filteredPlayers.filter(p => (p.risk_score || 0) >= 40 && (p.risk_score || 0) < 70);

  const transformedInterventions = interventions.map(intervention => {
    let status: 'completed' | 'pending' | 'failed' | 'acknowledged' = 'pending';
    if (intervention.player_response === 'accepted') status = 'completed';
    else if (intervention.player_response === 'declined') status = 'failed';
    else if (intervention.player_response === 'ignored') status = 'pending';
    else if (intervention.player_response) status = 'acknowledged';

    return {
      id: intervention.id,
      playerId: intervention.player_id,
      timestamp: intervention.triggered_at,
      type: (intervention.delivery_method || 'in_app') as 'email' | 'sms' | 'whatsapp' | 'phone' | 'in_person',
      reason: intervention.trigger_reason,
      riskScore: intervention.risk_score_at_trigger,
      status,
      outcome: intervention.intervention_successful ? 'Successful' : 'Pending',
      staffMember: intervention.staff_member || 'System',
    };
  });

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
            <p className="mt-4 text-sm text-muted-foreground">Loading...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <TooltipProvider>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center">
                <ShieldAlert className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Player Interventions</h1>
                <p className="text-muted-foreground">
                  Send responsible gambling interventions to players
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="relative">
            <div className="absolute top-3 right-3 z-10">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help hover:text-foreground transition-colors" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>Players with risk scores of 70 or higher, indicating significant gambling harm patterns requiring immediate intervention.</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <CardHeader className="pb-3">
              <CardDescription>High Risk Players</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">{highRiskPlayers.length}</div>
              <p className="text-sm text-muted-foreground mt-1">Risk Score 70+</p>
            </CardContent>
          </Card>

          <Card className="relative">
            <div className="absolute top-3 right-3 z-10">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help hover:text-foreground transition-colors" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>Players with risk scores between 40-69, showing moderate risk patterns that should be monitored closely and may need preventive interventions.</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <CardHeader className="pb-3">
              <CardDescription>Medium Risk Players</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-600">{mediumRiskPlayers.length}</div>
              <p className="text-sm text-muted-foreground mt-1">Risk Score 40-69</p>
            </CardContent>
          </Card>

          <Card className="relative">
            <div className="absolute top-3 right-3 z-10">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help hover:text-foreground transition-colors" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>Total number of responsible gambling interventions sent to players across all delivery methods throughout the platform's history.</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <CardHeader className="pb-3">
              <CardDescription>Total Interventions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-700">{interventions.length}</div>
              <p className="text-sm text-muted-foreground mt-1">All time</p>
            </CardContent>
          </Card>

          <Card className="relative">
            <div className="absolute top-3 right-3 z-10">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help hover:text-foreground transition-colors" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>Percentage of interventions that successfully led to positive behavioral changes, such as reduced risk scores or player engagement with support resources.</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <CardHeader className="pb-3">
              <CardDescription>Success Rate</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">
                {interventions.length > 0
                  ? Math.round((interventions.filter(i => i.intervention_successful).length / interventions.length) * 100)
                  : 0}%
              </div>
              <p className="text-sm text-muted-foreground mt-1">Successful outcomes</p>
            </CardContent>
          </Card>
        </div>

        {/* Players Needing Intervention */}
        <Card className="relative">
          <div className="absolute top-4 right-4 z-10">
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 text-muted-foreground cursor-help hover:text-foreground transition-colors" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>List of players sorted by risk score who may need responsible gambling interventions. You can send personalized messages via multiple channels to help protect player wellbeing.</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-primary" />
                  Players Needing Intervention
                </CardTitle>
                <CardDescription>Send responsible gambling interventions to at-risk players</CardDescription>
              </div>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search players..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Player</TableHead>
                    <TableHead>Risk Score</TableHead>
                    <TableHead>Last Session</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPlayers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        No players found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredPlayers.map((player) => (
                      <TableRow key={player.id}>
                        <TableCell>
                          <div className="font-medium">{player.first_name} {player.last_name}</div>
                          <div className="font-mono text-xs text-muted-foreground">{player.player_id}</div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={`${
                              (player.risk_score || 0) >= 80 ? 'bg-red-100 text-red-700' :
                              (player.risk_score || 0) >= 70 ? 'bg-orange-100 text-orange-700' :
                              (player.risk_score || 0) >= 40 ? 'bg-yellow-100 text-yellow-700' :
                              'bg-primary/10 text-primary'
                            } border-0`}
                          >
                            {player.risk_score || 'N/A'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {player.last_active
                            ? new Date(player.last_active).toLocaleDateString()
                            : 'N/A'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            onClick={() => {
                              setSelectedPlayer(player);
                              setInterventionModalOpen(true);
                            }}
                            className="bg-primary hover:bg-primary/90"
                          >
                            <Send className="h-4 w-4 mr-2" />
                            Send Intervention
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Intervention History */}
        <InterventionHistoryTable
          interventions={transformedInterventions}
          onExport={() => {
            toast.info('Export functionality coming soon');
          }}
        />

        {/* Intervention Modal */}
        {selectedPlayer && (
          <InterventionModal
            open={interventionModalOpen}
            onOpenChange={setInterventionModalOpen}
            playerName={`${selectedPlayer.first_name} ${selectedPlayer.last_name}`}
            casinoName={casinoName}
            riskScore={selectedPlayer.risk_score || 0}
            triggerReason={`Risk Score: ${selectedPlayer.risk_score || 'N/A'}`}
            onSubmit={handleSendIntervention}
          />
        )}
      </div>
      </TooltipProvider>
    </DashboardLayout>
  );
}
