import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Plus, Trash2, Pencil, Star, ChevronDown, ChevronUp, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Skeleton } from '../components/ui/skeleton';
import { getClients, createClient, updateClient, deleteClient, setDefaultClient } from '../lib/api';
import { useClient } from '../context/ClientContext';

const RATE_TYPES = [
  { value: 'hourly',      label: 'Hourly',       hint: 'rate × hours' },
  { value: 'per_session', label: 'Per session',  hint: 'flat per session' },
  { value: 'milestone',   label: 'Milestone',    hint: 'paid on completion' },
];

const COLOR_PRESETS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#3b82f6', '#8b5cf6', '#ef4444', '#14b8a6'];

function WorkTypeEditor({ workTypes = [], onChange }) {
  function update(idx, field, value) {
    const next = workTypes.map((wt, i) => i === idx ? { ...wt, [field]: value } : wt);
    onChange(next);
  }
  function add() {
    onChange([...workTypes, { name: '', rate_type: 'hourly', rate: 0, color: '#6366f1' }]);
  }
  function remove(idx) {
    onChange(workTypes.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-3">
      {workTypes.map((wt, idx) => (
        <div key={idx} className="rounded-lg border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-3">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label className="text-xs">Name</Label>
              <Input value={wt.name} onChange={(e) => update(idx, 'name', e.target.value)} placeholder="e.g. Consulting" />
            </div>
            <div>
              <Label className="text-xs">Rate type</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-surface-elevated px-3 py-1 text-sm shadow-sm dark:text-txt-primary"
                value={wt.rate_type}
                onChange={(e) => update(idx, 'rate_type', e.target.value)}
              >
                {RATE_TYPES.map((rt) => (
                  <option key={rt.value} value={rt.value}>{rt.label} — {rt.hint}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs">
                {wt.rate_type === 'hourly' ? 'Rate per hour' : wt.rate_type === 'per_session' ? 'Flat rate' : 'Payout on complete'}
              </Label>
              <Input type="number" min="0" step="0.01" value={wt.rate}
                onChange={(e) => update(idx, 'rate', Number(e.target.value))} />
            </div>
            <div>
              <Label className="text-xs">Color</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={wt.color || '#6366f1'}
                  onChange={(e) => update(idx, 'color', e.target.value)}
                  className="h-9 w-12 cursor-pointer rounded border border-input p-0.5" />
                <div className="flex flex-wrap gap-1">
                  {COLOR_PRESETS.map((c) => (
                    <button key={c} type="button"
                      onClick={() => update(idx, 'color', c)}
                      className="h-4 w-4 rounded-full border-2 transition-transform hover:scale-110"
                      style={{ backgroundColor: c, borderColor: wt.color === c ? '#0f172a' : 'transparent' }}
                    />
                  ))}
                </div>
                <Button variant="ghost" size="icon" className="ml-auto text-rose-600 shrink-0" onClick={() => remove(idx)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={add}>
        <Plus className="mr-1 h-4 w-4" /> Add work type
      </Button>
    </div>
  );
}

function ClientForm({ initial, onSave, onCancel, saving }) {
  const [name, setName] = useState(initial?.name || '');
  const [currency, setCurrency] = useState(initial?.currency || 'EGP');
  const [startDay, setStartDay] = useState(initial?.workCycleStartDay ?? 25);
  const [dueStartDay, setDueStartDay] = useState(initial?.paymentDueStartDay ?? 1);
  const [dueEndDay, setDueEndDay] = useState(initial?.paymentDueEndDay ?? 5);
  const [timezone, setTimezone] = useState(initial?.config?.timezone || 'Africa/Cairo');
  const [workTypes, setWorkTypes] = useState(initial?.config?.work_types || []);
  const [showConfig, setShowConfig] = useState(false);

  function submit() {
    if (!name.trim()) { toast.error('Client name is required'); return; }
    onSave({
      name: name.trim(),
      currency: currency.trim() || 'EGP',
      workCycleStartDay: Number(startDay) || 25,
      paymentDueStartDay: Number(dueStartDay) || 1,
      paymentDueEndDay: Number(dueEndDay) || 5,
      config: { timezone, work_cycle_start_day: Number(startDay) || 25, currency, work_types: workTypes },
    });
  }

  return (
    <div className="grid gap-4 py-2">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="sm:col-span-1">
          <Label>Client / Employer name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Acme Corp" />
        </div>
        <div>
          <Label>Currency</Label>
          <Input value={currency} onChange={(e) => setCurrency(e.target.value)} placeholder="EGP" />
        </div>
        <div>
          <Label>Cycle start day</Label>
          <Input type="number" min="1" max="28" value={startDay}
            onChange={(e) => setStartDay(e.target.value)} />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Payment due start day</Label>
          <Input type="number" min="1" max="28" value={dueStartDay}
            onChange={(e) => setDueStartDay(e.target.value)} />
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Day of month when payment window opens (e.g. 1 = 1st of next month)</p>
        </div>
        <div>
          <Label>Payment due end day</Label>
          <Input type="number" min="1" max="28" value={dueEndDay}
            onChange={(e) => setDueEndDay(e.target.value)} />
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Day of month when payment window closes (e.g. 5 = 5th of next month)</p>
        </div>
      </div>

      <div>
        <button
          type="button"
          className="flex items-center gap-1 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900"
          onClick={() => setShowConfig((v) => !v)}
        >
          {showConfig ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          {showConfig ? 'Hide' : 'Configure'} work types & advanced settings
        </button>
      </div>

      {showConfig && (
        <>
          <div>
            <Label>Timezone (IANA)</Label>
            <Input value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="Africa/Cairo" />
          </div>
          <div className="border-t border-slate-200" />
          <div>
            <div className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Work types</div>
            <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
              Define every type of work you do for this client. Sessions are matched to work types by name, and earnings are auto-calculated.
            </p>
            <WorkTypeEditor workTypes={workTypes} onChange={setWorkTypes} />
          </div>
        </>
      )}

      <div className="flex gap-2 pt-2">
        <Button onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Save client'}</Button>
        {onCancel && <Button variant="outline" onClick={onCancel}>Cancel</Button>}
      </div>
    </div>
  );
}

export function Clients() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { setSelectedClientId } = useClient();

  const { data: clients = [], isLoading } = useQuery({ queryKey: ['clients'], queryFn: getClients });

  const [editClient, setEditClient] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  function invalidate() { qc.invalidateQueries({ queryKey: ['clients'] }); }

  const mutCreate = useMutation({
    mutationFn: createClient,
    onSuccess: (c) => { invalidate(); toast.success('Client created'); setAddOpen(false); setSelectedClientId(c.id); },
    onError: (e) => {
      if (e.response?.status === 403 && e.response?.data?.code === 'upgrade_required') {
        setAddOpen(false);
        setUpgradeOpen(true);
      } else {
        toast.error(e.response?.data?.error || e.message);
      }
    },
  });

  const mutUpdate = useMutation({
    mutationFn: ({ id, body }) => updateClient(id, body),
    onSuccess: () => { invalidate(); toast.success('Client updated'); setEditClient(null); },
    onError: (e) => toast.error(e.response?.data?.error || e.message),
  });

  const mutDelete = useMutation({
    mutationFn: deleteClient,
    onSuccess: () => { invalidate(); toast.success('Client deleted'); },
    onError: (e) => toast.error(e.response?.data?.error || e.message),
  });

  const mutSetDefault = useMutation({
    mutationFn: setDefaultClient,
    onSuccess: () => { invalidate(); toast.success('Default client updated'); },
    onError: (e) => toast.error(e.response?.data?.error || e.message),
  });

  if (isLoading) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Clients</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Manage your clients / employers. Each has its own work types, rates, and payment history.</p>
        </div>
        <Button onClick={() => setAddOpen(true)}><Plus className="mr-2 h-4 w-4" />New client</Button>
      </div>

      <div className="space-y-4">
        {clients.map((c) => {
          const workTypes = c.config?.work_types || [];
          const isExpanded = expandedId === c.id;
          return (
            <Card key={c.id} className={c.isDefault ? 'border-indigo-200 dark:border-indigo-800' : ''}>
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">{c.name}</CardTitle>
                    {c.isDefault && (
                      <span className="rounded-full bg-indigo-100 dark:bg-indigo-900 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:text-indigo-300">
                        default
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
<span className="text-xs text-slate-500 dark:text-slate-400">
                        {c.currency} · cycle day {c.workCycleStartDay} · due {c.paymentDueStartDay}–{c.paymentDueEndDay} · {workTypes.length} work type{workTypes.length !== 1 ? 's' : ''}
                      </span>
                    {!c.isDefault && (
                      <Button variant="outline" size="sm" onClick={() => mutSetDefault.mutate(c.id)}>
                        <Star className="mr-1 h-3.5 w-3.5" />Set default
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => setEditClient(c)}>
                      <Pencil className="mr-1 h-3.5 w-3.5" />Edit
                    </Button>
                    {!c.isDefault && (
                      <Button variant="ghost" size="sm" className="text-rose-600"
                        onClick={() => {
                          if (confirm(`Delete client "${c.name}"? This only works if it has no sessions or payments.`)) {
                            mutDelete.mutate(c.id);
                          }
                        }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>

              {workTypes.length > 0 && (
                <CardContent className="pt-0">
                  <button
                    className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-800"
                    onClick={() => setExpandedId(isExpanded ? null : c.id)}
                  >
                    {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    {isExpanded ? 'Hide' : 'Show'} work types
                  </button>
                  {isExpanded && (
                    <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {workTypes.map((wt) => (
                        <div key={wt.name} className="flex items-center gap-2 rounded-md border border-slate-100 dark:border-slate-700 px-3 py-2">
                          <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: wt.color || '#6366f1' }} />
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium">{wt.name}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              {wt.rate_type === 'hourly' && `${wt.rate} ${c.currency}/hr`}
                              {wt.rate_type === 'per_session' && `${wt.rate} ${c.currency}/session`}
                              {wt.rate_type === 'milestone' && `${wt.rate} ${c.currency} on complete`}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          );
        })}

        {clients.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">
              No clients yet. Click "New client" to add your first employer or project.
            </CardContent>
          </Card>
        )}
      </div>

      {/* Add dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New client</DialogTitle></DialogHeader>
          <ClientForm
            onSave={(body) => mutCreate.mutate(body)}
            onCancel={() => setAddOpen(false)}
            saving={mutCreate.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editClient} onOpenChange={() => setEditClient(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit — {editClient?.name}</DialogTitle></DialogHeader>
          {editClient && (
            <ClientForm
              initial={editClient}
              onSave={(body) => mutUpdate.mutate({ id: editClient.id, body })}
              onCancel={() => setEditClient(null)}
              saving={mutUpdate.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Upgrade prompt */}
      <Dialog open={upgradeOpen} onOpenChange={setUpgradeOpen}>
        <DialogContent className="max-w-sm text-center">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-center gap-2">
              <Zap className="h-5 w-5 text-indigo-500" /> Upgrade to Pro
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              The free plan supports <strong>1 client</strong>. Upgrade to Pro
              for unlimited clients and everything we ship next.
            </p>
            <div className="flex flex-col gap-2">
              <Button
                className="bg-indigo-600 hover:bg-indigo-700 text-white w-full"
                onClick={() => { setUpgradeOpen(false); navigate('/billing'); }}
              >
                <Zap className="mr-2 h-4 w-4" /> See Pro plan
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setUpgradeOpen(false)}>
                Maybe later
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
