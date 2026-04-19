'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCasinoSettings } from '@/contexts/CasinoSettingsContext';
import { upsertCasinoSettings, interpolateMessage } from '@/lib/casinoSettings';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import {
  Zap, Clock, MessageSquare, Monitor, Smartphone, Mail,
  Save, RefreshCw, AlertTriangle, CheckCircle2, Info, Settings,
} from 'lucide-react';

// ── Channel options ───────────────────────────────────────────────────────────

const CHANNEL_OPTIONS = [
  {
    id:          'in_app',
    label:       'In-App Notification',
    icon:        Monitor,
    description: 'Via Supabase Realtime — instant, zero cost',
  },
  {
    id:          'whatsapp',
    label:       'WhatsApp',
    icon:        MessageSquare,
    description: 'Twilio — highest open rates (~98%)',
  },
  {
    id:          'sms',
    label:       'SMS',
    icon:        Smartphone,
    description: 'Twilio — broad reach, no app required',
  },
  {
    id:          'email',
    label:       'Email',
    icon:        Mail,
    description: 'Email provider (placeholder — wire up SendGrid when ready)',
  },
] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatRand(n: number): string {
  if (n >= 1_000_000) return `R ${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `R ${(n / 1_000).toFixed(1)}K`;
  return `R ${Math.round(n).toLocaleString()}`;
}

// ── Main panel ────────────────────────────────────────────────────────────────

export function CasinoSettingsPanel() {
  const { user }   = useAuth();
  const casinoId   = (user as any)?.casino_id as string | undefined;
  const { settings, loading, refreshSettings } = useCasinoSettings();

  // ── Local form state (synced from context on load / realtime update) ──────

  const [threshold,       setThreshold]   = useState(settings.intervention_threshold);
  const [channels,        setChannels]    = useState<string[]>(settings.enabled_channels);
  const [cooldown,        setCooldown]    = useState(settings.cooldown_minutes);
  const [msgTemplate,     setMsgTemplate] = useState(settings.message_template);
  const [saving,          setSaving]      = useState(false);
  const [dirty,           setDirty]       = useState(false);

  // Sync when context updates (realtime push from another tab)
  useEffect(() => {
    setThreshold(settings.intervention_threshold);
    setChannels(settings.enabled_channels);
    setCooldown(settings.cooldown_minutes);
    setMsgTemplate(settings.message_template);
    setDirty(false);
  }, [settings]);

  // ── Validation ────────────────────────────────────────────────────────────

  const validThreshold = threshold > 0;
  const validCooldown  = cooldown >= 1 && cooldown <= 60;
  const validChannels  = channels.length >= 1;
  const canSave        = validThreshold && validCooldown && validChannels && dirty && !saving;

  // ── Channel toggle ────────────────────────────────────────────────────────

  const toggleChannel = (id: string) => {
    setChannels(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
    setDirty(true);
  };

  // ── Save ──────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!casinoId) { toast.error('Casino ID unavailable'); return; }
    if (!validThreshold) { toast.error('Threshold must be greater than R 0'); return; }
    if (!validCooldown)  { toast.error('Cooldown must be between 1 and 60 minutes'); return; }
    if (!validChannels)  { toast.error('Select at least one delivery channel'); return; }

    setSaving(true);

    const result = await upsertCasinoSettings(casinoId, {
      intervention_threshold: threshold,
      enabled_channels:       channels,
      cooldown_minutes:       cooldown,
      message_template:       msgTemplate,
    });

    if (result.success) {
      toast.success('Settings saved', {
        description:
          `Threshold ${formatRand(threshold)} · ` +
          `${channels.length} channel${channels.length > 1 ? 's' : ''} · ` +
          `${cooldown} min cooldown · applied immediately`,
        duration: 5000,
      });
      await refreshSettings();
      setDirty(false);
    } else {
      toast.error(`Save failed: ${result.error}`);
    }

    setSaving(false);
  };

  // ── Message preview ───────────────────────────────────────────────────────

  const messagePreview = interpolateMessage(msgTemplate, {
    player: 'Jane Doe',
    risk:   87,
    amount: '6,200',
  });

  // ── Loading state ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground gap-2 text-sm">
        <RefreshCw className="h-4 w-4 animate-spin" />
        Loading casino settings…
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-6 max-w-3xl">

        {/* Unsaved-changes banner */}
        {dirty && (
          <div className="flex items-center gap-2 text-amber-700 text-sm bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <span>Unsaved changes — the intervention engine will use these values after you save</span>
          </div>
        )}

        {/* ── Section 1: Threshold ──────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-3 border-b border-border">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <Zap className="h-4 w-4 text-orange-500" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold">Intervention Threshold</CardTitle>
                <CardDescription className="text-xs">
                  Trigger an intervention when a player's predicted 30-minute loss exceeds this value
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-5 space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Trigger when predicted loss exceeds</Label>
                <span className={`text-lg font-bold tabular-nums ${validThreshold ? 'text-foreground' : 'text-destructive'}`}>
                  {formatRand(threshold)}
                </span>
              </div>
              <Slider
                value={[threshold]}
                onValueChange={([v]) => { setThreshold(v); setDirty(true); }}
                min={500}
                max={50000}
                step={500}
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>R 500</span>
                <span>R 25,000</span>
                <span>R 50,000</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Label className="text-sm whitespace-nowrap">Enter manually (R):</Label>
              <Input
                type="number"
                min="1"
                value={threshold}
                onChange={e => { setThreshold(Number(e.target.value)); setDirty(true); }}
                className={`w-32 h-8 text-sm tabular-nums ${!validThreshold ? 'border-destructive' : ''}`}
              />
              {!validThreshold && (
                <span className="text-xs text-destructive">Must be &gt; 0</span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ── Section 2: Channels ───────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-3 border-b border-border">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Monitor className="h-4 w-4 text-blue-500" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold">Delivery Channels</CardTitle>
                <CardDescription className="text-xs">
                  Channels used when dispatching an intervention — at least one required
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-5">
            {!validChannels && (
              <p className="text-xs text-destructive mb-3">At least one channel must be selected</p>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              {CHANNEL_OPTIONS.map(({ id, label, icon: Icon, description }) => {
                const checked = channels.includes(id);
                return (
                  <label
                    key={id}
                    className={`flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition-colors select-none ${
                      checked
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-muted/40'
                    }`}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggleChannel(id)}
                      className="flex-shrink-0"
                    />
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      checked ? 'bg-primary/10' : 'bg-muted'
                    }`}>
                      <Icon className={`h-4 w-4 ${checked ? 'text-primary' : 'text-muted-foreground'}`} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium leading-tight">{label}</div>
                      <div className="text-[10px] text-muted-foreground leading-snug mt-0.5">{description}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* ── Section 3: Cooldown ───────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-3 border-b border-border">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <Clock className="h-4 w-4 text-emerald-500" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold">Intervention Cooldown</CardTitle>
                <CardDescription className="text-xs">
                  Minimum time before re-triggering an intervention for the same player
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-5 space-y-4">
            <div className="flex items-start gap-5 flex-wrap">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Cooldown period</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="1"
                    max="60"
                    value={cooldown}
                    onChange={e => { setCooldown(Number(e.target.value)); setDirty(true); }}
                    className={`w-24 h-8 text-sm tabular-nums ${!validCooldown ? 'border-destructive' : ''}`}
                  />
                  <span className="text-sm text-muted-foreground">minutes</span>
                </div>
                {!validCooldown && (
                  <p className="text-xs text-destructive">Must be between 1–60 minutes</p>
                )}
              </div>
              <div className="rounded-xl bg-muted/40 border border-border px-4 py-3 text-sm">
                <div className="font-semibold text-foreground">
                  {cooldown} {cooldown === 1 ? 'minute' : 'minutes'} between interventions
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Per-player · checked in-memory and against DB
                </div>
              </div>
            </div>
            <Slider
              value={[cooldown]}
              onValueChange={([v]) => { setCooldown(v); setDirty(true); }}
              min={1}
              max={60}
              step={1}
            />
            <div className="flex justify-between text-[10px] text-muted-foreground -mt-2">
              <span>1 min</span>
              <span>30 min</span>
              <span>60 min</span>
            </div>
          </CardContent>
        </Card>

        {/* ── Section 4: Message Template ───────────────────────────────── */}
        <Card>
          <CardHeader className="pb-3 border-b border-border">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
                <MessageSquare className="h-4 w-4 text-violet-500" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold">Message Template</CardTitle>
                <CardDescription className="text-xs">
                  Sent across all enabled channels. Supports{' '}
                  <code className="font-mono bg-muted px-0.5 rounded">{'{player}'}</code>
                  {', '}
                  <code className="font-mono bg-muted px-0.5 rounded">{'{risk}'}</code>
                  {', '}
                  <code className="font-mono bg-muted px-0.5 rounded">{'{amount}'}</code>{' '}
                  variables
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-5 space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Template</Label>
              <Textarea
                value={msgTemplate}
                onChange={e => { setMsgTemplate(e.target.value); setDirty(true); }}
                rows={4}
                className="text-sm resize-none"
                placeholder={
                  'Hi {player}, your current risk level is {risk}. ' +
                  'You may lose approximately R{amount} in the next 30 minutes. ' +
                  'Please consider taking a break. Support: 0800 006 008.'
                }
              />
              {/* Variable insert buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] text-muted-foreground">Insert variable:</span>
                {['{player}', '{risk}', '{amount}'].map(v => (
                  <button
                    key={v}
                    type="button"
                    className="font-mono text-[10px] px-2 py-0.5 rounded bg-muted border border-border hover:bg-primary/10 hover:border-primary/40 transition-colors"
                    onClick={() => { setMsgTemplate(t => t + v); setDirty(true); }}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            {/* Live preview */}
            <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Live Preview
                </div>
                <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                  Jane Doe · Risk 87 · R 6,200
                </Badge>
              </div>
              <p className="text-sm text-foreground leading-relaxed">{messagePreview}</p>
            </div>
          </CardContent>
        </Card>

        {/* ── Section 5: Save ───────────────────────────────────────────── */}
        <div className="flex items-center gap-3 flex-wrap">
          <Button
            onClick={handleSave}
            disabled={!canSave}
            size="default"
            className="gap-2"
          >
            {saving
              ? <><RefreshCw className="h-4 w-4 animate-spin" /> Saving…</>
              : <><Save className="h-4 w-4" /> Save Settings</>
            }
          </Button>

          {!dirty && !saving && (
            <div className="flex items-center gap-1.5 text-sm text-emerald-600">
              <CheckCircle2 className="h-3.5 w-3.5" />
              All changes saved
            </div>
          )}

          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground"
            onClick={() => {
              setThreshold(settings.intervention_threshold);
              setChannels(settings.enabled_channels);
              setCooldown(settings.cooldown_minutes);
              setMsgTemplate(settings.message_template);
              setDirty(false);
            }}
          >
            Reset to saved
          </Button>
        </div>

        {/* ── Info note ─────────────────────────────────────────────────── */}
        <div className="rounded-xl border border-border bg-muted/10 px-4 py-3 text-xs text-muted-foreground space-y-1.5">
          <div className="font-semibold text-foreground/60 flex items-center gap-1.5">
            <Info className="h-3 w-3" />
            How settings are applied
          </div>
          <div>Settings take effect immediately after saving — the next intervention will use the new values.</div>
          <div>Changes sync in real-time via Supabase Realtime to all open tabs without a page reload.</div>
          <div>
            Stored in:{' '}
            <code className="font-mono bg-muted px-1 rounded">casino_settings</code>
            {' '}· RLS-enforced · one row per casino
          </div>
        </div>

      </div>
    </TooltipProvider>
  );
}
