import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { RefreshCw, CheckCircle2, XCircle, Upload, Wand2, Plus, Trash2, Map, Sparkles, SkipForward, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { DateField } from '../components/DateField';
import { Badge } from '../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { syncCalendar, getSyncLog, getCalendarStatus, getConfig, previewIcsFile, previewIcsPaste, confirmIcsImport, getSessions, deleteUncategorizedSessions } from '../lib/api';
import { getDefaultSyncRange } from '../lib/utils';
import { ProGate } from '../components/ProGate';
import { useClient } from '../context/ClientContext';

const RATE_TYPES = [
  { value: 'hourly', label: 'Hourly', hint: 'rate x hours' },
  { value: 'per_session', label: 'Per session', hint: 'flat per session' },
  { value: 'milestone', label: 'Milestone', hint: 'paid on completion' },
];

const COLOR_PRESETS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#3b82f6', '#8b5cf6', '#ef4444', '#14b8a6'];

function findMatchStatus(title, existingWorkTypes, mappings, delimiter) {
  const lower = title.toLowerCase();
  for (const wt of existingWorkTypes) {
    if (lower === wt.name.toLowerCase() || lower.includes(wt.name.toLowerCase())) {
      return { type: 'existing', workType: wt };
    }
  }
  for (const m of mappings) {
    if (!m.keyword) continue;
    if (lower.includes(m.keyword.toLowerCase())) {
      let subCategory = null;
      const afterKw = title.slice(title.toLowerCase().indexOf(m.keyword.toLowerCase()) + m.keyword.length);
      if (afterKw.startsWith(m.delimiter || delimiter)) {
        subCategory = afterKw.slice((m.delimiter || delimiter).length).trim() || null;
      }
      return { type: 'mapped', mapping: m, subCategory };
    }
  }
  return { type: 'unmatched' };
}

// ─── Smart Import Wizard ─────────────────────────────────────────────────────────

function SmartImportWizard({ onResult }) {
  const qc = useQueryClient();
  const { clients, selectedClientId } = useClient();
  const fileRef = useRef(null);

  const [phase, setPhase] = useState('upload');
  const [icsPaste, setIcsPaste] = useState('');
  const [icsFile, setIcsFile] = useState(null);
  const [icsText, setIcsText] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [delimiter, setDelimiter] = useState(' - ');
  const [preview, setPreview] = useState(null);

  const [mappings, setMappings] = useState([]);
  const [skippedTitles, setSkippedTitles] = useState([]);

  const { data: config } = useQuery({ queryKey: ['config'], queryFn: getConfig });

  useEffect(() => {
    if (config) {
      const r = getDefaultSyncRange(config.work_cycle_start_day ?? 25);
      setFrom((f) => f || r.from);
      setTo((t) => t || r.to);
    }
  }, [config]);

  const mutPreview = useMutation({ mutationFn: runPreview });
  const mutConfirm = useMutation({ mutationFn: runConfirm });

  function runPreview() {
    const opts = { from: from || undefined, to: to || undefined, clientId: selectedClientId || undefined, delimiter };
    if (icsFile) return previewIcsFile(icsFile, opts);
    return previewIcsPaste(icsText, opts);
  }

  function runConfirm() {
    return confirmIcsImport({
      ics: icsText,
      clientId: preview?.clientId || selectedClientId,
      from: from || undefined,
      to: to || undefined,
      delimiter,
      mappings: mappings.map((m) => ({ ...m, delimiter })),
      skippedTitles,
    });
  }

  function handlePreview() {
    mutPreview.mutate(undefined, {
      onSuccess: (data) => {
        setPreview(data);
        setMappings(
          data.suggestedGroups.map((g, i) => ({
            keyword: g.keyword,
            workTypeName: g.keyword,
            rateType: 'hourly',
            rate: 0,
            color: COLOR_PRESETS[i % COLOR_PRESETS.length],
          })),
        );
        setSkippedTitles([]);
        setPhase('map');
      },
      onError: (e) => toast.error(e.response?.data?.error || e.message),
    });
  }

  function handleConfirm() {
    const hasZeroRate = mappings.some((m) => m.rate <= 0);
    if (hasZeroRate) {
      if (!confirm('One or more mappings have a rate of 0. Continue anyway?')) return;
    }
    mutConfirm.mutate(undefined, {
      onSuccess: (data) => {
        toast.success(`Imported: ${data.new} new sessions (${data.skipped} existing skipped)`);
        qc.invalidateQueries({ queryKey: ['sessions'] });
        qc.invalidateQueries({ queryKey: ['summary'] });
        qc.invalidateQueries({ queryKey: ['monthly'] });
        qc.invalidateQueries({ queryKey: ['sync-log'] });
        qc.invalidateQueries({ queryKey: ['clients'] });
        setPhase('result');
        onResult?.(data);
      },
      onError: (e) => toast.error(e.response?.data?.error || e.message),
    });
  }

  function handleAutoDetect() {
    if (!preview) return;
    const groups = detectTitleGroups(preview.uniqueTitles, delimiter);
    setMappings(groups.map((g, i) => ({
      keyword: g.keyword,
      workTypeName: g.keyword,
      rateType: 'hourly',
      rate: 0,
      color: COLOR_PRESETS[i % COLOR_PRESETS.length],
    })));
    setSkippedTitles([]);
  }

  function addMapping(preset) {
    setMappings((prev) => [...prev, {
      keyword: preset?.keyword || '',
      workTypeName: preset?.workTypeName || preset?.keyword || '',
      rateType: 'hourly',
      rate: 0,
      color: COLOR_PRESETS[prev.length % COLOR_PRESETS.length],
    }]);
  }

  function removeMapping(idx) {
    setMappings((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateMapping(idx, field, value) {
    setMappings((prev) => prev.map((m, i) => (i === idx ? { ...m, [field]: value } : m)));
  }

  // ─── Phase: Upload ──────────────────────────────────────────────
  if (phase === 'upload') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Smart .ics import</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p className="text-slate-600 dark:text-slate-400">
            Upload or paste an .ics file to preview events, assign categories & rates, then import.
          </p>
          {clients.length > 1 && (
            <div>
              <Label>Import into client</Label>
              <div className="text-sm text-slate-500 dark:text-slate-400">
                Using currently selected client ({clients.find((c) => c.id === selectedClientId)?.name || 'default'})
              </div>
            </div>
          )}
          <div>
            <Label>Sub-category delimiter</Label>
            <Input value={delimiter} onChange={(e) => setDelimiter(e.target.value)} placeholder=" - " className="max-w-[200px]" />
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Titles like "Arabian - SQL" will be split into category "Arabian" and sub-category "SQL"
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <DateField label="Filter from (optional)" value={from} onChange={setFrom} />
            <DateField label="Filter to (optional)" value={to} onChange={setTo} />
          </div>
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <input
                ref={fileRef}
                id="smart-ics-file"
                type="file"
                accept=".ics,text/calendar"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                      setIcsText(ev.target.result);
                      setIcsFile(file);
                    };
                    reader.readAsText(file);
                  }
                  e.target.value = '';
                }}
              />
              <Button type="button" variant="secondary" onClick={() => fileRef.current?.click()}>
                <Upload className="mr-2 h-4 w-4" /> Choose .ics file
              </Button>
              {icsFile && (
                <span className="text-xs text-slate-600 dark:text-slate-400">{icsFile.name} selected</span>
              )}
            </div>
            <div className="border-t border-slate-100 dark:border-slate-700 pt-3">
              <Label>Or paste .ics contents</Label>
              <textarea
                className="flex min-h-[120px] w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
                placeholder="BEGIN:VCALENDAR..."
                value={icsPaste}
                onChange={(e) => { setIcsPaste(e.target.value); setIcsText(e.target.value); }}
              />
            </div>
          </div>
          <Button
            disabled={mutPreview.isPending || (!icsFile && !icsPaste.trim())}
            onClick={handlePreview}
          >
            {mutPreview.isPending ? (
              <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Analyzing…</>
            ) : (
              <><Sparkles className="mr-2 h-4 w-4" /> Preview & map categories</>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ─── Phase: Map ─────────────────────────────────────────────────
  if (phase === 'map') {
    const allTitles = preview?.uniqueTitles || [];
    const matchedTitles = [];
    const unmatchedTitles = [];
    for (const ut of allTitles) {
      const status = findMatchStatus(ut.title, preview.existingWorkTypes || [], mappings, delimiter);
      if (status.type === 'existing') {
        matchedTitles.push({ ...ut, matchType: 'existing', workType: status.workType });
      } else if (status.type === 'mapped') {
        matchedTitles.push({ ...ut, matchType: 'mapped', mapping: status.mapping, subCategory: status.subCategory });
      } else {
        unmatchedTitles.push(ut);
      }
    }
    const totalMatchedEvents = matchedTitles.reduce((s, t) => s + t.count, 0);
    const totalUnmatchedEvents = unmatchedTitles.reduce((s, t) => s + t.count, 0);
    const totalSkippedEvents = skippedTitles.reduce((s, t) => {
      const found = allTitles.find((ut) => ut.title === t);
      return s + (found ? found.count : 0);
    }, 0);
    const importEventCount = preview.totalEvents - totalSkippedEvents;

    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Map className="h-4 w-4" /> Map categories
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex flex-wrap gap-4 text-xs text-slate-500 dark:text-slate-400">
              <span>{preview.totalEvents} events found</span>
              {preview.dateRange.from && (
                <span>{preview.dateRange.from} → {preview.dateRange.to}</span>
              )}
              <span>Client: {preview.clientName}</span>
            </div>

            {/* Auto-detect */}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleAutoDetect}>
                <Wand2 className="mr-1 h-3.5 w-3.5" /> Auto-detect groups
              </Button>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Suggests groupings based on the delimiter "{delimiter}"
              </span>
            </div>

            {/* Mappings editor */}
            <div className="space-y-3">
              <h3 className="font-medium text-sm">Category mappings</h3>
              {mappings.length === 0 && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  No mappings yet. Click "Auto-detect groups" or add one manually.
                </p>
              )}
              {mappings.map((m, idx) => {
                const matchCount = allTitles.filter((ut) =>
                  ut.title.toLowerCase().includes(m.keyword.toLowerCase())
                ).reduce((sum, ut) => sum + ut.count, 0);
                return (
                  <div key={idx} className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-3">
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                      <div>
                        <Label className="text-xs">Keyword</Label>
                        <Input value={m.keyword} onChange={(e) => updateMapping(idx, 'keyword', e.target.value)} placeholder="e.g. Arabian" />
                      </div>
                      <div>
                        <Label className="text-xs">Work type name</Label>
                        <Input value={m.workTypeName} onChange={(e) => updateMapping(idx, 'workTypeName', e.target.value)} placeholder="e.g. Arabian" />
                      </div>
                      <div>
                        <Label className="text-xs">Rate type</Label>
                        <select
                          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                          value={m.rateType}
                          onChange={(e) => updateMapping(idx, 'rateType', e.target.value)}
                        >
                          {RATE_TYPES.map((rt) => (
                            <option key={rt.value} value={rt.value}>{rt.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <Label className="text-xs">
                          {m.rateType === 'hourly' ? 'Rate per hour' : m.rateType === 'per_session' ? 'Flat rate' : 'Payout on complete'}
                        </Label>
                        <Input type="number" min="0" step="0.01" value={m.rate} onChange={(e) => updateMapping(idx, 'rate', Number(e.target.value))} />
                      </div>
                      <div className="flex items-end gap-2">
                        <div className="flex-1">
                          <Label className="text-xs">Color</Label>
                          <div className="flex items-center gap-1">
                            <input type="color" value={m.color || '#6366f1'} onChange={(e) => updateMapping(idx, 'color', e.target.value)} className="h-9 w-12 cursor-pointer rounded border border-input p-0.5" />
                            <div className="flex flex-wrap gap-0.5">
                              {COLOR_PRESETS.slice(0, 4).map((c) => (
                                <button key={c} type="button" onClick={() => updateMapping(idx, 'color', c)} className="h-3.5 w-3.5 rounded-full border" style={{ backgroundColor: c, borderColor: m.color === c ? '#0f172a' : 'transparent' }} />
                              ))}
                            </div>
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" className="text-rose-600 shrink-0 h-9 w-9" onClick={() => removeMapping(idx)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {m.keyword && (
                      <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                        Matches {matchCount} event{matchCount !== 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                );
              })}
              <Button variant="outline" size="sm" onClick={() => addMapping()}>
                <Plus className="mr-1 h-3.5 w-3.5" /> Add mapping
              </Button>
            </div>

            {/* Matched titles (existing work types) */}
            {matchedTitles.filter((t) => t.matchType === 'existing').length > 0 && (
              <div className="space-y-2">
                <h3 className="font-medium text-sm flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Auto-matched (existing work types)
                </h3>
                <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950 p-3">
                  {matchedTitles.filter((t) => t.matchType === 'existing').map((t) => (
                    <div key={t.title} className="flex items-center gap-2 text-xs py-1">
                      <span className="font-medium">{t.title}</span>
                      <Badge variant="success" className="text-[10px]">{t.workType.name} ({t.count})</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Currently mapped titles */}
            {matchedTitles.filter((t) => t.matchType === 'mapped').length > 0 && (
              <div className="space-y-2">
                <h3 className="font-medium text-sm flex items-center gap-1">
                  <Map className="h-4 w-4 text-indigo-500" /> Mapped by your rules
                </h3>
                <div className="rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950 p-3">
                  {matchedTitles.filter((t) => t.matchType === 'mapped').map((t) => (
                    <div key={t.title} className="flex items-center gap-2 text-xs py-1">
                      <span className="font-medium">{t.title}</span>
                      <Badge className="text-[10px]">{t.mapping.workTypeName}</Badge>
                      {t.subCategory && (
                        <span className="text-slate-500 dark:text-slate-400">sub: {t.subCategory}</span>
                      )}
                      <span className="text-slate-400">({t.count})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Unmatched titles */}
            {unmatchedTitles.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-medium text-sm flex items-center gap-1">
                  <XCircle className="h-4 w-4 text-amber-500" /> Unmatched titles ({totalUnmatchedEvents} event{totalUnmatchedEvents !== 1 ? 's' : ''})
                </h3>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setSkippedTitles(unmatchedTitles.map((t) => t.title))}>
                    <SkipForward className="mr-1 h-3.5 w-3.5" /> Skip all unmatched
                  </Button>
                  {skippedTitles.length > 0 && (
                    <Button variant="outline" size="sm" onClick={() => setSkippedTitles([])}>
                      Clear skips
                    </Button>
                  )}
                </div>
                <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950 p-3 space-y-1.5">
                  {unmatchedTitles.map((t) => {
                    const isSkipped = skippedTitles.includes(t.title);
                    return (
                      <div key={t.title} className="flex items-center gap-2 text-xs">
                        <span className={isSkipped ? 'line-through text-slate-400' : 'font-medium'}>{t.title}</span>
                        <span className="text-slate-400">({t.count})</span>
                        {!isSkipped && (
                          <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => addMapping({ keyword: t.title })}>
                            <Plus className="mr-0.5 h-3 w-3" /> Map
                          </Button>
                        )}
                        {isSkipped ? (
                          <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setSkippedTitles((prev) => prev.filter((s) => s !== t.title))}>
                            Unskip
                          </Button>
                        ) : (
                          <Button variant="ghost" size="sm" className="h-6 text-xs text-amber-600" onClick={() => setSkippedTitles((prev) => [...prev, t.title])}>
                            Skip
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-3 pt-2">
              <Button onClick={handleConfirm} disabled={mutConfirm.isPending}>
                {mutConfirm.isPending ? (
                  <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Importing…</>
                ) : (
                  <>Import {importEventCount} event{importEventCount !== 1 ? 's' : ''}</>
                )}
              </Button>
              <Button variant="outline" onClick={() => { setPhase('upload'); setPreview(null); }}>
                Back
              </Button>
              <Button variant="ghost" onClick={() => { setPhase('upload'); setPreview(null); setIcsPaste(''); setIcsFile(null); setIcsText(''); }}>
                Start over
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Phase: Result ──────────────────────────────────────────────
  if (phase === 'result') {
    const result = mutConfirm.data;
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Import complete</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid gap-2">
            <div>Events parsed: {result.fetched}</div>
            <div>New sessions: {result.new}</div>
            <div>Skipped (already in DB): {result.skipped}</div>
            {result.skippedByUser > 0 && (
              <div>Skipped (by your choice): {result.skippedByUser}</div>
            )}
            <div>Flagged titles: {result.flagged}</div>
            {result.flaggedTitles?.length > 0 && (
              <ul className="list-inside list-disc text-amber-800 dark:text-amber-300">
                {result.flaggedTitles.map((t) => <li key={t}>{t}</li>)}
              </ul>
            )}
          </div>
          {result.mappingBreakdown && Object.keys(result.mappingBreakdown).length > 0 && (
            <div className="mt-3">
              <h4 className="font-medium mb-2">Breakdown by category</h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead>Events</TableHead>
                    <TableHead>Hours</TableHead>
                    <TableHead>Earnings</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(result.mappingBreakdown).map(([name, b]) => (
                    <TableRow key={name}>
                      <TableCell className="font-medium">{name}</TableCell>
                      <TableCell>{b.events}</TableCell>
                      <TableCell>{b.hours}</TableCell>
                      <TableCell>{b.earnings}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={() => {
              setPhase('upload'); setPreview(null); setIcsPaste(''); setIcsFile(null); setIcsText(''); setMappings([]); setSkippedTitles([]);
            }}>
              Import another file
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
}

// ─── Helper duplicated in backend ─────────────────────────────────────────────────

function detectTitleGroups(uniqueTitles, delimiter = ' - ') {
  const groupMap = new Map();
  for (const { title, count } of uniqueTitles) {
    const idx = title.indexOf(delimiter);
    let keyword;
    if (idx > 0) {
      keyword = title.slice(0, idx).trim();
    } else {
      keyword = title.trim();
    }
    if (!groupMap.has(keyword)) {
      groupMap.set(keyword, { keyword, titles: [], totalEvents: 0 });
    }
    const group = groupMap.get(keyword);
    group.titles.push(title);
    group.totalEvents += count;
  }
  return [...groupMap.values()].sort((a, b) => b.totalEvents - a.totalEvents || a.keyword.localeCompare(b.keyword));
}

// ─── Uncategorized Sessions Deleter ──────────────────────────────────────────────

function UncategorizedBanner() {
  const qc = useQueryClient();
  const { selectedClientId } = useClient();
  const [uncatCount, setUncatCount] = useState(null);

  const { data: sessions } = useQuery({
    queryKey: ['sessions', { flagged: '1', clientId: selectedClientId }],
    queryFn: () => getSessions({ flagged: '1', clientId: selectedClientId || undefined }),
    enabled: true,
  });

  useEffect(() => {
    if (sessions) {
      const flagged = (sessions.data || sessions || []).filter(
        (s) => s.category === 'Uncategorized' || s.flagged
      );
      setUncatCount(flagged.length);
    }
  }, [sessions]);

  const mutDelete = useMutation({
    mutationFn: () => deleteUncategorizedSessions(selectedClientId || undefined),
    onSuccess: (data) => {
      toast.success(`Deleted ${data.deleted} uncategorized session${data.deleted !== 1 ? 's' : ''}`);
      qc.invalidateQueries({ queryKey: ['sessions'] });
      qc.invalidateQueries({ queryKey: ['summary'] });
      qc.invalidateQueries({ queryKey: ['monthly'] });
      setUncatCount(0);
    },
    onError: (e) => toast.error(e.response?.data?.error || e.message),
  });

  if (!uncatCount || uncatCount === 0) return null;

  return (
    <Card className="border-amber-200 dark:border-amber-800">
      <CardContent className="flex items-center justify-between py-4">
        <div className="flex items-center gap-2 text-sm">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <span className="text-slate-700 dark:text-slate-300">
            <strong>{uncatCount}</strong> uncategorized session{uncatCount !== 1 ? 's' : ''} found
          </span>
        </div>
        <Button
          variant="destructive"
          size="sm"
          disabled={mutDelete.isPending}
          onClick={() => {
            if (confirm(`Delete all ${uncatCount} uncategorized session${uncatCount !== 1 ? 's' : ''}? This cannot be undone.`)) {
              mutDelete.mutate();
            }
          }}
        >
          {mutDelete.isPending ? <RefreshCw className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Trash2 className="mr-1 h-3.5 w-3.5" />}
          Delete all uncategorized
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Main Sync Page ──────────────────────────────────────────────────────────────

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
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Calendar sync & import</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Sync from Google Calendar, or import a downloaded .ics file — fully local, no Google API for .ics.
        </p>
      </div>

      <UncategorizedBanner />

      <SmartImportWizard />

      <ProGate feature="Google Calendar sync">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Google auth status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex gap-4">
            <span className="text-slate-600 dark:text-slate-400">credentials.json</span>
            {status?.hasCredentials ? (
              <Badge variant="success">Found</Badge>
            ) : (
              <Badge variant="warning">Missing — add to backend/</Badge>
            )}
          </div>
          <div className="flex gap-4">
            <span className="text-slate-600 dark:text-slate-400">token.json</span>
            {status?.hasToken ? (
              <Badge variant="success">Connected</Badge>
            ) : (
              <Badge variant="warning">Not connected</Badge>
            )}
          </div>
          {!status?.hasToken && (
            <p className="rounded-md bg-amber-50 dark:bg-amber-950 p-3 text-amber-900 dark:text-amber-300">
              From the repo root run: <code className="rounded bg-white dark:bg-slate-900 px-1">cd backend && npm run auth</code>
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
              <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Syncing…</>
            ) : (
              <><RefreshCw className="mr-2 h-4 w-4" /> Sync now</>
            )}
          </Button>
        </CardContent>
      </Card>
      </ProGate>

      {lastResult && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Last Google sync result</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <div>Events fetched: {lastResult.fetched}</div>
            <div>New sessions: {lastResult.new}</div>
            <div>Skipped (already in DB): {lastResult.skipped}</div>
            <div>Flagged titles: {lastResult.flagged}</div>
            {lastResult.flaggedTitles?.length > 0 && (
              <ul className="list-inside list-disc text-amber-800 dark:text-amber-300">
                {lastResult.flaggedTitles.map((t) => <li key={t}>{t}</li>)}
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
                  <TableCell className="text-xs">{row.rangeFrom} → {row.rangeTo}</TableCell>
                  <TableCell>{row.eventsFetched}</TableCell>
                  <TableCell>{row.newSessions}</TableCell>
                  <TableCell>{row.skipped}</TableCell>
                  <TableCell>
                    {row.status === 'success' ? (
                      <Badge variant="success" className="gap-1"><CheckCircle2 className="h-3 w-3" /> Success</Badge>
                    ) : (
                      <Badge variant="warning" className="gap-1"><XCircle className="h-3 w-3" /> Error</Badge>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-xs text-rose-600 dark:text-rose-400">{row.errorMessage}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {(!log || log.length === 0) && <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">No syncs yet.</p>}
        </CardContent>
      </Card>
    </div>
  );
}