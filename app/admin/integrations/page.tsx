"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCw, Settings, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";

interface IntegrationProvider {
  id: string;
  provider_key: string;
  provider_name: string;
  provider_type: string;
  display_name: string;
  description: string;
  logo_url: string;
  is_active: boolean;
}

interface CasinoIntegration {
  id: string;
  casino_id: string;
  provider_id: string;
  is_enabled: boolean;
  sync_status: string;
  last_sync_at: string;
  casinos: {
    name: string;
  };
  integration_providers: IntegrationProvider;
}

export default function IntegrationsPage() {
  const router = useRouter();
  const [providers, setProviders] = useState<IntegrationProvider[]>([]);
  const [integrations, setIntegrations] = useState<CasinoIntegration[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);

    // Load all providers
    const { data: providersData } = await supabase
      .from("integration_providers")
      .select("*")
      .order("provider_name");

    // Load all casino integrations
    const { data: integrationsData } = await supabase
      .from("casino_integration_configs")
      .select(`
        *,
        casinos(name),
        integration_providers(*)
      `)
      .order("created_at", { ascending: false });

    setProviders(providersData || []);
    setIntegrations(integrationsData || []);
    setLoading(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "success":
        return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Active</Badge>;
      case "error":
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Error</Badge>;
      case "syncing":
        return <Badge className="bg-blue-500"><RefreshCw className="w-3 h-3 mr-1 animate-spin" />Syncing</Badge>;
      default:
        return <Badge variant="secondary"><AlertCircle className="w-3 h-3 mr-1" />Pending</Badge>;
    }
  };

  const groupedIntegrations = integrations.reduce((acc, integration) => {
    const type = integration.integration_providers.provider_type;
    if (!acc[type]) acc[type] = [];
    acc[type].push(integration);
    return acc;
  }, {} as Record<string, CasinoIntegration[]>);

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Integration Management</h1>
          <p className="text-muted-foreground mt-1">
            Manage all casino platform integrations across the system
          </p>
        </div>
        <Button onClick={loadData}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Available Providers */}
      <Card>
        <CardHeader>
          <CardTitle>Available Integration Providers</CardTitle>
          <CardDescription>
            {providers.length} integration providers available
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {providers.map((provider) => (
              <Card key={provider.id} className="border-2">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{provider.display_name}</CardTitle>
                      <Badge variant="outline" className="mt-2">
                        {provider.provider_type.replace('_', ' ')}
                      </Badge>
                    </div>
                    {provider.is_active ? (
                      <Badge className="bg-green-500">Active</Badge>
                    ) : (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{provider.description}</p>
                  <div className="mt-4 flex justify-end">
                    <Button size="sm" variant="outline">
                      <Settings className="w-4 h-4 mr-2" />
                      Configure
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Casino Integrations */}
      <Card>
        <CardHeader>
          <CardTitle>Casino Integrations</CardTitle>
          <CardDescription>
            {integrations.length} active integrations across all casinos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all">
            <TabsList>
              <TabsTrigger value="all">All ({integrations.length})</TabsTrigger>
              <TabsTrigger value="messaging">
                Messaging ({groupedIntegrations['messaging']?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="casino_platform">
                Casino ({groupedIntegrations['casino_platform']?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="sports_betting">
                Sports ({groupedIntegrations['sports_betting']?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="pam">
                PAM ({groupedIntegrations['pam']?.length || 0})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="space-y-4 mt-4">
              {integrations.map((integration) => (
                <Card key={integration.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div>
                          <h3 className="font-semibold text-lg">
                            {integration.casinos.name}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {integration.integration_providers.display_name}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {getStatusBadge(integration.sync_status)}
                        {integration.is_enabled ? (
                          <Badge className="bg-green-500">Enabled</Badge>
                        ) : (
                          <Badge variant="secondary">Disabled</Badge>
                        )}
                        {integration.last_sync_at && (
                          <span className="text-sm text-muted-foreground">
                            Last sync: {new Date(integration.last_sync_at).toLocaleString()}
                          </span>
                        )}
                        <Button size="sm" variant="outline">
                          <Settings className="w-4 h-4 mr-2" />
                          Manage
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            {Object.entries(groupedIntegrations).map(([type, items]) => (
              <TabsContent key={type} value={type} className="space-y-4 mt-4">
                {items.map((integration) => (
                  <Card key={integration.id}>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div>
                            <h3 className="font-semibold text-lg">
                              {integration.casinos.name}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              {integration.integration_providers.display_name}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          {getStatusBadge(integration.sync_status)}
                          {integration.is_enabled ? (
                            <Badge className="bg-green-500">Enabled</Badge>
                          ) : (
                            <Badge variant="secondary">Disabled</Badge>
                          )}
                          {integration.last_sync_at && (
                            <span className="text-sm text-muted-foreground">
                              Last sync: {new Date(integration.last_sync_at).toLocaleString()}
                            </span>
                          )}
                          <Button size="sm" variant="outline">
                            <Settings className="w-4 h-4 mr-2" />
                            Manage
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
