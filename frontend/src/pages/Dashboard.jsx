import { useQuery } from '@tanstack/react-query';
import { TrendingUp, Wallet, Scale, AlertTriangle } from 'lucide-react';
import {
  Bar, BarChart, CartesianGrid, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis, Legend,
} from 'recharts';
import { StatCard } from '../components/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import { Link } from 'react-router-dom';
import { getMonthlyBreakdown, getSessions, getSummary } from '../lib/api';
import { formatCurrency, formatDateUi, formatDurationHours } from '../lib/utils';
import { useClient } from '../context/ClientContext';

export function Dashboard() {
  const { selectedClientId } = useClient();

  const qSummary = useQuery({
    queryKey: ['summary', selectedClientId],
    queryFn: () => getSummary(selectedClientId),
  });
  const qMonthly = useQuery({
    queryKey: ['monthly', selectedClientId],
    queryFn: () => getMonthlyBreakdown(selectedClientId),
  });
  const qRecent = useQuery({
    queryKey: ['sessions', 'recent', selectedClientId],
    queryFn: () => getSessions({ page: 1, sortBy: 'date', sortDir: 'desc', clientId: selectedClientId }),
  });

  const s = qSummary.data;
  const monthly = qMonthly.data || [];
  const recent = qRecent.isSuccess ? (qRecent.data?.data || []).slice(0, 10) : [];

  const barData = monthly.map((m) => ({ name: m.salaryMonth, earned: m.expectedEarnings }));
  const lineData = monthly.map((m) => ({ name: m.salaryMonth, earned: m.cumulativeEarned, paid: m.cumulativePaid }));

  const balanceTone = !s ? 'default' : s.balance > 0 ? 'balance-owed' : s.balance < 0 ? 'overpaid' : 'balance-ok';
  const balanceLabel = !s ? '' : s.balance > 0 ? 'You are owed' : s.balance < 0 ? 'Overpaid by' : 'Balanced';

  if (qSummary.isLoading) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-10 w-40" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-64" />
          <div className="flex gap-8 mt-2">
            <Skeleton className="h-10 w-36" />
            <Skeleton className="h-10 w-36" />
          </div>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  if (qSummary.isError || !s) {
    return (
      <div className="space-y-8">
        <h1 className="text-2xl font-bold text-txt-primary">Dashboard</h1>
        <div className="rounded-lg border border-danger bg-danger-bg p-4">
          <p className="font-semibold text-danger">Failed to load dashboard data</p>
          <p className="mt-1 text-sm text-txt-secondary">
            {qSummary.error?.response?.data?.error || qSummary.error?.message || 'An unexpected error occurred.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-txt-primary">Dashboard</h1>
        <p className="mt-1 text-sm text-txt-secondary">Earnings, payments, and recent sessions.</p>
      </div>

      <section className="space-y-8">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-txt-tertiary">{balanceLabel}</p>
          <div className={
            balanceTone === 'balance-owed'
              ? 'text-5xl font-bold tabular-nums tracking-tight text-danger'
              : balanceTone === 'balance-ok'
                ? 'text-5xl font-bold tabular-nums tracking-tight text-success'
                : balanceTone === 'overpaid'
                  ? 'text-5xl font-bold tabular-nums tracking-tight text-warning'
                  : 'text-5xl font-bold tabular-nums tracking-tight text-txt-primary'
          }>
            {formatCurrency(s.balance)}
          </div>
          <div className="flex gap-8 mt-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-txt-tertiary">Earned</p>
              <p className="text-lg font-semibold tabular-nums text-success">{formatCurrency(s.totalEarned)}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-txt-tertiary">Received</p>
              <p className="text-lg font-semibold tabular-nums text-accent-bright">{formatCurrency(s.totalPaid)}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-txt-tertiary">Sessions</p>
              <p className="text-lg font-semibold tabular-nums text-txt-primary">
                {s.totalSessions} <span className="text-sm font-normal text-txt-tertiary">&middot; {formatDurationHours(s.totalHours)}</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Monthly expected earnings</CardTitle></CardHeader>
          <CardContent className="h-72">
            {barData.length === 0 ? (
              <p className="text-sm text-txt-tertiary">No session data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border-default))" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--text-tertiary))' }} />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--text-tertiary))' }} />
                  <Tooltip formatter={(v) => formatCurrency(v)} />
                  <Bar dataKey="earned" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Cumulative earned vs paid</CardTitle></CardHeader>
          <CardContent className="h-72">
            {lineData.length === 0 ? (
              <p className="text-sm text-txt-tertiary">No data for chart.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={lineData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border-default))" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--text-tertiary))' }} />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--text-tertiary))' }} />
                  <Tooltip formatter={(v) => formatCurrency(v)} />
                  <Legend />
                  <Line type="monotone" dataKey="earned" stroke="hsl(var(--success))" strokeWidth={2} dot={false} name="Earned" />
                  <Line type="monotone" dataKey="paid" stroke="hsl(var(--accent-bright))" strokeWidth={2} dot={false} name="Paid" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </section>

      <section>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent sessions</CardTitle>
            <Button variant="outline" size="sm" asChild><Link to="/sessions">View all</Link></Button>
          </CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <p className="py-8 text-center text-sm text-txt-tertiary">No sessions yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Hours</TableHead>
                    <TableHead>Earnings</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recent.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{formatDateUi(row.date)}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{row.title}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {row.flagged && <AlertTriangle className="h-3.5 w-3.5 text-warning" />}
                          <Badge variant={row.flagged ? 'warning' : 'muted'}>{row.category}</Badge>
                        </div>
                      </TableCell>
                      <TableCell className="tabular-nums">{formatDurationHours(row.durationHours)}</TableCell>
                      <TableCell className="tabular-nums">{formatCurrency(row.earnings)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}