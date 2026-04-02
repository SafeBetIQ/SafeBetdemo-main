'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Calendar, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export type DateRange = '7d' | '30d' | '90d' | 'custom';

interface DateRangePickerProps {
  value: DateRange;
  onChange: (value: DateRange) => void;
}

const ranges: { value: DateRange; label: string }[] = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'custom', label: 'Custom range' },
];

export function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const selectedRange = ranges.find((r) => r.value === value);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Calendar className="h-4 w-4" />
          <span>{selectedRange?.label || 'Select range'}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {ranges.map((range) => (
          <DropdownMenuItem
            key={range.value}
            onClick={() => onChange(range.value)}
            className="flex items-center justify-between"
          >
            <span>{range.label}</span>
            {value === range.value && <Check className="h-4 w-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
