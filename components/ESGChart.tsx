'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Leaf, Heart, TrendingUp, Award, AlertCircle } from 'lucide-react';

interface ESGChartProps {
  casinoName: string;
  wellbeingIndex: number;
  humanityScore: number;
  recoveryRate: number;
  responsibleMarketingScore: number;
  carbonScore: number;
  totalESGScore: number;
  esgGrade: string;
}

export function ESGChart({
  casinoName,
  wellbeingIndex,
  humanityScore,
  recoveryRate,
  responsibleMarketingScore,
  carbonScore,
  totalESGScore,
  esgGrade,
}: ESGChartProps) {
  const getGradeColor = (grade: string) => {
    if (grade.startsWith('A')) return 'bg-brand-100 text-brand-600';
    if (grade.startsWith('B')) return 'bg-blue-100 text-blue-700';
    if (grade.startsWith('C')) return 'bg-yellow-100 text-yellow-700';
    if (grade.startsWith('D')) return 'bg-orange-100 text-orange-700';
    return 'bg-red-100 text-red-700';
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-brand-500';
    if (score >= 60) return 'text-blue-600';
    if (score >= 40) return 'text-yellow-600';
    return 'text-orange-600';
  };

  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Leaf className="h-5 w-5 text-brand-500" />
            <CardTitle className="text-lg">ESG Gambling Sustainability Score™</CardTitle>
          </div>
          <Badge className={`${getGradeColor(esgGrade)} border-0 text-lg px-3 py-1`}>
            {esgGrade}
          </Badge>
        </div>
        <CardDescription className="text-xs">
          {casinoName} - World's first ESG rating for gambling operators
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 bg-gradient-to-r from-brand-50 to-blue-50 rounded-lg border border-brand-200">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <Award className="h-5 w-5 text-brand-500" />
              <span className="text-sm font-semibold text-slate-800">Total ESG Score</span>
            </div>
            <span className={`text-3xl font-bold ${getScoreColor(totalESGScore)}`}>
              {totalESGScore}/100
            </span>
          </div>
          <Progress value={totalESGScore} className="h-3" />
        </div>

        <div className="space-y-3">
          <div className="p-3 bg-white rounded-lg border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <Heart className="h-4 w-4 text-pink-600" />
                <span className="text-sm font-medium text-slate-700">Player Wellbeing Index™</span>
              </div>
              <span className={`text-lg font-bold ${getScoreColor(wellbeingIndex)}`}>
                {wellbeingIndex}/100
              </span>
            </div>
            <Progress value={wellbeingIndex} className="h-2" />
            <p className="text-xs text-slate-500 mt-1">
              Measures player safety, intervention effectiveness, and harm prevention
            </p>
          </div>

          <div className="p-3 bg-white rounded-lg border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <Heart className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-slate-700">Casino Humanity Score™</span>
              </div>
              <span className={`text-lg font-bold ${getScoreColor(humanityScore)}`}>
                {humanityScore}/100
              </span>
            </div>
            <Progress value={humanityScore} className="h-2" />
            <p className="text-xs text-slate-500 mt-1">
              Evaluates ethical practices, staff training, and responsible gaming culture
            </p>
          </div>

          <div className="p-3 bg-white rounded-lg border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-4 w-4 text-brand-500" />
                <span className="text-sm font-medium text-slate-700">Recovery Rate</span>
              </div>
              <span className={`text-lg font-bold ${getScoreColor(recoveryRate)}`}>
                {recoveryRate}%
              </span>
            </div>
            <Progress value={recoveryRate} className="h-2" />
            <p className="text-xs text-slate-500 mt-1">
              Percentage of at-risk players showing self-correction behavior
            </p>
          </div>

          <div className="p-3 bg-white rounded-lg border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <AlertCircle className="h-4 w-4 text-purple-600" />
                <span className="text-sm font-medium text-slate-700">Responsible Marketing</span>
              </div>
              <span className={`text-lg font-bold ${getScoreColor(responsibleMarketingScore)}`}>
                {responsibleMarketingScore}/100
              </span>
            </div>
            <Progress value={responsibleMarketingScore} className="h-2" />
            <p className="text-xs text-slate-500 mt-1">
              Analysis of promotional practices and marketing ethics
            </p>
          </div>

          <div className="p-3 bg-white rounded-lg border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <Leaf className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-slate-700">Carbon Server Impact</span>
              </div>
              <span className={`text-lg font-bold ${getScoreColor(carbonScore)}`}>
                {carbonScore}/100
              </span>
            </div>
            <Progress value={carbonScore} className="h-2" />
            <p className="text-xs text-slate-500 mt-1">
              Server efficiency, energy consumption, and environmental impact
            </p>
          </div>
        </div>

        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
          <p className="text-xs font-medium text-slate-700 mb-2">ESG Impact Assessment:</p>
          <ul className="space-y-1 text-xs text-slate-600">
            <li className="flex items-center">
              <span className={`w-2 h-2 rounded-full mr-2 ${totalESGScore >= 75 ? 'bg-brand-400' : 'bg-yellow-500'}`} />
              Overall sustainability rating: {esgGrade} ({totalESGScore >= 75 ? 'Excellent' : totalESGScore >= 60 ? 'Good' : 'Needs Improvement'})
            </li>
            <li className="flex items-center">
              <span className={`w-2 h-2 rounded-full mr-2 ${recoveryRate >= 65 ? 'bg-brand-400' : 'bg-yellow-500'}`} />
              Player recovery rate is {recoveryRate >= 65 ? 'above' : 'below'} industry average
            </li>
            <li className="flex items-center">
              <span className={`w-2 h-2 rounded-full mr-2 ${humanityScore >= 70 ? 'bg-brand-400' : 'bg-yellow-500'}`} />
              Ethical practices {humanityScore >= 70 ? 'exceed' : 'meet'} baseline standards
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
