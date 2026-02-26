'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Building2, TrendingUp, Users, Award } from 'lucide-react';
import { formatPercentage } from '@/lib/utils';

interface CasinoMetrics {
  id: string;
  name: string;
  esgScore: number;
  esgGrade: string;
  wellbeingIndex: number;
  activePlayers: number;
  atRiskPlayers: number;
  avgRiskScore: number;
  revenueStability: number;
}

interface CasinoComparisonChartProps {
  casinos: CasinoMetrics[];
  highlightedCasinoId?: string;
}

export function CasinoComparisonChart({
  casinos,
  highlightedCasinoId,
}: CasinoComparisonChartProps) {
  const sortedCasinos = [...casinos].sort((a, b) => b.esgScore - a.esgScore);

  const getGradeColor = (grade: string) => {
    if (grade.startsWith('A')) return 'bg-brand-100 text-brand-600 border-brand-300';
    if (grade.startsWith('B')) return 'bg-blue-100 text-blue-700 border-blue-300';
    if (grade.startsWith('C')) return 'bg-yellow-100 text-yellow-700 border-yellow-300';
    if (grade.startsWith('D')) return 'bg-orange-100 text-orange-700 border-orange-300';
    return 'bg-red-100 text-red-700 border-red-300';
  };

  const getRiskLevel = (riskScore: number) => {
    if (riskScore >= 70) return { level: 'High', color: 'text-red-600' };
    if (riskScore >= 50) return { level: 'Moderate', color: 'text-yellow-600' };
    return { level: 'Low', color: 'text-green-600' };
  };

  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-3">
        <div className="flex items-center space-x-2">
          <Building2 className="h-5 w-5 text-blue-600" />
          <CardTitle className="text-lg">Casino ESG Comparison</CardTitle>
        </div>
        <CardDescription className="text-xs">
          Comparative analysis across {casinos.length} gaming operators
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {sortedCasinos.map((casino, index) => {
          const isHighlighted = casino.id === highlightedCasinoId;
          const riskLevel = getRiskLevel(casino.avgRiskScore);
          const riskPercentage = (casino.atRiskPlayers / casino.activePlayers) * 100;

          return (
            <div
              key={casino.id}
              className={`p-4 rounded-lg border-2 transition-all ${
                isHighlighted
                  ? 'border-blue-400 bg-blue-50 shadow-md'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <Award className="h-4 w-4 text-slate-500" />
                    <span className="font-semibold text-slate-900">{casino.name}</span>
                    {index === 0 && (
                      <Badge className="bg-amber-100 text-amber-700 border-amber-300 text-xs">
                        Industry Leader
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">
                    Rank #{index + 1} of {sortedCasinos.length}
                  </p>
                </div>
                <Badge className={`${getGradeColor(casino.esgGrade)} border text-base px-3 py-1`}>
                  {casino.esgGrade}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="p-2 bg-slate-50 rounded border border-slate-200">
                  <p className="text-xs text-slate-600 mb-1">ESG Score</p>
                  <p className="text-lg font-bold text-slate-900">{casino.esgScore}/100</p>
                  <Progress value={casino.esgScore} className="h-1 mt-1" />
                </div>

                <div className="p-2 bg-slate-50 rounded border border-slate-200">
                  <p className="text-xs text-slate-600 mb-1">Wellbeing Index</p>
                  <p className="text-lg font-bold text-slate-900">{casino.wellbeingIndex}/100</p>
                  <Progress value={casino.wellbeingIndex} className="h-1 mt-1" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="p-2 bg-white rounded border border-slate-200">
                  <div className="flex items-center space-x-1 mb-1">
                    <Users className="h-3 w-3 text-blue-600" />
                    <span className="text-slate-600">Active</span>
                  </div>
                  <p className="font-bold text-slate-900">{casino.activePlayers.toLocaleString()}</p>
                </div>

                <div className="p-2 bg-white rounded border border-slate-200">
                  <div className="flex items-center space-x-1 mb-1">
                    <TrendingUp className={`h-3 w-3 ${riskLevel.color}`} />
                    <span className="text-slate-600">At Risk</span>
                  </div>
                  <p className={`font-bold ${riskLevel.color}`}>
                    {casino.atRiskPlayers} ({formatPercentage(riskPercentage)})
                  </p>
                </div>

                <div className="p-2 bg-white rounded border border-slate-200">
                  <div className="flex items-center space-x-1 mb-1">
                    <Award className="h-3 w-3 text-purple-600" />
                    <span className="text-slate-600">Stability</span>
                  </div>
                  <p className="font-bold text-slate-900">{casino.revenueStability}/100</p>
                </div>
              </div>

              {isHighlighted && (
                <div className="mt-3 pt-3 border-t border-blue-200">
                  <p className="text-xs text-blue-700 font-medium">
                    Currently viewing this casino's detailed analytics
                  </p>
                </div>
              )}
            </div>
          );
        })}

        <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-lg">
          <p className="text-xs font-medium text-slate-700 mb-2">Industry Insights:</p>
          <ul className="space-y-1 text-xs text-slate-600">
            <li>
              • Average ESG Score: {(sortedCasinos.reduce((sum, c) => sum + c.esgScore, 0) / sortedCasinos.length).toFixed(1)}
            </li>
            <li>
              • Top Performer: {sortedCasinos[0].name} ({sortedCasinos[0].esgScore}/100)
            </li>
            <li>
              • {sortedCasinos.filter(c => c.esgGrade.startsWith('A')).length} operators achieved Grade A rating
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
