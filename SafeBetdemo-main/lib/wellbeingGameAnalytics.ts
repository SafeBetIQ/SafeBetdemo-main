import { supabase } from './supabase';

export interface DecisionData {
  scenario_id: number;
  scenario_situation: string;
  scenario_category: string;
  card_selected: string;
  risk_type: 'safe' | 'risky' | 'very-risky';
  points: number;
  decision_time_ms: number;
  hover_durations?: Record<number, number>;
  comparison_count?: number;
}

export interface GameSession {
  id: string;
  player_id: string;
  casino_id: string;
  behaviour_risk_index: number;
  hesitation_score: number;
  consistency_score: number;
  completed_at: string;
  telemetry: any[];
}

export interface Insight {
  type: 'pattern' | 'trigger' | 'recommendation' | 'comparison';
  category: string;
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'concern';
  evidence?: any[];
  recommendation?: string;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
}

export class WellbeingGameAnalytics {
  static calculateRiskIndex(decisions: DecisionData[]): number {
    const safeChoices = decisions.filter(d => d.risk_type === 'safe').length;
    const riskyChoices = decisions.filter(d => d.risk_type === 'risky').length;
    const veryRiskyChoices = decisions.filter(d => d.risk_type === 'very-risky').length;

    return Math.max(0, Math.min(100,
      50 - (safeChoices * 8) + (riskyChoices * 3) + (veryRiskyChoices * 10)
    ));
  }

  static calculateHesitationScore(decisions: DecisionData[], hesitationEvents: number): number {
    const avgDecisionTime = decisions.reduce((sum, d) => sum + d.decision_time_ms, 0) / decisions.length;
    const longDecisions = decisions.filter(d => d.decision_time_ms > 15000).length;

    return Math.min(100, Math.floor(
      (hesitationEvents * 15) +
      (longDecisions * 10) +
      (avgDecisionTime > 10000 ? 20 : 0)
    ));
  }

  static calculateConsistencyScore(decisions: DecisionData[]): number {
    const riskTypes = decisions.map(d => d.risk_type);

    const transitions = riskTypes.slice(0, -1).filter((type, i) => {
      const nextType = riskTypes[i + 1];
      return (
        (type === 'safe' && nextType === 'very-risky') ||
        (type === 'very-risky' && nextType === 'safe')
      );
    }).length;

    return Math.max(0, 100 - (transitions * 15));
  }

  static detectRiskEscalation(decisions: DecisionData[]): boolean {
    const riskScores = decisions.map(d => {
      switch (d.risk_type) {
        case 'safe': return 0;
        case 'risky': return 1;
        case 'very-risky': return 2;
      }
    });

    let escalationCount = 0;
    for (let i = 1; i < riskScores.length; i++) {
      if (riskScores[i] > riskScores[i - 1]) {
        escalationCount++;
      }
    }

    return escalationCount >= 3;
  }

