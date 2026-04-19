'use client';

import React from 'react';
import { cn, formatPercentage } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus, Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface KPICardProps {
  title: string;
  value: string | number;
  change?: {
    value: number;
    type: 'increase' | 'decrease' | 'neutral';
    label?: string;
  };
  icon?: React.ElementType;
  className?: string;
  valuePrefix?: string;
  valueSuffix?: string;
  tooltip?: string;
}

export function KPICard({
  title,
  value,
  change,
  icon: Icon,
  className,
  valuePrefix = '',
  valueSuffix = '',
  tooltip,
}: KPICardProps) {
  const getTrendIcon = () => {
    if (!change) return null;
    switch (change.type) {
      case 'increase':
        return <TrendingUp className="h-4 w-4" />;
      case 'decrease':
        return <TrendingDown className="h-4 w-4" />;
      case 'neutral':
        return <Minus className="h-4 w-4" />;
    }
  };

  const getTrendColor = () => {
    if (!change) return '';
    switch (change.type) {
      case 'increase':
        return 'text-success';
      case 'decrease':
        return 'text-destructive';
      case 'neutral':
        return 'text-muted-foreground';
    }
  };

  return (
    <Card className={cn('card-elevation', 'relative', className)}>
      {tooltip && (
        <div className="absolute top-3 right-3 z-10">
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help hover:text-foreground transition-colors" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p>{tooltip}</p>
            </TooltipContent>
          </Tooltip>
        </div>
      )}
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="mt-2 text-3xl font-bold text-foreground">
              {valuePrefix}
              {typeof value === 'number' ? value.toLocaleString() : value}
              {valueSuffix}
            </p>
            {change && (
              <div className={cn('mt-2 flex items-center gap-1 text-sm font-medium', getTrendColor())}>
                {getTrendIcon()}
                <span>{change.value > 0 ? '+' : ''}{formatPercentage(change.value)}</span>
                {change.label && (
                  <span className="text-muted-foreground font-normal">
                    {change.label}
                  </span>
                )}
              </div>
            )}
          </div>
          {Icon && (
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="h-6 w-6" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
