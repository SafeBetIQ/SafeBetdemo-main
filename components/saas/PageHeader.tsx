'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Bell } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, actions, children, className }: PageHeaderProps) {
  return (
    <div className={cn('border-b border-border bg-card', className)}>
      <div className="flex flex-col gap-4 p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-heading-1">{title}</h1>
            {subtitle && (
              <p className="mt-1 text-body text-muted-foreground">{subtitle}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {actions}
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
