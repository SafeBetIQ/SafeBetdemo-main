import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SendInvitationRequest {
  player_id: string;
  game_concept_id: string;
  campaign_id?: string;
  channel: 'email' | 'whatsapp';
  expires_in_hours?: number;
}

interface TwilioConfig {
  accountSid: string;
  authToken: string;
  whatsappNumber: string;
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

    const {
      player_id,
      game_concept_id,
      campaign_id,
      channel,
      expires_in_hours = 72
    }: SendInvitationRequest = await req.json();

    if (!player_id || !game_concept_id || !channel) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: player_id, game_concept_id, channel" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: player, error: playerError } = await supabase
      .from('players')
      .select('id, first_name, email, phone, casino_id')
      .eq('id', player_id)
      .single();

    if (playerError || !player) {
      return new Response(
        JSON.stringify({ error: "Player not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: gameConcept, error: gameError } = await supabase
      .from('wellbeing_game_concepts')
      .select('id, name, slug, description, duration_minutes')
      .eq('id', game_concept_id)
      .single();

    if (gameError || !gameConcept) {
      return new Response(
        JSON.stringify({ error: "Game concept not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const secureToken = generateSecureToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expires_in_hours);

    const { data: invitation, error: invitationError } = await supabase
      .from('wellbeing_game_invitations')
      .insert({
        campaign_id: campaign_id || null,
        player_id: player_id,
        game_concept_id: game_concept_id,
        secure_token: secureToken,
        channel: channel,
        sent_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
        status: 'pending'
      })
      .select()
      .single();

    if (invitationError || !invitation) {
      console.error("Error creating invitation:", invitationError);
      return new Response(
        JSON.stringify({ error: "Failed to create invitation" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const gameUrl = `${supabaseUrl.replace('/v1', '')}/wellbeing-game/play/${secureToken}`;

    const message = createMessage(player.first_name, gameConcept, gameUrl);

    let sendResult = null;
    let deliveryStatus = 'simulation';

    if (channel === 'email') {
      console.log(`[EMAIL SIMULATION] To: ${player.email}`);
      console.log(`Subject: Quick wellbeing check-in - ${gameConcept.name}`);
      console.log(`Body: ${message}`);
      console.log(`Link: ${gameUrl}`);
      deliveryStatus = 'simulated';
    } else if (channel === 'whatsapp') {
      const twilioConfig = getTwilioConfig();

      if (twilioConfig && player.phone) {
        try {
          sendResult = await sendWhatsAppMessage(
            twilioConfig,
            player.phone,
            message
          );
          deliveryStatus = sendResult.success ? 'sent' : 'failed';
          console.log(`[WHATSAPP] Message ${deliveryStatus} to ${player.phone}`);
        } catch (error) {
          console.error(`[WHATSAPP ERROR]`, error);
          deliveryStatus = 'error';
        }
      } else {
        console.log(`[WHATSAPP SIMULATION] To: ${player.phone || 'no phone'}`);
        console.log(`Message: ${message}`);
        deliveryStatus = 'simulated';
      }
    }

    await supabase
      .from('wellbeing_game_invitations')
      .update({
        status: deliveryStatus === 'sent' ? 'sent' : 'pending',
        delivery_status: deliveryStatus
      })
      .eq('id', invitation.id);

    return new Response(
      JSON.stringify({
        success: true,
        invitation_id: invitation.id,
        secure_token: secureToken,
        game_url: gameUrl,
        expires_at: expiresAt.toISOString(),
        message: `Invitation ${deliveryStatus} via ${channel}`,
        delivery_status: deliveryStatus,
        ...(sendResult && { twilio_sid: sendResult.sid })
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in send-wellbeing-invitation:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

function generateSecureToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

function getTwilioConfig(): TwilioConfig | null {
  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  const whatsappNumber = Deno.env.get("TWILIO_WHATSAPP_NUMBER");

  if (!accountSid || !authToken || !whatsappNumber) {
    return null;
  }

  return { accountSid, authToken, whatsappNumber };
}

async function sendWhatsAppMessage(
  config: TwilioConfig,
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

function createMessage(
  playerName: string,
  gameConcept: any,
  gameUrl: string
): string {
  return `Hi ${playerName},

Take a quick ${gameConcept.duration_minutes}-minute game to reflect on how you're playing.

${gameConcept.description}

Play now: ${gameUrl}

This is a voluntary wellbeing check-in to support responsible play.

SafeBet IQ`;
}
