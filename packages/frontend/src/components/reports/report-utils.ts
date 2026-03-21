import type { ActionItem } from '@vitals/shared';

export const priorityColor: Record<ActionItem['priority'], string> = {
  high: 'border-l-red-500',
  medium: 'border-l-amber-500',
  low: 'border-l-blue-500',
};

export const priorityVariant: Record<
  ActionItem['priority'],
  'destructive' | 'secondary' | 'outline'
> = {
  high: 'destructive',
  medium: 'secondary',
  low: 'outline',
};

export function scoreColor(score: number) {
  if (score >= 7) return 'bg-green-500/15 text-green-500';
  if (score >= 5) return 'bg-amber-500/15 text-amber-500';
  return 'bg-red-500/15 text-red-500';
}

export function scoreRingColor(score: number) {
  if (score >= 7) return 'text-green-500';
  if (score >= 5) return 'text-amber-500';
  return 'text-red-500';
}

export function extractBullets(markdown: string, max: number): string[] {
  return markdown
    .split('\n')
    .filter((line) => /^[-*]\s/.test(line.trim()))
    .slice(0, max)
    .map((line) => line.trim().replace(/^[-*]\s+/, ''));
}
