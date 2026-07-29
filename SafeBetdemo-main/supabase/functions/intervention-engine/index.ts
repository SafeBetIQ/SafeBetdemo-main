import { createClient } from 'npm:@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface DispatchPayload {
  intervention_id: string;
  player_id: string;
  casino_id: string;
  channels: string[];
  message: string;
  intervention_type: string;
  risk_score: number;
}

async function dispatchWhatsApp(
  supabase: ReturnType<typeof createClient>,
  casinoId: string,
  recipientPhone: string,
  message: string
): Promise<{ success: boolean; sid?: string; error?: string }> {
  try {
    const { data: config } = await supabase
      .from('casino_integration_configs')
      .select('config_data')
      .eq('casino_id', casinoId)
      .eq('integration_type', 'twilio')
      .eq('is_active', true)
      .maybeSingle();

    if (!config?.config_data) {
      return { success: false, error: 'Twilio not configured for this casino' };
    }

    const { account_sid, auth_token, whatsapp_from } = config.config_data;
    if (!account_sid || !auth_token) {
      return { success: false, error: 'Missing Twilio credentials' };
    }

    const fromNumber = whatsapp_from || 'whatsapp:+14155238886';
    const toNumber = recipientPhone.startsWith('whatsapp:')
      ? recipientPhone
      : `whatsapp:+27${recipientPhone.replace(/^0/, '')}`;

    const body = new URLSearchParams({
      From: fromNumber,
      To: toNumber,
      Body: message,
    });

    const resp = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${account_sid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${btoa(`${account_sid}:${auth_token}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      }
    );

    const result = await resp.json();
    if (result.sid) {
      return { success: true, sid: result.sid };
    }
    return { success: false, error: result.message || 'WhatsApp send failed' };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

async function dispatchSMS(
  supabase: ReturnType<typeof createClient>,
  casinoId: string,
  recipientPhone: string,
  message: string
): Promise<{ success: boolean; sid?: string; error?: string }> {
  try {
    const { data: config } = await supabase
      .from('casino_integration_configs')
      .select('config_data')
      .eq('casino_id', casinoId)
      .eq('integration_type', 'twilio')
      .eq('is_active', true)
      .maybeSingle();

    if (!config?.config_data) {
      return { success: false, error: 'Twilio not configured' };
    }

    const { account_sid, auth_token, sms_from } = config.config_data;
    if (!account_sid || !auth_token) {
      return { success: false, error: 'Missing Twilio credentials' };
    }

    const body = new URLSearchParams({
      From: sms_from || '+27000000000',
      To: `+27${recipientPhone.replace(/^0/, '')}`,
      Body: message.substring(0, 1600),
    });

    const resp = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${account_sid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${btoa(`${account_sid}:${auth_token}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      }
    );

    const result = await resp.json();
    if (result.sid) return { success: true, sid: result.sid };
    return { success: false, error: result.message || 'SMS send failed' };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

async function dispatchEmail(
  supabase: ReturnType<typeof createClient>,
  casinoId: string,
  recipientEmail: string,
  subject: string,
  message: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const { data: config } = await supabase
      .from('casino_integration_configs')
      .select('config_data')
      .eq('casino_id', casinoId)
      .eq('integration_type', 'email')
      .eq('is_active', true)
      .maybeSingle();

    if (!config?.config_data) {
      return { success: false, error: 'Email not configured for this casino' };
    }

    const { sendgrid_api_key, from_email, from_name } = config.config_data;
    if (!sendgrid_api_key) {
      return { success: false, error: 'Missing SendGrid API key' };
    }

    const resp = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sendgrid_api_key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: recipientEmail }] }],
        from: { email: from_email || 'support@safebetiq.com', name: from_name || 'SafeBet IQ Support' },
        subject,
        content: [
          { type: 'text/plain', value: message },
          { type: 'text/html', value: `<pre style="font-family:sans-serif;white-space:pre-wrap">${message}</pre>` },
        ],
      }),
    });

    if (resp.status === 202) {
      return { success: true, messageId: resp.headers.get('x-message-id') || 'sent' };
    }
    const err = await resp.json().catch(() => ({}));
    return { success: false, error: JSON.stringify(err) };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

