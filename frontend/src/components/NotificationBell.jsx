import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bell, AlertTriangle, X } from 'lucide-react';
import { cn, formatCurrency } from '../lib/utils';
import { getOverdueNotifications } from '../lib/api';
import { useClient } from '../context/ClientContext';

export function NotificationBell() {
  const { selectedClientId } = useClient();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const { data, isLoading } = useQuery({
    queryKey: ['overdue', selectedClientId],
    queryFn: () => getOverdueNotifications(selectedClientId),
    staleTime: 60_000,
  });

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const hasOverdue = data?.hasOverdue ?? false;
  const overdueCount = data?.overdueCount ?? 0;
  const totalOwed = data?.totalOwed ?? 0;
  const cycles = data?.cycles ?? [];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs transition-colors',
          hasOverdue
            ? 'text-danger-bright hover:bg-danger-bg'
            : 'text-txt-secondary hover:bg-surface-elevated-hover hover:text-txt-primary',
        )}
      >
        <div className="relative">
          <Bell className="h-3.5 w-3.5" />
          {overdueCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-danger text-[8px] font-bold text-white">
              {overdueCount > 9 ? '9+' : overdueCount}
            </span>
          )}
        </div>
        <span>Notifications</span>
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-2 w-72 rounded-lg border border-border bg-surface-elevated shadow-xl z-50">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <h3 className="text-xs font-semibold text-txt-primary">Overdue Cycles</h3>
            <button onClick={() => setOpen(false)} className="text-txt-secondary hover:text-txt-primary">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="max-h-64 overflow-y-auto">
            {isLoading && (
              <div className="px-3 py-4 text-center text-xs text-txt-tertiary">Loading...</div>
            )}

            {!isLoading && !hasOverdue && (
              <div className="px-3 py-4 text-center">
                <Bell className="mx-auto h-6 w-6 text-success-bright mb-1" />
                <p className="text-xs text-txt-tertiary">All cycles are up to date</p>
              </div>
            )}

            {hasOverdue && (
              <div className="space-y-0">
                {cycles.map((c) => (
                  <div
                    key={c.salaryMonth}
                    className="flex items-start gap-2 border-b border-border px-3 py-2 last:border-b-0"
                  >
                    <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-warning-bright" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-txt-primary">{c.salaryMonth}</p>
                      <p className="text-[10px] text-txt-tertiary">
                        {c.cyclePeriod} &middot; {c.daysOverdue} day{c.daysOverdue !== 1 ? 's' : ''} overdue
                      </p>
                      <p className="text-xs font-semibold text-danger-bright">
                        {formatCurrency(c.runningBalance)} owed
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {hasOverdue && (
            <div className="border-t border-border px-3 py-2">
              <p className="text-xs text-txt-secondary">
                Total overdue:{' '}
                <span className="font-semibold text-danger-bright">{formatCurrency(totalOwed)}</span>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}