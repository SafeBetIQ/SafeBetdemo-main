'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShieldAlert, Clock, CheckCircle, Users } from 'lucide-react';

interface SelfExclusionStats {
  activeExclusions: number;
  newThisMonth: number;
  completedThisYear: number;
  averageCounselingCompletion: number;
  pendingReinstatements: number;
}

interface SelfExclusionMonitorProps {
  stats: SelfExclusionStats;
  className?: string;
}

export function SelfExclusionMonitor({ stats, className }: SelfExclusionMonitorProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Self-Exclusion Programme</CardTitle>
            <CardDescription>6-month minimum period compliance</CardDescription>
          </div>
          <div className="p-3 bg-orange-100 dark:bg-orange-900 rounded-lg">
            <ShieldAlert className="h-6 w-6 text-orange-600 dark:text-orange-400" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 p-4 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <Users className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              <Badge variant="outline" className="bg-white dark:bg-gray-950">
                Active
              </Badge>
            </div>
            <p className="text-2xl font-bold text-orange-700 dark:text-orange-300">
              {stats.activeExclusions}
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              Currently excluded players
            </p>
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 p-4 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <Badge variant="outline" className="bg-white dark:bg-gray-950">
                New
              </Badge>
            </div>
            <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
              {stats.newThisMonth}
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              This month
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <div className="flex items-center space-x-2 mb-1">
              <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
              <span className="text-xs text-gray-600 dark:text-gray-400">
                Completed
              </span>
            </div>
            <p className="text-lg font-bold text-gray-900 dark:text-white">
              {stats.completedThisYear}
            </p>
            <p className="text-xs text-gray-500">This year</p>
          </div>

          <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <div className="flex items-center space-x-2 mb-1">
              <Clock className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
              <span className="text-xs text-gray-600 dark:text-gray-400">
                Pending
              </span>
            </div>
            <p className="text-lg font-bold text-gray-900 dark:text-white">
              {stats.pendingReinstatements}
            </p>
            <p className="text-xs text-gray-500">Reinstatements</p>
          </div>
        </div>

        <div className="pt-3 border-t border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                Counseling Completion Rate
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                SARGF treatment compliance
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {stats.averageCounselingCompletion}%
              </p>
            </div>
          </div>
        </div>

        <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
          <p className="text-xs text-blue-800 dark:text-blue-300 font-medium">
            ESG Compliance: Industry Best Practice
          </p>
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
            Minimum 6-month exclusion period with mandatory SARGF counseling before reinstatement consideration
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
