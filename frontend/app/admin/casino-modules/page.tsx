'use client';
export const dynamic = "force-dynamic";

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Brain, Bell, FileCheck, Network, UserX, Sparkles, Landmark, Building2, ArrowLeft, Shield, CircleCheck as CheckCircle2, Lock, ChevronRight, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

interface SoftwareModule {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  price_tier: string;
  is_active: boolean;
  is_default: boolean;
  icon: string;
  sort_order: number;
}

interface Casino {
  id: string;
  name: string;
  province?: string;
}

interface CasinoModule {
  casino_id: string;
  module_id: string;
  enabled_at: string;
}

const MODULE_ICONS: Record<string, any> = {
  brain: Brain,
  bell: Bell,
  'file-check': FileCheck,
  network: Network,
  'user-x': UserX,
  sparkles: Sparkles,
  landmark: Landmark,
  shield: Shield,
};

const TIER_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  standard: { label: 'Default', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  premium: { label: 'Premium', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
  enterprise: { label: 'Enterprise', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
};

const CATEGORY_LABELS: Record<string, string> = {
  core: 'Default Features',
  intelligence: 'Intelligence',
  compliance: 'Compliance',
  ai: 'Artificial Intelligence',
};

export default function CasinoModulesPage() {
  const { user } = useAuth();
  const userRole = (user as any)?.role;
  const { toast } = useToast();
  const router = useRouter();

  const [modules, setModules] = useState<SoftwareModule[]>([]);
  const [casinos, setCasinos] = useState<Casino[]>([]);
  const [casinoModules, setCasinoModules] = useState<CasinoModule[]>([]);
  const [selectedCasino, setSelectedCasino] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    if (user && userRole === 'super_admin') loadData();
  }, [user, userRole]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [modulesRes, casinosRes, casinoModulesRes] = await Promise.all([
        supabase.from('software_modules').select('*').eq('is_active', true).order('sort_order'),
        supabase.from('casinos').select('id, name, province').order('name'),
        supabase.from('casino_modules').select('casino_id, module_id, enabled_at'),
      ]);

      if (modulesRes.data) setModules(modulesRes.data);
      if (casinosRes.data) {
        setCasinos(casinosRes.data);
        if (casinosRes.data.length > 0 && !selectedCasino) {
          setSelectedCasino(casinosRes.data[0].id);
        }
      }
      if (casinoModulesRes.data) setCasinoModules(casinoModulesRes.data);
    } catch {
      toast({ title: 'Error', description: 'Failed to load data', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const isEnabled = (casinoId: string, moduleId: string) =>
    casinoModules.some((cm) => cm.casino_id === casinoId && cm.module_id === moduleId);

  const toggleModule = async (moduleId: string) => {
    if (!selectedCasino) return;
    const currentlyEnabled = isEnabled(selectedCasino, moduleId);
    setUpdating(moduleId);
    try {
      if (currentlyEnabled) {
        await supabase
          .from('casino_modules')
          .delete()
          .eq('casino_id', selectedCasino)
          .eq('module_id', moduleId);
        setCasinoModules((prev) =>
          prev.filter((cm) => !(cm.casino_id === selectedCasino && cm.module_id === moduleId))
        );
        toast({ title: 'Module disabled', description: 'Access removed immediately.' });
      } else {
        const { data, error } = await supabase
          .from('casino_modules')
          .insert({ casino_id: selectedCasino, module_id: moduleId, enabled_by: user?.id })
          .select()
          .single();
        if (error) throw error;
        if (data) {
          setCasinoModules((prev) => [
            ...prev,
            { casino_id: data.casino_id, module_id: data.module_id, enabled_at: data.enabled_at },
          ]);
        }
        toast({ title: 'Module enabled', description: 'Casino access granted immediately.' });
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message || 'Failed to update', variant: 'destructive' });
      await loadData();
    } finally {
      setUpdating(null);
    }
  };

  const enableAllOptional = async () => {
    if (!selectedCasino) return;
    setUpdating('bulk');
    try {
      const toAdd = modules
        .filter((m) => !m.is_default && !isEnabled(selectedCasino, m.id))
        .map((m) => ({ casino_id: selectedCasino, module_id: m.id, enabled_by: user?.id }));
      if (toAdd.length === 0) {
        toast({ title: 'All optional modules already enabled' });
        return;
      }
      await supabase.from('casino_modules').insert(toAdd);
      await loadData();
      toast({ title: 'All optional modules enabled', description: `${toAdd.length} modules activated.` });
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message, variant: 'destructive' });
    } finally {
      setUpdating(null);
    }
  };

  const disableAllOptional = async () => {
    if (!selectedCasino) return;
    setUpdating('bulk');
    try {
      const toRemove = modules.filter((m) => !m.is_default && isEnabled(selectedCasino, m.id));
      for (const m of toRemove) {
        await supabase
          .from('casino_modules')
          .delete()
          .eq('casino_id', selectedCasino)
          .eq('module_id', m.id);
      }
      await loadData();
      toast({ title: 'Optional modules disabled', description: `${toRemove.length} modules deactivated.` });
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message, variant: 'destructive' });
    } finally {
      setUpdating(null);
    }
  };

  if (userRole !== 'super_admin') {
    return (
      <div className="p-8">
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            Access restricted to Super Administrators.
          </CardContent>
        </Card>
      </div>
    );
  }

  const selectedCasinoData = casinos.find((c) => c.id === selectedCasino);
  const defaultModules = modules.filter((m) => m.is_default);
  const optionalModules = modules.filter((m) => !m.is_default);
  const enabledOptionalCount = optionalModules.filter((m) => isEnabled(selectedCasino, m.id)).length;
  const totalEnabledCount = modules.filter((m) => isEnabled(selectedCasino, m.id)).length;

  const groupedOptional = optionalModules.reduce((acc, m) => {
    const key = m.category;
    if (!acc[key]) acc[key] = [];
    acc[key].push(m);
    return acc;
  }, {} as Record<string, SoftwareModule[]>);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-7xl mx-auto p-6 lg:p-8 space-y-6">

        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.push('/admin')}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Admin
          </Button>
          <div className="h-5 w-px bg-border" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Feature Module Management</h1>
            <p className="text-sm text-muted-foreground">
              Control which modules each casino can access
            </p>
          </div>
        </div>

        {/* Module overview strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-emerald-200 bg-emerald-50 dark:bg-emerald-950 dark:border-emerald-800">
            <CardContent className="pt-4 pb-4">
              <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                {defaultModules.length}
              </div>
              <div className="text-xs text-emerald-600 dark:text-emerald-500 font-medium">Default modules</div>
              <div className="text-xs text-muted-foreground mt-0.5">Enabled for all casinos</div>
            </CardContent>
          </Card>
          <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
            <CardContent className="pt-4 pb-4">
              <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                {optionalModules.length}
              </div>
              <div className="text-xs text-blue-600 dark:text-blue-500 font-medium">Optional modules</div>
              <div className="text-xs text-muted-foreground mt-0.5">Requires manual activation</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-2xl font-bold">{casinos.length}</div>
              <div className="text-xs text-muted-foreground font-medium">Licensed casinos</div>
              <div className="text-xs text-muted-foreground mt-0.5">On the platform</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-2xl font-bold">{modules.length}</div>
              <div className="text-xs text-muted-foreground font-medium">Total modules</div>
              <div className="text-xs text-muted-foreground mt-0.5">Available in platform</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Casino list */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Casinos
              </h2>
              <Button variant="ghost" size="sm" onClick={loadData} disabled={loading}>
                <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
              </Button>
            </div>
            <div className="space-y-2">
              {casinos.map((casino) => {
                const casinoEnabledCount = modules.filter((m) => isEnabled(casino.id, m.id)).length;
                const pct = modules.length > 0 ? (casinoEnabledCount / modules.length) * 100 : 0;
                const isSelected = selectedCasino === casino.id;

                return (
                  <button
                    key={casino.id}
                    onClick={() => setSelectedCasino(casino.id)}
                    className={cn(
                      'w-full text-left rounded-lg border p-3 transition-all',
                      isSelected
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-border bg-card hover:border-primary/50 hover:bg-muted/50'
                    )}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span className="text-sm font-medium leading-tight">{casino.name}</span>
                      </div>
                      {isSelected && <ChevronRight className="h-4 w-4 text-primary" />}
                    </div>
                    {casino.province && (
                      <p className="text-xs text-muted-foreground mb-1.5 pl-6">{casino.province}</p>
                    )}
                    <div className="pl-6">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-muted-foreground">{casinoEnabledCount}/{modules.length} modules</span>
                      </div>
                      <Progress value={pct} className="h-1" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Module management panel */}
          <div className="lg:col-span-2 space-y-5">
            {selectedCasinoData ? (
              <>
                {/* Selected casino header */}
                <Card>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Building2 className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold">{selectedCasinoData.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {totalEnabledCount} of {modules.length} modules active
                            {selectedCasinoData.province && ` · ${selectedCasinoData.province}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={enableAllOptional}
                          disabled={updating === 'bulk' || enabledOptionalCount === optionalModules.length}
                        >
                          Enable all optional
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={disableAllOptional}
                          disabled={updating === 'bulk' || enabledOptionalCount === 0}
                        >
                          Disable optional
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Default modules */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Shield className="h-4 w-4 text-emerald-600" />
                    <h2 className="text-sm font-semibold">Default Features</h2>
                    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">
                      Always enabled
                    </Badge>
                  </div>
                  <div className="space-y-3">
                    {defaultModules.map((module) => {
                      const Icon = MODULE_ICONS[module.icon] || Shield;
                      return (
                        <Card key={module.id} className="border-emerald-100 dark:border-emerald-900">
                          <CardContent className="pt-4 pb-4">
                            <div className="flex items-start gap-4">
                              <div className="h-9 w-9 rounded-lg bg-emerald-50 dark:bg-emerald-900 flex items-center justify-center flex-shrink-0">
                                <Icon className="h-4.5 w-4.5 text-emerald-600" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <span className="font-medium text-sm">{module.name}</span>
                                  <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs font-normal">
                                    Default
                                  </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                  {module.description}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                                <Switch checked={true} disabled className="opacity-60" />
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>

                {/* Optional modules by category */}
                {Object.entries(groupedOptional).map(([category, categoryModules]) => {
                  const tierConfig = TIER_CONFIG[categoryModules[0]?.price_tier] || TIER_CONFIG.premium;

                  return (
                    <div key={category}>
                      <div className="flex items-center gap-2 mb-3">
                        <Sparkles className="h-4 w-4 text-blue-500" />
                        <h2 className="text-sm font-semibold">
                          {CATEGORY_LABELS[category] || category}
                        </h2>
                        <Badge variant="outline" className={cn('text-xs', tierConfig.color)}>
                          {tierConfig.label}
                        </Badge>
                      </div>
                      <div className="space-y-3">
                        {categoryModules.map((module) => {
                          const Icon = MODULE_ICONS[module.icon] || Shield;
                          const enabled = isEnabled(selectedCasino, module.id);
                          const isUpdating = updating === module.id;
                          const moduleTier = TIER_CONFIG[module.price_tier] || TIER_CONFIG.premium;

                          return (
                            <Card
                              key={module.id}
                              className={cn(
                                'transition-all',
                                enabled ? 'border-primary/30 bg-primary/2' : 'opacity-80'
                              )}
                            >
                              <CardContent className="pt-4 pb-4">
                                <div className="flex items-start gap-4">
                                  <div
                                    className={cn(
                                      'h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors',
                                      enabled
                                        ? 'bg-primary/10'
                                        : 'bg-muted'
                                    )}
                                  >
                                    <Icon
                                      className={cn(
                                        'h-4.5 w-4.5 transition-colors',
                                        enabled ? 'text-primary' : 'text-muted-foreground'
                                      )}
                                    />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5">
                                      <span className="font-medium text-sm">{module.name}</span>
                                      <Badge
                                        variant="outline"
                                        className={cn('text-xs font-normal', moduleTier.color)}
                                      >
                                        {moduleTier.label}
                                      </Badge>
                                      {enabled && (
                                        <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                                          <CheckCircle2 className="h-3 w-3" />
                                          Active
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                      {module.description}
                                    </p>
                                  </div>
                                  <Switch
                                    checked={enabled}
                                    onCheckedChange={() => toggleModule(module.id)}
                                    disabled={isUpdating || updating === 'bulk'}
                                    className="flex-shrink-0"
                                  />
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </>
            ) : (
              <Card>
                <CardContent className="pt-12 pb-12 text-center text-muted-foreground">
                  Select a casino to manage its modules.
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
