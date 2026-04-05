'use client';

import React, {
  createContext, useContext, useState, useEffect, useCallback,
} from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import {
  getCasinoSettings, DEFAULT_SETTINGS, type CasinoSettings,
} from '@/lib/casinoSettings';

// ── Context type ──────────────────────────────────────────────────────────────

interface CasinoSettingsContextValue {
  settings: CasinoSettings;
  loading: boolean;
  refreshSettings: () => Promise<void>;
}

// ── Context + hook ────────────────────────────────────────────────────────────

const CasinoSettingsContext = createContext<CasinoSettingsContextValue | null>(null);

export function useCasinoSettings(): CasinoSettingsContextValue {
  const ctx = useContext(CasinoSettingsContext);
  if (!ctx) {
    throw new Error('useCasinoSettings must be used within <CasinoSettingsProvider>');
  }
  return ctx;
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function CasinoSettingsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const casinoId = (user as any)?.casino_id as string | undefined;

  const [settings, setSettings] = useState<CasinoSettings>({
    casino_id: casinoId ?? '',
    ...DEFAULT_SETTINGS,
  });
  const [loading, setLoading] = useState(true);

  // ── Initial load ──────────────────────────────────────────────────────────

  const loadSettings = useCallback(async () => {
    if (!casinoId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const s = await getCasinoSettings(casinoId);
    setSettings(s);
    setLoading(false);
  }, [casinoId]);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  // ── Supabase Realtime — live-sync on settings row changes ─────────────────
  //
  // When the settings page (or any other client) saves new values, the DB row
  // changes and Supabase pushes an event here. We re-fetch so the intervention
  // engine picks up new thresholds / channels / cooldown immediately without
  // requiring a page reload.

  useEffect(() => {
    if (!casinoId) return;

    const channel = supabase
      .channel(`casino-settings:${casinoId}`)
      .on(
        'postgres_changes',
        {
          event:  '*',
          schema: 'public',
          table:  'casino_settings',
          filter: `casino_id=eq.${casinoId}`,
        },
        async () => {
          const updated = await getCasinoSettings(casinoId);
          setSettings(updated);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [casinoId]);

  return (
    <CasinoSettingsContext.Provider value={{ settings, loading, refreshSettings: loadSettings }}>
      {children}
    </CasinoSettingsContext.Provider>
  );
}
