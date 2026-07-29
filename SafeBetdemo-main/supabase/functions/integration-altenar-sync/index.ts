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
  sync_type: 'players' | 'bets' | 'events' | 'full';
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

    // Get Altenar integration config
    const { data: provider } = await supabase
      .from('integration_providers')
      .select('id')
      .eq('provider_key', 'altenar')
      .single();

    if (!provider) {
      return new Response(
        JSON.stringify({ error: "Altenar provider not found" }),
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
        JSON.stringify({ error: "Altenar integration not configured", details: configError?.message }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const credentials = config.credentials as any;
    const { api_username, api_password, operator_id, brand_id, environment } = credentials;

    if (!api_username || !api_password || !operator_id) {
      return new Response(
        JSON.stringify({ error: "Invalid Altenar credentials" }),
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
      ? 'https://sb2api-staging.altenar.com'
      : 'https://sb2api.altenar.com';

    // Authenticate with Altenar to get a Bearer token
    const authResult = await authenticateAltenar(baseUrl, api_username, api_password);

    if (!authResult.success || !authResult.token) {
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
          error_details: { error: authResult.error || 'Authentication failed' },
          updated_at: new Date().toISOString()
        });

      await supabase
        .from('casino_integration_configs')
        .update({
          last_sync_at: new Date().toISOString(),
          sync_status: 'error',
          sync_error: authResult.error || 'Authentication failed'
        })
        .eq('id', config.id);

      return new Response(
        JSON.stringify({ error: "Altenar authentication failed", details: authResult.error }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const bearerToken = authResult.token;

    switch (sync_type) {
      case 'players':
        syncResult = await syncPlayers(baseUrl, api_username, api_password, bearerToken, operator_id, brand_id, casino_id, supabase);
        break;
      case 'bets':
        syncResult = await syncBets(baseUrl, api_username, api_password, bearerToken, operator_id, brand_id, casino_id, supabase, date_from, date_to);
        break;
      case 'events':
        syncResult = await syncEvents(baseUrl, api_username, api_password, bearerToken, operator_id);
        break;
      case 'full':
        syncResult = await syncFull(baseUrl, api_username, api_password, bearerToken, operator_id, brand_id, casino_id, supabase, date_from, date_to);
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
    console.error("Error in integration-altenar-sync:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

async function authenticateAltenar(
  baseUrl: string,
  apiUsername: string,
  apiPassword: string
): Promise<{ success: boolean; token?: string; error?: string }> {
  try {
    const response = await fetch(`${baseUrl}/api/Account/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        login: apiUsername,
        password: apiPassword,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `Auth API Error: ${response.status} - ${errorText}` };
    }

    const data = await response.json();
    const token = data?.token || data?.access_token || data?.Token || data?.AccessToken;

    if (!token) {
      return { success: false, error: 'No token returned from Altenar authentication' };
    }

    return { success: true, token };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function syncPlayers(
  baseUrl: string,
  apiUsername: string,
  apiPassword: string,
  bearerToken: string,
  operatorId: string,
  brandId: string | undefined,
  localCasinoId: string,
  supabase: any
) {
  try {
    let page = 1;
    const pageSize = 100;
    let synced = 0;
    let failed = 0;
    let hasMore = true;

    while (hasMore) {
      const params = new URLSearchParams({
        operatorId,
        page: page.toString(),
        pageSize: pageSize.toString(),
      });
      if (brandId) params.append('brandId', brandId);

      const response = await callAltenarAPI(
        `${baseUrl}/api/players?${params.toString()}`,
        apiUsername,
        apiPassword,
        bearerToken,
        'GET'
      );

      if (!response.success) {
        return { success: false, error: response.error, records_synced: synced, records_failed: failed };
      }

      const players = response.data?.items || response.data?.players || response.data?.data || [];

      if (players.length === 0) {
        hasMore = false;
        break;
      }

      for (const player of players) {
        // IRS: opaque platform reference → stable anonymous SB-PLR id. No PII stored.
        const externalRef = String(player.id || player.playerId || player.Id);
        const safebetId = await getIdentityService().resolveIdentity(externalRef, { casinoId: localCasinoId, client: supabase });
        const { error } = await supabase
          .from('players')
          .upsert({
            casino_id: localCasinoId,
            external_id: player.id || player.playerId || player.Id,
            player_id: safebetId,
            registration_date: player.registrationDate || player.created_at || player.RegistrationDate,
            country: player.country || player.Country,
            vip_tier: player.vipLevel || player.vip_level || player.VipLevel || 'standard'
          }, {
            onConflict: 'external_id'
          });

        if (error) {
          console.error(`Failed to sync player ${player.id || player.playerId}:`, error);
          failed++;
        } else {
          synced++;
        }
      }

      // Check if we should fetch the next page
      const total = response.data?.total || response.data?.totalCount || response.data?.Total;
      if (total !== undefined && synced + failed >= total) {
        hasMore = false;
      } else if (players.length < pageSize) {
        hasMore = false;
      } else {
        page++;
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

async function syncBets(
  baseUrl: string,
  apiUsername: string,
  apiPassword: string,
  bearerToken: string,
  operatorId: string,
  brandId: string | undefined,
  localCasinoId: string,
  supabase: any,
  dateFrom?: string,
  dateTo?: string
) {
  try {
    const params = new URLSearchParams({ operatorId });
    if (brandId) params.append('brandId', brandId);
    if (dateFrom) params.append('dateFrom', dateFrom);
    if (dateTo) params.append('dateTo', dateTo);

    const response = await callAltenarAPI(
      `${baseUrl}/api/report/bets?${params.toString()}`,
      apiUsername,
      apiPassword,
      bearerToken,
      'GET'
    );

    if (!response.success) {
      return { success: false, error: response.error, records_synced: 0, records_failed: 0 };
    }

    const bets = response.data?.items || response.data?.bets || response.data?.data || [];
    let synced = 0;
    let failed = 0;

    for (const bet of bets) {
      const { error } = await supabase
        .from('transactions')
        .upsert({
          casino_id: localCasinoId,
          external_id: bet.id || bet.betId || bet.Id,
          player_external_id: bet.playerId || bet.player_id || bet.PlayerId,
          transaction_type: 'bet',
          amount: bet.stake || bet.amount || bet.Amount || bet.Stake,
          currency: bet.currency || bet.Currency,
          status: bet.status || bet.Status,
          created_at: bet.placedDate || bet.created_at || bet.PlacedDate || bet.date,
          metadata: {
            sport: bet.sportName || bet.sport,
            event: bet.eventName || bet.event,
            market: bet.marketName || bet.market,
            odds: bet.odds || bet.Odds,
            potential_win: bet.potentialWin || bet.potential_win || bet.PotentialWin,
            result: bet.result || bet.Result,
            win_amount: bet.winAmount || bet.win_amount || bet.WinAmount,
          }
        }, {
          onConflict: 'external_id'
        });

      if (error) {
        console.error(`Failed to sync bet ${bet.id || bet.betId}:`, error);
        failed++;
      } else {
        synced++;
      }
    }

    return {
      success: true,
      records_synced: synced,
      records_failed: failed,
      message: `Synced ${synced} bets, ${failed} failed`
    };
  } catch (error) {
    return { success: false, error: error.message, records_synced: 0, records_failed: 0 };
  }
}

async function syncEvents(
  baseUrl: string,
  apiUsername: string,
  apiPassword: string,
  bearerToken: string,
  operatorId: string
) {
  try {
    const params = new URLSearchParams({ operatorId });

    const response = await callAltenarAPI(
      `${baseUrl}/api/sportsbook/events?${params.toString()}`,
      apiUsername,
      apiPassword,
      bearerToken,
      'GET'
    );

    if (!response.success) {
      return { success: false, error: response.error, records_synced: 0, records_failed: 0 };
    }

    const events = response.data?.items || response.data?.events || response.data?.data || [];
    const count = response.data?.total || response.data?.totalCount || events.length;

    return {
      success: true,
      records_synced: count,
      records_failed: 0,
      message: `Retrieved ${count} sportsbook events`
    };
  } catch (error) {
    return { success: false, error: error.message, records_synced: 0, records_failed: 0 };
  }
}

async function syncFull(
  baseUrl: string,
  apiUsername: string,
  apiPassword: string,
  bearerToken: string,
  operatorId: string,
  brandId: string | undefined,
  localCasinoId: string,
  supabase: any,
  dateFrom?: string,
  dateTo?: string
) {
  const playersResult = await syncPlayers(baseUrl, apiUsername, apiPassword, bearerToken, operatorId, brandId, localCasinoId, supabase);
  const betsResult = await syncBets(baseUrl, apiUsername, apiPassword, bearerToken, operatorId, brandId, localCasinoId, supabase, dateFrom, dateTo);
  const eventsResult = await syncEvents(baseUrl, apiUsername, apiPassword, bearerToken, operatorId);

  return {
    success: playersResult.success && betsResult.success && eventsResult.success,
    records_synced: (playersResult.records_synced || 0) + (betsResult.records_synced || 0) + (eventsResult.records_synced || 0),
    records_failed: (playersResult.records_failed || 0) + (betsResult.records_failed || 0) + (eventsResult.records_failed || 0),
    message: `Full sync completed: ${playersResult.records_synced} players, ${betsResult.records_synced} bets, ${eventsResult.records_synced} events`
  };
}

async function callAltenarAPI(
  url: string,
  apiUsername: string,
  apiPassword: string,
  bearerToken: string,
  method: string = 'GET',
  body?: any
) {
  try {
    const timestamp = Date.now().toString();
    const signature = await generateHmacSignature(apiUsername, apiPassword, timestamp);

    const options: RequestInit = {
      method,
      headers: {
        'Authorization': `Bearer ${bearerToken}`,
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

async function generateHmacSignature(apiUsername: string, apiPassword: string, timestamp: string): Promise<string> {
  const message = `${apiUsername}${timestamp}`;
  const encoder = new TextEncoder();
  const keyData = encoder.encode(apiPassword);
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
