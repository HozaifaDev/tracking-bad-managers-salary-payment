import { cn } from '../lib/utils';

export function StatCard({ title, value, subtitle, icon: Icon, tone = 'default' }) {
  const valueClass = {
    earned: 'text-success',
    paid: 'text-accent',
    'balance-owed': 'text-danger',
    'balance-ok': 'text-success',
    overpaid: 'text-warning',
    default: 'text-txt-primary',
  }[tone];

  return (
    <div className="rounded-lg border border-border bg-surface-elevated px-6 py-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium uppercase tracking-wide text-txt-tertiary">{title}</span>
        {Icon && <Icon className={cn('h-4 w-4', valueClass)} />}
      </div>
      <div className={cn('text-3xl font-bold tabular-nums tracking-tight', valueClass)}>{value}</div>
      {subtitle && <p className="mt-1.5 text-xs text-txt-tertiary">{subtitle}</p>}
    </div>
  );
}