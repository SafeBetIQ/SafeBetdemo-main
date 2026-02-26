'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  Award,
  Target,
  BarChart3,
  Clock
} from 'lucide-react';
import { WellbeingGameAnalytics, type GameSession } from '@/lib/wellbeingGameAnalytics';

interface SessionHistoryDisplayProps {
  playerId: string;
  casinoId: string;
  currentSession?: Partial<GameSession>;
}

export default function SessionHistoryDisplay({
  playerId,
  casinoId,
  currentSession,
}: SessionHistoryDisplayProps) {
  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [comparison, setComparison] = useState<any>(null);

  useEffect(() => {
    const loadSessions = async () => {
      setLoading(true);
      const history = await WellbeingGameAnalytics.getPlayerHistory(playerId, casinoId);
      setSessions(history);

      if (currentSession) {
        const comp = WellbeingGameAnalytics.compareToHistory(currentSession, history);
        setComparison(comp);
      }

      setLoading(false);
    };

    loadSessions();
  }, [playerId, casinoId, currentSession]);

  if (loading) {
    return (
      <Card className="bg-slate-900/80 border-slate-800">
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-400" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (sessions.length === 0 && !currentSession) {
    return (
      <Card className="bg-slate-900/80 border-slate-800">
        <CardContent className="p-6 text-center">
          <BarChart3 className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">No previous sessions found</p>
        </CardContent>
      </Card>
    );
  }

  const allSessions = currentSession
    ? [...sessions, currentSession as GameSession]
    : sessions;

  const avgBalance =
    allSessions.reduce((sum, s) => sum + (100 - s.behaviour_risk_index), 0) /
    allSessions.length;

  return (
    <div className="space-y-4">
      {comparison && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className={`
            border-2
            ${comparison.trend === 'improving' ? 'bg-green-500/5 border-green-500/30' : ''}
            ${comparison.trend === 'declining' ? 'bg-red-500/5 border-red-500/30' : ''}
            ${comparison.trend === 'stable' ? 'bg-blue-500/5 border-blue-500/30' : ''}
          `}>
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className={`
                  p-3 rounded-xl
                  ${comparison.trend === 'improving' ? 'bg-green-500/10' : ''}
                  ${comparison.trend === 'declining' ? 'bg-red-500/10' : ''}
                  ${comparison.trend === 'stable' ? 'bg-blue-500/10' : ''}
                `}>
                  {comparison.trend === 'improving' && <TrendingUp className="w-6 h-6 text-green-400" />}
                  {comparison.trend === 'declining' && <TrendingDown className="w-6 h-6 text-red-400" />}
                  {comparison.trend === 'stable' && <Minus className="w-6 h-6 text-blue-400" />}
                </div>
                <div className="flex-1">
                  <h3 className={`font-semibold mb-1 ${
                    comparison.trend === 'improving' ? 'text-green-400' :
                    comparison.trend === 'declining' ? 'text-red-400' :
                    'text-blue-400'
                  }`}>
                    {comparison.trend === 'improving' ? 'Improvement Detected!' :
                     comparison.trend === 'declining' ? 'Attention Needed' :
                     'Consistent Performance'}
                  </h3>
                  <p className="text-sm text-slate-300">{comparison.message}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <Card className="bg-slate-900/80 border-slate-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-emerald-400" />
            Your Progress
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-slate-800/50 rounded-lg">
              <div className="text-2xl font-bold text-white mb-1">
                {allSessions.length}
              </div>
              <div className="text-xs text-slate-400">Total Sessions</div>
            </div>

            <div className="text-center p-4 bg-slate-800/50 rounded-lg">
              <div className="text-2xl font-bold text-emerald-400 mb-1">
                {Math.round(avgBalance)}
              </div>
              <div className="text-xs text-slate-400">Avg Balance Score</div>
            </div>

            <div className="text-center p-4 bg-slate-800/50 rounded-lg">
              <div className="text-2xl font-bold text-amber-400 mb-1">
                {Math.round(
                  allSessions.reduce((sum, s) => sum + s.hesitation_score, 0) /
                    allSessions.length
                )}
              </div>
              <div className="text-xs text-slate-400">Avg Hesitation</div>
            </div>

            <div className="text-center p-4 bg-slate-800/50 rounded-lg">
              <div className="text-2xl font-bold text-purple-400 mb-1">
                {Math.round(
                  allSessions.reduce((sum, s) => sum + s.consistency_score, 0) /
                    allSessions.length
                )}
              </div>
              <div className="text-xs text-slate-400">Avg Consistency</div>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Recent Sessions
            </h4>

            {allSessions.slice(0, 5).map((session, index) => {
              const balanceScore = 100 - session.behaviour_risk_index;
              const isCurrentSession = currentSession && index === 0;

              return (
                <motion.div
                  key={session.id || 'current'}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`
                    p-4 rounded-lg border
                    ${isCurrentSession ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-slate-800/30 border-slate-700/50'}
                  `}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      <span className="text-sm text-slate-300">
                        {isCurrentSession
                          ? 'Current Session'
                          : new Date(session.completed_at).toLocaleDateString()}
                      </span>
                    </div>
                    <Badge
                      variant="outline"
                      className={`
                        ${balanceScore >= 70 ? 'border-green-500/50 text-green-400' :
                          balanceScore >= 50 ? 'border-amber-500/50 text-amber-400' :
                          'border-red-500/50 text-red-400'}
                      `}
                    >
                      {balanceScore}/100
                    </Badge>
                  </div>

                  <Progress
                    value={balanceScore}
                    className="h-2"
                  />

                  <div className="flex items-center gap-4 mt-3 text-xs text-slate-400">
                    <div className="flex items-center gap-1">
                      <Target className="w-3 h-3" />
                      <span>Risk: {session.behaviour_risk_index}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>Hesitation: {session.hesitation_score}</span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
