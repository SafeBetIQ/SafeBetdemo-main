import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getIdentityService } from "../../../lib/playerIdentity/index.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SyncRequest {
  casino_id: string;
  sync_type: 'players' | 'transactions' | 'sessions' | 'full';
  date_from?: string;
  date_to?: string;
}

interface PlaytechCredentials {
  client_id: string;
  client_secret: string;
  license_key: string;
  region: string;
  environment: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { casino_id, sync_type, date_from, date_to }: SyncRequest = await req.json();

    if (!casino_id || !sync_type) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: casino_id, sync_type" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get Playtech integration config
    const { data: provider } = await supabase
      .from('integration_providers')
      .select('id')
      .eq('provider_key', 'playtech')
      .single();

    if (!provider) {
      return new Response(
        JSON.stringify({ error: "Playtech provider not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: config, error: configError } = await supabase
      .from('casino_integration_configs')
      .select('id, credentials, is_enabled, api_base_url:integration_providers(api_base_url)')
      .eq('casino_id', casino_id)
      .eq('provider_id', provider.id)
      .eq('is_enabled', true)
      .maybeSingle();

    if (configError || !config) {
      return new Response(
        JSON.stringify({ error: "Playtech integration not configured", details: configError?.message }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const credentials = config.credentials as PlaytechCredentials;
    const { client_id, client_secret, license_key, region, environment } = credentials;

    if (!client_id || !client_secret || !license_key || !region) {
      return new Response(
        JSON.stringify({ error: "Invalid Playtech credentials" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update sync status to running
    await supabase
      .from('integration_sync_status')
      .upsert({
        config_id: config.id,
        sync_type,
        status: 'running',
        last_sync_at: new Date().toISOString()
      });

    const startTime = Date.now();

    // Obtain OAuth2 access token
    const tokenResult = await getAccessToken(client_id, client_secret, environment);

    if (!tokenResult.success) {
      const duration = Date.now() - startTime;

      await supabase
        .from('integration_sync_status')
        .upsert({
          config_id: config.id,
          sync_type,
          status: 'failed',
          records_synced: 0,
          records_failed: 0,
          sync_duration_ms: duration,
          error_details: { error: tokenResult.error },
          updated_at: new Date().toISOString()
        });

      await supabase
        .from('casino_integration_configs')
        .update({
          last_sync_at: new Date().toISOString(),
          sync_status: 'error',
          sync_error: tokenResult.error || null
        })
        .eq('id', config.id);

      return new Response(
        JSON.stringify({ error: "Failed to obtain Playtech access token", details: tokenResult.error }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accessToken = tokenResult.access_token!;

    const baseUrl = environment === 'staging'
      ? 'https://staging-api.playtech.com'
      : 'https://api.playtech.com';

    let syncResult;

    switch (sync_type) {
      case 'players':
        syncResult = await syncPlayers(baseUrl, accessToken, license_key, region, casino_id, supabase);
        break;
      case 'transactions':
        syncResult = await syncTransactions(baseUrl, accessToken, license_key, region, casino_id, supabase, date_from, date_to);
        break;
      case 'sessions':
        syncResult = await syncSessions(baseUrl, accessToken, license_key, region, casino_id, supabase, date_from, date_to);
        break;
      case 'full':
        syncResult = await syncFull(baseUrl, accessToken, license_key, region, casino_id, supabase, date_from, date_to);
        break;
      default:
        return new Response(
          JSON.stringify({ error: "Invalid sync_type" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    const duration = Date.now() - startTime;

    // Update sync status
    await supabase
      .from('integration_sync_status')
      .upsert({
        config_id: config.id,
        sync_type,
        status: syncResult.success ? 'completed' : 'failed',
        records_synced: syncResult.records_synced || 0,
        records_failed: syncResult.records_failed || 0,
        sync_duration_ms: duration,
        error_details: syncResult.error ? { error: syncResult.error } : null,
        updated_at: new Date().toISOString()
      });

    // Update last sync on config
    await supabase
      .from('casino_integration_configs')
      .update({
        last_sync_at: new Date().toISOString(),
        sync_status: syncResult.success ? 'success' : 'error',
        sync_error: syncResult.error || null
      })
      .eq('id', config.id);

    return new Response(
      JSON.stringify({
        success: syncResult.success,
        sync_type,
        records_synced: syncResult.records_synced,
        records_failed: syncResult.records_failed,
        duration_ms: duration,
        message: syncResult.message
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in integration-playtech-sync:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

async function getAccessToken(
  clientId: string,
  clientSecret: string,
  environment: string
): Promise<{ success: boolean; access_token?: string; error?: string }> {
  try {
    const tokenUrl = environment === 'staging'
      ? 'https://staging-api.playtech.com/oauth2/token'
      : 'https://api.playtech.com/oauth2/token';

    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    });

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `OAuth2 token error: ${response.status} - ${errorText}` };
    }

    const data = await response.json();

    if (!data.access_token) {
      return { success: false, error: "No access_token in OAuth2 response" };
    }

    return { success: true, access_token: data.access_token };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function callPlaytechAPI(
  url: string,
  accessToken: string,
  licenseKey: string,
  method: string = 'GET',
  body?: any
) {
  try {
    const options: RequestInit = {
      method,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'X-License-Key': licenseKey,
        'Content-Type': 'application/json',
      },
    };

    if (body && method !== 'GET') {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `API Error: ${response.status} - ${errorText}` };
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function syncPlayers(
  baseUrl: string,
  accessToken: string,
  licenseKey: string,
  region: string,
  localCasinoId: string,
  supabase: any
) {
  try {
    const params = new URLSearchParams({
      region,
      limit: '500',
    });

    const response = await callPlaytechAPI(
      `${baseUrl}/pam/v2/players?${params.toString()}`,
      accessToken,
      licenseKey,
      'GET'
    );

    if (!response.success) {
      return { success: false, error: response.error, records_synced: 0, records_failed: 0 };
    }

    const players = response.data?.players || [];
    let synced = 0;
    let failed = 0;

    for (const player of players) {
      // Identity Resolution Service: the platform reference is hashed and
      // mapped to a stable anonymous SafeBet IQ Player ID. No identity data
      // (names, email, phone) is ever stored by SafeBet IQ.
      const safebetId = await getIdentityService().resolveIdentity(String(player.id), { casinoId: localCasinoId, client: supabase });
      const { error } = await supabase
        .from('players')
        .upsert({
          casino_id: localCasinoId,
          external_id: player.id,
          player_id: safebetId,
          registration_date: player.created_at,
          country: player.country,
          vip_tier: player.vip_level || 'standard',
        }, {
          onConflict: 'external_id',
        });

      if (error) {
        console.error(`Failed to sync player ${player.id}:`, error);
        failed++;
      } else {
        synced++;
      }
    }

    return {
      success: true,
      records_synced: synced,
      records_failed: failed,
      message: `Synced ${synced} players, ${failed} failed`,
    };
  } catch (error) {
    return { success: false, error: error.message, records_synced: 0, records_failed: 0 };
  }
}

async function syncTransactions(
  baseUrl: string,
  accessToken: string,
  licenseKey: string,
  region: string,
  localCasinoId: string,
  supabase: any,
  dateFrom?: string,
  dateTo?: string
) {
  try {
    const params = new URLSearchParams({ region });
    if (dateFrom) params.append('from', dateFrom);
    if (dateTo) params.append('to', dateTo);

    const response = await callPlaytechAPI(
      `${baseUrl}/pam/v2/transactions?${params.toString()}`,
      accessToken,
      licenseKey,
      'GET'
    );

    if (!response.success) {
      return { success: false, error: response.error, records_synced: 0, records_failed: 0 };
    }

    const transactions = response.data?.transactions || [];
    let synced = 0;
    let failed = 0;

    for (const transaction of transactions) {
      const { error } = await supabase
        .from('transactions')
        .upsert({
          casino_id: localCasinoId,
          external_id: transaction.id,
          player_id: transaction.player_id,
          type: transaction.type,
          amount: transaction.amount,
          currency: transaction.currency,
          status: transaction.status,
          created_at: transaction.created_at,
        }, {
          onConflict: 'external_id',
        });

      if (error) {
        console.error(`Failed to sync transaction ${transaction.id}:`, error);
        failed++;
      } else {
        synced++;
      }
    }

    return {
      success: true,
      records_synced: synced,
      records_failed: failed,
      message: `Synced ${synced} transactions, ${failed} failed`,
    };
  } catch (error) {
    return { success: false, error: error.message, records_synced: 0, records_failed: 0 };
  }
}

async function syncSessions(
  baseUrl: string,
  accessToken: string,
  licenseKey: string,
  region: string,
  localCasinoId: string,
  supabase: any,
  dateFrom?: string,
  dateTo?: string
) {
  try {
    const params = new URLSearchParams({ region });
    if (dateFrom) params.append('from', dateFrom);
    if (dateTo) params.append('to', dateTo);

    const response = await callPlaytechAPI(
      `${baseUrl}/pam/v2/sessions?${params.toString()}`,
      accessToken,
      licenseKey,
      'GET'
    );

    if (!response.success) {
      return { success: false, error: response.error, records_synced: 0, records_failed: 0 };
    }

    const sessions = response.data?.sessions || [];
    let synced = 0;
    let failed = 0;

    for (const session of sessions) {
      const { error } = await supabase
        .from('sessions')
        .upsert({
          casino_id: localCasinoId,
          external_id: session.id,
          player_id: session.player_id,
          started_at: session.started_at,
          ended_at: session.ended_at,
          duration_seconds: session.duration_seconds,
          ip_address: session.ip_address,
          device_type: session.device_type,
        }, {
          onConflict: 'external_id',
        });

      if (error) {
        console.error(`Failed to sync session ${session.id}:`, error);
        failed++;
      } else {
        synced++;
      }
    }

    return {
      success: true,
      records_synced: synced,
      records_failed: failed,
      message: `Synced ${synced} sessions, ${failed} failed`,
    };
  } catch (error) {
    return { success: false, error: error.message, records_synced: 0, records_failed: 0 };
  }
}

async function syncFull(
  baseUrl: string,
  accessToken: string,
  licenseKey: string,
  region: string,
  localCasinoId: string,
  supabase: any,
  dateFrom?: string,
  dateTo?: string
) {
  const playersResult = await syncPlayers(baseUrl, accessToken, licenseKey, region, localCasinoId, supabase);
  const transactionsResult = await syncTransactions(baseUrl, accessToken, licenseKey, region, localCasinoId, supabase, dateFrom, dateTo);
  const sessionsResult = await syncSessions(baseUrl, accessToken, licenseKey, region, localCasinoId, supabase, dateFrom, dateTo);

  return {
    success: playersResult.success && transactionsResult.success && sessionsResult.success,
    records_synced: (playersResult.records_synced || 0) + (transactionsResult.records_synced || 0) + (sessionsResult.records_synced || 0),
    records_failed: (playersResult.records_failed || 0) + (transactionsResult.records_failed || 0) + (sessionsResult.records_failed || 0),
    message: `Full sync completed: ${playersResult.records_synced} players, ${transactionsResult.records_synced} transactions, ${sessionsResult.records_synced} sessions`,
  };
}
