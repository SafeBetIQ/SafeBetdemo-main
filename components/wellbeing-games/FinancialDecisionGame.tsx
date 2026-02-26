'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  Clock,
  Target
} from 'lucide-react';

interface FinancialDecisionGameProps {
  invitation?: any;
  demoMode?: boolean;
  onGameComplete?: (data: GameCompletionData) => void;
}

interface GameCompletionData {
  duration_seconds: number;
  completion_rate: number;
  behaviour_risk_index: number;
  telemetry: TelemetryEvent[];
}

interface TelemetryEvent {
  event_type: string;
  event_timestamp: string;
  event_sequence: number;
  event_data: Record<string, any>;
  decision_speed_ms?: number;
  risk_level_chosen?: 'low' | 'medium' | 'high' | 'none';
}

interface Scenario {
  id: number;
  type: 'lending' | 'investment' | 'spending' | 'fraud';
  title: string;
  description: string;
  context: string;
  options: {
    label: string;
    risk: 'low' | 'medium' | 'high';
    return: number;
    consequence: string;
  }[];
}

const scenarios: Scenario[] = [
  {
    id: 1,
    type: 'lending',
    title: 'Personal Loan Application',
    description: 'Customer requesting $15,000 personal loan',
    context: 'Credit score: 680 | Income: $45K/year | Debt ratio: 35%',
    options: [
      { label: 'Approve Full Amount', risk: 'high', return: 8, consequence: 'Higher default risk, maximum interest revenue' },
      { label: 'Approve $10,000', risk: 'medium', return: 5, consequence: 'Moderate risk, customer may seek elsewhere' },
      { label: 'Decline Application', risk: 'low', return: 0, consequence: 'Zero risk, lose customer relationship' },
    ]
  },
  {
    id: 2,
    type: 'investment',
    title: 'Investment Portfolio Rebalance',
    description: 'Market volatility detected, portfolio down 12%',
    context: 'Customer has $250K portfolio | Retirement in 10 years',
    options: [
      { label: 'Sell All Equities Now', risk: 'high', return: -12, consequence: 'Lock in losses, miss recovery' },
      { label: 'Hold Current Position', risk: 'medium', return: -5, consequence: 'May recover, or drop further' },
      { label: 'Buy More Equities', risk: 'high', return: 15, consequence: 'Average down, higher exposure' },
    ]
  },
  {
    id: 3,
    type: 'spending',
    title: 'Credit Card Limit Increase',
    description: 'Customer requests limit increase from $5K to $15K',
    context: 'Current usage: 85% | Payment history: Excellent | Recent purchases trending up',
    options: [
      { label: 'Approve $15K Limit', risk: 'high', return: 12, consequence: 'More revenue potential, higher exposure' },
      { label: 'Approve $8K Limit', risk: 'medium', return: 6, consequence: 'Balanced approach, customer may be unsatisfied' },
      { label: 'Decline Increase', risk: 'low', return: 2, consequence: 'Maintain safety, risk losing customer' },
    ]
  },
  {
    id: 4,
    type: 'fraud',
    title: 'Suspicious Transaction Alert',
    description: 'Large wire transfer to new international account',
    context: 'Amount: $45,000 | Customer normally transfers < $2,000 | New beneficiary in high-risk country',
    options: [
      { label: 'Block Transaction', risk: 'low', return: 0, consequence: 'Prevent potential fraud, may inconvenience customer' },
      { label: 'Request Verification', risk: 'medium', return: 3, consequence: 'Delayed transaction, customer friction' },
      { label: 'Allow Transaction', risk: 'high', return: -50, consequence: 'Fast service, massive loss if fraudulent' },
    ]
  },
  {
    id: 5,
    type: 'lending',
    title: 'Business Line of Credit',
    description: 'Small business requesting $100K revolving credit',
    context: 'Business age: 2 years | Revenue: $500K/year | Cashflow: Variable',
    options: [
      { label: 'Approve $100K Unsecured', risk: 'high', return: 18, consequence: 'High revenue, significant exposure' },
      { label: 'Approve $50K Secured', risk: 'medium', return: 10, consequence: 'Collateral protection, lower revenue' },
      { label: 'Refer to SBA Loan', risk: 'low', return: 4, consequence: 'Government backing, slower process' },
    ]
  },
  {
    id: 6,
    type: 'investment',
    title: 'High-Yield Bond Opportunity',
    description: 'Customer considering 9% corporate bond',
    context: 'Bond rating: BB | Issuer: Tech startup | Customer risk tolerance: Moderate',
    options: [
      { label: 'Recommend 50% Allocation', risk: 'high', return: 9, consequence: 'High yield, speculative grade' },
      { label: 'Recommend 10% Allocation', risk: 'medium', return: 5, consequence: 'Diversification, limited exposure' },
      { label: 'Recommend Government Bonds', risk: 'low', return: 2, consequence: 'Safe but low return' },
    ]
  },
  {
    id: 7,
    type: 'spending',
    title: 'Overdraft Protection Decision',
    description: 'Customer overdrawn by $300',
    context: 'Account history: 5 years | Previous overdrafts: 2 in past year | Current balance: -$300',
    options: [
      { label: 'Auto-Approve Overdraft', risk: 'high', return: 8, consequence: '$35 fee per occurrence, customer dependency risk' },
      { label: 'Approve with Warning', risk: 'medium', return: 5, consequence: 'Fee revenue, financial health concern' },
      { label: 'Decline & Block', risk: 'low', return: 0, consequence: 'Protect customer, may cause bounced payments' },
    ]
  },
  {
    id: 8,
    type: 'fraud',
    title: 'Multiple Failed Login Attempts',
    description: 'Account shows 8 failed logins from foreign IP',
    context: 'Customer abroad: Unknown | Account balance: $125K | No recent travel notifications',
    options: [
      { label: 'Lock Account Immediately', risk: 'low', return: 0, consequence: 'Prevent breach, customer lockout inconvenience' },
      { label: 'Send 2FA Challenge', risk: 'medium', return: 2, consequence: 'Security layer, delayed access' },
      { label: 'Monitor Only', risk: 'high', return: -80, consequence: 'No friction, potential account takeover' },
    ]
  },
];

