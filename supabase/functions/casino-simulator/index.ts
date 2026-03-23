import { createClient } from 'npm:@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const GAME_TYPES = ['Slots', 'Blackjack', 'Roulette', 'Poker', 'Baccarat', 'Video Poker', 'Craps', 'Bingo'];
const MACHINE_TYPES = ['slot', 'table', 'rng', 'live_dealer'] as const;

const SA_NAMES = [
  'Thabo Nkosi','Lerato Dlamini','Sipho Mthembu','Nomsa Khumalo','Mandla Ndlovu',
  'Zanele Zulu','Bongani Sithole','Precious Zwane','Tshepo Mkhize','Ntombi Nkomo',
  'Pieter van der Merwe','Annelie Botha','Ahmed Mohamed','Fatima Abrahams','Ravi Patel',
  'Priya Naidoo','Johan Botha','Lindiwe Zulu','Kagiso Molefe','Neo Phiri',
  'Luthando Dube','Ayanda Mthethwa','Sbongile Hadebe','Thandeka Vilakazi','Nhlanhla Mkhize',
  'Siyanda Buthelezi','Nokuthula Gumbi','Mpendulo Ndlela','Zintle Skosana','Tebogo Mokoena',
];

type BehaviourProfile = 'casual' | 'high_roller' | 'at_risk' | 'problem';

