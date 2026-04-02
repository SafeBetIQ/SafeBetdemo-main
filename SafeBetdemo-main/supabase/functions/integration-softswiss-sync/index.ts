import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SyncRequest {
  casino_id: string;
  sync_type: 'players' | 'transactions' | 'games' | 'full';
  date_from?: string;
  date_to?: string;
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

    // Get SOFTSWISS integration config
    const { data: provider } = await supabase
      .from('integration_providers')
      .select('id')
      .eq('provider_key', 'softswiss')
      .single();

    if (!provider) {
      return new Response(
        JSON.stringify({ error: "SOFTSWISS provider not found" }),
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
        JSON.stringify({ error: "SOFTSWISS integration not configured", details: configError?.message }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const credentials = config.credentials as any;
    const { api_key, api_secret, casino_id: softswiss_casino_id, environment } = credentials;

    if (!api_key || !api_secret || !softswiss_casino_id) {
      return new Response(
        JSON.stringify({ error: "Invalid SOFTSWISS credentials" }),
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
    let syncResult;

    const baseUrl = environment === 'staging'
      ? 'https://staging-casino-api.softswiss.com/v1'
      : 'https://casino-api.softswiss.com/v1';

    switch (sync_type) {
      case 'players':
        syncResult = await syncPlayers(baseUrl, api_key, api_secret, softswiss_casino_id, casino_id, supabase);
        break;
      case 'transactions':
        syncResult = await syncTransactions(baseUrl, api_key, api_secret, softswiss_casino_id, date_from, date_to);
        break;
      case 'games':
        syncResult = await syncGames(baseUrl, api_key, api_secret, softswiss_casino_id);
        break;
      case 'full':
        syncResult = await syncFull(baseUrl, api_key, api_secret, softswiss_casino_id, casino_id, supabase);
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
    console.error("Error in integration-softswiss-sync:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

async function syncPlayers(
  baseUrl: string,
  apiKey: string,
  apiSecret: string,
  casinoId: string,
  localCasinoId: string,
  supabase: any
) {
  try {
    const response = await callSoftswissAPI(
      `${baseUrl}/casinos/${casinoId}/players`,
      apiKey,
      apiSecret,
      'GET'
    );

    if (!response.success) {
      return { success: false, error: response.error, records_synced: 0, records_failed: 0 };
    }

    const players = response.data?.players || [];
    let synced = 0;
    let failed = 0;

    for (const player of players) {
      const { error } = await supabase
        .from('players')
        .upsert({
          casino_id: localCasinoId,
          external_id: player.id,
          email: player.email,
          first_name: player.first_name,
          last_name: player.last_name,
          phone: player.phone,
          registration_date: player.created_at,
          country: player.country,
          vip_tier: player.vip_level || 'standard'
        }, {
          onConflict: 'external_id'
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
      message: `Synced ${synced} players, ${failed} failed`
    };
  } catch (error) {
    return { success: false, error: error.message, records_synced: 0, records_failed: 0 };
  }
}

async function syncTransactions(
  baseUrl: string,
  apiKey: string,
  apiSecret: string,
  casinoId: string,
  dateFrom?: string,
  dateTo?: string
) {
  try {
    const params = new URLSearchParams();
    if (dateFrom) params.append('from', dateFrom);
    if (dateTo) params.append('to', dateTo);

    const response = await callSoftswissAPI(
      `${baseUrl}/casinos/${casinoId}/transactions?${params.toString()}`,
      apiKey,
      apiSecret,
      'GET'
    );

    if (!response.success) {
      return { success: false, error: response.error, records_synced: 0 };
    }

    const transactions = response.data?.transactions || [];
    return {
      success: true,
      records_synced: transactions.length,
      records_failed: 0,
      message: `Retrieved ${transactions.length} transactions`
    };
  } catch (error) {
    return { success: false, error: error.message, records_synced: 0 };
  }
}

async function syncGames(
  baseUrl: string,
  apiKey: string,
  apiSecret: string,
  casinoId: string
) {
  try {
    const response = await callSoftswissAPI(
      `${baseUrl}/casinos/${casinoId}/games`,
      apiKey,
      apiSecret,
      'GET'
    );

    if (!response.success) {
      return { success: false, error: response.error, records_synced: 0 };
    }

    const games = response.data?.games || [];
    return {
      success: true,
      records_synced: games.length,
      records_failed: 0,
      message: `Retrieved ${games.length} games`
    };
  } catch (error) {
    return { success: false, error: error.message, records_synced: 0 };
  }
}

async function syncFull(
  baseUrl: string,
  apiKey: string,
  apiSecret: string,
  casinoId: string,
  localCasinoId: string,
  supabase: any
) {
  const playersResult = await syncPlayers(baseUrl, apiKey, apiSecret, casinoId, localCasinoId, supabase);
  const transactionsResult = await syncTransactions(baseUrl, apiKey, apiSecret, casinoId);
  const gamesResult = await syncGames(baseUrl, apiKey, apiSecret, casinoId);

  return {
    success: playersResult.success && transactionsResult.success && gamesResult.success,
    records_synced: playersResult.records_synced + transactionsResult.records_synced + gamesResult.records_synced,
    records_failed: playersResult.records_failed,
    message: `Full sync completed: ${playersResult.records_synced} players, ${transactionsResult.records_synced} transactions, ${gamesResult.records_synced} games`
  };
}

async function callSoftswissAPI(
  url: string,
  apiKey: string,
  apiSecret: string,
  method: string = 'GET',
  body?: any
) {
  try {
    const timestamp = Date.now().toString();
    const signature = await generateSignature(apiKey, apiSecret, timestamp);

    const options: RequestInit = {
      method,
      headers: {
        'X-API-Key': apiKey,
        'X-Timestamp': timestamp,
        'X-Signature': signature,
        'Content-Type': 'application/json',
      }
    };

    if (body && method !== 'GET') {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error: `API Error: ${response.status} - ${error}` };
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function generateSignature(apiKey: string, apiSecret: string, timestamp: string): Promise<string> {
  const message = `${apiKey}${timestamp}`;
  const encoder = new TextEncoder();
  const keyData = encoder.encode(apiSecret);
  const messageData = encoder.encode(message);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
