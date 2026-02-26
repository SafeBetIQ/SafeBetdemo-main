'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Award, Leaf, Heart, TrendingUp, Users } from 'lucide-react';
import { formatPercentage } from '@/lib/utils';

interface ESGScoreCardProps {
  totalScore: number;
  grade: string;
  wellbeingIndex?: number;
  humanityScore?: number;
  recoveryRate?: number;
  carbonScore?: number;
  casinoName?: string;
  reportingPeriod?: string;
}

export function ESGScoreCard({
  totalScore,
  grade,
  wellbeingIndex,
  humanityScore,
  recoveryRate,
  carbonScore,
  casinoName,
  reportingPeriod
}: ESGScoreCardProps) {
  const getGradeColor = (grade: string) => {
    const firstChar = grade.charAt(0);
    switch (firstChar) {
      case 'A':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'B':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'C':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'D':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'F':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-blue-600';
    if (score >= 40) return 'text-yellow-600';
    if (score >= 20) return 'text-orange-600';
    return 'text-red-600';
  };

  return (
    <Card className="hover:shadow-lg transition-shadow border-2 border-brand-200">
      <CardHeader className="bg-gradient-to-r from-brand-50 to-teal-50">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg flex items-center space-x-2">
              <Award className="h-5 w-5 text-brand-500" />
              <span>{casinoName || 'ESG Sustainability Score'}</span>
            </CardTitle>
            {reportingPeriod && (
              <CardDescription className="text-xs mt-1">
                {reportingPeriod}
              </CardDescription>
            )}
          </div>
          <Badge className={`${getGradeColor(grade)} text-xl px-3 py-1`}>
            {grade}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Total ESG Score</span>
            <span className={`text-4xl font-bold ${getScoreColor(totalScore)}`}>
              {totalScore.toFixed(1)}
            </span>
          </div>

          <div className="w-full bg-gray-200 rounded-full h-4">
            <div
              className="bg-gradient-to-r from-brand-400 to-teal-500 h-4 rounded-full transition-all"
              style={{ width: `${totalScore}%` }}
            ></div>
          </div>

          {(wellbeingIndex !== undefined || humanityScore !== undefined || recoveryRate !== undefined || carbonScore !== undefined) && (
            <div className="pt-4 border-t space-y-3">
              {wellbeingIndex !== undefined && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Heart className="h-4 w-4 text-pink-500" />
                    <span className="text-sm text-gray-600">Player Wellbeing Index™</span>
                  </div>
                  <span className="font-semibold">{formatPercentage(wellbeingIndex)}</span>
                </div>
              )}
              {humanityScore !== undefined && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Users className="h-4 w-4 text-blue-500" />
                    <span className="text-sm text-gray-600">Casino Humanity Score™</span>
                  </div>
                  <span className="font-semibold">{formatPercentage(humanityScore)}</span>
                </div>
              )}
              {recoveryRate !== undefined && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <TrendingUp className="h-4 w-4 text-green-500" />
                    <span className="text-sm text-gray-600">Recovery Rate</span>
                  </div>
                  <span className="font-semibold">{formatPercentage(recoveryRate)}</span>
                </div>
              )}
              {carbonScore !== undefined && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Leaf className="h-4 w-4 text-brand-400" />
                    <span className="text-sm text-gray-600">Carbon Energy Score</span>
                  </div>
                  <span className="font-semibold">{formatPercentage(carbonScore)}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