export default function FinancialDecisionGame({
  invitation,
  demoMode = false,
  onGameComplete,
}: FinancialDecisionGameProps) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentScenarioIndex, setCurrentScenarioIndex] = useState(0);
  const [gameStatus, setGameStatus] = useState<'instructions' | 'playing' | 'completed'>('instructions');
  const [startTime, setStartTime] = useState<number>(0);
  const [decisionStartTime, setDecisionStartTime] = useState<number>(0);
  const [telemetry, setTelemetry] = useState<TelemetryEvent[]>([]);
  const [eventSequence, setEventSequence] = useState(0);
  const [totalReturn, setTotalReturn] = useState(0);
  const [riskChoices, setRiskChoices] = useState<{ low: number; medium: number; high: number }>({
    low: 0,
    medium: 0,
    high: 0,
  });
  const [decisionTimes, setDecisionTimes] = useState<number[]>([]);
  const [showFeedback, setShowFeedback] = useState(false);
  const [lastChoice, setLastChoice] = useState<any>(null);

  const currentScenario = scenarios[currentScenarioIndex];
  const progress = ((currentScenarioIndex) / scenarios.length) * 100;

  const recordTelemetry = useCallback((
    eventType: string,
    eventData: Record<string, any>,
    decisionSpeedMs?: number,
    riskLevel?: 'low' | 'medium' | 'high' | 'none'
  ) => {
    if (demoMode) return;

    const telemetryEvent: TelemetryEvent = {
      event_type: eventType,
      event_timestamp: new Date().toISOString(),
      event_sequence: eventSequence,
      event_data: eventData,
      decision_speed_ms: decisionSpeedMs,
      risk_level_chosen: riskLevel,
    };

    setTelemetry(prev => [...prev, telemetryEvent]);
    setEventSequence(prev => prev + 1);
  }, [demoMode, eventSequence]);

  const startGame = useCallback(async () => {
    if (!demoMode && invitation && !sessionId) {
      const { data } = await supabase
        .from('wellbeing_game_sessions')
        .insert({
          invitation_id: invitation.id,
          player_id: invitation.player_id,
          game_concept_id: invitation.game_concept_id,
          casino_id: invitation.casino_id,
          started_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (data) {
        setSessionId(data.id);
      }
    }

    const now = Date.now();
    setStartTime(now);
    setDecisionStartTime(now);
    setGameStatus('playing');

    recordTelemetry('game_started', {
      demo_mode: demoMode,
      total_scenarios: scenarios.length,
      device_type: /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
    });
  }, [demoMode, invitation, sessionId, recordTelemetry]);

  const handleChoice = useCallback((choice: any) => {
    const decisionTime = Date.now() - decisionStartTime;
    setDecisionTimes(prev => [...prev, decisionTime]);
    setTotalReturn(prev => prev + choice.return);
    const riskLevel = choice.risk as 'low' | 'medium' | 'high';
    setRiskChoices(prev => ({
      ...prev,
      [riskLevel]: prev[riskLevel] + 1,
    }));

    setLastChoice(choice);
    setShowFeedback(true);

    recordTelemetry('decision_made', {
      scenario_id: currentScenario.id,
      scenario_type: currentScenario.type,
      decision_time_ms: decisionTime,
      risk_level: choice.risk,
      expected_return: choice.return,
      choice_label: choice.label,
    }, decisionTime, choice.risk);

    setTimeout(() => {
      setShowFeedback(false);
      setLastChoice(null);

      if (currentScenarioIndex < scenarios.length - 1) {
        setCurrentScenarioIndex(prev => prev + 1);
        setDecisionStartTime(Date.now());
      } else {
        completeGame();
      }
    }, 2500);
  }, [currentScenario, currentScenarioIndex, decisionStartTime, recordTelemetry]);

  const completeGame = useCallback(async () => {
    const durationSeconds = Math.floor((Date.now() - startTime) / 1000);
    const avgDecisionTime = decisionTimes.reduce((a, b) => a + b, 0) / decisionTimes.length;

    const totalDecisions = riskChoices.low + riskChoices.medium + riskChoices.high;
    const riskScore = ((riskChoices.high * 100) + (riskChoices.medium * 50)) / totalDecisions;

    const impulsivityScore = Math.min(100, (1000 / avgDecisionTime) * 100);

    const rapidDecisionCount = decisionTimes.filter(t => t < 3000).length;
    const rapidDecisionRate = (rapidDecisionCount / decisionTimes.length) * 100;

    const behaviourRiskIndex = (
      riskScore * 0.40 +
      impulsivityScore * 0.30 +
      rapidDecisionRate * 0.30
    );

    recordTelemetry('game_completed', {
      duration_seconds: durationSeconds,
      completion_rate: 100,
      total_decisions: totalDecisions,
      avg_decision_time_ms: avgDecisionTime,
      risk_distribution: riskChoices,
      risk_score: riskScore,
      impulsivity_score: impulsivityScore,
      rapid_decision_rate: rapidDecisionRate,
      behaviour_risk_index: behaviourRiskIndex,
      total_return: totalReturn,
    });

    const completionData: GameCompletionData = {
      duration_seconds: durationSeconds,
      completion_rate: 100,
      behaviour_risk_index: behaviourRiskIndex,
      telemetry,
    };

    if (!demoMode && sessionId) {
      await supabase
        .from('wellbeing_game_sessions')
        .update({
          completed_at: new Date().toISOString(),
          duration_seconds: durationSeconds,
          completion_rate: 100,
          behaviour_risk_index: behaviourRiskIndex,
        })
        .eq('id', sessionId);

      if (telemetry.length > 0) {
        await supabase
          .from('wellbeing_game_telemetry')
          .insert(
            telemetry.map((t) => ({
              session_id: sessionId,
              ...t,
            }))
          );
      }

      await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/wellbeing-risk-calculator`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ session_id: sessionId }),
        }
      );

      if (invitation) {
        await supabase
          .from('wellbeing_game_invitations')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
          })
          .eq('id', invitation.id);
      }
    }

    setGameStatus('completed');
    onGameComplete?.(completionData);
  }, [startTime, decisionTimes, riskChoices, totalReturn, telemetry, demoMode, sessionId, invitation, recordTelemetry, onGameComplete]);

  useEffect(() => {
    if (gameStatus === 'playing') {
      setDecisionStartTime(Date.now());
    }
  }, [gameStatus]);

  if (gameStatus === 'instructions') {
    return (
      <div className="max-w-lg mx-auto">
        <Card className="bg-slate-900 border-slate-700">
          <CardContent className="p-4 md:p-6 space-y-4 md:space-y-6">
            <div className="text-center space-y-3 md:space-y-4">
              <div className="w-16 h-16 md:w-20 md:h-20 mx-auto bg-cyan-500/20 rounded-full flex items-center justify-center">
                <Target className="w-8 h-8 md:w-10 md:h-10 text-cyan-400" />
              </div>
              <h2 className="text-xl md:text-2xl font-bold text-white">Financial Decision Assessment</h2>
              <p className="text-sm md:text-base text-slate-300">
                You will evaluate 8 realistic financial scenarios. Each decision reflects your approach to risk, timing, and judgment.
              </p>
            </div>

            <div className="bg-slate-800/50 rounded-lg p-3 md:p-4 space-y-3 md:space-y-4">
              <h3 className="text-sm md:text-base font-semibold text-white flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 md:w-5 md:h-5 text-amber-400" />
                Important Information
              </h3>
              <ul className="space-y-2 text-xs md:text-sm text-slate-300">
                <li className="flex items-start gap-2">
                  <span className="text-cyan-400 mt-1">•</span>
                  <span>There are no "correct" answers - decisions reveal behavioral patterns</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-cyan-400 mt-1">•</span>
                  <span>Your decision speed and choices are recorded anonymously</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-cyan-400 mt-1">•</span>
                  <span>This assessment takes approximately 5-8 minutes</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-cyan-400 mt-1">•</span>
                  <span>Data is used for behavioral risk assessment and compliance only</span>
                </li>
              </ul>
            </div>

            <Button
              onClick={startGame}
              className="w-full bg-cyan-600 hover:bg-cyan-500 text-white text-base md:text-lg px-6 py-5"
            >
              Begin Assessment
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (gameStatus === 'completed') {
    return (
      <div className="max-w-lg mx-auto">
        <Card className="bg-slate-900 border-slate-700">
          <CardContent className="p-4 md:p-6 text-center space-y-4 md:space-y-6">
            <div className="w-16 h-16 md:w-20 md:h-20 mx-auto bg-cyan-500/20 rounded-full flex items-center justify-center">
              <CheckCircle className="w-8 h-8 md:w-10 md:h-10 text-cyan-400" />
            </div>

            <h2 className="text-xl md:text-2xl font-bold text-white">Assessment Complete</h2>

            <p className="text-sm md:text-base text-slate-300 leading-relaxed">
              Thank you for completing the financial decision assessment. Your behavioral patterns have been recorded anonymously and will be used for risk profiling and regulatory compliance purposes only.
            </p>

            <div className="grid grid-cols-3 gap-2 md:gap-3 pt-2 md:pt-4">
              <div className="bg-slate-800/50 rounded-lg p-3">
                <div className="text-xl md:text-2xl font-bold text-cyan-400">{riskChoices.high}</div>
                <div className="text-xs text-slate-400">High Risk</div>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-3">
                <div className="text-xl md:text-2xl font-bold text-cyan-400">{riskChoices.medium}</div>
                <div className="text-xs text-slate-400">Medium Risk</div>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-3">
                <div className="text-xl md:text-2xl font-bold text-cyan-400">{riskChoices.low}</div>
                <div className="text-xs text-slate-400">Low Risk</div>
              </div>
            </div>

            {demoMode && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 md:p-4">
                <p className="text-xs md:text-sm text-amber-200">
                  This was a demonstration. No data was collected.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 md:w-5 md:h-5 text-slate-400" />
          <span className="text-slate-400 text-xs md:text-sm">
            Scenario {currentScenarioIndex + 1} of {scenarios.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 md:w-5 md:h-5 text-cyan-400" />
          <span className="text-white font-semibold text-xs md:text-sm">
            {totalReturn > 0 ? '+' : ''}{totalReturn}%
          </span>
        </div>
      </div>

      <Progress value={progress} className="h-2" />

      <Card className="bg-slate-900 border-slate-700">
        <CardContent className="p-4 md:p-6">
          <div className="space-y-4">
            <div>
              <div className="inline-block px-2 py-1 bg-cyan-500/10 border border-cyan-500/30 rounded-full text-xs text-cyan-400 mb-2">
                {currentScenario.type.toUpperCase()}
              </div>
              <h2 className="text-lg md:text-xl font-bold text-white mb-2">{currentScenario.title}</h2>
              <p className="text-sm md:text-base text-slate-300 mb-3">{currentScenario.description}</p>
              <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
                <p className="text-xs md:text-sm text-slate-400">{currentScenario.context}</p>
              </div>
            </div>

            {showFeedback && lastChoice ? (
              <div className="space-y-3 animate-in fade-in duration-300">
                <div className={`p-3 rounded-lg border ${
                  lastChoice.risk === 'high' ? 'bg-amber-500/10 border-amber-500/30' :
                  lastChoice.risk === 'medium' ? 'bg-cyan-500/10 border-cyan-500/30' :
                  'bg-slate-500/10 border-slate-500/30'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="w-4 h-4 md:w-5 md:h-5" />
                    <span className="text-sm md:text-base font-semibold text-white">Decision Recorded</span>
                  </div>
                  <p className="text-xs md:text-sm text-slate-300">{lastChoice.consequence}</p>
                  <p className="text-xs text-slate-400 mt-2">
                    Expected return: {lastChoice.return > 0 ? '+' : ''}{lastChoice.return}% | Risk level: {lastChoice.risk}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {currentScenario.options.map((option, index) => (
                  <button
                    key={index}
                    onClick={() => handleChoice(option)}
                    className={`w-full text-left p-3 rounded-lg border-2 transition-all hover:scale-[1.01] ${
                      option.risk === 'high'
                        ? 'border-amber-500/30 hover:border-amber-500 hover:bg-amber-500/10'
                        : option.risk === 'medium'
                        ? 'border-cyan-500/30 hover:border-cyan-500 hover:bg-cyan-500/10'
                        : 'border-slate-500/30 hover:border-slate-400 hover:bg-slate-800/50'
                    } bg-slate-800/30`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="text-sm md:text-base font-semibold text-white mb-1">{option.label}</div>
                        <div className="text-xs md:text-sm text-slate-400">{option.consequence}</div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          option.risk === 'high' ? 'bg-amber-500/20 text-amber-300' :
                          option.risk === 'medium' ? 'bg-cyan-500/20 text-cyan-300' :
                          'bg-slate-500/20 text-slate-300'
                        }`}>
                          {option.risk.toUpperCase()}
                        </span>
                        <span className={`text-xs md:text-sm font-semibold ${
                          option.return > 0 ? 'text-green-400' :
                          option.return < 0 ? 'text-red-400' :
                          'text-slate-400'
                        }`}>
                          {option.return > 0 ? '+' : ''}{option.return}%
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {demoMode && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-2 md:p-3 text-center">
          <p className="text-xs md:text-sm text-amber-200">
            Demonstration Mode – No Player Data Collected
          </p>
        </div>
      )}
    </div>
  );
}
