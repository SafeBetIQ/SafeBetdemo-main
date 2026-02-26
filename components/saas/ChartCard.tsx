'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ChartCardProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  headerAction?: React.ReactNode;
  footer?: React.ReactNode;
  tooltip?: string;
}

export function ChartCard({
  title,
  description,
  children,
  className,
  headerAction,
  footer,
  tooltip,
}: ChartCardProps) {
  return (
    <Card className={cn('card-elevation', 'relative', className)}>
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
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div className="space-y-1">
          <CardTitle className="text-heading-3">{title}</CardTitle>
          {description && (
            <CardDescription>{description}</CardDescription>
          )}
        </div>
        {headerAction && <div className="flex items-center gap-2">{headerAction}</div>}
      </CardHeader>
      <CardContent>
        {children}
      </CardContent>
      {footer && (
        <div className="border-t border-border px-6 py-4">
          {footer}
        </div>
      )}
    </Card>
  );
}