  static generateInsights(decisions: DecisionData[]): Insight[] {
    const insights: Insight[] = [];

    const safeChoices = decisions.filter(d => d.risk_type === 'safe').length;
    const riskyChoices = decisions.filter(d => d.risk_type === 'risky').length;
    const veryRiskyChoices = decisions.filter(d => d.risk_type === 'very-risky').length;

    const categoryCounts: Record<string, { safe: number; risky: number; veryRisky: number }> = {};
    decisions.forEach(d => {
      if (!categoryCounts[d.scenario_category]) {
        categoryCounts[d.scenario_category] = { safe: 0, risky: 0, veryRisky: 0 };
      }
      if (d.risk_type === 'safe') categoryCounts[d.scenario_category].safe++;
      if (d.risk_type === 'risky') categoryCounts[d.scenario_category].risky++;
      if (d.risk_type === 'very-risky') categoryCounts[d.scenario_category].veryRisky++;
    });

    if (categoryCounts.loss_chasing?.veryRisky >= 1) {
      insights.push({
        type: 'pattern',
        category: 'loss_chasing',
        title: 'Loss Chasing Tendency',
        description: 'You showed a tendency to chase losses with risky bets. This is one of the most dangerous patterns in gambling and often leads to bigger losses.',
        severity: 'concern',
        recommendation: 'Set strict loss limits before you start playing and stick to them no matter what.',
      });
    }

    if (categoryCounts.winning_streak?.safe >= 2) {
      insights.push({
        type: 'pattern',
        category: 'winning_streak',
        title: 'Excellent Win Management',
        description: 'You showed great discipline during winning streaks. This is when most players lose control, but you made safe choices.',
        severity: 'info',
        recommendation: 'Keep this mindset when playing for real. Consider setting a "win target" and stopping when you reach it.',
      });
    }

    if (categoryCounts.budget_violation?.veryRisky >= 1) {
      insights.push({
        type: 'trigger',
        category: 'budget_violation',
        title: 'Budget Limit Concerns',
        description: 'You chose to exceed your budget in a scenario. This is a red flag that could lead to overspending.',
        severity: 'warning',
        recommendation: 'Use your casino\'s deposit limit features to enforce boundaries automatically.',
      });
    }

    if (categoryCounts.emotional_play?.risky >= 1 || categoryCounts.emotional_play?.veryRisky >= 1) {
      insights.push({
        type: 'trigger',
        category: 'emotional_play',
        title: 'Emotional Decision Making',
        description: 'You made risky choices in emotional scenarios. Playing while stressed, upset, or trying to cope with emotions is risky.',
        severity: 'warning',
        recommendation: 'Consider taking a break from gambling when you\'re feeling emotional or stressed.',
      });
    }

    const avgDecisionTime = decisions.reduce((sum, d) => sum + d.decision_time_ms, 0) / decisions.length;
    if (avgDecisionTime < 3000 && veryRiskyChoices > 2) {
      insights.push({
        type: 'trigger',
        category: 'impulsivity',
        title: 'Quick Risky Decisions',
        description: 'You made several risky choices very quickly. Impulsive decisions often lead to regret.',
        severity: 'warning',
        recommendation: 'Try the "10-second rule": Wait 10 seconds before making any bet, especially large ones.',
      });
    }

    if (safeChoices >= 6) {
      insights.push({
        type: 'recommendation',
        category: 'positive_reinforcement',
        title: 'Strong Self-Control',
        description: 'You demonstrated excellent self-control throughout the scenarios. This awareness is your best protection.',
        severity: 'info',
        recommendation: 'Keep this awareness when playing for real. Share your strategies with friends who gamble.',
      });
    }

    if (veryRiskyChoices >= 5) {
      insights.push({
        type: 'recommendation',
        category: 'risk_awareness',
        title: 'Consider Stricter Safeguards',
        description: 'Your choices suggest you might benefit from additional safeguards when gambling.',
        severity: 'concern',
        recommendation: 'Consider self-exclusion or reduced deposit limits. Contact support if you need help.',
      });
    }

    if (this.detectRiskEscalation(decisions)) {
      insights.push({
        type: 'pattern',
        category: 'risk_escalation',
        title: 'Risk Escalation Pattern',
        description: 'Your risk level increased throughout the game. This pattern of escalating bets is very dangerous.',
        severity: 'concern',
        recommendation: 'Set bet limits before starting and use your casino\'s tools to enforce them automatically.',
      });
    }

    return insights;
  }

  static checkBadges(
    decisions: DecisionData[],
    currentSession: Partial<GameSession>,
    previousSessions: GameSession[] = []
  ): Badge[] {
    const badges: Badge[] = [];
    const totalSessions = previousSessions.length + 1;

    const safeChoices = decisions.filter(d => d.risk_type === 'safe').length;
    const veryRiskyChoices = decisions.filter(d => d.risk_type === 'very-risky').length;
    const balanceScore = 100 - (currentSession.behaviour_risk_index || 50);

    if (totalSessions === 1) {
      badges.push({
        id: 'self_aware',
        name: 'Self-Aware Player',
        description: 'Completed your first wellbeing assessment',
        icon: 'Brain',
        tier: 'bronze',
      });
    }

    if (safeChoices >= 6) {
      badges.push({
        id: 'balanced_start',
        name: 'Balanced Beginning',
        description: 'Made 6 or more safe choices in a session',
        icon: 'Shield',
        tier: 'bronze',
      });
    }

    if (veryRiskyChoices === 0) {
      badges.push({
        id: 'risk_manager',
        name: 'Risk Manager',
        description: 'Avoided all high-risk choices in a session',
        icon: 'Target',
        tier: 'silver',
      });
    }

    if (totalSessions >= 3) {
      badges.push({
        id: 'improvement_seeker',
        name: 'Improvement Seeker',
        description: 'Completed 3 wellbeing assessments',
        icon: 'TrendingUp',
        tier: 'silver',
      });

      const recentSessions = [
        ...previousSessions.slice(-2),
        currentSession as GameSession,
      ];
      const allBalanced = recentSessions.every(s => (100 - s.behaviour_risk_index) >= 70);

      if (allBalanced) {
        badges.push({
          id: 'consistent_control',
          name: 'Consistent Control',
          description: 'Maintained 70+ balance score across 3 sessions',
          icon: 'CheckCircle',
          tier: 'gold',
        });
      }
    }

    if (totalSessions >= 10) {
      const avgBalance =
        [...previousSessions, currentSession as GameSession].reduce(
          (sum, s) => sum + (100 - s.behaviour_risk_index),
          0
        ) / totalSessions;

      if (avgBalance >= 80) {
        badges.push({
          id: 'wellbeing_champion',
          name: 'Wellbeing Champion',
          description: '10 sessions with average 80+ balance score',
          icon: 'Trophy',
          tier: 'platinum',
        });
      }
    }

    return badges;
  }

