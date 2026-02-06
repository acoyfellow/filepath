import type { AgentSlot } from '$lib/types/session';

export const statusColors: Record<AgentSlot['status'], string> = {
  pending: 'bg-neutral-500',
  starting: 'bg-amber-500 animate-pulse',
  running: 'bg-emerald-500',
  stopped: 'bg-neutral-600',
  error: 'bg-red-500',
};

export function getStatusColor(status: AgentSlot['status']): string {
  return statusColors[status] ?? 'bg-neutral-500';
}
