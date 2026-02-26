'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Zap, Target, TrendingUp, AlertCircle } from 'lucide-react';

interface ImpulseData {
  timestamp: string;
  action: string;
  impulseLevel: number;
  intentAlignment: number;
  outcome: 'win' | 'loss';
  betAmount: number;
}

interface ImpulseVsIntentionTableProps {
  playerId: string;
  data: ImpulseData[];
  overallRatio: number;
}

export function ImpulseVsIntentionTable({
  playerId,
  data,
  overallRatio,
}: ImpulseVsIntentionTableProps) {
  const getRatioLevel = (ratio: number) => {
    if (ratio >= 2.0) return { level: 'Critical', color: 'text-red-600', bg: 'bg-red-100' };
    if (ratio >= 1.5) return { level: 'High', color: 'text-orange-600', bg: 'bg-orange-100' };
    if (ratio >= 1.2) return { level: 'Moderate', color: 'text-yellow-600', bg: 'bg-yellow-100' };
    return { level: 'Balanced', color: 'text-green-600', bg: 'bg-green-100' };
  };

  const ratioLevel = getRatioLevel(overallRatio);

  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Target className="h-5 w-5 text-cyan-600" />
            <CardTitle className="text-lg">Impulse vs Intention Analysis™</CardTitle>
          </div>
          <Badge className={`${ratioLevel.bg} ${ratioLevel.color} border-0`}>
            Ratio: {overallRatio.toFixed(2)}:1
          </Badge>
        </div>
        <CardDescription className="text-xs">
          Player ID: {playerId} - Decision-making pattern analysis
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start space-x-2">
            <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs font-medium text-blue-900">Pattern Assessment</p>
              <p className="text-xs text-blue-700 mt-1">
                {overallRatio >= 2.0 ? (
                  'Player showing significant impulsive behavior. Immediate monitoring recommended.'
                ) : overallRatio >= 1.5 ? (
                  'Elevated impulse levels detected. Consider intervention protocols.'
                ) : overallRatio >= 1.2 ? (
                  'Minor impulse elevation. Continue monitoring for pattern changes.'
                ) : (
                  'Decision-making appears balanced and intentional. Normal pattern.'
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="text-xs">Time</TableHead>
                <TableHead className="text-xs">Action</TableHead>
                <TableHead className="text-xs text-center">
                  <div className="flex items-center justify-center space-x-1">
                    <Zap className="h-3 w-3" />
                    <span>Impulse</span>
                  </div>
                </TableHead>
                <TableHead className="text-xs text-center">
                  <div className="flex items-center justify-center space-x-1">
                    <Target className="h-3 w-3" />
                    <span>Intent</span>
                  </div>
                </TableHead>
                <TableHead className="text-xs">Bet</TableHead>
                <TableHead className="text-xs">Outcome</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.slice(0, 10).map((row, idx) => {
                const isHighImpulse = row.impulseLevel >= 75;
                const isLowIntent = row.intentAlignment < 40;

                return (
                  <TableRow key={idx} className={isHighImpulse && isLowIntent ? 'bg-red-50' : ''}>
                    <TableCell className="text-xs text-slate-600">
                      {new Date(row.timestamp).toLocaleTimeString()}
                    </TableCell>
                    <TableCell className="text-xs font-medium">{row.action}</TableCell>
                    <TableCell className="text-center">
                      <Badge
                        className={`${
                          row.impulseLevel >= 75 ? 'bg-red-100 text-red-700' :
                          row.impulseLevel >= 50 ? 'bg-orange-100 text-orange-700' :
                          'bg-green-100 text-green-700'
                        } border-0 text-xs`}
                      >
                        {row.impulseLevel}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        className={`${
                          row.intentAlignment >= 70 ? 'bg-green-100 text-green-700' :
                          row.intentAlignment >= 40 ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        } border-0 text-xs`}
                      >
                        {row.intentAlignment}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs font-mono">
                      R{row.betAmount.toFixed(0)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={`${
                          row.outcome === 'win' ? 'bg-brand-100 text-brand-600' : 'bg-slate-100 text-slate-700'
                        } border-0 text-xs`}
                      >
                        {row.outcome}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex items-center space-x-2 mb-1">
              <Zap className="h-3 w-3 text-orange-600" />
              <span className="text-xs font-medium text-slate-600">Avg Impulse</span>
            </div>
            <p className="text-lg font-bold text-slate-900">
              {(data.reduce((sum, d) => sum + d.impulseLevel, 0) / data.length).toFixed(0)}
            </p>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex items-center space-x-2 mb-1">
              <Target className="h-3 w-3 text-cyan-600" />
              <span className="text-xs font-medium text-slate-600">Avg Intent</span>
            </div>
            <p className="text-lg font-bold text-slate-900">
              {(data.reduce((sum, d) => sum + d.intentAlignment, 0) / data.length).toFixed(0)}
            </p>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex items-center space-x-2 mb-1">
              <TrendingUp className="h-3 w-3 text-blue-600" />
              <span className="text-xs font-medium text-slate-600">Pattern Trend</span>
            </div>
            <p className="text-lg font-bold text-slate-900">
              {overallRatio > 1.5 ? '↑' : overallRatio < 0.9 ? '↓' : '→'}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
