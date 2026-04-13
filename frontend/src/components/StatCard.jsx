import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { cn } from '../lib/utils';

export function StatCard({ title, value, subtitle, icon: Icon, tone = 'default' }) {
  const toneCls =
    tone === 'earned'
      ? 'text-emerald-600'
      : tone === 'paid'
        ? 'text-blue-600'
        : tone === 'balance-owed'
          ? 'text-rose-600'
          : tone === 'balance-ok'
            ? 'text-emerald-600'
            : tone === 'overpaid'
              ? 'text-amber-600'
              : 'text-slate-900';

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-slate-500">{title}</CardTitle>
        {Icon && <Icon className={cn('h-5 w-5 text-slate-400', toneCls)} />}
      </CardHeader>
      <CardContent>
        <div className={cn('text-3xl font-bold', toneCls)}>{value}</div>
        {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}