async function handleDispatch(
  supabase: ReturnType<typeof createClient>,
  payload: DispatchPayload
) {
  const { data: player } = await supabase
    .from('players')
    .select('phone, email')
    .eq('id', payload.player_id)
    .maybeSingle();

  const results: Record<string, { success: boolean; error?: string; providerId?: string }> = {};

  for (const channel of payload.channels) {
    const { data: queueRow } = await supabase
      .from('intervention_delivery_queue')
      .insert({
        intervention_id: payload.intervention_id,
        casino_id: payload.casino_id,
        player_id: payload.player_id,
        channel,
        status: 'sending',
        message_body: payload.message,
        recipient_address: channel === 'email' ? player?.email : player?.phone,
        scheduled_at: new Date().toISOString(),
        attempts: 1,
      })
      .select('id')
      .single();

    const queueId = queueRow?.id;

    let dispatchResult: { success: boolean; sid?: string; messageId?: string; error?: string } = {
      success: false,
      error: 'Channel not dispatched',
    };

    if (channel === 'whatsapp' && player?.phone) {
      dispatchResult = await dispatchWhatsApp(supabase, payload.casino_id, player.phone, payload.message);
    } else if (channel === 'sms' && player?.phone) {
      dispatchResult = await dispatchSMS(supabase, payload.casino_id, player.phone, payload.message);
    } else if (channel === 'email' && player?.email) {
      const subject = `Responsible Gaming Notice — ${payload.intervention_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}`;
      dispatchResult = await dispatchEmail(supabase, payload.casino_id, player.email, subject, payload.message);
    } else if (channel === 'in_app') {
      dispatchResult = { success: true, sid: 'in_app_delivered' };
    }

    results[channel] = {
      success: dispatchResult.success,
      error: dispatchResult.error,
      providerId: dispatchResult.sid || dispatchResult.messageId,
    };

    if (queueId) {
      await supabase
        .from('intervention_delivery_queue')
        .update({
          status: dispatchResult.success ? 'sent' : 'failed',
          sent_at: dispatchResult.success ? new Date().toISOString() : null,
          failed_at: !dispatchResult.success ? new Date().toISOString() : null,
          provider_message_id: dispatchResult.sid || dispatchResult.messageId || null,
          error_message: dispatchResult.error || null,
          provider_response: dispatchResult as any,
        })
        .eq('id', queueId);
    }
  }

  const anySuccess = Object.values(results).some((r) => r.success);
  const allFailed = Object.values(results).every((r) => !r.success);

  await supabase
    .from('intervention_history')
    .update({
      channels_attempted: payload.channels,
      dispatch_status: allFailed ? 'failed' : anySuccess ? 'dispatched' : 'partial',
    })
    .eq('id', payload.intervention_id);

  return results;
}

