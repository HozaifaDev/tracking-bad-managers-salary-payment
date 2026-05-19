import { useQuery } from '@tanstack/react-query';
import { Download, FileWarning } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Skeleton } from '../components/ui/skeleton';
import { useState } from 'react';
import { getMonthlyBreakdown, downloadInvoice, downloadExcel, downloadDemandLetter } from '../lib/api';
import { formatCurrency } from '../lib/utils';
import { useClient } from '../context/ClientContext';
import { ProGate } from '../components/ProGate';
import { toast } from 'sonner';

export function Monthly() {
  const { selectedClientId } = useClient();
  const { data, isLoading } = useQuery({
    queryKey: ['monthly', selectedClientId],
    queryFn: () => getMonthlyBreakdown(selectedClientId),
  });
  const [downloading, setDownloading] = useState(null);
  const [demandLoading, setDemandLoading] = useState(false);

  const overdueCount = (data || []).filter((m) => m.runningBalance > 0).length;

  async function handleDownloadInvoice(salaryMonth) {
    setDownloading(salaryMonth);
    try { await downloadInvoice(salaryMonth, selectedClientId); }
    catch (e) { console.error(e); }
    finally { setDownloading(null); }
  }

  async function handleDemandLetter() {
    setDemandLoading(true);
    try {
      await downloadDemandLetter(selectedClientId);
    } catch (e) {
      const msg = e.response?.data
        ? await e.response.data.text().catch(() => e.message)
        : e.message;
      toast.error(msg.includes('No overdue') ? 'No overdue cycles — nothing to dispute.' : 'Failed to generate demand letter.');
    } finally {
      setDemandLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Monthly breakdown</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Per salary cycle: expected earnings and running balance vs payments.</p>
      </div>

      <ProGate feature="Monthly breakdown">
      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
            <CardTitle>Salary months</CardTitle>
            <div className="flex flex-wrap gap-2">
              {overdueCount > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={demandLoading}
                  onClick={handleDemandLetter}
                >
                  <FileWarning className="mr-2 h-4 w-4" />
                  {demandLoading ? 'Generating…' : `Demand Letter (${overdueCount} overdue)`}
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => downloadExcel(selectedClientId)}>
                <Download className="mr-2 h-4 w-4" />
                Excel report
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
<TableHeader>
                    <TableRow>
                      <TableHead>Salary month</TableHead>
                      <TableHead>Cycle period</TableHead>
                      <TableHead>Payment due</TableHead>
                      <TableHead>Sessions</TableHead>
                      <TableHead>Hours</TableHead>
                      <TableHead>Expected</TableHead>
                      <TableHead>Cum. earned</TableHead>
                      <TableHead>Cum. paid</TableHead>
                      <TableHead>Running balance</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
              <TableBody>
                {(data || []).map((m) => (
                  <TableRow
                    key={m.salaryMonth}
                    className={m.runningBalance > 0 ? 'border-l-4 border-l-rose-400 bg-rose-50/30 dark:bg-rose-950/30' : ''}
                  >
                    <TableCell className="font-medium">{m.salaryLabel || m.salaryMonth}</TableCell>
                    <TableCell className="text-xs text-slate-600 dark:text-slate-400">{m.cyclePeriod}</TableCell>
                    <TableCell className="text-xs text-slate-600 dark:text-slate-400">{m.paymentDueLabel || '–'}</TableCell>
                    <TableCell>{m.sessionsCount}</TableCell>
                    <TableCell>{m.totalHours.toFixed(2)}</TableCell>
                    <TableCell>{formatCurrency(m.expectedEarnings)}</TableCell>
                    <TableCell>{formatCurrency(m.cumulativeEarned)}</TableCell>
                    <TableCell>{formatCurrency(m.cumulativePaid)}</TableCell>
                    <TableCell className={m.runningBalance > 0 ? 'font-semibold text-rose-600' : ''}>
                      {formatCurrency(m.runningBalance)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={downloading === m.salaryMonth}
                        onClick={() => handleDownloadInvoice(m.salaryMonth)}
                        title="Download invoice"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {(!data || data.length === 0) && (
              <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">No session months yet.</p>
            )}
          </CardContent>
        </Card>
      )}
      </ProGate>
    </div>
  );
}
