'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { TrendingUp, TrendingDown, Users, DollarSign, Award, Heart, Info } from 'lucide-react';

interface ESGMetric {
  label: string;
  value: string;
  change?: string;
  trend?: 'up' | 'down' | 'neutral';
  icon: 'users' | 'dollar' | 'award' | 'heart';
}

interface ESGPerformanceCardProps {
  title: string;
  description: string;
  metrics: ESGMetric[];
  className?: string;
  tooltip?: string;
}

const iconMap = {
  users: Users,
  dollar: DollarSign,
  award: Award,
  heart: Heart,
};

export function ESGPerformanceCard({ title, description, metrics, className, tooltip }: ESGPerformanceCardProps) {
  return (
    <Card className={`relative ${className}`}>
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
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {metrics.map((metric, index) => {
            const Icon = iconMap[metric.icon];
            return (
              <div key={index} className="flex items-start space-x-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <div className="p-2 bg-brand-100 dark:bg-brand-900 rounded-lg">
                  <Icon className="h-5 w-5 text-brand-600 dark:text-brand-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500 dark:text-gray-400">{metric.label}</p>
                  <p className="text-xl font-semibold text-gray-900 dark:text-white mt-1">
                    {metric.value}
                  </p>
                  {metric.change && (
                    <div className="flex items-center mt-1 space-x-1">
                      {metric.trend === 'up' && (
                        <TrendingUp className="h-3 w-3 text-green-500" />
                      )}
                      {metric.trend === 'down' && (
                        <TrendingDown className="h-3 w-3 text-red-500" />
                      )}
                      <span className={`text-xs ${
                        metric.trend === 'up' ? 'text-green-600' :
                        metric.trend === 'down' ? 'text-red-600' :
                        'text-gray-600'
                      }`}>
                        {metric.change}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
