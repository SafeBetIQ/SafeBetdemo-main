'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Brain, Activity, Zap, Clock } from 'lucide-react';
import { formatPercentage } from '@/lib/utils';

interface PersonaShiftData {
  emotionalState: string;
  personalityShiftScore: number;
  bettingVelocity: number;
  sessionDuration: number;
  reactionTime: number;
}

interface PersonaShiftChartProps {
  data: PersonaShiftData;
  playerName?: string;
}

export function PersonaShiftChart({ data, playerName }: PersonaShiftChartProps) {
  const getEmotionalStateColor = (state: string) => {
    switch (state.toLowerCase()) {
      case 'calm':
      case 'neutral':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'excited':
      case 'euphoric':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'anxious':
      case 'stressed':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'frustrated':
      case 'desperate':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getShiftSeverity = (score: number) => {
    if (score < 20) return { label: 'Stable', color: 'text-green-600' };
    if (score < 40) return { label: 'Minor Shift', color: 'text-blue-600' };
    if (score < 60) return { label: 'Moderate Shift', color: 'text-yellow-600' };
    if (score < 80) return { label: 'Significant Shift', color: 'text-orange-600' };
    return { label: 'Critical Shift', color: 'text-red-600' };
  };

  const shiftSeverity = getShiftSeverity(data.personalityShiftScore);

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg flex items-center space-x-2">
              <Brain className="h-5 w-5 text-purple-600" />
              <span>Personality Analysis</span>
            </CardTitle>
            {playerName && (
              <CardDescription className="text-xs mt-1">
                {playerName}
              </CardDescription>
            )}
          </div>
          <Badge className={getEmotionalStateColor(data.emotionalState)}>
            {data.emotionalState}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Personality Shift Score</span>
              <span className={`text-2xl font-bold ${shiftSeverity.color}`}>
                {formatPercentage(data.personalityShiftScore)}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 mb-1">
              <div
                className={`h-3 rounded-full transition-all ${
                  data.personalityShiftScore < 20
                    ? 'bg-green-500'
                    : data.personalityShiftScore < 40
                    ? 'bg-blue-500'
                    : data.personalityShiftScore < 60
                    ? 'bg-yellow-500'
                    : data.personalityShiftScore < 80
                    ? 'bg-orange-500'
                    : 'bg-red-500'
                }`}
                style={{ width: `${data.personalityShiftScore}%` }}
              ></div>
            </div>
            <p className={`text-xs ${shiftSeverity.color} font-medium`}>
              {shiftSeverity.label}
            </p>
          </div>

          <div className="pt-4 border-t space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Activity className="h-4 w-4 text-blue-500" />
                <span className="text-sm text-gray-600">Betting Velocity</span>
              </div>
              <span className="font-semibold">{data.bettingVelocity.toFixed(2)} bets/min</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Clock className="h-4 w-4 text-green-500" />
                <span className="text-sm text-gray-600">Session Duration</span>
              </div>
              <span className="font-semibold">{data.sessionDuration} mins</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Zap className="h-4 w-4 text-yellow-500" />
                <span className="text-sm text-gray-600">Reaction Time</span>
              </div>
              <span className="font-semibold">{data.reactionTime} ms</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
