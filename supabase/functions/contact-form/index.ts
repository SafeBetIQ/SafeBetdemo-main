import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// ── UPGRADE 4: Contact Form API Security ──────────────────────────────────────
// This Edge Function is the ONLY path for contact form submissions.
// Direct anon INSERT to contact_submissions is a fallback kept for compatibility.
//
// Security layers (in order):
//   1. Cloudflare Turnstile CAPTCHA verification
//   2. Schema validation (email format, field lengths, allowed values)
//   3. Rate limiting — 3 submissions per email per 24h (checked in DB)
//   4. Sanitisation — whitespace trim, email lowercased
//   5. INSERT using service_role (no anon JWT transmitted)
// ─────────────────────────────────────────────────────────────────────────────

const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  Deno.env.get("ALLOWED_ORIGIN") ?? "https://safebetiq.com",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

const EMAIL_RE    = /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/;
const ALLOWED_TYPES = new Set(["casino_operator", "regulator", "player", "other", ""]);

// ── Validation ────────────────────────────────────────────────────────────────

interface ContactPayload {
  name:       string;
  email:      string;
  company?:   string;
  phone?:     string;
  user_type?: string;
  message:    string;
  turnstile_token: string;
}

interface ValidationError {
  field: string;
  message: string;
}

function validatePayload(body: unknown): { data: ContactPayload | null; errors: ValidationError[] } {
  const errors: ValidationError[] = [];

  if (typeof body !== "object" || body === null) {
    return { data: null, errors: [{ field: "body", message: "Invalid request body" }] };
  }

  const b = body as Record<string, unknown>;

  // turnstile_token
  if (!b.turnstile_token || typeof b.turnstile_token !== "string") {
    errors.push({ field: "turnstile_token", message: "CAPTCHA token is required" });
  }

  // name
  const name = typeof b.name === "string" ? b.name.trim() : "";
  if (name.length < 2 || name.length > 100) {
    errors.push({ field: "name", message: "Name must be 2–100 characters" });
  }

  // email
  const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
  if (!EMAIL_RE.test(email) || email.length < 5 || email.length > 254) {
    errors.push({ field: "email", message: "Valid email address is required (max 254 chars)" });
  }

  // message
  const message = typeof b.message === "string" ? b.message.trim() : "";
  if (message.length < 10 || message.length > 5000) {
    errors.push({ field: "message", message: "Message must be 10–5000 characters" });
  }

  // user_type (optional, but must be in allowed set if provided)
  const user_type = typeof b.user_type === "string" ? b.user_type.trim() : "";
  if (!ALLOWED_TYPES.has(user_type)) {
    errors.push({ field: "user_type", message: "Invalid user type" });
  }

  // optional fields — length guard only
  const company = typeof b.company === "string" ? b.company.trim().slice(0, 200) : undefined;
  const phone   = typeof b.phone   === "string" ? b.phone.trim().slice(0, 30)   : undefined;

  if (errors.length > 0) return { data: null, errors };

  return {
    data: {
      name,
      email,
      company:         company || undefined,
      phone:           phone   || undefined,
      user_type:       user_type || undefined,
      message,
      turnstile_token: b.turnstile_token as string,
    },
    errors: [],
  };
}

// ── Turnstile verification ────────────────────────────────────────────────────

async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  const secret = Deno.env.get("TURNSTILE_SECRET_KEY");
  if (!secret) {
    console.error("[contact-form] TURNSTILE_SECRET_KEY not configured — rejecting");
    return false;
  }

  const formData = new FormData();
  formData.append("secret",   secret);
  formData.append("response", token);
  formData.append("remoteip", ip);

  try {
    const res  = await fetch(TURNSTILE_VERIFY_URL, { method: "POST", body: formData });
    const json = await res.json() as { success: boolean; "error-codes"?: string[] };

    if (!json.success) {
      console.warn("[contact-form] Turnstile rejected", { ip, codes: json["error-codes"] });
    }
    return json.success === true;
  } catch (err) {
    console.error("[contact-form] Turnstile network error:", err);
    return false;
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const ip = req.headers.get("cf-connecting-ip")
    ?? req.headers.get("x-forwarded-for")?.split(",")[0].trim()
    ?? "unknown";

  // ── Parse body ──────────────────────────────────────────────────────────────
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  // ── Schema validation ───────────────────────────────────────────────────────
  const { data, errors } = validatePayload(rawBody);
  if (!data || errors.length > 0) {
    return new Response(JSON.stringify({ error: "Validation failed", details: errors }), {
      status: 422,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  // ── Turnstile CAPTCHA ───────────────────────────────────────────────────────
  const captchaOk = await verifyTurnstile(data.turnstile_token, ip);
  if (!captchaOk) {
    return new Response(JSON.stringify({ error: "CAPTCHA verification failed. Please try again." }), {
      status: 403,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  // ── Service client (bypasses RLS — insert is authoritative here) ────────────
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // ── Rate limit check — max 3 per email per 24 hours ─────────────────────────
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error: countErr } = await supabase
    .from("contact_submissions")
    .select("id", { count: "exact", head: true })
    .eq("email", data.email)
    .gte("created_at", since);

  if (countErr) {
    console.error("[contact-form] Rate limit check failed:", countErr.message);
    return new Response(JSON.stringify({ error: "Internal error — please try again" }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  if ((count ?? 0) >= 3) {
    console.warn("[contact-form] Rate limit hit", { email: data.email, ip });
    return new Response(
      JSON.stringify({ error: "Too many submissions. Please wait 24 hours before submitting again." }),
      { status: 429, headers: { ...CORS_HEADERS, "Content-Type": "application/json", "Retry-After": "86400" } },
    );
  }

  // ── Insert ──────────────────────────────────────────────────────────────────
  const { error: insertErr } = await supabase.from("contact_submissions").insert({
    name:       data.name,
    email:      data.email,
    company:    data.company    ?? null,
    phone:      data.phone      ?? null,
    user_type:  data.user_type  ?? null,
    message:    data.message,
    status:     "new",
    email_sent: false,
  });

  if (insertErr) {
    // Surface rate-limit trigger error (P0001) cleanly to the client
    if (insertErr.code === "P0001") {
      return new Response(
        JSON.stringify({ error: "Too many submissions. Please wait before submitting again." }),
        { status: 429, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
      );
    }
    console.error("[contact-form] Insert error:", insertErr.message, insertErr.code);
    return new Response(JSON.stringify({ error: "Submission failed — please try again" }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  console.log("[contact-form] Submission accepted", { email: data.email, ip });

  return new Response(
    JSON.stringify({ success: true, message: "Thank you — we will be in touch shortly." }),
    { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
  );
});
