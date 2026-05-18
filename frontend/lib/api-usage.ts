import { NextRequest } from 'next/server';
import { serviceClient } from '@/lib/api-auth';

/**
 * Fire-and-forget usage log. Never throws — failure is swallowed to avoid
 * blocking the request. Only logs when x-api-key header is present.
 */
export function logApiUsage(
  req: NextRequest,
  endpoint: string,
  userId: string,
  statusCode = 200,
  durationMs?: number,
): void {
  const apiKey = req.headers.get('x-api-key')?.trim();
  if (!apiKey) return;

  const ip = req.headers.get('cf-connecting-ip')
    ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? null;

  try {
    const sb = serviceClient();

    // Resolve api_key_id non-blockingly
    sb.from('api_keys')
      .select('id')
      .eq('key', apiKey)
      .single()
      .then(({ data }) => {
        sb.from('api_usage_logs').insert({
          api_key_id:  data?.id ?? null,
          api_key:     apiKey,
          endpoint,
          user_id:     userId || null,
          request_ip:  ip,
          status_code: statusCode,
          duration_ms: durationMs ?? null,
          created_at:  new Date().toISOString(),
        }).then(({ error }) => {
          if (error) console.error('[api-usage] log failed:', error.message);
        });

        // Update last_used_at on the key
        if (data?.id) {
          sb.from('api_keys')
            .update({ last_used_at: new Date().toISOString() })
            .eq('id', data.id)
            .then(() => {});
        }
      });
  } catch {
    // swallow — usage logging must never break a request
  }
}
