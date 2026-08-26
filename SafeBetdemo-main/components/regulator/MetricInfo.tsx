'use client';

// Accessible metric definition control (PERF-REG-1). Replaces the previous
// title=-only tooltips, which were not reliably keyboard-focusable or
// screen-reader discoverable. This renders a focusable button whose aria-label
// carries the full definition (announced on focus), with a Radix tooltip shown
// on hover/focus — keyboard, screen-reader, mouse and touch (focus) accessible.

import { Info } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';

export function MetricInfo({ label, description }: { label: string; description: string }) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={`${label}: ${description}`}
            className="inline-flex items-center justify-center rounded-full p-0.5 text-muted-foreground/70 transition-colors hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Info className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </TooltipTrigger>
        <TooltipContent role="tooltip" className="max-w-xs text-xs leading-snug">
          {description}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
