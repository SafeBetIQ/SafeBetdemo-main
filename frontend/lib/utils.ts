import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPercentage(value: number, maxDecimals: number = 3): string {
  const rounded = Number(value.toFixed(maxDecimals));
  const formatted = rounded.toString();
  return `${formatted}%`;
}
