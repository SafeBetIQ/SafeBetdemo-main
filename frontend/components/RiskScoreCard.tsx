'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { AlertCircle, TrendingUp, TrendingDown, Minus, Info } from 'lucide-react';
import { formatPercentage } from '@/lib/utils';

interface RiskScoreCardProps {
  riskScore: number;
  riskLevel: 'low' | 'moderate' | 'high' | 'critical';
  playerName?: string;
  lastUpdated?: string;
  trend?: 'up' | 'down' | 'stable';
  impulseLevel?: number;
  fatigueIndex?: number;
  tooltip?: string;
}

export function RiskScoreCard({
  riskScore,
  riskLevel,
  playerName,
  lastUpdated,
  trend = 'stable',
  impulseLevel,
  fatigueIndex,
  tooltip
}: RiskScoreCardProps) {
  const getRiskColor = (level: string) => {
    switch (level) {
      case 'low':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'moderate':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getScoreColor = (score: number) => {
    if (score < 30) return 'text-green-600';
    if (score < 60) return 'text-yellow-600';
    if (score < 80) return 'text-orange-600';
    return 'text-red-600';
  };

  const getTrendIcon = () => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-red-500" />;
      case 'down':
        return <TrendingDown className="h-4 w-4 text-green-500" />;
      default:
        return <Minus className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <Card className="hover:shadow-lg transition-shadow relative">
      {tooltip && (
        <div className="absolute top-4 right-4 z-10">
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-4 w-4 text-muted-foreground cursor-help hover:text-foreground transition-colors" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p>{tooltip}</p>
            </TooltipContent>
          </Tooltip>
        </div>
      )}
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">
              {playerName || 'Player Risk Profile'}
            </CardTitle>
            {lastUpdated && (
              <CardDescription className="text-xs mt-1">
                Updated {lastUpdated}
              </CardDescription>
            )}
          </div>
          <Badge className={getRiskColor(riskLevel)}>
            {riskLevel.toUpperCase()}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-5 w-5 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Risk Score</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className={`text-3xl font-bold ${getScoreColor(riskScore)}`}>
                {riskScore}
              </span>
              <span className="text-sm text-gray-500">/100</span>
              {getTrendIcon()}
            </div>
          </div>

          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all ${
                riskScore < 30
                  ? 'bg-green-500'
                  : riskScore < 60
                  ? 'bg-yellow-500'
                  : riskScore < 80
                  ? 'bg-orange-500'
                  : 'bg-red-500'
              }`}
              style={{ width: `${riskScore}%` }}
            ></div>
          </div>

          {(impulseLevel !== undefined || fatigueIndex !== undefined) && (
            <div className="pt-3 border-t grid grid-cols-2 gap-4">
              {impulseLevel !== undefined && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Impulse Level</p>
                  <p className="text-lg font-semibold">{formatPercentage(impulseLevel)}</p>
                </div>
              )}
              {fatigueIndex !== undefined && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Fatigue Index</p>
                  <p className="text-lg font-semibold">{formatPercentage(fatigueIndex)}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
