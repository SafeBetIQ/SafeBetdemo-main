import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const CASINO_ID = '33333333-3333-3333-3333-333333333333';

const saFirstNames = [
  'Thabo', 'Sipho', 'Lerato', 'Nomsa', 'Mandla', 'Zanele', 'Bongani', 'Precious', 'Tshepo', 'Ntombi',
  'Jabu', 'Thandiwe', 'Sello', 'Lindiwe', 'Kagiso', 'Nokuthula', 'Andile', 'Zinhle', 'Mpho', 'Busisiwe',
  'Themba', 'Nandi', 'Sizwe', 'Ayanda', 'Lwazi', 'Nombuso', 'Vusi', 'Thulisile', 'Nkosi', 'Zandile',
  'Sibusiso', 'Thandeka', 'Lucky', 'Noluthando', 'Gift', 'Simphiwe', 'Justice', 'Bontle', 'Welcome', 'Refilwe',
  'Pieter', 'Annelie', 'Johan', 'Marietjie', 'Francois', 'Elmarie', 'Charl', 'Liezl', 'Hennie', 'Sonja',
  'Ahmed', 'Fatima', 'Yusuf', 'Aisha', 'Ibrahim', 'Khadija', 'Abdullah', 'Zainab', 'Omar', 'Layla',
  'Ravi', 'Priya', 'Kumaran', 'Nalini', 'Dev', 'Anjali', 'Raj', 'Deepika', 'Amit', 'Kavita',
  'David', 'Sarah', 'Michael', 'Rebecca', 'Joshua', 'Rachel', 'Daniel', 'Hannah', 'James', 'Emma',
  'Lebo', 'Neo', 'Karabo', 'Palesa', 'Tebogo', 'Keabetswe', 'Lesedi', 'Onthatile', 'Kgosi', 'Masego',
  'Xolani', 'Nthabiseng', 'Siphiwe', 'Dineo', 'Dumisani', 'Boitumelo', 'Sandile', 'Mmabatho', 'Jabulani', 'Tlhogi'
];

const saLastNames = [
  'Nkosi', 'Dlamini', 'Mthembu', 'Khumalo', 'Ndlovu', 'Zulu', 'Sithole', 'Zwane', 'Mkhize', 'Nkomo',
  'Mokoena', 'Maluleke', 'Chauke', 'Modise', 'Phiri', 'Dube', 'Tshabalala', 'Cele', 'Ngcobo', 'Shezi',
  'Van der Merwe', 'Botha', 'Nel', 'Venter', 'De Wet', 'Pretorius', 'Fourie', 'Marais', 'Van Wyk', 'Steyn',
  'Patel', 'Naidoo', 'Pillay', 'Govender', 'Chetty', 'Reddy', 'Singh', 'Naicker', 'Moodley', 'Govindsamy',
  'Mohamed', 'Abrahams', 'Adams', 'Benjamin', 'Davids', 'Isaacs', 'Williams', 'Jones', 'Peters', 'Fisher',
  'Molefe', 'Maseko', 'Mathebula', 'Mabuza', 'Mnisi', 'Simelane', 'Khoza', 'Vilakazi', 'Mahlangu', 'Ngwenya',
  'Moyo', 'Sibanda', 'Ncube', 'Mpofu', 'Tshuma', 'Nkosi', 'Madonsela', 'Lukhele', 'Sikhosana', 'Magagula',
  'Baloyi', 'Rikhotso', 'Mathonsi', 'Nkuna', 'Hlongwane', 'Masilela', 'Mabaso', 'Radebe', 'Mdluli', 'Shabalala',
  'Mokwena', 'Mthethwa', 'Ntuli', 'Zungu', 'Majola', 'Biyela', 'Hadebe', 'Kubheka', 'Ngubane', 'Khanyile',
  'Langa', 'Gumede', 'Buthelezi', 'Mchunu', 'Gwala', 'Ntombela', 'Xaba', 'Mnguni', 'Zondi', 'Mdlalose'
];

const saProvinces = [
  'Gauteng', 'Western Cape', 'KwaZulu-Natal', 'Eastern Cape', 'Limpopo',
  'Mpumalanga', 'North West', 'Free State', 'Northern Cape'
];

const gameTypes = ['slots', 'blackjack', 'roulette', 'poker', 'baccarat'];

function generateSAIdNumber(): string {
  const year = Math.floor(Math.random() * 50) + 50;
  const month = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
  const day = String(Math.floor(Math.random() * 28) + 1).padStart(2, '0');
  const sequence = String(Math.floor(Math.random() * 9000) + 1000);
  const citizen = '0';
  const checksum = String(Math.floor(Math.random() * 10));
  return `${year}${month}${day}${sequence}${citizen}8${checksum}`;
}

function generatePhone(): string {
  const prefixes = ['082', '083', '084', '071', '072', '073', '074', '076', '078', '079'];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const number = String(Math.floor(Math.random() * 9000000) + 1000000);
  return `${prefix}${number}`;
}

