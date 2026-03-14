import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 200, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      return jsonResponse({ error: "Server configuration error" }, 500);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const action = url.searchParams.get("action") ?? "status";

    if (action === "refresh-realtime") {
      const { data, error } = await supabase.rpc("refresh_realtime_views");
      if (error) return jsonResponse({ error: error.message }, 500);
      return jsonResponse({ success: true, result: data });
    }

    if (action === "refresh-all") {
      const { data, error } = await supabase.rpc("refresh_all_materialized_views");
      if (error) return jsonResponse({ error: error.message }, 500);
      return jsonResponse({ success: true, result: data });
    }

    if (action === "ensure-partitions") {
      const { error } = await supabase.rpc("ensure_future_partitions", { p_months_ahead: 3 });
      if (error) return jsonResponse({ error: error.message }, 500);
      return jsonResponse({ success: true, message: "Partitions ensured for next 3 months" });
    }

    if (action === "archive-records") {
      const monthsOld = parseInt(url.searchParams.get("months_old") ?? "6");
      const { data, error } = await supabase.rpc("archive_old_records", { p_months_old: monthsOld });
      if (error) return jsonResponse({ error: error.message }, 500);
      return jsonResponse({ success: true, result: data });
    }

    if (action === "performance-stats") {
      const { data, error } = await supabase.rpc("get_performance_stats");
      if (error) return jsonResponse({ error: error.message }, 500);
      return jsonResponse({ success: true, stats: data });
    }

    if (action === "rate-limit-analytics") {
      const hoursBack = parseInt(url.searchParams.get("hours_back") ?? "24");
      const { data, error } = await supabase.rpc("get_rate_limit_analytics", { p_hours_back: hoursBack });
      if (error) return jsonResponse({ error: error.message }, 500);
      return jsonResponse({ success: true, analytics: data });
    }

    return jsonResponse({
      status: "ok",
      available_actions: [
        "refresh-realtime",
        "refresh-all",
        "ensure-partitions",
        "archive-records",
        "performance-stats",
        "rate-limit-analytics",
      ],
    });
  } catch (err) {
    console.error("Unhandled error in db-maintenance:", err);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
