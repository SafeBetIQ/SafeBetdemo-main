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
  sync_type: 'sessions' | 'rounds' | 'players' | 'full';
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

    // Get Evolution Gaming integration config
    const { data: provider } = await supabase
      .from('integration_providers')
      .select('id')
      .eq('provider_key', 'evolution')
      .single();

    if (!provider) {
      return new Response(
        JSON.stringify({ error: "Evolution Gaming provider not found" }),
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
        JSON.stringify({ error: "Evolution Gaming integration not configured", details: configError?.message }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const credentials = config.credentials as any;
    const { api_key, casino_key, environment } = credentials;

    if (!api_key || !casino_key) {
      return new Response(
        JSON.stringify({ error: "Invalid Evolution Gaming credentials" }),
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
      ? 'https://staging-api.evolutiongaming.com/v1'
      : 'https://api.evolutiongaming.com/v1';

    switch (sync_type) {
      case 'sessions':
        syncResult = await syncSessions(baseUrl, api_key, casino_key, casino_id, supabase, date_from, date_to);
        break;
      case 'rounds':
        syncResult = await syncRounds(baseUrl, api_key, casino_key, casino_id, supabase, date_from, date_to);
        break;
      case 'players':
        syncResult = await syncPlayers(baseUrl, api_key, casino_key, casino_id, supabase);
        break;
      case 'full':
        syncResult = await syncFull(baseUrl, api_key, casino_key, casino_id, supabase, date_from, date_to);
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
    console.error("Error in integration-evolution-sync:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

async function syncSessions(
  baseUrl: string,
  apiKey: string,
  casinoKey: string,
  localCasinoId: string,
  supabase: any,
  dateFrom?: string,
  dateTo?: string
) {
  try {
    const params = new URLSearchParams();
    if (dateFrom) params.append('from', dateFrom);
    if (dateTo) params.append('to', dateTo);

    const path = `/live/sessions${params.toString() ? '?' + params.toString() : ''}`;
    const response = await callEvolutionAPI(baseUrl, path, apiKey, casinoKey, 'GET');

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
          game_id: session.game_id,
          table_id: session.table_id,
          started_at: session.started_at,
          ended_at: session.ended_at,
          duration_seconds: session.duration_seconds,
          currency: session.currency,
          total_wagered: session.total_wagered,
          total_won: session.total_won,
          status: session.status,
          metadata: session.metadata || {}
        }, {
          onConflict: 'external_id'
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
      message: `Synced ${synced} sessions, ${failed} failed`
    };
  } catch (error) {
    return { success: false, error: error.message, records_synced: 0, records_failed: 0 };
  }
}

async function syncRounds(
  baseUrl: string,
  apiKey: string,
  casinoKey: string,
  localCasinoId: string,
  supabase: any,
  dateFrom?: string,
  dateTo?: string
) {
  try {
    const params = new URLSearchParams();
    if (dateFrom) params.append('from', dateFrom);
    if (dateTo) params.append('to', dateTo);

    const path = `/live/rounds${params.toString() ? '?' + params.toString() : ''}`;
    const response = await callEvolutionAPI(baseUrl, path, apiKey, casinoKey, 'GET');

    if (!response.success) {
      return { success: false, error: response.error, records_synced: 0, records_failed: 0 };
    }

    const rounds = response.data?.rounds || [];
    let synced = 0;
    let failed = 0;

    for (const round of rounds) {
      // Upsert wager transaction
      const { error: wagerError } = await supabase
        .from('transactions')
        .upsert({
          casino_id: localCasinoId,
          external_id: `${round.id}_wager`,
          round_id: round.id,
          player_id: round.player_id,
          session_id: round.session_id,
          game_id: round.game_id,
          table_id: round.table_id,
          transaction_type: 'wager',
          amount: round.wager_amount,
          currency: round.currency,
          created_at: round.started_at,
          status: round.status,
          metadata: round.metadata || {}
        }, {
          onConflict: 'external_id'
        });

      if (wagerError) {
        console.error(`Failed to sync wager for round ${round.id}:`, wagerError);
        failed++;
      } else {
        synced++;
      }

      // Upsert win transaction if a payout is present
      if (round.win_amount !== undefined && round.win_amount !== null) {
        const { error: winError } = await supabase
          .from('transactions')
          .upsert({
            casino_id: localCasinoId,
            external_id: `${round.id}_win`,
            round_id: round.id,
            player_id: round.player_id,
            session_id: round.session_id,
            game_id: round.game_id,
            table_id: round.table_id,
            transaction_type: 'win',
            amount: round.win_amount,
            currency: round.currency,
            created_at: round.ended_at || round.started_at,
            status: round.status,
            metadata: round.metadata || {}
          }, {
            onConflict: 'external_id'
          });

        if (winError) {
          console.error(`Failed to sync win for round ${round.id}:`, winError);
          failed++;
        } else {
          synced++;
        }
      }
    }

    return {
      success: true,
      records_synced: synced,
      records_failed: failed,
      message: `Synced ${synced} transactions (wager/win) from ${rounds.length} rounds, ${failed} failed`
    };
  } catch (error) {
    return { success: false, error: error.message, records_synced: 0, records_failed: 0 };
  }
}

async function syncPlayers(
  baseUrl: string,
  apiKey: string,
  casinoKey: string,
  localCasinoId: string,
  supabase: any
) {
  try {
    const path = '/live/players';
    const response = await callEvolutionAPI(baseUrl, path, apiKey, casinoKey, 'GET');

    if (!response.success) {
      return { success: false, error: response.error, records_synced: 0, records_failed: 0 };
    }

    const players = response.data?.players || [];
    let synced = 0;
    let failed = 0;

    for (const player of players) {
      // IRS: opaque platform reference → stable anonymous SB-PLR id. No PII stored.
      const safebetId = await getIdentityService().resolveIdentity(String(player.id), { casinoId: localCasinoId, client: supabase });
      const { error } = await supabase
        .from('players')
        .upsert({
          casino_id: localCasinoId,
          external_id: player.id,
          player_id: safebetId,
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

async function syncFull(
  baseUrl: string,
  apiKey: string,
  casinoKey: string,
  localCasinoId: string,
  supabase: any,
  dateFrom?: string,
  dateTo?: string
) {
  const sessionsResult = await syncSessions(baseUrl, apiKey, casinoKey, localCasinoId, supabase, dateFrom, dateTo);
  const roundsResult = await syncRounds(baseUrl, apiKey, casinoKey, localCasinoId, supabase, dateFrom, dateTo);
  const playersResult = await syncPlayers(baseUrl, apiKey, casinoKey, localCasinoId, supabase);

  return {
    success: sessionsResult.success && roundsResult.success && playersResult.success,
    records_synced: sessionsResult.records_synced + roundsResult.records_synced + playersResult.records_synced,
    records_failed: (sessionsResult.records_failed || 0) + (roundsResult.records_failed || 0) + (playersResult.records_failed || 0),
    message: `Full sync completed: ${sessionsResult.records_synced} sessions, ${roundsResult.records_synced} round transactions, ${playersResult.records_synced} players`
  };
}

async function callEvolutionAPI(
  baseUrl: string,
  path: string,
  apiKey: string,
  casinoKey: string,
  method: string = 'GET',
  body?: any
) {
  try {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const basicAuth = btoa(`${apiKey}:${casinoKey}`);
    const signature = await generateHmacSha1Signature(method, path, timestamp, apiKey);

    const url = `${baseUrl}${path}`;
    const options: RequestInit = {
      method,
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'X-EVO-Timestamp': timestamp,
        'X-EVO-Signature': signature,
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

// HMAC-SHA1 request signing: sha1(method + '\n' + path + '\n' + timestamp, api_key)
async function generateHmacSha1Signature(
  method: string,
  path: string,
  timestamp: string,
  apiKey: string
): Promise<string> {
  const message = `${method}\n${path}\n${timestamp}`;
  const encoder = new TextEncoder();
  const keyData = encoder.encode(apiKey);
  const messageData = encoder.encode(message);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
