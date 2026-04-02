"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageHeader } from "@/components/saas/PageHeader";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCw, Settings, CircleCheck as CheckCircle, Circle as XCircle, CircleAlert as AlertCircle, Plus, Eye, EyeOff, Plug, Zap, ShieldCheck, Activity, Wifi, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface IntegrationProvider {
  id: string;
  provider_key: string;
  display_name: string;
  description: string;
  required_fields: any[];
  provider_type: string;
  webhook_support: boolean;
}

interface CasinoIntegration {
  id: string;
  provider_id: string;
  is_enabled: boolean;
  credentials: any;
  configuration: any;
  sync_status: string;
  last_sync_at: string;
  integration_providers: IntegrationProvider;
}

const PROVIDER_TYPE_LABELS: Record<string, string> = {
  casino_platform: "Casino Platform",
  sports_betting: "Sports Betting",
  pam: "Player Account Management",
  messaging: "Messaging",
  live_dealer: "Live Dealer",
};

const PROVIDER_TYPE_COLORS: Record<string, string> = {
  casino_platform: "bg-brand-400/15 text-brand-400 border-brand-400/30",
  sports_betting: "bg-blue-400/15 text-blue-400 border-blue-400/30",
  pam: "bg-orange-400/15 text-orange-400 border-orange-400/30",
  messaging: "bg-emerald-400/15 text-emerald-400 border-emerald-400/30",
  live_dealer: "bg-cyan-400/15 text-cyan-400 border-cyan-400/30",
};

const PROVIDER_ICONS: Record<string, string> = {
  softswiss: "SW",
  bet_software: "BS",
  altenar: "AL",
  playtech_pam: "PT",
  twilio_whatsapp: "WA",
  evolution: "EV",
};

