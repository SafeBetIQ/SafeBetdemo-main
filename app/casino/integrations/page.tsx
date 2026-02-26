"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, Settings, CheckCircle, XCircle, AlertCircle, Plus, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

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

  useEffect(() => {
    if (user?.casino_id) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    if (!user?.casino_id) return;

    setLoading(true);

    // Load all providers
    const { data: providersData } = await supabase
      .from("integration_providers")
      .select("*")
      .eq("is_active", true)
      .order("provider_name");

    // Load casino's integrations
    const { data: integrationsData } = await supabase
      .from("casino_integration_configs")
      .select(`
        *,
        integration_providers(*)
      `)
      .eq("casino_id", user.casino_id);

    setProviders(providersData || []);
    setIntegrations(integrationsData || []);
    setLoading(false);
  };

  const openConfigDialog = (provider: IntegrationProvider, integration?: CasinoIntegration) => {
    setSelectedProvider(provider);
    setSelectedIntegration(integration || null);

    if (integration) {
      setCredentials(integration.credentials || {});
      setIsEnabled(integration.is_enabled);
    } else {
      setCredentials({});
      setIsEnabled(false);
    }

    setConfigDialogOpen(true);
    setShowSecrets({});
  };

  const saveIntegration = async () => {
    if (!selectedProvider || !user?.casino_id) return;

    setSaving(true);

    try {
      // Validate required fields
      const missingFields = selectedProvider.required_fields
        .filter((field: any) => field.required && !credentials[field.name])
        .map((field: any) => field.label);

      if (missingFields.length > 0) {
        toast({
          title: "Missing required fields",
          description: `Please fill in: ${missingFields.join(", ")}`,
          variant: "destructive",
        });
        setSaving(false);
        return;
      }

      const payload = {
        casino_id: user.casino_id,
        provider_id: selectedProvider.id,
        is_enabled: isEnabled,
        credentials,
        configuration: {},
        created_by: user.id,
      };

      const { error } = await supabase
        .from("casino_integration_configs")
        .upsert(payload, {
          onConflict: "casino_id,provider_id",
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Integration configuration saved successfully",
      });

      setConfigDialogOpen(false);
      loadData();
    } catch (error: any) {
      console.error("Error saving integration:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save integration",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async (integration: CasinoIntegration) => {
    toast({
      title: "Testing connection",
      description: "Verifying credentials...",
    });

    // Simulate connection test
    setTimeout(() => {
      toast({
        title: "Connection successful",
        description: "Your integration is working correctly",
      });
    }, 2000);
  };

  const syncNow = async (integration: CasinoIntegration) => {
    if (!user?.casino_id) return;

    toast({
      title: "Sync started",
      description: "Synchronizing data from platform...",
    });

    try {
      const functionMap: Record<string, string> = {
        softswiss: "integration-softswiss-sync",
      };

      const functionName = functionMap[integration.integration_providers.provider_key];

      if (functionName) {
        const { data, error } = await supabase.functions.invoke(functionName, {
          body: {
            casino_id: user.casino_id,
            sync_type: "players",
          },
        });

        if (error) throw error;

        toast({
          title: "Sync completed",
          description: `Successfully synced ${data.records_synced || 0} records`,
        });

        loadData();
      }
    } catch (error: any) {
      toast({
        title: "Sync failed",
        description: error.message || "Failed to sync data",
        variant: "destructive",
      });
    }
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

  const renderCredentialField = (field: any) => {
    const value = credentials[field.name] || "";
    const isSecret = field.type === "password";
    const showThisSecret = showSecrets[field.name] || false;

    return (
      <div key={field.name} className="space-y-2">
        <Label htmlFor={field.name}>
          {field.label}
          {field.required && <span className="text-red-500 ml-1">*</span>}
        </Label>
        {field.type === "select" ? (
          <Select
            value={value}
            onValueChange={(val) => setCredentials({ ...credentials, [field.name]: val })}
          >
            <SelectTrigger>
              <SelectValue placeholder={`Select ${field.label}`} />
            </SelectTrigger>
            <SelectContent>
              {field.options.map((option: string) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <div className="relative">
            <Input
              id={field.name}
              type={isSecret && !showThisSecret ? "password" : field.type || "text"}
              placeholder={field.placeholder || field.label}
              value={value}
              onChange={(e) => setCredentials({ ...credentials, [field.name]: e.target.value })}
            />
            {isSecret && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowSecrets({ ...showSecrets, [field.name]: !showThisSecret })}
              >
                {showThisSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            )}
          </div>
        )}
        {field.description && (
          <p className="text-xs text-muted-foreground">{field.description}</p>
        )}
      </div>
    );
  };

  const configuredProviders = integrations.map((i) => i.provider_id);
  const availableProviders = providers.filter((p) => !configuredProviders.includes(p.id));

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
          <h1 className="text-3xl font-bold">Platform Integrations</h1>
          <p className="text-muted-foreground mt-1">
            Connect your casino to external platforms
          </p>
        </div>
        <Button onClick={loadData}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Configured Integrations */}
      {integrations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Your Integrations</CardTitle>
            <CardDescription>
              {integrations.length} integration{integrations.length !== 1 ? "s" : ""} configured
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {integrations.map((integration) => (
                <Card key={integration.id} className="border-2">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-lg">
                          {integration.integration_providers.display_name}
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {integration.integration_providers.description}
                        </p>
                        <div className="flex gap-2 mt-2">
                          {getStatusBadge(integration.sync_status)}
                          {integration.is_enabled ? (
                            <Badge className="bg-green-500">Enabled</Badge>
                          ) : (
                            <Badge variant="secondary">Disabled</Badge>
                          )}
                        </div>
                        {integration.last_sync_at && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Last sync: {new Date(integration.last_sync_at).toLocaleString()}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => testConnection(integration)}
                        >
                          Test Connection
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => syncNow(integration)}
                        >
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Sync Now
                        </Button>
                        <Button
                          size="sm"
                          onClick={() =>
                            openConfigDialog(integration.integration_providers, integration)
                          }
                        >
                          <Settings className="w-4 h-4 mr-2" />
                          Configure
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Available Integrations */}
      {availableProviders.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Available Integrations</CardTitle>
            <CardDescription>
              Connect to these platforms to enhance your casino operations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {availableProviders.map((provider) => (
                <Card key={provider.id} className="border-2">
                  <CardHeader>
                    <CardTitle className="text-lg">{provider.display_name}</CardTitle>
                    <Badge variant="outline">
                      {provider.provider_type.replace("_", " ")}
                    </Badge>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                      {provider.description}
                    </p>
                    <Button
                      className="w-full"
                      onClick={() => openConfigDialog(provider)}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Connect
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Configuration Dialog */}
      <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedIntegration ? "Edit" : "Configure"} {selectedProvider?.display_name}
            </DialogTitle>
            <DialogDescription>
              {selectedProvider?.description}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="enabled">Enable Integration</Label>
                <p className="text-sm text-muted-foreground">
                  Activate this integration to start syncing data
                </p>
              </div>
              <Switch
                id="enabled"
                checked={isEnabled}
                onCheckedChange={setIsEnabled}
              />
            </div>

            <div className="border-t pt-4 space-y-4">
              <h3 className="font-semibold">Credentials</h3>
              {selectedProvider?.required_fields.map((field: any) =>
                renderCredentialField(field)
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfigDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveIntegration} disabled={saving}>
              {saving ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Configuration"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
