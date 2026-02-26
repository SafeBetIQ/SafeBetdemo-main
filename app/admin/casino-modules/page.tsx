'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Shield, Search, Building2, Package, Zap, CircleCheck as CheckCircle2, Circle as XCircle, Clock, ArrowLeft, Crown, TrendingUp, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface SoftwareModule {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  price_tier: string;
  price_monthly: number;
  is_active: boolean;
  sort_order: number;
}

interface Casino {
  id: string;
  email: string;
  name: string;
}

interface CasinoModule {
  casino_id: string;
  module_id: string;
  enabled_at: string;
  expires_at?: string;
}

interface PricingPackage {
  id: string;
  name: string;
  slug: string;
  description: string;
  price_monthly: number;
  price_annual: number;
  features: string[];
  sort_order: number;
}

interface PackageModule {
  package_id: string;
  module_id: string;
  is_included: boolean;
}

const categoryIcons: Record<string, any> = {
  core: Shield,
  analytics: Zap,
  compliance: CheckCircle2,
  training: Building2,
  ai: Zap,
};

const priceTierColors: Record<string, string> = {
  included: 'bg-gray-500',
  standard: 'bg-blue-500',
  premium: 'bg-purple-500',
  enterprise: 'bg-amber-500',
};

export default function CasinoModulesPage() {
  const { user } = useAuth();
  const userRole = (user as any)?.role;
  const { toast } = useToast();
  const [modules, setModules] = useState<SoftwareModule[]>([]);
  const [casinos, setCasinos] = useState<Casino[]>([]);
  const [casinoModules, setCasinoModules] = useState<CasinoModule[]>([]);
  const [packages, setPackages] = useState<PricingPackage[]>([]);
  const [packageModules, setPackageModules] = useState<PackageModule[]>([]);
  const [selectedCasino, setSelectedCasino] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [activeTab, setActiveTab] = useState('packages');
  const router = useRouter();

  useEffect(() => {
    if (user && userRole === 'super_admin') {
      loadData();
    }
  }, [user, userRole]);

  const loadData = async () => {
    try {
      setLoading(true);

      const [modulesRes, casinosRes, casinoModulesRes, packagesRes, packageModulesRes] = await Promise.all([
        supabase.from('software_modules').select('*').order('category, sort_order'),
        supabase.from('casinos').select('id, name, contact_email').order('name'),
        supabase.from('casino_modules').select('casino_id, module_id, enabled_at, expires_at'),
        supabase.from('pricing_packages').select('*').order('sort_order'),
        supabase.from('package_modules').select('package_id, module_id, is_included'),
      ]);

      if (modulesRes.data) setModules(modulesRes.data);
      if (casinosRes.data) {
        const mappedCasinos = casinosRes.data.map((c: any) => ({
          id: c.id,
          name: c.name,
          email: c.contact_email,
        }));
        setCasinos(mappedCasinos);
        if (mappedCasinos.length > 0 && !selectedCasino) {
          setSelectedCasino(mappedCasinos[0].id);
        }
      }
      if (casinoModulesRes.data) setCasinoModules(casinoModulesRes.data);
      if (packagesRes.data) setPackages(packagesRes.data);
      if (packageModulesRes.data) setPackageModules(packageModulesRes.data);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load module data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const hasModule = (casinoId: string, moduleId: string) => {
    return casinoModules.some(
      (cm) => cm.casino_id === casinoId && cm.module_id === moduleId
    );
  };

  const toggleModule = async (casinoId: string, moduleId: string, currentlyEnabled: boolean) => {
    try {
      setUpdating(moduleId);

      if (currentlyEnabled) {
        const { error } = await supabase
          .from('casino_modules')
          .delete()
          .eq('casino_id', casinoId)
          .eq('module_id', moduleId);

        if (error) {
          throw error;
        }

        // Update local state immediately
        setCasinoModules((prev) =>
          prev.filter((cm) => !(cm.casino_id === casinoId && cm.module_id === moduleId))
        );

        toast({
          title: 'Module Disabled',
          description: 'Casino dashboard will update automatically',
        });
      } else {
        const { data, error } = await supabase.from('casino_modules').insert({
          casino_id: casinoId,
          module_id: moduleId,
          enabled_by: user?.id,
        }).select().single();

        if (error) {
          throw error;
        }

        // Update local state with actual data from database
        if (data) {
          setCasinoModules((prev) => [
            ...prev,
            {
              casino_id: data.casino_id,
              module_id: data.module_id,
              enabled_at: data.enabled_at,
              expires_at: data.expires_at,
            },
          ]);
        }

        toast({
          title: 'Module Enabled',
          description: 'Casino dashboard will update automatically',
        });
      }

      // Force a refresh of the data to ensure consistency
      await loadData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error?.message || error?.error_description || 'Failed to update module assignment',
        variant: 'destructive',
      });
      // Reload data even on error to ensure UI is consistent with database
      await loadData();
    } finally {
      setUpdating(null);
    }
  };

  const enableAllModules = async (casinoId: string) => {
    try {
      setBulkUpdating(true);

      const modulesToAdd = modules
        .filter((m) => !hasModule(casinoId, m.id))
        .map((m) => ({
          casino_id: casinoId,
          module_id: m.id,
          enabled_by: user?.id,
        }));

      if (modulesToAdd.length === 0) {
        toast({
          title: 'Info',
          description: 'All modules are already enabled for this casino',
        });
        setBulkUpdating(false);
        return;
      }

      const { error } = await supabase.from('casino_modules').insert(modulesToAdd);

      if (error) {
        throw error;
      }

      // Reload all data to ensure consistency
      await loadData();

      toast({
        title: 'Success',
        description: `Enabled ${modulesToAdd.length} modules for this casino`,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error?.message || error?.error_description || 'Failed to enable all modules',
        variant: 'destructive',
      });
      await loadData();
    } finally {
      setBulkUpdating(false);
    }
  };

  const disableAllModules = async (casinoId: string) => {
    try {
      setBulkUpdating(true);

      const { error } = await supabase
        .from('casino_modules')
        .delete()
        .eq('casino_id', casinoId);

      if (error) {
        throw error;
      }

      // Reload all data to ensure consistency
      await loadData();

      toast({
        title: 'Success',
        description: 'All modules have been disabled for this casino',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error?.message || error?.error_description || 'Failed to disable all modules',
        variant: 'destructive',
      });
      await loadData();
    } finally {
      setBulkUpdating(false);
    }
  };

  const assignPackage = async (casinoId: string, packageId: string) => {
    try {
      setBulkUpdating(true);
      const pkg = packages.find(p => p.id === packageId);

      // Get all modules for this package
      const moduleIds = packageModules
        .filter(pm => pm.package_id === packageId && pm.is_included)
        .map(pm => pm.module_id);

      if (moduleIds.length === 0) {
        toast({
          title: 'Error',
          description: 'This package has no modules configured',
          variant: 'destructive',
        });
        setBulkUpdating(false);
        return;
      }

      // First, remove all existing modules
      await supabase
        .from('casino_modules')
        .delete()
        .eq('casino_id', casinoId);

      // Then add all modules from the package
      const modulesToAdd = moduleIds.map(moduleId => ({
        casino_id: casinoId,
        module_id: moduleId,
        enabled_by: user?.id,
      }));

      const { error } = await supabase
        .from('casino_modules')
        .insert(modulesToAdd);

      if (error) {
        throw error;
      }

      // Record package assignment
      await supabase
        .from('casino_packages')
        .upsert({
          casino_id: casinoId,
          package_id: packageId,
          activated_by: user?.id,
          is_active: true,
        });

      await loadData();

      toast({
        title: 'Success',
        description: `${pkg?.name} package assigned successfully`,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error?.message || 'Failed to assign package',
        variant: 'destructive',
      });
      await loadData();
    } finally {
      setBulkUpdating(false);
    }
  };

  const getPackageIcon = (packageName: string) => {
    switch (packageName.toLowerCase()) {
      case 'standard':
        return Package;
      case 'enterprise':
        return TrendingUp;
      case 'premium':
        return Crown;
      default:
        return Package;
    }
  };

  const getModulesForPackage = (packageId: string) => {
    const moduleIds = packageModules
      .filter(pm => pm.package_id === packageId && pm.is_included)
      .map(pm => pm.module_id);
    return modules.filter(m => moduleIds.includes(m.id));
  };

  const filteredModules = modules.filter(
    (m) =>
      m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const groupedModules = filteredModules.reduce((acc, module) => {
    if (!acc[module.category]) {
      acc[module.category] = [];
    }
    acc[module.category].push(module);
    return acc;
  }, {} as Record<string, SoftwareModule[]>);

  if (userRole !== 'super_admin') {
    return (
      <div className="p-8">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Access denied. This page is only available to super administrators.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const selectedCasinoData = casinos.find((c) => c.id === selectedCasino);
  const enabledCount = modules.filter((m) => hasModule(selectedCasino, m.id)).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div>
          <Button
            variant="ghost"
            className="mb-4"
            onClick={() => router.push('/admin')}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Admin Dashboard
          </Button>
          <h1 className="text-4xl font-bold mb-2">Casino Software Modules</h1>
          <p className="text-muted-foreground">
            Manage which features and modules each casino has access to
          </p>
        </div>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Select Casino</CardTitle>
              <CardDescription>
                Choose a casino to manage their software module access
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {casinos.map((casino) => {
                  const casinoEnabledCount = modules.filter((m) =>
                    hasModule(casino.id, m.id)
                  ).length;
                  const isSelected = selectedCasino === casino.id;

                  return (
                    <Card
                      key={casino.id}
                      className={`cursor-pointer transition-all hover:shadow-lg ${
                        isSelected ? 'ring-2 ring-primary' : ''
                      }`}
                      onClick={() => setSelectedCasino(casino.id)}
                    >
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-3 mb-3">
                          <Building2 className="h-5 w-5 text-primary" />
                          <h3 className="font-semibold">{casino.name || casino.email}</h3>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {casinoEnabledCount} / {modules.length} modules enabled
                        </div>
                        <div className="mt-2 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all"
                            style={{
                              width: `${(casinoEnabledCount / modules.length) * 100}%`,
                            }}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {selectedCasino && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>
                      {selectedCasinoData?.name || selectedCasinoData?.email}
                    </CardTitle>
                    <CardDescription>
                      {enabledCount} / {modules.length} modules enabled
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <TabsList className="grid w-full grid-cols-2 mb-6">
                    <TabsTrigger value="packages">
                      <Package className="mr-2 h-4 w-4" />
                      Manage by Package
                    </TabsTrigger>
                    <TabsTrigger value="modules">
                      <Sparkles className="mr-2 h-4 w-4" />
                      Individual Modules
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="packages" className="space-y-6">
                    <div className="text-center mb-6">
                      <h3 className="text-2xl font-bold mb-2">Choose a Package</h3>
                      <p className="text-muted-foreground">
                        Select a pricing tier that includes the features this casino needs
                      </p>
                    </div>

                    <div className="grid gap-6 md:grid-cols-3">
                      {packages.map((pkg) => {
                        const Icon = getPackageIcon(pkg.name);
                        const packageModulesCount = getModulesForPackage(pkg.id).length;
                        const packageCategories = Array.from(
                          new Set(getModulesForPackage(pkg.id).map(m => m.category))
                        );

                        return (
                          <Card
                            key={pkg.id}
                            className={`relative overflow-hidden transition-all hover:shadow-xl ${
                              pkg.slug === 'premium' ? 'border-amber-500 border-2' : ''
                            }`}
                          >
                            {pkg.slug === 'premium' && (
                              <div className="absolute top-0 right-0 bg-amber-500 text-white px-3 py-1 text-xs font-bold">
                                BEST VALUE
                              </div>
                            )}
                            <CardHeader>
                              <div className="flex items-center gap-3 mb-2">
                                <Icon className="h-8 w-8 text-primary" />
                                <CardTitle className="text-2xl">{pkg.name}</CardTitle>
                              </div>
                              <CardDescription className="text-base">
                                {pkg.description}
                              </CardDescription>
                              <div className="mt-4">
                                <div className="text-3xl font-bold">
                                  R{pkg.price_monthly.toLocaleString()}
                                  <span className="text-lg font-normal text-muted-foreground">/month</span>
                                </div>
                                <div className="text-sm text-muted-foreground mt-1">
                                  or R{pkg.price_annual.toLocaleString()}/year
                                </div>
                              </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                              <div className="space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                  <span className="text-muted-foreground">Modules Included:</span>
                                  <span className="font-semibold">{packageModulesCount}</span>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {packageCategories.map(cat => (
                                    <Badge key={cat} variant="secondary" className="text-xs capitalize">
                                      {cat}
                                    </Badge>
                                  ))}
                                </div>
                              </div>

                              <div className="space-y-2">
                                <p className="text-sm font-semibold">Key Features:</p>
                                <ul className="space-y-1">
                                  {pkg.features.slice(0, 6).map((feature, idx) => (
                                    <li key={idx} className="text-sm flex items-start gap-2">
                                      <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                                      <span>{feature}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>

                              <Button
                                className="w-full"
                                onClick={() => assignPackage(selectedCasino, pkg.id)}
                                disabled={bulkUpdating}
                                variant={pkg.slug === 'premium' ? 'default' : 'outline'}
                              >
                                {bulkUpdating ? 'Assigning...' : `Assign ${pkg.name}`}
                              </Button>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>

                    <Card className="mt-8 border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
                      <CardContent className="pt-6">
                        <div className="flex items-start gap-4">
                          <Sparkles className="h-6 w-6 text-blue-600 mt-1" />
                          <div>
                            <h4 className="font-semibold mb-2">Upgrade Path</h4>
                            <p className="text-sm text-muted-foreground">
                              Start with <strong>Standard</strong> for essential features, upgrade to <strong>Enterprise</strong>
                              for AI-powered risk detection and full training academy, or choose <strong>Premium</strong> for
                              complete SafeBet IQ suite with ESG reporting and advanced behavioral monitoring.
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="modules" className="space-y-6">
                    {(() => {
                      const enabledModules = modules.filter(m => hasModule(selectedCasino, m.id));
                      const totalMonthlyCost = enabledModules.reduce((sum, m) => sum + (m.price_monthly || 0), 0);

                      return (
                        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 border-blue-200 dark:border-blue-800">
                          <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm text-muted-foreground mb-1">Current Monthly Cost (À la carte)</p>
                                <p className="text-3xl font-bold">R{totalMonthlyCost.toLocaleString()}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {enabledModules.length} module{enabledModules.length !== 1 ? 's' : ''} enabled
                                </p>
                              </div>
                              {totalMonthlyCost > 75000 && (
                                <div className="text-right">
                                  <Badge variant="destructive" className="mb-2">Could Save Money</Badge>
                                  <p className="text-sm text-muted-foreground">
                                    Consider switching to a package plan
                                  </p>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })()}

                    <div className="flex items-center justify-between mb-4">
                      <div className="flex-1 max-w-md">
                        <div className="relative">
                          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Search modules..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          onClick={() => enableAllModules(selectedCasino)}
                          disabled={bulkUpdating}
                        >
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          {bulkUpdating ? 'Enabling...' : 'Enable All'}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => disableAllModules(selectedCasino)}
                          disabled={bulkUpdating}
                        >
                          <XCircle className="mr-2 h-4 w-4" />
                          {bulkUpdating ? 'Disabling...' : 'Disable All'}
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-6">
                      {Object.entries(groupedModules).map(([category, categoryModules]) => {
                        const Icon = categoryIcons[category] || Package;

                        return (
                          <div key={category}>
                            <div className="flex items-center gap-2 mb-3">
                              <Icon className="h-5 w-5 text-primary" />
                              <h3 className="text-lg font-semibold capitalize">{category}</h3>
                            </div>
                            <div className="grid gap-3">
                              {categoryModules.map((module) => {
                                const enabled = hasModule(selectedCasino, module.id);
                                const isUpdating = updating === module.id;

                                return (
                                  <Card key={module.id}>
                                    <CardContent className="pt-6">
                                      <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1">
                                          <div className="flex items-center gap-2 mb-1">
                                            <h4 className="font-semibold">{module.name}</h4>
                                            <Badge
                                              className={priceTierColors[module.price_tier]}
                                            >
                                              {module.price_tier}
                                            </Badge>
                                          </div>
                                          <p className="text-sm text-muted-foreground">
                                            {module.description}
                                          </p>
                                          {module.price_monthly > 0 && (
                                            <div className="mt-2">
                                              <span className="text-lg font-bold text-primary">
                                                R{module.price_monthly.toLocaleString()}
                                              </span>
                                              <span className="text-sm text-muted-foreground">/month</span>
                                            </div>
                                          )}
                                          {module.price_monthly === 0 && (
                                            <div className="mt-2">
                                              <span className="text-sm font-semibold text-green-600">
                                                Included (No additional cost)
                                              </span>
                                            </div>
                                          )}
                                        </div>
                                        <Switch
                                          checked={enabled}
                                          onCheckedChange={() =>
                                            toggleModule(selectedCasino, module.id, enabled)
                                          }
                                          disabled={isUpdating}
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
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
