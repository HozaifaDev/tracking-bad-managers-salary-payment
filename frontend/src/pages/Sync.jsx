import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { RefreshCw, CheckCircle2, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { DateField } from '../components/DateField';
import { Badge } from '../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { syncCalendar, getSyncLog, getCalendarStatus, getConfig } from '../lib/api';
import { getDefaultSyncRange } from '../lib/utils';

export function Sync() {
  const qc = useQueryClient();
  const { data: status } = useQuery({ queryKey: ['calendar-status'], queryFn: getCalendarStatus });
  const { data: config } = useQuery({ queryKey: ['config'], queryFn: getConfig });
  const { data: log } = useQuery({ queryKey: ['sync-log'], queryFn: getSyncLog });

  const startDay = config?.work_cycle_start_day ?? 25;
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  useEffect(() => {
    if (config) {
      const r = getDefaultSyncRange(startDay);
      setFrom((f) => f || r.from);
      setTo((t) => t || r.to);
    }
  }, [config, startDay]);

  const [lastResult, setLastResult] = useState(null);

  const mut = useMutation({
    mutationFn: () => syncCalendar({ from, to }),
    onSuccess: (data) => {
      setLastResult(data);
      qc.invalidateQueries({ queryKey: ['sessions'] });
      qc.invalidateQueries({ queryKey: ['summary'] });
      qc.invalidateQueries({ queryKey: ['monthly'] });
      qc.invalidateQueries({ queryKey: ['sync-log'] });
      qc.invalidateQueries({ queryKey: ['calendar-status'] });
      toast.success(`Sync complete: ${data.new} new sessions`);
    },
    onError: (e) => {
      toast.error(e.response?.data?.error || e.message);
      qc.invalidateQueries({ queryKey: ['sync-log'] });
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Google Calendar sync</h1>
        <p className="text-sm text-slate-500">Pull timed events from your primary calendar into SQLite (no duplicates).</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Google auth status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex gap-4">
            <span className="text-slate-600">credentials.json</span>
            {status?.hasCredentials ? (
              <Badge variant="success">Found</Badge>
            ) : (
              <Badge variant="warning">Missing — add to backend/</Badge>
            )}
          </div>
          <div className="flex gap-4">
            <span className="text-slate-600">token.json</span>
            {status?.hasToken ? (
              <Badge variant="success">Connected</Badge>
            ) : (
              <Badge variant="warning">Not connected</Badge>
            )}
          </div>
          {!status?.hasToken && (
            <p className="rounded-md bg-amber-50 p-3 text-amber-900">
              From the repo root run: <code className="rounded bg-white px-1">cd backend && npm run auth</code>
              <br />
              Open the printed URL, approve access, paste the code into the terminal. Then restart or refresh this page.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sync range</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
          <DateField label="From" value={from} onChange={setFrom} />
          <DateField label="To" value={to} onChange={setTo} />
          <Button size="lg" onClick={() => mut.mutate()} disabled={mut.isPending || !from || !to}>
            {mut.isPending ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Syncing…
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" /> Sync now
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {lastResult && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Last sync result</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <div>Events fetched: {lastResult.fetched}</div>
            <div>New sessions: {lastResult.new}</div>
            <div>Skipped (already in DB): {lastResult.skipped}</div>
            <div>Flagged titles: {lastResult.flagged}</div>
            {lastResult.flaggedTitles?.length > 0 && (
              <ul className="list-inside list-disc text-amber-800">
                {lastResult.flaggedTitles.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sync history</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Range</TableHead>
                <TableHead>Fetched</TableHead>
                <TableHead>New</TableHead>
                <TableHead>Skipped</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Error</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(log || []).map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="whitespace-nowrap text-xs">{row.syncedAt}</TableCell>
                  <TableCell className="text-xs">
                    {row.rangeFrom} → {row.rangeTo}
                  </TableCell>
                  <TableCell>{row.eventsFetched}</TableCell>
                  <TableCell>{row.newSessions}</TableCell>
                  <TableCell>{row.skipped}</TableCell>
                  <TableCell>
                    {row.status === 'success' ? (
                      <Badge variant="success" className="gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Success
                      </Badge>
                    ) : (
                      <Badge variant="warning" className="gap-1">
                        <XCircle className="h-3 w-3" /> Error
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-xs text-rose-600">{row.errorMessage}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {(!log || log.length === 0) && <p className="py-6 text-center text-sm text-slate-500">No syncs yet.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
