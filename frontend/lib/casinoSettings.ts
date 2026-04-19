/**
 * casinoSettings.ts
 *
 * Helper functions for reading and writing per-casino intervention configuration.
 * Safe to call from both client components and API routes.
 */

import { supabase } from './supabase';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CasinoSettings {
  id?: string;
  casino_id: string;
  intervention_threshold: number;
  enabled_channels: string[];
  cooldown_minutes: number;
  message_template: string;
  updated_at?: string;
}

// ── Defaults — used when no row exists for a casino yet ───────────────────────

export const DEFAULT_SETTINGS: Omit<CasinoSettings, 'casino_id'> = {
  intervention_threshold: 5000,
  enabled_channels:       ['in_app'],
  cooldown_minutes:       10,
  message_template:
    "We've noticed unusual betting activity on your account. Please consider taking a break.",
};

// ── Read ──────────────────────────────────────────────────────────────────────

/**
 * Fetch settings for a casino. Returns DEFAULT_SETTINGS if no row exists yet.
 */
export async function getCasinoSettings(casinoId: string): Promise<CasinoSettings> {
  const { data, error } = await supabase
    .from('casino_settings')
    .select('*')
    .eq('casino_id', casinoId)
    .maybeSingle();

  if (error) {
    console.error('[casinoSettings] fetch error:', error.message);
  }

  if (!data) {
    return { casino_id: casinoId, ...DEFAULT_SETTINGS };
  }

  return data as CasinoSettings;
}

// ── Write ─────────────────────────────────────────────────────────────────────

/**
 * Upsert settings for a casino.
 * Inserts a new row if none exists; updates in-place if one does.
 */
export async function upsertCasinoSettings(
  casinoId: string,
  updates: Partial<Omit<CasinoSettings, 'id' | 'casino_id'>>
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('casino_settings')
    .upsert(
      {
        casino_id: casinoId,
        ...updates,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'casino_id' }
    );

  if (error) {
    console.error('[casinoSettings] upsert error:', error.message);
    return { success: false, error: error.message };
  }

  return { success: true };
}

// ── Template interpolation ────────────────────────────────────────────────────

/**
 * Replace {player}, {risk}, {amount} placeholders in a message template.
 *
 * @example
 * interpolateMessage("Hi {player}, risk {risk}, loss ~R{amount}", {
 *   player: "Jane",
 *   risk: 87,
 *   amount: "6,200",
 * });
 * // → "Hi Jane, risk 87, loss ~R6,200"
 */
export function interpolateMessage(
  template: string,
  vars: { player?: string; risk?: number | string; amount?: string }
): string {
  return template
    .replace(/\{player\}/g, vars.player ?? 'Valued Player')
    .replace(/\{risk\}/g,   String(vars.risk   ?? ''))
    .replace(/\{amount\}/g, vars.amount ?? '');
}
