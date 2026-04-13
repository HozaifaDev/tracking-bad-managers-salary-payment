import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Pencil, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { DateField } from '../components/DateField';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Skeleton } from '../components/ui/skeleton';
import { getPayments, createPayment, updatePayment, deletePayment, getSummary } from '../lib/api';
import { formatCurrency, formatDateUi } from '../lib/utils';

export function Payments() {
  const qc = useQueryClient();
  const { data: summary } = useQuery({ queryKey: ['summary'], queryFn: getSummary });
  const { data: payments, isLoading } = useQuery({ queryKey: ['payments'], queryFn: getPayments });

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [edit, setEdit] = useState(null);

  const sorted = useMemo(() => [...(payments || [])].sort((a, b) => b.date.localeCompare(a.date)), [payments]);

  const withRunning = useMemo(() => {
    const asc = [...sorted].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
    let run = 0;
    const map = new Map();
    for (const p of asc) {
      run += Number(p.amountEgp);
      map.set(p.id, run);
    }
    return sorted.map((p) => ({ ...p, running: map.get(p.id) }));
  }, [sorted]);

  const mutAdd = useMutation({
    mutationFn: () => createPayment({ date, amountEgp: Number(amount), note }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payments'] });
      qc.invalidateQueries({ queryKey: ['summary'] });
      qc.invalidateQueries({ queryKey: ['monthly'] });
      toast.success('Payment added');
      setAmount('');
      setNote('');
    },
    onError: (e) => toast.error(e.response?.data?.error || e.message),
  });

  const mutUpd = useMutation({
    mutationFn: ({ id, body }) => updatePayment(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payments'] });
      qc.invalidateQueries({ queryKey: ['summary'] });
      qc.invalidateQueries({ queryKey: ['monthly'] });
      toast.success('Payment updated');
      setEdit(null);
    },
    onError: (e) => toast.error(e.response?.data?.error || e.message),
  });

  const mutDel = useMutation({
    mutationFn: deletePayment,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payments'] });
      qc.invalidateQueries({ queryKey: ['summary'] });
      qc.invalidateQueries({ queryKey: ['monthly'] });
      toast.success('Payment removed');
    },
    onError: (e) => toast.error(e.response?.data?.error || e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Payments</h1>
        <p className="text-sm text-slate-500">Log money received (not tied to a specific salary month).</p>
      </div>

      <Card className="border-indigo-100 bg-indigo-50/50">
        <CardContent className="py-4">
          <div className="text-sm text-slate-600">Total received (all time)</div>
          <div className="text-2xl font-bold text-indigo-900">{formatCurrency(summary?.totalPaid ?? 0)}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add payment</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div className="min-w-[200px]">
            <DateField label="Date received" value={date} onChange={setDate} />
          </div>
          <div>
            <Label>Amount (EGP)</Label>
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
          </div>
          <div className="min-w-[200px] flex-1">
            <Label>Note</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
          </div>
          <Button onClick={() => mutAdd.mutate()} disabled={!amount || mutAdd.isPending}>
            Add payment
          </Button>
        </CardContent>
      </Card>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead>Running total</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {withRunning.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{formatDateUi(p.date)}</TableCell>
                    <TableCell className="font-medium">{formatCurrency(p.amountEgp)}</TableCell>
                    <TableCell>{p.note}</TableCell>
                    <TableCell>{formatCurrency(p.running)}</TableCell>
                    <TableCell className="space-x-1">
                      <Button variant="ghost" size="icon" onClick={() => setEdit(p)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-rose-600"
                        onClick={() => {
                          if (confirm('Delete payment?')) mutDel.mutate(p.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {withRunning.length === 0 && <p className="py-8 text-center text-sm text-slate-500">No payments yet.</p>}
          </CardContent>
        </Card>
      )}

      <Dialog open={!!edit} onOpenChange={() => setEdit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit payment</DialogTitle>
          </DialogHeader>
          {edit && (
            <PaymentEditForm
              payment={edit}
              onSave={(body) => mutUpd.mutate({ id: edit.id, body })}
              onCancel={() => setEdit(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PaymentEditForm({ payment, onSave, onCancel }) {
  const [date, setDate] = useState(payment.date);
  const [amountEgp, setAmount] = useState(String(payment.amountEgp));
  const [note, setNote] = useState(payment.note || '');
  return (
    <div className="grid gap-3 py-2">
      <div>
        <Label>Date</Label>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <div>
        <Label>Amount</Label>
        <Input type="number" value={amountEgp} onChange={(e) => setAmount(e.target.value)} />
      </div>
      <div>
        <Label>Note</Label>
        <Input value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <div className="flex gap-2">
        <Button onClick={() => onSave({ date, amountEgp: Number(amountEgp), note })}>Save</Button>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
