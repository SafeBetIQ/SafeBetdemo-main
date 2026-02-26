'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { DollarSign, TrendingUp } from 'lucide-react';
import { formatPercentage } from '@/lib/utils';

interface Contribution {
  program_name: string;
  contribution_amount: number;
  recipient_organization: string;
  contribution_date: string;
}

interface NRGPContributionTrackerProps {
  totalContribution: number;
  targetContribution: number;
  recentContributions: Contribution[];
  yearToDate: number;
  className?: string;
}

export function NRGPContributionTracker({
  totalContribution,
  targetContribution,
  recentContributions,
  yearToDate,
  className
}: NRGPContributionTrackerProps) {
  const progressPercentage = (totalContribution / targetContribution) * 100;

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">NRGP Contribution Tracker</CardTitle>
            <CardDescription>National Responsible Gambling Programme Funding</CardDescription>
          </div>
          <div className="p-3 bg-green-100 dark:bg-green-900 rounded-lg">
            <DollarSign className="h-6 w-6 text-green-600 dark:text-green-400" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Annual Target Progress
            </span>
            <span className="text-sm font-bold text-gray-900 dark:text-white">
              {formatPercentage(progressPercentage)}
            </span>
          </div>
          <Progress value={progressPercentage} className="h-3" />
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-gray-500">
              R{(totalContribution / 1000000).toFixed(2)}M contributed
            </span>
            <span className="text-xs text-gray-500">
              Target: R{(targetContribution / 1000000).toFixed(1)}M
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 p-4 rounded-lg">
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Year to Date</p>
            <p className="text-2xl font-bold text-green-700 dark:text-green-300">
              R{(yearToDate / 1000000).toFixed(2)}M
            </p>
            <div className="flex items-center mt-1">
              <TrendingUp className="h-3 w-3 text-green-600 mr-1" />
              <span className="text-xs text-green-600">On track</span>
            </div>
          </div>
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 p-4 rounded-lg">
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">ESG Alignment</p>
            <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
              {progressPercentage >= 100 ? 'Exceeded' : 'Compliant'}
            </p>
            <p className="text-xs text-blue-600 mt-1">Industry Standard</p>
          </div>
        </div>

        {recentContributions.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
              Recent Contributions
            </h4>
            <div className="space-y-2">
              {recentContributions.slice(0, 3).map((contribution, index) => (
                <div key={index} className="flex items-start justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {contribution.program_name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {contribution.recipient_organization}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(contribution.contribution_date).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="ml-3 flex-shrink-0">
                    <p className="text-sm font-bold text-green-600 dark:text-green-400">
                      R{(contribution.contribution_amount / 1000000).toFixed(2)}M
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
