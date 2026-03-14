import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SyncRequest {
  casino_id: string;
  sync_type: 'players' | 'transactions' | 'rounds' | 'full';
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

    // Get Bet Software integration config
    const { data: provider } = await supabase
      .from('integration_providers')
      .select('id')
      .eq('provider_key', 'betsoftware')
      .single();

    if (!provider) {
      return new Response(
        JSON.stringify({ error: "Bet Software provider not found" }),
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
        JSON.stringify({ error: "Bet Software integration not configured", details: configError?.message }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const credentials = config.credentials as any;
    const { partner_id, api_key, hash_key, site_id, environment } = credentials;

    if (!partner_id || !api_key || !hash_key || !site_id) {
      return new Response(
        JSON.stringify({ error: "Invalid Bet Software credentials" }),
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
      ? 'https://staging-api.betsoftware.com/v1'
      : 'https://api.betsoftware.com/v1';

    switch (sync_type) {
      case 'players':
        syncResult = await syncPlayers(baseUrl, partner_id, api_key, hash_key, site_id, casino_id, supabase);
        break;
      case 'transactions':
        syncResult = await syncTransactions(baseUrl, partner_id, api_key, hash_key, site_id, casino_id, supabase, date_from, date_to);
        break;
      case 'rounds':
        syncResult = await syncRounds(baseUrl, partner_id, api_key, hash_key, site_id, casino_id, supabase, date_from, date_to);
        break;
      case 'full':
        syncResult = await syncFull(baseUrl, partner_id, api_key, hash_key, site_id, casino_id, supabase, date_from, date_to);
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
    console.error("Error in integration-betsoftware-sync:", error);
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
  partnerId: string,
  apiKey: string,
  hashKey: string,
  siteId: string,
  localCasinoId: string,
  supabase: any
) {
  try {
    let page = 1;
    const limit = 500;
    let totalSynced = 0;
    let totalFailed = 0;
    let hasMore = true;

    while (hasMore) {
      const response = await callBetsoftwareAPI(
        `${baseUrl}/players?site_id=${siteId}&page=${page}&limit=${limit}`,
        partnerId,
        apiKey,
        hashKey,
        siteId,
        'GET'
      );

      if (!response.success) {
        return { success: false, error: response.error, records_synced: totalSynced, records_failed: totalFailed };
      }

      const players = response.data?.players || [];

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
          totalFailed++;
        } else {
          totalSynced++;
        }
      }

      // Stop paginating if we received fewer records than the page limit
      hasMore = players.length === limit;
      page++;
    }

    return {
      success: true,
      records_synced: totalSynced,
      records_failed: totalFailed,
      message: `Synced ${totalSynced} players, ${totalFailed} failed`
    };
  } catch (error) {
    return { success: false, error: error.message, records_synced: 0, records_failed: 0 };
  }
}

async function syncTransactions(
  baseUrl: string,
  partnerId: string,
  apiKey: string,
  hashKey: string,
  siteId: string,
  localCasinoId: string,
  supabase: any,
  dateFrom?: string,
  dateTo?: string
) {
  try {
    const params = new URLSearchParams({ site_id: siteId });
    if (dateFrom) params.append('from', dateFrom);
    if (dateTo) params.append('to', dateTo);

    const response = await callBetsoftwareAPI(
      `${baseUrl}/transactions?${params.toString()}`,
      partnerId,
      apiKey,
      hashKey,
      siteId,
      'GET'
    );

    if (!response.success) {
      return { success: false, error: response.error, records_synced: 0, records_failed: 0 };
    }

    const transactions = response.data?.transactions || [];
    let synced = 0;
    let failed = 0;

    for (const tx of transactions) {
      const { error } = await supabase
        .from('transactions')
        .upsert({
          casino_id: localCasinoId,
          external_id: tx.id,
          player_external_id: tx.player_id,
          transaction_type: tx.type,
          amount: tx.amount,
          currency: tx.currency,
          status: tx.status,
          created_at: tx.created_at,
          metadata: tx.metadata || null
        }, {
          onConflict: 'external_id'
        });

      if (error) {
        console.error(`Failed to sync transaction ${tx.id}:`, error);
        failed++;
      } else {
        synced++;
      }
    }

    return {
      success: true,
      records_synced: synced,
      records_failed: failed,
      message: `Synced ${synced} transactions, ${failed} failed`
    };
  } catch (error) {
    return { success: false, error: error.message, records_synced: 0, records_failed: 0 };
  }
}

async function syncRounds(
  baseUrl: string,
  partnerId: string,
  apiKey: string,
  hashKey: string,
  siteId: string,
  localCasinoId: string,
  supabase: any,
  dateFrom?: string,
  dateTo?: string
) {
  try {
    const params = new URLSearchParams({ site_id: siteId });
    if (dateFrom) params.append('from', dateFrom);
    if (dateTo) params.append('to', dateTo);

    const response = await callBetsoftwareAPI(
      `${baseUrl}/rounds?${params.toString()}`,
      partnerId,
      apiKey,
      hashKey,
      siteId,
      'GET'
    );

    if (!response.success) {
      return { success: false, error: response.error, records_synced: 0, records_failed: 0 };
    }

    const rounds = response.data?.rounds || [];
    let synced = 0;
    let failed = 0;

    for (const round of rounds) {
      const { error } = await supabase
        .from('sessions')
        .upsert({
          casino_id: localCasinoId,
          external_id: round.id,
          player_external_id: round.player_id,
          game_id: round.game_id,
          game_name: round.game_name,
          bet_amount: round.bet_amount,
          win_amount: round.win_amount,
          currency: round.currency,
          status: round.status,
          started_at: round.started_at,
          ended_at: round.ended_at,
          metadata: round.metadata || null
        }, {
          onConflict: 'external_id'
        });

      if (error) {
        console.error(`Failed to sync round ${round.id}:`, error);
        failed++;
      } else {
        synced++;
      }
    }

    return {
      success: true,
      records_synced: synced,
      records_failed: failed,
      message: `Synced ${synced} rounds, ${failed} failed`
    };
  } catch (error) {
    return { success: false, error: error.message, records_synced: 0, records_failed: 0 };
  }
}

async function syncFull(
  baseUrl: string,
  partnerId: string,
  apiKey: string,
  hashKey: string,
  siteId: string,
  localCasinoId: string,
  supabase: any,
  dateFrom?: string,
  dateTo?: string
) {
  const playersResult = await syncPlayers(baseUrl, partnerId, apiKey, hashKey, siteId, localCasinoId, supabase);
  const transactionsResult = await syncTransactions(baseUrl, partnerId, apiKey, hashKey, siteId, localCasinoId, supabase, dateFrom, dateTo);
  const roundsResult = await syncRounds(baseUrl, partnerId, apiKey, hashKey, siteId, localCasinoId, supabase, dateFrom, dateTo);

  return {
    success: playersResult.success && transactionsResult.success && roundsResult.success,
    records_synced: (playersResult.records_synced || 0) + (transactionsResult.records_synced || 0) + (roundsResult.records_synced || 0),
    records_failed: (playersResult.records_failed || 0) + (transactionsResult.records_failed || 0) + (roundsResult.records_failed || 0),
    message: `Full sync completed: ${playersResult.records_synced} players, ${transactionsResult.records_synced} transactions, ${roundsResult.records_synced} rounds`
  };
}

async function callBetsoftwareAPI(
  url: string,
  partnerId: string,
  apiKey: string,
  hashKey: string,
  siteId: string,
  method: string = 'GET',
  body?: any
) {
  try {
    const timestamp = Date.now().toString();
    const signature = await generateSignature(partnerId, apiKey, hashKey, timestamp);

    const options: RequestInit = {
      method,
      headers: {
        'X-Partner-ID': partnerId,
        'X-Timestamp': timestamp,
        'X-Signature': signature,
        'X-Site-ID': siteId,
        'Content-Type': 'application/json',
      }
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

// HMAC-SHA256: sha256(partner_id + timestamp + api_key, hash_key) as hex
async function generateSignature(
  partnerId: string,
  apiKey: string,
  hashKey: string,
  timestamp: string
): Promise<string> {
  const message = `${partnerId}${timestamp}${apiKey}`;
  const encoder = new TextEncoder();
  const keyData = encoder.encode(hashKey);
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
