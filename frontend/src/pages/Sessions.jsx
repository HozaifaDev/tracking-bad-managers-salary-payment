import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, Trash2, AlertTriangle, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Skeleton } from '../components/ui/skeleton';
import { getSessions, createSession, updateSession, deleteSession } from '../lib/api';
import { formatCurrency, formatDateUi, formatDurationHours } from '../lib/utils';
import { useClient } from '../context/ClientContext';

export function Sessions() {
  const qc = useQueryClient();
  const { selectedClientId, selectedClient } = useClient();

  const workTypes = selectedClient?.config?.work_types || [];

  const [page, setPage] = useState(1);
  const [category, setCategory] = useState('');
  const [salaryMonth, setSalaryMonth] = useState('');
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [sortDir, setSortDir] = useState('desc');

  const [editRow, setEditRow] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    date: '', workTypeName: '', title: '', durationHours: '1.5', isComplete: false,
  });

  const params = useMemo(
    () => ({
      page,
      clientId: selectedClientId,
      category: category || undefined,
      salaryMonth: salaryMonth || undefined,
      flagged: flaggedOnly ? '1' : undefined,
      from: from || undefined,
      to: to || undefined,
      search: search || undefined,
      sortBy,
      sortDir,
    }),
    [page, selectedClientId, category, salaryMonth, flaggedOnly, from, to, search, sortBy, sortDir],
  );

  const { data, isLoading } = useQuery({
    queryKey: ['sessions', params],
    queryFn: () => getSessions(params),
  });

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['sessions'] });
    qc.invalidateQueries({ queryKey: ['summary', selectedClientId] });
    qc.invalidateQueries({ queryKey: ['monthly', selectedClientId] });
  }

  const mutUpdate = useMutation({
    mutationFn: ({ id, body }) => updateSession(id, body),
    onSuccess: () => { invalidate(); toast.success('Session updated'); setEditRow(null); },
    onError: (e) => toast.error(e.response?.data?.error || e.message),
  });

  const mutCreate = useMutation({
    mutationFn: (body) => createSession(body),
    onSuccess: () => { invalidate(); toast.success('Session added'); setAddOpen(false); },
    onError: (e) => toast.error(e.response?.data?.error || e.message),
  });

  const mutDelete = useMutation({
    mutationFn: deleteSession,
    onSuccess: () => { invalidate(); toast.success('Session deleted'); },
    onError: (e) => toast.error(e.response?.data?.error || e.message),
  });

  const rows = data?.data || [];
  const ft = data?.filterTotals;

  function getEarningsTooltip(row) {
    const wt = workTypes.find((w) => w.name === row.category);
    if (!wt) return `${formatCurrency(row.earnings)}`;
    switch (wt.rate_type) {
      case 'hourly': return `${formatDurationHours(row.durationHours)} × ${formatCurrency(wt.rate)}/hr = ${formatCurrency(row.earnings)}`;
      case 'per_session': return `${formatCurrency(wt.rate)} flat per session = ${formatCurrency(row.earnings)}`;
      case 'milestone': return row.isMilestoneComplete ? `Milestone complete: ${formatCurrency(wt.rate)}` : `Milestone pending (${formatCurrency(wt.rate)} on complete)`;
      default: return `${formatCurrency(row.earnings)}`;
    }
  }

  function openEdit(row) {
    setEditRow(row);
    setEditForm({ earnings: row.earnings, note: row.note || '', category: row.category, rateApplied: row.rateApplied, flagged: row.flagged });
  }

  function toggleSort(col) {
    if (sortBy === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortBy(col); setSortDir('asc'); }
  }

  function openAddDialog() {
    const today = new Date().toISOString().slice(0, 10);
    const defaultWorkType = workTypes[0]?.name || '';
    setAddForm({ date: today, workTypeName: defaultWorkType, title: '', durationHours: '1.5', isComplete: false });
    setAddOpen(true);
  }

  // Compute preview earnings for the add dialog
  const previewEarnings = useMemo(() => {
    const wt = workTypes.find((w) => w.name === addForm.workTypeName);
    if (!wt) return null;
    const dur = Number(addForm.durationHours) || 0;
    const complete = addForm.isComplete;
    switch (wt.rate_type) {
      case 'hourly':      return dur * (wt.rate || 0);
      case 'per_session': return wt.rate || 0;
      case 'milestone':   return complete ? (wt.rate || 0) : 0;
      default:            return 0;
    }
  }, [addForm.workTypeName, addForm.durationHours, addForm.isComplete, workTypes]);

  const selectedWorkType = workTypes.find((w) => w.name === addForm.workTypeName);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Sessions</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Work sessions — synced from calendar, imported via .ics, or added manually.</p>
        </div>
        <Button onClick={openAddDialog}><Plus className="mr-2 h-4 w-4" />Add session</Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Filters</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label>From</Label>
            <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
          </div>
          <div>
            <Label>To</Label>
            <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
          </div>
          <div>
            <Label>Category / Work type</Label>
            {workTypes.length > 0 ? (
              <select
                className="flex h-9 w-full rounded-md border border-input bg-surface-elevated px-3 py-1 text-sm shadow-sm dark:text-txt-primary"
                value={category}
                onChange={(e) => { setCategory(e.target.value); setPage(1); }}
              >
                <option value="">All</option>
                {workTypes.map((wt) => <option key={wt.name} value={wt.name}>{wt.name}</option>)}
                <option value="Uncategorized">Uncategorized</option>
              </select>
            ) : (
              <Input placeholder="e.g. Group A" value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }} />
            )}
          </div>
          <div>
            <Label>Salary month</Label>
            <Input placeholder="December 2024" value={salaryMonth} onChange={(e) => { setSalaryMonth(e.target.value); setPage(1); }} />
          </div>
          <div className="md:col-span-2">
            <Label>Search title</Label>
            <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Contains…" />
          </div>
          <div className="flex items-end gap-2">
            <input type="checkbox" id="flg" checked={flaggedOnly} onChange={(e) => { setFlaggedOnly(e.target.checked); setPage(1); }} />
            <Label htmlFor="flg">Flagged only</Label>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="cursor-pointer" onClick={() => toggleSort('date')}>
                    Date {sortBy === 'date' && (sortDir === 'asc' ? '↑' : '↓')}
                  </TableHead>
                  <TableHead>Day</TableHead>
                  <TableHead className="cursor-pointer" onClick={() => toggleSort('salary_month')}>Salary month</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead className="cursor-pointer" onClick={() => toggleSort('category')}>Work type</TableHead>
                  <TableHead className="cursor-pointer" onClick={() => toggleSort('duration_hours')}>Hrs</TableHead>
                  <TableHead className="cursor-pointer" onClick={() => toggleSort('earnings')}>Earnings</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id} className={row.flagged ? 'border-l-4 border-l-amber-400 bg-amber-50/30 dark:bg-amber-950/30' : ''}>
                    <TableCell>{formatDateUi(row.date)}</TableCell>
                    <TableCell>{row.dayOfWeek}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs">{row.salaryMonth}</TableCell>
                    <TableCell className="max-w-[180px] truncate text-xs" title={row.title}>{row.title}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {row.flagged && <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
                        <Badge variant="muted">{row.category}</Badge>
                      </div>
                    </TableCell>
                    <TableCell>{formatDurationHours(row.durationHours)}</TableCell>
                    <TableCell className="font-medium" title={getEarningsTooltip(row)}>{formatCurrency(row.earnings)}</TableCell>
                    <TableCell className="max-w-[120px] truncate text-xs">{row.note}</TableCell>
                    <TableCell className="space-x-1 whitespace-nowrap">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(row)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-rose-600"
                        onClick={() => { if (confirm('Delete this session?')) mutDelete.mutate(row.id); }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-700 pt-4 text-sm">
              <div className="text-slate-600 dark:text-slate-400">
                Page {data.page} / {data.totalPages} · Filter totals: {formatDurationHours(ft?.totalHours || 0)} · {formatCurrency(ft?.totalEarnings || 0)}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                <Button variant="outline" size="sm" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add session dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add session</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <div>
              <Label>Date</Label>
              <Input type="date" value={addForm.date} onChange={(e) => setAddForm({ ...addForm, date: e.target.value })} />
            </div>

            {workTypes.length > 0 ? (
              <div>
                <Label>Work type</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-surface-elevated px-3 py-1 text-sm shadow-sm dark:text-txt-primary"
                  value={addForm.workTypeName}
                  onChange={(e) => setAddForm({ ...addForm, workTypeName: e.target.value, isComplete: false })}
                >
                  <option value="">— Select —</option>
                  {workTypes.map((wt) => (
                    <option key={wt.name} value={wt.name}>
                      {wt.name} ({wt.rate_type === 'hourly' ? `${wt.rate}/hr` : wt.rate_type === 'per_session' ? `${wt.rate} flat` : `${wt.rate} on complete`})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <Label>Title</Label>
                <Input
                  value={addForm.title}
                  onChange={(e) => setAddForm({ ...addForm, title: e.target.value })}
                  placeholder="e.g. Group A - Topic"
                />
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Title rules match calendar sync. Add work types in Clients → Edit.</p>
              </div>
            )}

            {workTypes.length > 0 && (
              <div>
                <Label>Description (optional)</Label>
                <Input
                  value={addForm.title}
                  onChange={(e) => setAddForm({ ...addForm, title: e.target.value })}
                  placeholder="e.g. Session topic or notes"
                />
              </div>
            )}

            <div>
              <Label>Duration (hours)</Label>
              <Input type="number" step="0.25" min="0.25" max="168"
                value={addForm.durationHours}
                onChange={(e) => setAddForm({ ...addForm, durationHours: e.target.value })}
              />
            </div>

            {selectedWorkType?.rate_type === 'milestone' && (
              <div className="flex items-center gap-2">
                <input type="checkbox" id="isComplete" checked={addForm.isComplete}
                  onChange={(e) => setAddForm({ ...addForm, isComplete: e.target.checked })} />
                <Label htmlFor="isComplete">Mark as complete (triggers payout)</Label>
              </div>
            )}

            {previewEarnings !== null && (
              <div className="rounded-md bg-indigo-50 dark:bg-indigo-950 px-3 py-2 text-sm">
                <span className="text-slate-600 dark:text-slate-400">Estimated earnings: </span>
                <span className="font-semibold text-indigo-700 dark:text-indigo-300">{formatCurrency(previewEarnings)}</span>
              </div>
            )}

            <Button
              disabled={mutCreate.isPending || (!addForm.workTypeName && !addForm.title)}
              onClick={() => mutCreate.mutate({
                date: addForm.date,
                title: addForm.workTypeName || addForm.title,
                workTypeName: addForm.workTypeName || undefined,
                note: workTypes.length > 0 && addForm.title ? addForm.title : undefined,
                durationHours: Number(addForm.durationHours),
                isComplete: addForm.isComplete,
                clientId: selectedClientId,
              })}
            >
              {mutCreate.isPending ? 'Saving…' : 'Save session'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit session dialog */}
      <Dialog open={!!editRow} onOpenChange={() => setEditRow(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit session</DialogTitle></DialogHeader>
          {editRow && (
            <div className="grid gap-3 py-2">
              <div>
                <Label>Earnings</Label>
                <Input type="number" value={editForm.earnings}
                  onChange={(e) => setEditForm({ ...editForm, earnings: e.target.value })} />
              </div>
              <div>
                <Label>Rate applied</Label>
                <Input type="number" value={editForm.rateApplied}
                  onChange={(e) => setEditForm({ ...editForm, rateApplied: e.target.value })} />
              </div>
              <div>
                <Label>Work type / Category</Label>
                {workTypes.length > 0 ? (
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-surface-elevated px-3 py-1 text-sm shadow-sm dark:text-txt-primary"
                    value={editForm.category}
                    onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                  >
                    {workTypes.map((wt) => <option key={wt.name} value={wt.name}>{wt.name}</option>)}
                    <option value="Uncategorized">Uncategorized</option>
                  </select>
                ) : (
                  <Input value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })} />
                )}
              </div>
              <div>
                <Label>Note</Label>
                <Input value={editForm.note} onChange={(e) => setEditForm({ ...editForm, note: e.target.value })} />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={!!editForm.flagged}
                  onChange={(e) => setEditForm({ ...editForm, flagged: e.target.checked })} id="ef" />
                <Label htmlFor="ef">Flagged</Label>
              </div>
              <Button onClick={() => mutUpdate.mutate({
                id: editRow.id,
                body: { earnings: Number(editForm.earnings), rateApplied: Number(editForm.rateApplied), category: editForm.category, note: editForm.note, flagged: editForm.flagged },
              })}>
                Save
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
