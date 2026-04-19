'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Filter, Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface TableCardProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  onSearchChange?: (value: string) => void;
  headerAction?: React.ReactNode;
  footer?: React.ReactNode;
  tooltip?: string;
}

export function TableCard({
  title,
  description,
  children,
  className,
  searchable = false,
  searchPlaceholder = 'Search...',
  onSearchChange,
  headerAction,
  footer,
  tooltip,
}: TableCardProps) {
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
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-heading-3">{title}</CardTitle>
            {description && (
              <CardDescription>{description}</CardDescription>
            )}
          </div>
          <div className="flex items-center gap-2">
            {headerAction}
          </div>
        </div>
        {searchable && (
          <div className="flex items-center gap-2 pt-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={searchPlaceholder}
                className="pl-9"
                onChange={(e) => onSearchChange?.(e.target.value)}
              />
            </div>
            <Button variant="outline" size="icon">
              <Filter className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto custom-scrollbar">
          {children}
        </div>
      </CardContent>
      {footer && (
        <div className="border-t border-border px-6 py-4">
          {footer}
        </div>
      )}
    </Card>
  );
}
