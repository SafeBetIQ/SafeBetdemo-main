'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { GraduationCap, Award, Calendar, TrendingUp } from 'lucide-react';
import { formatPercentage } from '@/lib/utils';

interface TrainingStats {
  totalEmployees: number;
  trainedEmployees: number;
  completionRate: number;
  averageScore: number;
  upcomingRenewal: number;
  certificationRate: number;
}

interface EmployeeTrainingTrackerProps {
  stats: TrainingStats;
  className?: string;
}

export function EmployeeTrainingTracker({ stats, className }: EmployeeTrainingTrackerProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Responsible Gambling Training</CardTitle>
            <CardDescription>SARGF certified employee training programme</CardDescription>
          </div>
          <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-lg">
            <GraduationCap className="h-6 w-6 text-purple-600 dark:text-purple-400" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Training Completion Rate
            </span>
            <span className="text-sm font-bold text-gray-900 dark:text-white">
              {formatPercentage(stats.completionRate)}
            </span>
          </div>
          <Progress value={stats.completionRate} className="h-3" />
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-gray-500">
              {stats.trainedEmployees} of {stats.totalEmployees} employees
            </span>
            {stats.completionRate >= 90 && (
              <span className="text-xs text-green-600 font-medium flex items-center">
                <TrendingUp className="h-3 w-3 mr-1" />
                Industry leading
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 p-3 rounded-lg">
            <div className="flex items-center justify-center mb-1">
              <Award className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <p className="text-xl font-bold text-center text-purple-700 dark:text-purple-300">
              {stats.certificationRate}%
            </p>
            <p className="text-xs text-center text-gray-600 dark:text-gray-400 mt-1">
              Certified
            </p>
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 p-3 rounded-lg">
            <div className="flex items-center justify-center mb-1">
              <GraduationCap className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <p className="text-xl font-bold text-center text-blue-700 dark:text-blue-300">
              {stats.averageScore}%
            </p>
            <p className="text-xs text-center text-gray-600 dark:text-gray-400 mt-1">
              Avg Score
            </p>
          </div>

          <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 p-3 rounded-lg">
            <div className="flex items-center justify-center mb-1">
              <Calendar className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
            <p className="text-xl font-bold text-center text-orange-700 dark:text-orange-300">
              {stats.upcomingRenewal}
            </p>
            <p className="text-xs text-center text-gray-600 dark:text-gray-400 mt-1">
              Due Soon
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-start space-x-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <div className="flex-shrink-0 mt-0.5">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-900 dark:text-white">
                SARGF RG101 Course
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                8-hour comprehensive responsible gambling training
              </p>
            </div>
            <span className="text-xs text-gray-500 flex-shrink-0">Active</span>
          </div>
        </div>

        <div className="pt-3 border-t border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">Training Provider:</span>
            <span className="font-medium text-gray-900 dark:text-white">
              South African Responsible Gambling Foundation (SARGF)
            </span>
          </div>
          <div className="flex items-center justify-between text-xs mt-2">
            <span className="text-gray-500">ESG Alignment:</span>
            <span className="font-medium text-green-600">
              Industry Best Practice
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