async function checkThresholds(
  supabase: ReturnType<typeof createClient>,
  casinoId: string,
  playerId: string,
  riskScore: number
) {
  const { data: rules } = await supabase
    .from('intervention_threshold_rules')
    .select('*')
    .eq('casino_id', casinoId)
    .eq('is_active', true)
    .eq('auto_send', true)
    .lte('risk_threshold', riskScore)
    .order('priority', { ascending: true });

  if (!rules || rules.length === 0) return { triggered: false };

  const triggered = [];

  for (const rule of rules) {
    const cooldownCutoff = new Date(Date.now() - rule.cooldown_hours * 3600 * 1000).toISOString();

    const { data: recent } = await supabase
      .from('intervention_history')
      .select('id')
      .eq('player_id', playerId)
      .eq('casino_id', casinoId)
      .eq('intervention_type', rule.intervention_type)
      .gte('triggered_at', cooldownCutoff)
      .limit(1)
      .maybeSingle();

    if (recent) continue;

    // Privacy-by-design: intervention messages never contain player names.
    const message = (rule.message_template || '')
      .replace('{player_name}', 'Valued Player')
      .replace('{risk_score}', String(riskScore));

    const { data: ivRow } = await supabase
      .from('intervention_history')
      .insert({
        player_id: playerId,
        casino_id: casinoId,
        intervention_type: rule.intervention_type,
        trigger_reason: `Auto-triggered by threshold rule "${rule.rule_name}" (score ${riskScore} ≥ ${rule.risk_threshold})`,
        risk_score_at_trigger: riskScore,
        delivery_method: rule.delivery_methods[0],
        message_sent: message,
        auto_triggered: true,
        dispatch_status: 'pending',
        channels_attempted: rule.delivery_methods,
        triggered_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (ivRow?.id) {
      const dispatchResults = await handleDispatch(supabase, {
        intervention_id: ivRow.id,
        player_id: playerId,
        casino_id: casinoId,
        channels: rule.delivery_methods,
        message,
        intervention_type: rule.intervention_type,
        risk_score: riskScore,
      });
      triggered.push({ rule: rule.rule_name, intervention_id: ivRow.id, dispatch: dispatchResults });
    }
  }

  return { triggered: triggered.length > 0, interventions: triggered };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const url = new URL(req.url);
    const action = url.searchParams.get('action') || url.pathname.split('/').pop();

    if (req.method === 'POST') {
      const body = await req.json();

      if (action === 'dispatch') {
        const { intervention_id, player_id, casino_id, channels, message, intervention_type, risk_score } = body;
        if (!intervention_id || !player_id || !casino_id || !channels?.length) {
          return new Response(
            JSON.stringify({ error: 'Missing required fields: intervention_id, player_id, casino_id, channels' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        const results = await handleDispatch(supabase, { intervention_id, player_id, casino_id, channels, message, intervention_type, risk_score });
        return new Response(
          JSON.stringify({ success: true, dispatch_results: results }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (action === 'check-thresholds') {
        const { casino_id, player_id, risk_score } = body;
        if (!casino_id || !player_id || risk_score == null) {
          return new Response(
            JSON.stringify({ error: 'Missing: casino_id, player_id, risk_score' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        const result = await checkThresholds(supabase, casino_id, player_id, risk_score);
        return new Response(
          JSON.stringify({ success: true, ...result }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (action === 'send') {
        const {
          player_id, casino_id, intervention_type, delivery_methods,
          message, risk_score, trigger_reason, triggered_by,
        } = body;

        if (!player_id || !casino_id || !intervention_type || !message) {
          return new Response(
            JSON.stringify({ error: 'Missing required fields' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const channels: string[] = Array.isArray(delivery_methods) ? delivery_methods : [delivery_methods || 'in_app'];

        const { data: ivRow, error: ivErr } = await supabase
          .from('intervention_history')
          .insert({
            player_id,
            casino_id,
            intervention_type,
            trigger_reason: trigger_reason || `Manual intervention — risk score ${risk_score}`,
            risk_score_at_trigger: risk_score || 0,
            delivery_method: channels[0],
            message_sent: message,
            auto_triggered: false,
            triggered_by: triggered_by || null,
            dispatch_status: 'pending',
            channels_attempted: channels,
            triggered_at: new Date().toISOString(),
          })
          .select('id')
          .single();

        if (ivErr) throw ivErr;

        const dispatchResults = await handleDispatch(supabase, {
          intervention_id: ivRow.id,
          player_id,
          casino_id,
          channels,
          message,
          intervention_type,
          risk_score: risk_score || 0,
        });

        return new Response(
          JSON.stringify({ success: true, intervention_id: ivRow.id, dispatch_results: dispatchResults }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (req.method === 'GET') {
      const casinoId = url.searchParams.get('casino_id');
      const playerId = url.searchParams.get('player_id');

      if (action === 'rules') {
        const query = supabase.from('intervention_threshold_rules').select('*').order('risk_threshold');
        const { data, error } = casinoId ? await query.eq('casino_id', casinoId) : await query;
        if (error) throw error;
        return new Response(JSON.stringify({ success: true, rules: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (action === 'queue') {
        const query = supabase.from('intervention_delivery_queue').select('*').order('created_at', { ascending: false }).limit(100);
        const { data, error } = casinoId ? await query.eq('casino_id', casinoId) : await query;
        if (error) throw error;
        return new Response(JSON.stringify({ success: true, queue: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (action === 'history' && casinoId) {
        const { data, error } = await supabase
          .from('intervention_history')
          .select('*, players(player_id)')
          .eq('casino_id', casinoId)
          .order('triggered_at', { ascending: false })
          .limit(100);
        if (error) throw error;
        return new Response(JSON.stringify({ success: true, interventions: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    return new Response(
      JSON.stringify({ error: 'Unknown action. Use: POST ?action=send|dispatch|check-thresholds or GET ?action=rules|queue|history' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