interface SimPlayer {
  playerId: string;
  playerName: string;
  profile: BehaviourProfile;
  sessionId: string;
  riskScore: number;
  balance: number;
  currentGame: string;
  machineId: string;
  sessionStartTime: Date;
  lastBetTime: Date;
  consecutiveLosses: number;
  totalWageredSession: number;
}

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randFloat(min: number, max: number): number {
  return parseFloat((Math.random() * (max - min) + min).toFixed(2));
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function buildPlayerPool(
  size: number,
  behaviourMix: { casual: number; high_roller: number; at_risk: number; problem: number }
): SimPlayer[] {
  const players: SimPlayer[] = [];

  for (let i = 0; i < size; i++) {
    const r = Math.random();
    let profile: BehaviourProfile;
    if (r < behaviourMix.casual) profile = 'casual';
    else if (r < behaviourMix.casual + behaviourMix.high_roller) profile = 'high_roller';
    else if (r < behaviourMix.casual + behaviourMix.high_roller + behaviourMix.at_risk) profile = 'at_risk';
    else profile = 'problem';

    const name = SA_NAMES[i % SA_NAMES.length];
    const suffix = Math.floor(i / SA_NAMES.length);

    const baseRisk = profile === 'problem' ? rand(75, 100)
      : profile === 'at_risk' ? rand(55, 79)
      : profile === 'high_roller' ? rand(20, 60)
      : rand(0, 40);

    players.push({
      playerId: `PLR${String(i + 1).padStart(6, '0')}`,
      playerName: suffix > 0 ? `${name} ${suffix + 1}` : name,
      profile,
      sessionId: `SES${Date.now()}-${i}`,
      riskScore: baseRisk,
      balance: profile === 'high_roller' ? randFloat(50000, 500000) : randFloat(500, 50000),
      currentGame: pickRandom(GAME_TYPES),
      machineId: `M${String(rand(1, 200)).padStart(3, '0')}`,
      sessionStartTime: new Date(Date.now() - rand(0, 7200000)),
      lastBetTime: new Date(Date.now() - rand(0, 60000)),
      consecutiveLosses: 0,
      totalWageredSession: randFloat(0, 5000),
    });
  }

  return players;
}

function generateBetAmount(player: SimPlayer): number {
  switch (player.profile) {
    case 'high_roller': return randFloat(500, 10000);
    case 'problem': {
      const base = randFloat(200, 3000);
      return player.consecutiveLosses > 3 ? base * (1 + player.consecutiveLosses * 0.3) : base;
    }
    case 'at_risk': return randFloat(100, 2000);
    default: return randFloat(20, 500);
  }
}

function computeRiskFlags(player: SimPlayer, betAmount: number): string[] {
  const flags: string[] = [];
  const sessionMinutes = (Date.now() - player.sessionStartTime.getTime()) / 60000;

  if (player.consecutiveLosses >= 3) flags.push('loss_chasing');
  if (sessionMinutes > 120) flags.push('excessive_time');
  if (betAmount > player.totalWageredSession * 0.5 && player.totalWageredSession > 1000) flags.push('bet_escalation');
  if (sessionMinutes > 240) flags.push('continuous_play');
  if (player.profile === 'problem' && betAmount > 1000) flags.push('rapid_high_stakes');

  return flags;
}

function updateRiskScore(player: SimPlayer, flags: string[]): number {
  let score = player.riskScore;
  if (flags.includes('loss_chasing')) score = Math.min(100, score + rand(3, 8));
  if (flags.includes('excessive_time')) score = Math.min(100, score + rand(2, 5));
  if (flags.includes('bet_escalation')) score = Math.min(100, score + rand(5, 12));
  if (flags.includes('continuous_play')) score = Math.min(100, score + rand(4, 10));
  if (flags.length === 0) score = Math.max(0, score - rand(0, 2));
  return Math.round(score);
}

function simulateBurst(
  players: SimPlayer[],
  casinoId: string,
  count: number
): { events: Record<string, unknown>[]; machineUpdates: Record<string, unknown>[] } {
  const events: Record<string, unknown>[] = [];
  const machineMap = new Map<string, Record<string, unknown>>();

  const activePlayers = players.filter(p => Math.random() > 0.3);

  for (let i = 0; i < count; i++) {
    const player = pickRandom(activePlayers);
    if (!player) continue;

    const betAmount = generateBetAmount(player);
    const isWin = Math.random() > (player.profile === 'problem' ? 0.65 : 0.55);
    const winAmount = isWin ? parseFloat((betAmount * randFloat(1.2, 4.0)).toFixed(2)) : 0;
    const flags = computeRiskFlags(player, betAmount);
    player.riskScore = updateRiskScore(player, flags);

    if (isWin) {
      player.consecutiveLosses = 0;
      player.balance += winAmount - betAmount;
    } else {
      player.consecutiveLosses++;
      player.balance -= betAmount;
    }
    player.totalWageredSession += betAmount;
    player.lastBetTime = new Date();

    const eventTypes: Array<'BET_PLACED' | 'GAME_SPIN' | 'HAND_PLAYED'> = ['BET_PLACED', 'GAME_SPIN', 'HAND_PLAYED'];
    const eventType = pickRandom(eventTypes);

    events.push({
      event_type: eventType,
      casino_id: casinoId,
      player_id: player.playerId,
      session_id: player.sessionId,
      game_id: player.currentGame,
      machine_id: player.machineId,
      bet_amount: betAmount,
      win_amount: winAmount,
      balance_after: Math.max(0, player.balance),
      duration_seconds: rand(10, 120),
      risk_score: player.riskScore,
      risk_flags: flags,
      outcome: isWin ? 'win' : 'loss',
      game_type: player.currentGame,
      is_simulated: true,
      metadata: {
        player_name: player.playerName,
        profile: player.profile,
        consecutive_losses: player.consecutiveLosses,
        session_minutes: Math.round((Date.now() - player.sessionStartTime.getTime()) / 60000),
      },
    });

    machineMap.set(player.machineId, {
      casino_id: casinoId,
      machine_id: player.machineId,
      machine_type: pickRandom([...MACHINE_TYPES]),
      current_player_id: player.playerId,
      session_start: player.sessionStartTime.toISOString(),
      status: 'active',
      spins_per_minute: randFloat(8, 25),
      current_risk_score: player.riskScore,
      total_wagered_session: player.totalWageredSession,
      is_simulated: true,
      updated_at: new Date().toISOString(),
    });
  }

  const idleMachineCount = rand(5, 20);
  for (let i = 0; i < idleMachineCount; i++) {
    const machineId = `M${String(rand(100, 200)).padStart(3, '0')}`;
    if (!machineMap.has(machineId)) {
      machineMap.set(machineId, {
        casino_id: casinoId,
        machine_id: machineId,
        machine_type: pickRandom([...MACHINE_TYPES]),
        current_player_id: null,
        session_start: null,
        status: Math.random() > 0.9 ? 'offline' : 'idle',
        spins_per_minute: 0,
        current_risk_score: 0,
        total_wagered_session: 0,
        is_simulated: true,
        updated_at: new Date().toISOString(),
      });
    }
  }

  return { events, machineUpdates: Array.from(machineMap.values()) };
}

function computeKpiSnapshot(
  players: SimPlayer[],
  events: Record<string, unknown>[],
  casinoId: string
) {
  const totalWagered = events.reduce((s, e) => s + Number(e.bet_amount || 0), 0);
  const totalWon = events.reduce((s, e) => s + Number(e.win_amount || 0), 0);
  const activePlayers = new Set(events.map(e => e.player_id)).size;
  const avgBet = events.length > 0 ? totalWagered / events.length : 0;

  const riskCounts = { low: 0, medium: 0, high: 0, critical: 0 };
  players.forEach(p => {
    if (p.riskScore >= 80) riskCounts.critical++;
    else if (p.riskScore >= 60) riskCounts.high++;
    else if (p.riskScore >= 40) riskCounts.medium++;
    else riskCounts.low++;
  });

  return {
    casino_id: casinoId,
    snapshot_at: new Date().toISOString(),
    active_players: activePlayers,
    events_per_min: events.length,
    total_wagered: parseFloat(totalWagered.toFixed(2)),
    total_won: parseFloat(totalWon.toFixed(2)),
    ggr: parseFloat((totalWagered - totalWon).toFixed(2)),
    avg_bet_size: parseFloat(avgBet.toFixed(2)),
    risk_critical: riskCounts.critical,
    risk_high: riskCounts.high,
    risk_medium: riskCounts.medium,
    risk_low: riskCounts.low,
    active_machines: 0,
    is_simulated: true,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: userData } = await supabase
      .from('users')
      .select('role, casino_id')
      .eq('id', user.id)
      .maybeSingle();

    if (!userData || !['casino_admin', 'super_admin'].includes(userData.role)) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'burst';
    const casinoId = url.searchParams.get('casino_id') || userData.casino_id;

    if (!casinoId) {
      return new Response(JSON.stringify({ error: 'casino_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: config } = await supabase
      .from('simulation_config')
      .select('*')
      .eq('casino_id', casinoId)
      .maybeSingle();

    const cfg = config || {
      player_pool_size: 500,
      events_per_minute: 60,
      machine_count: 50,
      behaviour_mix: { casual: 0.6, high_roller: 0.15, at_risk: 0.2, problem: 0.05 },
    };

    if (action === 'burst') {
      const burstSize = Math.min(Number(url.searchParams.get('count') || 20), 200);
      const players = buildPlayerPool(Math.min(cfg.player_pool_size, 200), cfg.behaviour_mix);
      const { events, machineUpdates } = simulateBurst(players, casinoId, burstSize);

      const BATCH_SIZE = 50;
      let inserted = 0;
      for (let i = 0; i < events.length; i += BATCH_SIZE) {
        const batch = events.slice(i, i + BATCH_SIZE);
        const { error } = await supabase.from('live_events').insert(batch);
        if (!error) inserted += batch.length;
      }

      for (const machine of machineUpdates) {
        await supabase.from('machine_activity').upsert(machine, {
          onConflict: 'casino_id,machine_id',
        });
      }

      const kpi = computeKpiSnapshot(players, events, casinoId);
      await supabase.from('live_kpi_snapshots').insert(kpi);

      return new Response(JSON.stringify({
        success: true,
        inserted,
        machines: machineUpdates.length,
        kpi: { wagered: kpi.total_wagered, won: kpi.total_won, ggr: kpi.ggr },
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'status') {
      const { data: recentEvents, count } = await supabase
        .from('live_events')
        .select('*', { count: 'exact', head: true })
        .eq('casino_id', casinoId)
        .gte('created_at', new Date(Date.now() - 60000).toISOString());

      const { data: latestKpi } = await supabase
        .from('live_kpi_snapshots')
        .select('*')
        .eq('casino_id', casinoId)
        .order('snapshot_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      return new Response(JSON.stringify({
        casino_id: casinoId,
        events_last_minute: count || 0,
        config: cfg,
        latest_kpi: latestKpi,
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('casino-simulator error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
