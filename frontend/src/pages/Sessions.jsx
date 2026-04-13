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

export function Sessions() {
  const qc = useQueryClient();
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
  const [addForm, setAddForm] = useState({ date: '', title: '', durationHours: '1.5' });

  const params = useMemo(
    () => ({
      page,
      category: category || undefined,
      salaryMonth: salaryMonth || undefined,
      flagged: flaggedOnly ? '1' : undefined,
      from: from || undefined,
      to: to || undefined,
      search: search || undefined,
      sortBy,
      sortDir,
    }),
    [page, category, salaryMonth, flaggedOnly, from, to, search, sortBy, sortDir],
  );

  const { data, isLoading } = useQuery({ queryKey: ['sessions', params], queryFn: () => getSessions(params) });

  const mutUpdate = useMutation({
    mutationFn: ({ id, body }) => updateSession(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sessions'] });
      qc.invalidateQueries({ queryKey: ['summary'] });
      qc.invalidateQueries({ queryKey: ['monthly'] });
      toast.success('Session updated');
      setEditRow(null);
    },
    onError: (e) => toast.error(e.response?.data?.error || e.message),
  });

  const mutCreate = useMutation({
    mutationFn: (body) => createSession(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sessions'] });
      qc.invalidateQueries({ queryKey: ['summary'] });
      qc.invalidateQueries({ queryKey: ['monthly'] });
      toast.success('Session added');
      setAddOpen(false);
    },
    onError: (e) => toast.error(e.response?.data?.error || e.message),
  });

  const mutDelete = useMutation({
    mutationFn: deleteSession,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sessions'] });
      qc.invalidateQueries({ queryKey: ['summary'] });
      qc.invalidateQueries({ queryKey: ['monthly'] });
      toast.success('Session deleted');
    },
    onError: (e) => toast.error(e.response?.data?.error || e.message),
  });

  const rows = data?.data || [];
  const ft = data?.filterTotals;

  function openEdit(row) {
    setEditRow(row);
    setEditForm({
      earnings: row.earnings,
      note: row.note || '',
      category: row.category,
      rateApplied: row.rateApplied,
      flagged: row.flagged,
    });
  }

  function toggleSort(col) {
    if (sortBy === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortBy(col);
      setSortDir('asc');
    }
  }

  function openAddDialog() {
    const today = new Date().toISOString().slice(0, 10);
    setAddForm({ date: today, title: '', durationHours: '1.5' });
    setAddOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Sessions</h1>
          <p className="text-sm text-slate-500">Teaching sessions from calendar sync, .ics import, or manual entry.</p>
        </div>
        <Button onClick={openAddDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Add session
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
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
            <Label>Category</Label>
            <Input placeholder="e.g. Group A" value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }} />
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
                  <TableHead className="cursor-pointer" onClick={() => toggleSort('salary_month')}>
                    Salary month
                  </TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead className="cursor-pointer" onClick={() => toggleSort('category')}>
                    Category
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => toggleSort('duration_hours')}>
                    Hrs
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => toggleSort('rate_applied')}>
                    Rate
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => toggleSort('earnings')}>
                    Earnings
                  </TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id} className={row.flagged ? 'border-l-4 border-l-amber-400 bg-amber-50/30' : ''}>
                    <TableCell>{formatDateUi(row.date)}</TableCell>
                    <TableCell>{row.dayOfWeek}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs">{row.salaryMonth}</TableCell>
                    <TableCell className="max-w-[180px] truncate text-xs" title={row.title}>
                      {row.title}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {row.flagged && <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
                        <Badge variant="muted">{row.category}</Badge>
                      </div>
                    </TableCell>
                    <TableCell>{formatDurationHours(row.durationHours)}</TableCell>
                    <TableCell>{formatCurrency(row.rateApplied)}</TableCell>
                    <TableCell className="font-medium">{formatCurrency(row.earnings)}</TableCell>
                    <TableCell className="max-w-[120px] truncate text-xs">{row.note}</TableCell>
                    <TableCell className="space-x-1 whitespace-nowrap">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(row)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-rose-600"
                        onClick={() => {
                          if (confirm('Delete this session?')) mutDelete.mutate(row.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4 text-sm">
              <div className="text-slate-600">
                Page {data.page} / {data.totalPages} · Filter totals: {formatDurationHours(ft?.totalHours || 0)} ·{' '}
                {formatCurrency(ft?.totalEarnings || 0)}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <Button variant="outline" size="sm" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog
        open={addOpen}
        onOpenChange={(o) => {
          setAddOpen(o);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add session</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <p className="text-xs text-slate-500">
              Start time is fixed at 09:00 in your configured timezone (Settings). Title rules match calendar sync
              (groups, private courses, diplomas).
            </p>
            <div>
              <Label>Date</Label>
              <Input type="date" value={addForm.date} onChange={(e) => setAddForm({ ...addForm, date: e.target.value })} />
            </div>
            <div>
              <Label>Title</Label>
              <Input
                value={addForm.title}
                onChange={(e) => setAddForm({ ...addForm, title: e.target.value })}
                placeholder="e.g. Group A - Topic"
              />
            </div>
            <div>
              <Label>Duration (hours)</Label>
              <Input
                type="number"
                step="0.25"
                min="0.25"
                max="168"
                value={addForm.durationHours}
                onChange={(e) => setAddForm({ ...addForm, durationHours: e.target.value })}
              />
            </div>
            <Button
              disabled={mutCreate.isPending}
              onClick={() =>
                mutCreate.mutate({
                  date: addForm.date,
                  title: addForm.title,
                  durationHours: Number(addForm.durationHours),
                })
              }
            >
              {mutCreate.isPending ? 'Saving…' : 'Save session'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editRow} onOpenChange={() => setEditRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit session</DialogTitle>
          </DialogHeader>
          {editRow && (
            <div className="grid gap-3 py-2">
              <div>
                <Label>Earnings (EGP)</Label>
                <Input
                  type="number"
                  value={editForm.earnings}
                  onChange={(e) => setEditForm({ ...editForm, earnings: e.target.value })}
                />
              </div>
              <div>
                <Label>Rate applied</Label>
                <Input
                  type="number"
                  value={editForm.rateApplied}
                  onChange={(e) => setEditForm({ ...editForm, rateApplied: e.target.value })}
                />
              </div>
              <div>
                <Label>Category</Label>
                <Input value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })} />
              </div>
              <div>
                <Label>Note</Label>
                <Input value={editForm.note} onChange={(e) => setEditForm({ ...editForm, note: e.target.value })} />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!!editForm.flagged}
                  onChange={(e) => setEditForm({ ...editForm, flagged: e.target.checked })}
                  id="ef"
                />
                <Label htmlFor="ef">Flagged</Label>
              </div>
              <Button
                onClick={() =>
                  mutUpdate.mutate({
                    id: editRow.id,
                    body: {
                      earnings: Number(editForm.earnings),
                      rateApplied: Number(editForm.rateApplied),
                      category: editForm.category,
                      note: editForm.note,
                      flagged: editForm.flagged,
                    },
                  })
                }
              >
                Save
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
