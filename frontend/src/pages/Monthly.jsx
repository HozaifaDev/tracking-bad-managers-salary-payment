import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Skeleton } from '../components/ui/skeleton';
import { getMonthlyBreakdown, getExportUrl } from '../lib/api';
import { formatCurrency } from '../lib/utils';

export function Monthly() {
  const { data, isLoading } = useQuery({ queryKey: ['monthly'], queryFn: getMonthlyBreakdown });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Monthly breakdown</h1>
        <p className="text-sm text-slate-500">Per salary cycle: expected earnings and running balance vs payments.</p>
      </div>

      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Salary months</CardTitle>
            <Button variant="outline" size="sm" asChild>
              <a href={getExportUrl()} download>
                <Download className="mr-2 inline h-4 w-4" />
                Download Excel report
              </a>
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Salary month</TableHead>
                  <TableHead>Cycle period</TableHead>
                  <TableHead>Sessions</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>Expected</TableHead>
                  <TableHead>Cum. earned</TableHead>
                  <TableHead>Cum. paid</TableHead>
                  <TableHead>Running balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data || []).map((m) => (
                  <TableRow key={m.salaryMonth}>
                    <TableCell className="font-medium">{m.salaryMonth}</TableCell>
                    <TableCell className="text-xs text-slate-600">{m.cyclePeriod}</TableCell>
                    <TableCell>{m.sessionsCount}</TableCell>
                    <TableCell>{m.totalHours.toFixed(2)}</TableCell>
                    <TableCell>{formatCurrency(m.expectedEarnings)}</TableCell>
                    <TableCell>{formatCurrency(m.cumulativeEarned)}</TableCell>
                    <TableCell>{formatCurrency(m.cumulativePaid)}</TableCell>
                    <TableCell className={m.runningBalance > 0 ? 'font-semibold text-rose-600' : ''}>
                      {formatCurrency(m.runningBalance)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {(!data || data.length === 0) && (
              <p className="py-8 text-center text-sm text-slate-500">No session months yet.</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
