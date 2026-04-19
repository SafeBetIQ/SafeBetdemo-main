"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageHeader } from "@/components/saas/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCw, Settings, CircleCheck as CheckCircle, Circle as XCircle, CircleAlert as AlertCircle, Plug, Network, Building2, Zap, Wifi } from "lucide-react";
import { cn } from "@/lib/utils";

interface IntegrationProvider {
  id: string;
  provider_key: string;
  provider_name: string;
  provider_type: string;
  display_name: string;
  description: string;
  is_active: boolean;
}

interface CasinoIntegration {
  id: string;
  casino_id: string;
  provider_id: string;
  is_enabled: boolean;
  sync_status: string;
  last_sync_at: string;
  casinos: { name: string } | null;
  integration_providers: IntegrationProvider;
}

const PROVIDER_TYPE_LABELS: Record<string, string> = {
  casino_platform: "Casino Platform",
  sports_betting: "Sports Betting",
  pam: "PAM",
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

export default function AdminIntegrationsPage() {
  const [providers, setProviders] = useState<IntegrationProvider[]>([]);
  const [integrations, setIntegrations] = useState<CasinoIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    const [providersRes, integrationsRes] = await Promise.all([
      supabase.from("integration_providers").select("*").order("provider_name"),
      supabase
        .from("casino_integration_configs")
        .select("*, casinos(name), integration_providers(*)")
        .order("created_at", { ascending: false }),
    ]);
    setProviders(providersRes.data || []);
    setIntegrations(integrationsRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const toggleProvider = async (provider: IntegrationProvider) => {
    setTogglingId(provider.id);
    await supabase
      .from("integration_providers")
      .update({ is_active: !provider.is_active })
      .eq("id", provider.id);
    await loadData();
    setTogglingId(null);
  };

  const groupedByType = integrations.reduce((acc, i) => {
    const type = i.integration_providers?.provider_type || "other";
    if (!acc[type]) acc[type] = [];
    acc[type].push(i);
    return acc;
  }, {} as Record<string, CasinoIntegration[]>);

  const types = Object.keys(groupedByType);
  const activeCount = integrations.filter((i) => i.is_enabled && i.sync_status === "success").length;
  const errorCount = integrations.filter((i) => i.sync_status === "error").length;
  const activeProviders = providers.filter((p) => p.is_active).length;

  return (
    <DashboardLayout>
      <div className="flex flex-col min-h-full">
        <PageHeader
          title="Integration Management"
          subtitle="Manage all casino platform integrations and provider configurations across the system"
          actions={
            <Button size="sm" variant="outline" onClick={loadData} disabled={loading}>
              <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
              Refresh
            </Button>
          }
        />

        <div className="flex-1 p-6 space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Total Integrations", value: integrations.length, icon: Plug, color: "text-brand-400" },
              { label: "Active", value: activeCount, icon: Wifi, color: "text-emerald-400" },
              { label: "Providers Enabled", value: activeProviders, icon: Zap, color: "text-blue-400" },
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

          <Tabs defaultValue="providers" className="space-y-4">
            <TabsList className="bg-muted border-border">
              <TabsTrigger value="providers">
                <Plug className="h-4 w-4 mr-2" />
                Providers ({providers.length})
              </TabsTrigger>
              <TabsTrigger value="all">
                <Network className="h-4 w-4 mr-2" />
                All Integrations ({integrations.length})
              </TabsTrigger>
              {types.map((type) => (
                <TabsTrigger key={type} value={type}>
                  {PROVIDER_TYPE_LABELS[type] || type} ({groupedByType[type].length})
                </TabsTrigger>
              ))}
            </TabsList>

            {/* PROVIDERS TAB */}
            <TabsContent value="providers" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {providers.map((provider) => (
                  <Card
                    key={provider.id}
                    className={cn(
                      "border transition-colors",
                      provider.is_active ? "border-brand-400/20 bg-brand-400/5" : "border-border"
                    )}
                  >
                    <CardContent className="p-5 space-y-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-muted border border-border text-xs font-bold text-foreground">
                            {PROVIDER_ICONS[provider.provider_key] || provider.display_name?.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <h3 className="font-semibold text-sm text-foreground">{provider.display_name}</h3>
                            <Badge className={cn("mt-1 text-[10px]", PROVIDER_TYPE_COLORS[provider.provider_type] || "bg-muted text-muted-foreground")}>
                              {PROVIDER_TYPE_LABELS[provider.provider_type] || provider.provider_type}
                            </Badge>
                          </div>
                        </div>
                        <Switch
                          checked={provider.is_active}
                          disabled={togglingId === provider.id}
                          onCheckedChange={() => toggleProvider(provider)}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">{provider.description}</p>
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[11px] text-muted-foreground">
                          {integrations.filter((i) => i.provider_id === provider.id).length} casino(s) connected
                        </span>
                        <Badge
                          className={cn(
                            "text-[10px]",
                            provider.is_active
                              ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                              : "bg-muted text-muted-foreground"
                          )}
                        >
                          {provider.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* ALL INTEGRATIONS TAB */}
            <TabsContent value="all" className="space-y-3">
              <IntegrationList integrations={integrations} />
            </TabsContent>

            {/* PER-TYPE TABS */}
            {types.map((type) => (
              <TabsContent key={type} value={type} className="space-y-3">
                <IntegrationList integrations={groupedByType[type]} />
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </div>
    </DashboardLayout>
  );
}

function IntegrationList({ integrations }: { integrations: CasinoIntegration[] }) {
  if (integrations.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-12 text-center">
          <Plug className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No integrations in this category</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {integrations.map((integration) => {
        const prov = integration.integration_providers;
        const statusOk = integration.sync_status === "success";
        const statusErr = integration.sync_status === "error";

        return (
          <Card
            key={integration.id}
            className={cn(
              "border transition-colors",
              integration.is_enabled ? "border-brand-400/20" : "border-border"
            )}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-muted border border-border text-xs font-bold text-foreground">
                  {PROVIDER_ICONS[prov?.provider_key] || prov?.display_name?.substring(0, 2).toUpperCase() || "??"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-foreground">
                      {integration.casinos?.name || "Unknown Casino"}
                    </span>
                    <span className="text-muted-foreground text-xs">—</span>
                    <span className="text-sm text-muted-foreground">{prov?.display_name}</span>
                    <Badge className={cn("text-[10px]", PROVIDER_TYPE_COLORS[prov?.provider_type] || "bg-muted text-muted-foreground")}>
                      {PROVIDER_TYPE_LABELS[prov?.provider_type] || prov?.provider_type}
                    </Badge>
                  </div>
                  {integration.last_sync_at && (
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Last sync: {new Date(integration.last_sync_at).toLocaleString("en-ZA")}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {integration.is_enabled ? (
                    <Badge className="bg-brand-400/15 text-brand-400 border-brand-400/30 text-[10px]">Enabled</Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[10px]">Disabled</Badge>
                  )}
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
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