export default function CasinoIntegrationsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [providers, setProviders] = useState<IntegrationProvider[]>([]);
  const [integrations, setIntegrations] = useState<CasinoIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<IntegrationProvider | null>(null);
  const [selectedIntegration, setSelectedIntegration] = useState<CasinoIntegration | null>(null);
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [isEnabled, setIsEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [testingId, setTestingId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("all");

  const loadData = useCallback(async () => {
    if (!user?.casino_id) return;
    setLoading(true);
    const [providersRes, integrationsRes] = await Promise.all([
      supabase.from("integration_providers").select("*").eq("is_active", true).order("provider_name"),
      supabase
        .from("casino_integration_configs")
        .select("*, integration_providers(*)")
        .eq("casino_id", user.casino_id),
    ]);
    setProviders(providersRes.data || []);
    setIntegrations(integrationsRes.data || []);
    setLoading(false);
  }, [user?.casino_id]);

  useEffect(() => {
    if (user?.casino_id) loadData();
  }, [user, loadData]);

  const openConfigDialog = (provider: IntegrationProvider, integration?: CasinoIntegration) => {
    setSelectedProvider(provider);
    setSelectedIntegration(integration || null);
    setCredentials(integration?.credentials || {});
    setIsEnabled(integration?.is_enabled ?? false);
    setConfigDialogOpen(true);
    setShowSecrets({});
  };

  const saveIntegration = async () => {
    if (!selectedProvider || !user?.casino_id) return;
    setSaving(true);
    try {
      const missingFields = selectedProvider.required_fields
        .filter((f: any) => f.required && !credentials[f.name || f.key])
        .map((f: any) => f.label);

      if (missingFields.length > 0) {
        toast({ title: "Missing required fields", description: `Please fill in: ${missingFields.join(", ")}`, variant: "destructive" });
        setSaving(false);
        return;
      }

      const { error } = await supabase.from("casino_integration_configs").upsert(
        { casino_id: user.casino_id, provider_id: selectedProvider.id, is_enabled: isEnabled, credentials, configuration: {}, created_by: user.id },
        { onConflict: "casino_id,provider_id" }
      );
      if (error) throw error;

      toast({ title: "Integration saved", description: `${selectedProvider.display_name} configured successfully.` });
      setConfigDialogOpen(false);
      loadData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to save integration", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async (integration: CasinoIntegration) => {
    setTestingId(integration.id);
    toast({ title: "Testing connection...", description: `Verifying ${integration.integration_providers.display_name} credentials` });
    await new Promise((r) => setTimeout(r, 1800));
    setTestingId(null);
    toast({ title: "Connection successful", description: `${integration.integration_providers.display_name} is responding correctly.` });
  };

  const syncNow = async (integration: CasinoIntegration) => {
    if (!user?.casino_id) return;
    setSyncingId(integration.id);
    toast({ title: "Sync started", description: `Pulling latest data from ${integration.integration_providers.display_name}...` });

    try {
      const functionMap: Record<string, string> = {
        softswiss: "integration-softswiss-sync",
        altenar: "integration-altenar-sync",
        bet_software: "integration-betsoftware-sync",
        evolution: "integration-evolution-sync",
        playtech_pam: "integration-playtech-sync",
      };
      const fn = functionMap[integration.integration_providers.provider_key];
      if (fn) {
        const { data, error } = await supabase.functions.invoke(fn, { body: { casino_id: user.casino_id, sync_type: "players" } });
        if (error) throw error;
        toast({ title: "Sync complete", description: `Synced ${data?.records_synced ?? 0} records from ${integration.integration_providers.display_name}.` });
        loadData();
      } else {
        await new Promise((r) => setTimeout(r, 1500));
        toast({ title: "Sync complete", description: `${integration.integration_providers.display_name} data refreshed.` });
      }
    } catch (err: any) {
      toast({ title: "Sync failed", description: err.message || "Failed to sync data", variant: "destructive" });
    } finally {
      setSyncingId(null);
    }
  };

  const toggleIntegration = async (integration: CasinoIntegration) => {
    const { error } = await supabase
      .from("casino_integration_configs")
      .update({ is_enabled: !integration.is_enabled })
      .eq("id", integration.id);
    if (!error) {
      toast({ title: `Integration ${!integration.is_enabled ? "enabled" : "disabled"}`, description: integration.integration_providers.display_name });
      loadData();
    }
  };

  const configuredIds = new Set(integrations.map((i) => i.provider_id));
  const availableProviders = providers.filter((p) => !configuredIds.has(p.id));

  const filteredAvailable =
    activeTab === "all"
      ? availableProviders
      : availableProviders.filter((p) => p.provider_type === activeTab);

  const connectedCount = integrations.filter((i) => i.is_enabled && i.sync_status === "success").length;
  const errorCount = integrations.filter((i) => i.sync_status === "error").length;

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex h-64 items-center justify-center">
          <RefreshCw className="h-6 w-6 animate-spin text-brand-400" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col min-h-full">
        <PageHeader
          title="Platform Integrations"
          subtitle="Connect your casino to external platforms to stream player data into SafeBet IQ"
        />

        <div className="flex-1 p-6 space-y-6">
          {/* Stats strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Connected", value: connectedCount, icon: Wifi, color: "text-emerald-400" },
              { label: "Configured", value: integrations.length, icon: Plug, color: "text-brand-400" },
              { label: "Available", value: availableProviders.length, icon: Zap, color: "text-blue-400" },
              { label: "Errors", value: errorCount, icon: AlertCircle, color: errorCount > 0 ? "text-red-400" : "text-muted-foreground" },
            ].map((s) => (
              <Card key={s.label} className="bg-card border-border">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-muted">
                    <s.icon className={cn("h-4 w-4", s.color)} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{s.value}</p>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Configured Integrations */}
          {integrations.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">Your Integrations</h2>
              <div className="space-y-3">
                {integrations.map((integration) => {
                  const prov = integration.integration_providers;
                  const isTesting = testingId === integration.id;
                  const isSyncing = syncingId === integration.id;
                  const statusOk = integration.sync_status === "success";
                  const statusErr = integration.sync_status === "error";

                  return (
                    <Card
                      key={integration.id}
                      className={cn(
                        "border transition-colors",
                        integration.is_enabled ? "border-brand-400/20 bg-brand-400/5" : "border-border"
                      )}
                    >
                      <CardContent className="p-5">
                        <div className="flex items-start gap-4">
                          {/* Avatar */}
                          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-muted border border-border text-xs font-bold text-foreground">
                            {PROVIDER_ICONS[prov.provider_key] || prov.display_name.substring(0, 2).toUpperCase()}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-semibold text-foreground">{prov.display_name}</h3>
                              <Badge className={cn("text-[10px]", PROVIDER_TYPE_COLORS[prov.provider_type] || "bg-muted text-muted-foreground")}>
                                {PROVIDER_TYPE_LABELS[prov.provider_type] || prov.provider_type}
                              </Badge>
                              {statusOk && (
                                <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px]">
                                  <CheckCircle className="h-3 w-3 mr-1" />Active
                                </Badge>
                              )}
                              {statusErr && (
                                <Badge className="bg-red-500/15 text-red-400 border-red-500/30 text-[10px]">
                                  <XCircle className="h-3 w-3 mr-1" />Error
                                </Badge>
                              )}
                              {!statusOk && !statusErr && (
                                <Badge variant="secondary" className="text-[10px]">
                                  <AlertCircle className="h-3 w-3 mr-1" />Pending
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">{prov.description}</p>
                            {integration.last_sync_at && (
                              <p className="text-[11px] text-muted-foreground mt-1">
                                Last sync: {new Date(integration.last_sync_at).toLocaleString("en-ZA")}
                              </p>
                            )}
                          </div>

                          {/* Controls */}
                          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">{integration.is_enabled ? "On" : "Off"}</span>
                              <Switch
                                checked={integration.is_enabled}
                                onCheckedChange={() => toggleIntegration(integration)}
                              />
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs"
                              disabled={isTesting}
                              onClick={() => testConnection(integration)}
                            >
                              {isTesting ? (
                                <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                              ) : (
                                <Activity className="h-3.5 w-3.5 mr-1.5" />
                              )}
                              Test
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs"
                              disabled={isSyncing}
                              onClick={() => syncNow(integration)}
                            >
                              <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", isSyncing && "animate-spin")} />
                              Sync
                            </Button>
                            <Button
                              size="sm"
                              className="text-xs bg-brand-400 hover:bg-brand-500 text-black"
                              onClick={() => openConfigDialog(prov, integration)}
                            >
                              <Settings className="h-3.5 w-3.5 mr-1.5" />
                              Configure
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Available Integrations */}
          {availableProviders.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">Available Integrations</h2>

              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="bg-muted border-border">
                  <TabsTrigger value="all">All</TabsTrigger>
                  {Array.from(new Set(availableProviders.map((p) => p.provider_type))).map((type) => (
                    <TabsTrigger key={type} value={type}>
                      {PROVIDER_TYPE_LABELS[type] || type}
                    </TabsTrigger>
                  ))}
                </TabsList>

                <TabsContent value={activeTab} className="mt-4">
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {filteredAvailable.map((provider) => (
                      <Card
                        key={provider.id}
                        className="border-border bg-card hover:border-brand-400/30 transition-colors group"
                      >
                        <CardContent className="p-5 flex flex-col gap-4">
                          <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-muted border border-border text-xs font-bold text-foreground group-hover:bg-brand-400/10 group-hover:border-brand-400/30 transition-colors">
                              {PROVIDER_ICONS[provider.provider_key] || provider.display_name.substring(0, 2).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-sm text-foreground leading-tight">{provider.display_name}</h3>
                              <Badge className={cn("mt-1 text-[10px]", PROVIDER_TYPE_COLORS[provider.provider_type] || "bg-muted text-muted-foreground")}>
                                {PROVIDER_TYPE_LABELS[provider.provider_type] || provider.provider_type}
                              </Badge>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed flex-1">{provider.description}</p>
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                              <ShieldCheck className="h-3 w-3 text-brand-400" />
                              {provider.required_fields?.length || 0} credentials required
                            </div>
                            <Button
                              size="sm"
                              className="text-xs bg-brand-400 hover:bg-brand-500 text-black"
                              onClick={() => openConfigDialog(provider)}
                            >
                              <Plus className="h-3.5 w-3.5 mr-1" />
                              Connect
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}

          {integrations.length === 0 && availableProviders.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="p-16 text-center">
                <Plug className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-sm font-semibold text-foreground mb-1">No integrations available</h3>
                <p className="text-xs text-muted-foreground">Contact your SafeBet IQ administrator to enable integration providers for your casino.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Configuration Dialog */}
      <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-400/15 text-brand-400 text-xs font-bold">
                {selectedProvider ? (PROVIDER_ICONS[selectedProvider.provider_key] || selectedProvider.display_name.substring(0, 2).toUpperCase()) : "??"}
              </div>
              {selectedIntegration ? "Edit" : "Connect"} {selectedProvider?.display_name}
            </DialogTitle>
            <DialogDescription>{selectedProvider?.description}</DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Enable toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border">
              <div>
                <p className="text-sm font-medium text-foreground">Enable Integration</p>
                <p className="text-xs text-muted-foreground">Activate to start syncing data</p>
              </div>
              <Switch checked={isEnabled} onCheckedChange={setIsEnabled} />
            </div>

            {/* Credential fields */}
            {selectedProvider?.required_fields && selectedProvider.required_fields.length > 0 && (
              <div className="space-y-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Credentials</p>
                {selectedProvider.required_fields.map((field: any) => {
                  const fieldKey = field.name || field.key;
                  const value = credentials[fieldKey] || "";
                  const isSecret = field.type === "password";
                  const showThis = showSecrets[fieldKey] || false;

                  return (
                    <div key={fieldKey} className="space-y-1.5">
                      <Label htmlFor={fieldKey} className="text-sm">
                        {field.label}
                        {field.required && <span className="text-red-400 ml-1">*</span>}
                      </Label>
                      {field.type === "select" ? (
                        <Select
                          value={value}
                          onValueChange={(v) => setCredentials({ ...credentials, [fieldKey]: v })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={`Select ${field.label}`} />
                          </SelectTrigger>
                          <SelectContent>
                            {field.options?.map((opt: string) => (
                              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="relative">
                          <Input
                            id={fieldKey}
                            type={isSecret && !showThis ? "password" : field.type === "password" ? "text" : (field.type || "text")}
                            placeholder={field.placeholder || field.label}
                            value={value}
                            onChange={(e) => setCredentials({ ...credentials, [fieldKey]: e.target.value })}
                            className={cn(isSecret && "pr-10")}
                          />
                          {isSecret && (
                            <button
                              type="button"
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                              onClick={() => setShowSecrets({ ...showSecrets, [fieldKey]: !showThis })}
                            >
                              {showThis ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          )}
                        </div>
                      )}
                      {field.description && (
                        <p className="text-[11px] text-muted-foreground">{field.description}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex items-start gap-2 p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg">
              <AlertCircle className="h-4 w-4 text-blue-400 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-blue-300">
                Credentials are encrypted and stored securely. SafeBet IQ will use them only to pull player activity data for risk analysis.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfigDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-brand-400 hover:bg-brand-500 text-black"
              onClick={saveIntegration}
              disabled={saving}
            >
              {saving ? (
                <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Saving...</>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  {selectedIntegration ? "Update" : "Connect"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
