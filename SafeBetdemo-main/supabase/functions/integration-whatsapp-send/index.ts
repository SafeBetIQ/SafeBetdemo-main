import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SendMessageRequest {
  casino_id: string;
  to_phone: string;
  message: string;
  metadata?: Record<string, any>;
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

    const { casino_id, to_phone, message, metadata }: SendMessageRequest = await req.json();

    if (!casino_id || !to_phone || !message) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: casino_id, to_phone, message" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get casino's Twilio/WhatsApp integration config
    const { data: config, error: configError } = await supabase
      .from('casino_integration_configs')
      .select('id, credentials, is_enabled, casino_id')
      .eq('casino_id', casino_id)
      .eq('is_enabled', true)
      .limit(1)
      .maybeSingle();

    if (configError || !config) {
      return new Response(
        JSON.stringify({
          error: "WhatsApp integration not configured for this casino",
          details: configError?.message
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const credentials = config.credentials as any;
    const accountSid = credentials.account_sid;
    const authToken = credentials.auth_token;
    const whatsappNumber = credentials.whatsapp_number;

    if (!accountSid || !authToken || !whatsappNumber) {
      return new Response(
        JSON.stringify({ error: "Invalid Twilio credentials in configuration" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Send WhatsApp message via Twilio
    const startTime = Date.now();
    const result = await sendWhatsAppMessage(
      { accountSid, authToken, whatsappNumber },
      to_phone,
      message
    );
    const responseTime = Date.now() - startTime;

    // Log the API call
    await supabase
      .from('integration_api_logs')
      .insert({
        config_id: config.id,
        request_type: 'POST',
        endpoint: '/Messages',
        request_payload: { to: to_phone, message, metadata },
        response_status: result.success ? 200 : 400,
        response_payload: result,
        response_time_ms: responseTime,
        error_message: result.error || null
      });

    return new Response(
      JSON.stringify({
        success: result.success,
        message_sid: result.sid,
        status: result.success ? 'sent' : 'failed',
        error: result.error
      }),
      {
        status: result.success ? 200 : 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in integration-whatsapp-send:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

async function sendWhatsAppMessage(
  config: { accountSid: string; authToken: string; whatsappNumber: string },
  toPhone: string,
  message: string
): Promise<{ success: boolean; sid?: string; error?: string }> {
  try {
    const formattedTo = toPhone.startsWith('whatsapp:')
      ? toPhone
      : `whatsapp:${toPhone}`;

    const formattedFrom = config.whatsappNumber.startsWith('whatsapp:')
      ? config.whatsappNumber
      : `whatsapp:${config.whatsappNumber}`;

    const auth = btoa(`${config.accountSid}:${config.authToken}`);

    const body = new URLSearchParams({
      To: formattedTo,
      From: formattedFrom,
      Body: message
    });

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString()
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('[TWILIO ERROR]', error);
      return { success: false, error };
    }

    const result = await response.json();
    return { success: true, sid: result.sid };
  } catch (error) {
    console.error('[TWILIO EXCEPTION]', error);
    return { success: false, error: error.message };
  }
}