function calculateRiskLevel(score: number): string {
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

async function seedPlayers() {
  console.log('Starting player seeding...');

  const players = [];
  const sessions = [];
  const bets = [];

  for (let i = 0; i < 100; i++) {
    const firstName = saFirstNames[Math.floor(Math.random() * saFirstNames.length)];
    const lastName = saLastNames[Math.floor(Math.random() * saLastNames.length)];
    const riskScore = Math.floor(Math.random() * 100);
    const totalWagered = Math.floor(Math.random() * 500000) + 10000;
    const winRate = 0.4 + Math.random() * 0.15;
    const totalWon = Math.floor(totalWagered * winRate);
    const sessionCount = Math.floor(Math.random() * 150) + 10;
    const avgDuration = Math.floor(Math.random() * 180) + 30;

    const isActive = Math.random() > 0.3;
    const lastActiveHours = isActive ? Math.random() * 2 : Math.random() * 48 + 24;

    const player = {
      casino_id: CASINO_ID,
      player_id: `PLR${String(i + 1).padStart(6, '0')}`,
      first_name: firstName,
      last_name: lastName,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@email.co.za`,
      phone: generatePhone(),
      id_number: generateSAIdNumber(),
      province: saProvinces[Math.floor(Math.random() * saProvinces.length)],
      risk_score: riskScore,
      risk_level: calculateRiskLevel(riskScore),
      total_wagered: totalWagered,
      total_won: totalWon,
      session_count: sessionCount,
      avg_session_duration: avgDuration,
      is_active: isActive,
      last_active: new Date(Date.now() - lastActiveHours * 60 * 60 * 1000).toISOString(),
    };

    players.push(player);
  }

  const { data: insertedPlayers, error: playersError } = await supabase
    .from('players')
    .insert(players)
    .select();

  if (playersError) {
    console.error('Error inserting players:', playersError);
    return;
  }

  console.log(`Inserted ${insertedPlayers.length} players`);

  const activePlayerIds = insertedPlayers
    .filter(p => p.is_active)
    .map(p => p.id);

  for (const playerId of activePlayerIds.slice(0, 40)) {
    const gameType = gameTypes[Math.floor(Math.random() * gameTypes.length)];
    const durationMinutes = Math.floor(Math.random() * 180) + 15;
    const totalBetsCount = Math.floor(Math.random() * 200) + 20;
    const avgBet = 50 + Math.random() * 450;
    const totalWagered = Math.floor(avgBet * totalBetsCount);
    const winRate = 0.35 + Math.random() * 0.2;
    const totalWon = Math.floor(totalWagered * winRate);

    const startTime = new Date(Date.now() - Math.random() * 7200000);

    const session = {
      player_id: playerId,
      casino_id: CASINO_ID,
      game_type: gameType,
      start_time: startTime.toISOString(),
      duration: durationMinutes,
      total_bets: totalBetsCount,
      total_wagered: totalWagered,
      total_won: totalWon,
      net_result: totalWon - totalWagered,
      risk_score_change: Math.floor(Math.random() * 20) - 5,
      is_active: true,
    };

    sessions.push(session);
  }

  if (sessions.length > 0) {
    const { data: insertedSessions, error: sessionsError } = await supabase
      .from('gaming_sessions')
      .insert(sessions)
      .select();

    if (sessionsError) {
      console.error('Error inserting sessions:', sessionsError);
      return;
    }

    console.log(`Inserted ${insertedSessions.length} active sessions`);

    for (const session of insertedSessions) {
      const betCount = Math.min(50, Math.floor(session.total_bets / 2));

      for (let j = 0; j < betCount; j++) {
        const betAmount = 20 + Math.random() * 980;
        const outcome = Math.random() < 0.45 ? 'win' : (Math.random() < 0.9 ? 'loss' : 'push');
        const winAmount = outcome === 'win' ? betAmount * (1.5 + Math.random() * 2) : 0;

        const betTime = new Date(
          new Date(session.start_time).getTime() +
          (j / betCount) * (session.duration * 60 * 1000)
        );

        bets.push({
          session_id: session.id,
          player_id: session.player_id,
          game_type: session.game_type,
          bet_amount: Math.floor(betAmount),
          win_amount: Math.floor(winAmount),
          outcome,
          timestamp: betTime.toISOString(),
        });
      }
    }

    if (bets.length > 0) {
      const BATCH_SIZE = 500;
      for (let i = 0; i < bets.length; i += BATCH_SIZE) {
        const batch = bets.slice(i, i + BATCH_SIZE);
        const { error: betsError } = await supabase
          .from('player_bets')
          .insert(batch);

        if (betsError) {
          console.error(`Error inserting bets batch ${i / BATCH_SIZE + 1}:`, betsError);
        } else {
          console.log(`Inserted ${batch.length} bets (batch ${i / BATCH_SIZE + 1})`);
        }
      }
    }
  }

  console.log('Player seeding completed!');
  console.log(`Total: ${players.length} players, ${sessions.length} active sessions, ${bets.length} bets`);
}

seedPlayers().catch(console.error);
