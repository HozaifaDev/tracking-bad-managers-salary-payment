import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Separator } from '../components/ui/separator';
import { Skeleton } from '../components/ui/skeleton';
import { getConfig, saveConfig } from '../lib/api';

export function Settings() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['config'], queryFn: getConfig });
  const [cfg, setCfg] = useState(null);

  useEffect(() => {
    if (data) setCfg(JSON.parse(JSON.stringify(data)));
  }, [data]);

  const mut = useMutation({
    mutationFn: saveConfig,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['config'] });
      toast.success('Config saved!');
    },
    onError: (e) => toast.error(e.response?.data?.error || e.message),
  });

  if (isLoading || !cfg) {
    return <Skeleton className="h-96 w-full" />;
  }

  const groups = cfg.groups || {};
  const groupEntries = Object.entries(groups);

  const overrides = cfg.private_courses?.overrides || {};
  const overrideEntries = Object.entries(overrides);

  const diplomaEntries = Object.entries(cfg.diplomas || {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500">Edit config.json through the UI (saved to disk on Save).</p>
      </div>

      <Tabs defaultValue="cycle">
        <TabsList>
          <TabsTrigger value="cycle">Work cycle</TabsTrigger>
          <TabsTrigger value="groups">Groups</TabsTrigger>
          <TabsTrigger value="private">Private courses</TabsTrigger>
          <TabsTrigger value="diplomas">Diplomas</TabsTrigger>
        </TabsList>

        <TabsContent value="cycle">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">General</CardTitle>
            </CardHeader>
            <CardContent className="grid max-w-md gap-4">
              <div>
                <Label>Work cycle start day</Label>
                <Input
                  type="number"
                  value={cfg.work_cycle_start_day}
                  onChange={(e) => setCfg({ ...cfg, work_cycle_start_day: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>Timezone (IANA)</Label>
                <Input value={cfg.timezone} onChange={(e) => setCfg({ ...cfg, timezone: e.target.value })} />
              </div>
              <div>
                <Label>Currency code</Label>
                <Input value={cfg.currency} onChange={(e) => setCfg({ ...cfg, currency: e.target.value })} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="groups">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Regular groups</CardTitle>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const name = `Group ${Object.keys(cfg.groups || {}).length + 1}`;
                  setCfg({
                    ...cfg,
                    groups: { ...groups, [name]: { type: 'regular', platform: 'online', rate_per_hour: 175, color: '#6366f1' } },
                  });
                }}
              >
                <Plus className="mr-1 h-4 w-4" /> Add group
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              {groupEntries.map(([name, g]) => (
                <div key={name} className="rounded-lg border border-slate-100 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <Input
                      className="max-w-xs font-semibold"
                      value={name}
                      onChange={(e) => {
                        const next = { ...groups };
                        delete next[name];
                        next[e.target.value] = g;
                        setCfg({ ...cfg, groups: next });
                      }}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-rose-600"
                      onClick={() => {
                        const next = { ...groups };
                        delete next[name];
                        setCfg({ ...cfg, groups: next });
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    <div>
                      <Label>Platform</Label>
                      <Input
                        value={g.platform}
                        onChange={(e) =>
                          setCfg({
                            ...cfg,
                            groups: { ...groups, [name]: { ...g, platform: e.target.value } },
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label>Rate / hr</Label>
                      <Input
                        type="number"
                        value={g.rate_per_hour}
                        onChange={(e) =>
                          setCfg({
                            ...cfg,
                            groups: { ...groups, [name]: { ...g, rate_per_hour: Number(e.target.value) } },
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label>Color</Label>
                      <Input
                        type="color"
                        value={g.color || '#6366f1'}
                        onChange={(e) =>
                          setCfg({
                            ...cfg,
                            groups: { ...groups, [name]: { ...g, color: e.target.value } },
                          })
                        }
                      />
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="private">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Private course defaults & overrides</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid max-w-md gap-4 md:grid-cols-2">
                <div>
                  <Label>Default instructor split (0–1)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={cfg.private_courses?.default_split_instructor ?? 0.5}
                    onChange={(e) =>
                      setCfg({
                        ...cfg,
                        private_courses: {
                          ...(cfg.private_courses || {}),
                          default_split_instructor: Number(e.target.value),
                        },
                      })
                    }
                  />
                </div>
                <div>
                  <Label>Default hourly rate (EGP)</Label>
                  <Input
                    type="number"
                    value={cfg.private_courses?.default_hourly_rate ?? 300}
                    onChange={(e) =>
                      setCfg({
                        ...cfg,
                        private_courses: {
                          ...(cfg.private_courses || {}),
                          default_hourly_rate: Number(e.target.value),
                        },
                      })
                    }
                  />
                </div>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Overrides</h4>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const key = `Private Course: New${overrideEntries.length + 1}`;
                    setCfg({
                      ...cfg,
                      private_courses: {
                        ...cfg.private_courses,
                        overrides: {
                          ...overrides,
                          [key]: { fixed_instructor_amount: 0, total_course_amount: 0, note: '' },
                        },
                      },
                    });
                  }}
                >
                  <Plus className="mr-1 h-4 w-4" /> Add override
                </Button>
              </div>
              {overrideEntries.map(([key, o]) => (
                <div key={key} className="rounded-lg border border-slate-100 p-4">
                  <div className="mb-2 flex justify-between gap-2">
                    <Input
                      className="font-medium"
                      value={key}
                      onChange={(e) => {
                        const next = { ...overrides };
                        delete next[key];
                        next[e.target.value] = o;
                        setCfg({
                          ...cfg,
                          private_courses: { ...cfg.private_courses, overrides: next },
                        });
                      }}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-rose-600"
                      onClick={() => {
                        const next = { ...overrides };
                        delete next[key];
                        setCfg({
                          ...cfg,
                          private_courses: { ...cfg.private_courses, overrides: next },
                        });
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid gap-2 md:grid-cols-3">
                    <div>
                      <Label>Fixed instructor (EGP)</Label>
                      <Input
                        type="number"
                        value={o.fixed_instructor_amount}
                        onChange={(e) =>
                          setCfg({
                            ...cfg,
                            private_courses: {
                              ...cfg.private_courses,
                              overrides: {
                                ...overrides,
                                [key]: { ...o, fixed_instructor_amount: Number(e.target.value) },
                              },
                            },
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label>Total course (doc)</Label>
                      <Input
                        type="number"
                        value={o.total_course_amount}
                        onChange={(e) =>
                          setCfg({
                            ...cfg,
                            private_courses: {
                              ...cfg.private_courses,
                              overrides: {
                                ...overrides,
                                [key]: { ...o, total_course_amount: Number(e.target.value) },
                              },
                            },
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label>Note</Label>
                      <Input
                        value={o.note || ''}
                        onChange={(e) =>
                          setCfg({
                            ...cfg,
                            private_courses: {
                              ...cfg.private_courses,
                              overrides: { ...overrides, [key]: { ...o, note: e.target.value } },
                            },
                          })
                        }
                      />
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="diplomas">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Diploma tracks</CardTitle>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const name = `Track ${diplomaEntries.length + 1}`;
                  setCfg({
                    ...cfg,
                    diplomas: {
                      ...(cfg.diplomas || {}),
                      [name]: { color: '#6366f1', milestones: { Milestone1: 1000 } },
                    },
                  });
                }}
              >
                <Plus className="mr-1 h-4 w-4" /> Add track
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              {diplomaEntries.map(([trackName, t]) => (
                <div key={trackName} className="rounded-lg border border-slate-100 p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <Input
                      className="max-w-xs font-semibold"
                      value={trackName}
                      onChange={(e) => {
                        const next = { ...cfg.diplomas };
                        delete next[trackName];
                        next[e.target.value] = t;
                        setCfg({ ...cfg, diplomas: next });
                      }}
                    />
                    <div className="flex items-center gap-2">
                      <Label className="text-xs">Color</Label>
                      <Input
                        type="color"
                        className="w-16"
                        value={t.color || '#6366f1'}
                        onChange={(e) =>
                          setCfg({
                            ...cfg,
                            diplomas: {
                              ...cfg.diplomas,
                              [trackName]: { ...t, color: e.target.value },
                            },
                          })
                        }
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-rose-600"
                        onClick={() => {
                          const next = { ...cfg.diplomas };
                          delete next[trackName];
                          setCfg({ ...cfg, diplomas: next });
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {Object.entries(t.milestones || {}).map(([mName, amount]) => (
                      <div key={mName} className="flex flex-wrap items-end gap-2">
                        <div className="min-w-[120px] flex-1">
                          <Label className="text-xs">Milestone</Label>
                          <Input
                            value={mName}
                            onChange={(e) => {
                              const ms = { ...t.milestones };
                              delete ms[mName];
                              ms[e.target.value] = amount;
                              setCfg({
                                ...cfg,
                                diplomas: { ...cfg.diplomas, [trackName]: { ...t, milestones: ms } },
                              });
                            }}
                          />
                        </div>
                        <div className="w-28">
                          <Label className="text-xs">Payout</Label>
                          <Input
                            type="number"
                            value={amount}
                            onChange={(e) =>
                              setCfg({
                                ...cfg,
                                diplomas: {
                                  ...cfg.diplomas,
                                  [trackName]: {
                                    ...t,
                                    milestones: { ...t.milestones, [mName]: Number(e.target.value) },
                                  },
                                },
                              })
                            }
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-rose-600"
                          onClick={() => {
                            const ms = { ...t.milestones };
                            delete ms[mName];
                            setCfg({
                              ...cfg,
                              diplomas: { ...cfg.diplomas, [trackName]: { ...t, milestones: ms } },
                            });
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const ms = { ...t.milestones, [`New ${Object.keys(t.milestones).length + 1}`]: 0 };
                        setCfg({
                          ...cfg,
                          diplomas: { ...cfg.diplomas, [trackName]: { ...t, milestones: ms } },
                        });
                      }}
                    >
                      <Plus className="mr-1 h-3 w-3" /> Add milestone
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Button size="lg" onClick={() => mut.mutate(cfg)} disabled={mut.isPending}>
        Save configuration
      </Button>
    </div>
  );
}
