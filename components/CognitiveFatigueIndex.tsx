'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Brain, TrendingDown, AlertTriangle, Activity } from 'lucide-react';
import { formatPercentage } from '@/lib/utils';

interface CognitiveFatigueIndexProps {
  playerId: string;
  fatigueScore: number;
  decisionStability: number;
  reactionTimeMs: number;
  sessionDuration: number;
}

export function CognitiveFatigueIndex({
  playerId,
  fatigueScore,
  decisionStability,
  reactionTimeMs,
  sessionDuration,
}: CognitiveFatigueIndexProps) {
  const getFatigueLevel = (score: number) => {
    if (score >= 80) return { level: 'Critical', color: 'text-red-600', bg: 'bg-red-100' };
    if (score >= 60) return { level: 'High', color: 'text-orange-600', bg: 'bg-orange-100' };
    if (score >= 40) return { level: 'Moderate', color: 'text-yellow-600', bg: 'bg-yellow-100' };
    return { level: 'Low', color: 'text-green-600', bg: 'bg-green-100' };
  };

  const fatigue = getFatigueLevel(fatigueScore);
  const avgReactionTime = 1200;
  const reactionDelay = ((reactionTimeMs - avgReactionTime) / avgReactionTime) * 100;

  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Brain className="h-5 w-5 text-purple-600" />
            <CardTitle className="text-lg">Cognitive Fatigue Index™</CardTitle>
          </div>
          <Badge className={`${fatigue.bg} ${fatigue.color} border-0`}>
            {fatigue.level}
          </Badge>
        </div>
        <CardDescription className="text-xs">
          Player ID: {playerId} - Real-time cognitive performance analysis
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex justify-between mb-2">
            <span className="text-sm font-medium text-slate-700">Fatigue Score</span>
            <span className="text-sm font-bold text-slate-900">{fatigueScore}/100</span>
          </div>
          <Progress value={fatigueScore} className="h-2" />
          <p className="text-xs text-slate-500 mt-1">
            {fatigueScore >= 80 ? 'Immediate intervention recommended' :
             fatigueScore >= 60 ? 'Monitoring required' :
             'Normal cognitive function'}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex items-center space-x-2 mb-2">
              <Activity className="h-4 w-4 text-blue-600" />
              <span className="text-xs font-medium text-slate-600">Decision Stability</span>
            </div>
            <p className="text-xl font-bold text-slate-900">{decisionStability}%</p>
            <Progress value={decisionStability} className="h-1 mt-2" />
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex items-center space-x-2 mb-2">
              <TrendingDown className="h-4 w-4 text-orange-600" />
              <span className="text-xs font-medium text-slate-600">Reaction Time</span>
            </div>
            <p className="text-xl font-bold text-slate-900">{reactionTimeMs}ms</p>
            <p className="text-xs text-slate-500 mt-1">
              {reactionDelay > 20 ? '+' : ''}{formatPercentage(reactionDelay)} vs avg
            </p>
          </div>
        </div>

        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-start space-x-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-amber-900">Session Duration Alert</p>
              <p className="text-xs text-amber-700 mt-1">
                Active for {Math.floor(sessionDuration / 60)}h {sessionDuration % 60}m
                {sessionDuration > 180 && ' - Extended session detected'}
              </p>
            </div>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-200">
          <h4 className="text-xs font-semibold text-slate-700 mb-2">Fatigue Indicators:</h4>
          <ul className="space-y-1 text-xs text-slate-600">
            <li className="flex items-center">
              <span className={`w-2 h-2 rounded-full mr-2 ${reactionTimeMs > 1500 ? 'bg-red-500' : 'bg-green-500'}`} />
              Reaction time {reactionTimeMs > 1500 ? 'significantly delayed' : 'within normal range'}
            </li>
            <li className="flex items-center">
              <span className={`w-2 h-2 rounded-full mr-2 ${decisionStability < 50 ? 'bg-red-500' : 'bg-green-500'}`} />
              Decision consistency {decisionStability < 50 ? 'deteriorating' : 'stable'}
            </li>
            <li className="flex items-center">
              <span className={`w-2 h-2 rounded-full mr-2 ${sessionDuration > 240 ? 'bg-red-500' : 'bg-green-500'}`} />
              Session length {sessionDuration > 240 ? 'excessive' : 'reasonable'}
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