  static async getPlayerHistory(playerId: string, casinoId: string): Promise<GameSession[]> {
    const { data, error } = await supabase
      .from('wellbeing_game_sessions')
      .select('*')
      .eq('player_id', playerId)
      .eq('casino_id', casinoId)
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Error fetching player history:', error);
      return [];
    }

    return data || [];
  }

  static compareToHistory(
    currentSession: Partial<GameSession>,
    previousSessions: GameSession[]
  ): {
    improvement: number;
    trend: 'improving' | 'declining' | 'stable';
    message: string;
  } {
    if (previousSessions.length === 0) {
      return {
        improvement: 0,
        trend: 'stable',
        message: 'This is your first session. Great job taking this step!',
      };
    }

    const currentBalance = 100 - (currentSession.behaviour_risk_index || 50);
    const previousBalance = previousSessions.map(s => 100 - s.behaviour_risk_index);
    const avgPreviousBalance = previousBalance.reduce((a, b) => a + b, 0) / previousBalance.length;

    const improvement = currentBalance - avgPreviousBalance;

    let trend: 'improving' | 'declining' | 'stable';
    if (improvement > 10) trend = 'improving';
    else if (improvement < -10) trend = 'declining';
    else trend = 'stable';

    let message: string;
    if (trend === 'improving') {
      message = `Excellent progress! Your balance score improved by ${Math.round(improvement)} points since your last sessions.`;
    } else if (trend === 'declining') {
      message = `Your balance score decreased by ${Math.round(Math.abs(improvement))} points. Consider reviewing the insights and resources provided.`;
    } else {
      message = `Your balance score is consistent with your previous sessions (${Math.round(avgPreviousBalance)}/100).`;
    }

    return { improvement, trend, message };
  }

  static async getRelevantResources(
    insights: Insight[]
  ): Promise<any[]> {
    if (insights.length === 0) return [];

    const categories = Array.from(new Set(insights.map(i => i.category)));
    const severityLevels = Array.from(new Set(insights.map(i => i.severity)));

    const { data, error } = await supabase
      .from('wellbeing_educational_resources')
      .select('*')
      .eq('active', true)
      .overlaps('risk_patterns', categories)
      .overlaps('severity_level', severityLevels)
      .limit(5);

    if (error) {
      console.error('Error fetching resources:', error);
      return [];
    }

    return data || [];
  }
}

export async function generateWellbeingReport(
  casinoId: string | 'all',
  userType: 'casino' | 'regulator' | 'super_admin'
) {
  const isAllCasinos = casinoId === 'all';

  let sessionsQuery = supabase
    .from('wellbeing_game_sessions')
    .select(`
      *,
      player:players(first_name, last_name),
      game_concept:wellbeing_game_concepts(name),
      casino:casinos(name)
    `)
    .not('completed_at', 'is', null);

  if (!isAllCasinos) {
    sessionsQuery = sessionsQuery.eq('casino_id', casinoId);
  }

  const { data: sessions } = await sessionsQuery;

  let insightsQuery = supabase
    .from('wellbeing_game_insights')
    .select('*');

  if (!isAllCasinos) {
    insightsQuery = insightsQuery.eq('casino_id', casinoId);
  }

  const { data: insights } = await insightsQuery;

  const report = {
    generated_at: new Date().toISOString(),
    generated_by: userType,
    casino_id: casinoId,
    summary: {
      total_sessions: sessions?.length || 0,
      total_insights: insights?.length || 0,
      avg_risk_index:
        sessions && sessions.length > 0
          ? Math.round(
              sessions.reduce((sum, s) => sum + (s.behaviour_risk_index || 0), 0) /
                sessions.length
            )
          : 0,
    },
    sessions: sessions?.map((s) => ({
      id: s.id,
      player_name: userType !== 'casino' ? 'Anonymous' : `${s.player?.first_name} ${s.player?.last_name}`,
      casino_name: s.casino?.name,
      game_concept: s.game_concept?.name,
      risk_index: s.behaviour_risk_index,
      hesitation_score: s.hesitation_score,
      consistency_score: s.consistency_score,
      started_at: s.started_at,
      completed_at: s.completed_at,
    })),
    insights: insights?.map((i) => ({
      title: i.title,
      description: i.description,
      severity: i.severity,
      category: i.insight_category,
      created_at: i.created_at,
    })),
  };

  return report;
}
