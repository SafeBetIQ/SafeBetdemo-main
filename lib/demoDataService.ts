export interface DemoPlayer {
  id: string;
  casino_id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  province: string;
  vip_tier: 'none' | 'bronze' | 'silver' | 'gold' | 'platinum';
  risk_score: number;
  risk_level: 'Low' | 'Medium' | 'High' | 'Critical';
  lifetime_value: number;
  total_deposits: number;
  total_withdrawals: number;
  last_active_at: string;
  status: 'active' | 'flagged' | 'self_excluded' | 'closed';
  signup_date: string;
}

export interface DemoEvent {
  id: string;
  player_id: string;
  casino_id: string;
  event_type: string;
  risk_level: 'Low' | 'Medium' | 'High' | 'Critical';
  description: string;
  timestamp: string;
  metadata: any;
}

export interface DemoIntervention {
  id: string;
  player_id: string;
  casino_id: string;
  type: string;
  status: 'new' | 'in_review' | 'actioned' | 'follow_up' | 'closed';
  reason_stack: Array<{ factor: string; weight: number }>;
  created_at: string;
  updated_at: string;
  outcome?: string;
}

const SA_PROVINCES = [
  'Gauteng', 'Western Cape', 'KwaZulu-Natal', 'Eastern Cape',
  'Free State', 'Limpopo', 'Mpumalanga', 'North West', 'Northern Cape'
];

const FIRST_NAMES = [
  'Thabo', 'Sipho', 'Thandiwe', 'Nomsa', 'Kagiso', 'Lindiwe', 'Bongani', 'Zanele',
  'Mandla', 'Precious', 'Lerato', 'Mpho', 'Sello', 'Nthabiseng', 'Themba', 'Nokuthula',
  'Andile', 'Busisiwe', 'Dumisani', 'Thandi', 'Jabu', 'Palesa', 'Vusi', 'Nandi',
  'Johan', 'Pieter', 'Annelize', 'Marelize', 'Francois', 'Elmarie', 'Riaan', 'Chantel',
  'David', 'Sarah', 'Michael', 'Nicole', 'Ryan', 'Michelle', 'Shane', 'Natalie'
];

const LAST_NAMES = [
  'Mthembu', 'Nkosi', 'Dlamini', 'Khumalo', 'Ndlovu', 'Zulu', 'Mokoena', 'Molefe',
  'Mahlangu', 'Mbatha', 'Sithole', 'Naidoo', 'Pillay', 'Govender', 'Reddy', 'Chetty',
  'Van der Merwe', 'Botha', 'Pretorius', 'Fourie', 'Nel', 'Du Plessis', 'Venter',
  'Smith', 'Jones', 'Williams', 'Brown', 'Davis', 'Miller', 'Wilson', 'Moore'
];

const EVENT_TYPES = [
  { type: 'session_escalation', risk: 'High', desc: 'Betting session escalated beyond normal patterns' },
  { type: 'loss_chasing', risk: 'Critical', desc: 'Rapid re-deposits after significant losses' },
  { type: 'spend_spike', risk: 'High', desc: 'Sudden increase in spending detected' },
  { type: 'late_night_play', risk: 'Medium', desc: 'Extended gambling during late hours' },
  { type: 'rapid_deposits', risk: 'High', desc: 'Multiple deposits in short time period' },
  { type: 'affordability_concern', risk: 'High', desc: 'Spending patterns suggest affordability issues' },
  { type: 'time_spent_increase', risk: 'Medium', desc: 'Significant increase in time spent gambling' },
  { type: 'bet_size_increase', risk: 'High', desc: 'Unusual increase in bet sizes' },
  { type: 'emotional_betting', risk: 'High', desc: 'Erratic betting patterns detected' },
  { type: 'multi_channel_play', risk: 'Medium', desc: 'Simultaneous play across multiple channels' }
];

const INTERVENTION_TYPES = [
  'Proactive Check-in',
  'Spend Limit Suggestion',
  'Cool-off Period',
  'Reality Check Alert',
  'Account Restriction',
  'Self-exclusion Support',
  'Financial Wellness Referral',
  'VIP Concierge Contact'
];

export class DemoDataService {
  private casinos = [
    { id: 'casino-1', name: 'Sun City Casino', location: 'North West' },
    { id: 'casino-2', name: 'Monte Casino', location: 'Gauteng' },
    { id: 'casino-3', name: 'GrandWest Casino', location: 'Western Cape' }
  ];

  private randomElement<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)];
  }

  private randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  private randomFloat(min: number, max: number, decimals = 2): number {
    return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
  }

  private generatePlayerId(casinoIndex: number, playerIndex: number): string {
    return `SBQ-CA${casinoIndex + 1}-${String(playerIndex + 1).padStart(5, '0')}`;
  }

  private generateEmail(firstName: string, lastName: string, index: number): string {
    return `${firstName.toLowerCase()}.${lastName.toLowerCase()}${index}@demo.safebetiq.com`;
  }

  private generatePhone(): string {
    const prefix = this.randomElement(['082', '083', '084', '071', '072', '073', '074', '076']);
    const number = String(this.randomInt(1000000, 9999999));
    return `+27 ${prefix} ${number}`;
  }

  private calculateRiskLevel(score: number): 'Low' | 'Medium' | 'High' | 'Critical' {
    if (score >= 80) return 'Critical';
    if (score >= 60) return 'High';
    if (score >= 40) return 'Medium';
    return 'Low';
  }

  private generateVIPTier(ltv: number): 'none' | 'bronze' | 'silver' | 'gold' | 'platinum' {
    if (ltv >= 500000) return 'platinum';
    if (ltv >= 250000) return 'gold';
    if (ltv >= 100000) return 'silver';
    if (ltv >= 50000) return 'bronze';
    return 'none';
  }

  private generateRandomDate(daysAgo: number): string {
    const date = new Date();
    date.setDate(date.getDate() - this.randomInt(0, daysAgo));
    date.setHours(this.randomInt(0, 23));
    date.setMinutes(this.randomInt(0, 59));
    return date.toISOString();
  }

  generatePlayers(casinoId: string, casinoIndex: number, count: number): DemoPlayer[] {
    const players: DemoPlayer[] = [];

    for (let i = 0; i < count; i++) {
      const firstName = this.randomElement(FIRST_NAMES);
      const lastName = this.randomElement(LAST_NAMES);
      const lifetimeValue = this.randomFloat(5000, 800000, 0);
      const riskScore = this.randomFloat(10, 95, 1);

      const deposits = lifetimeValue * this.randomFloat(1.2, 1.8, 0);
      const withdrawals = deposits - lifetimeValue;

      const statusWeights = { active: 0.75, flagged: 0.15, self_excluded: 0.08, closed: 0.02 };
      const rand = Math.random();
      let status: 'active' | 'flagged' | 'self_excluded' | 'closed' = 'active';
      if (rand > 0.75) status = 'flagged';
      if (rand > 0.90) status = 'self_excluded';
      if (rand > 0.98) status = 'closed';

      players.push({
        id: this.generatePlayerId(casinoIndex, i),
        casino_id: casinoId,
        email: this.generateEmail(firstName, lastName, i),
        first_name: firstName,
        last_name: lastName,
        phone: this.generatePhone(),
        province: this.randomElement(SA_PROVINCES),
        vip_tier: this.generateVIPTier(lifetimeValue),
        risk_score: riskScore,
        risk_level: this.calculateRiskLevel(riskScore),
        lifetime_value: lifetimeValue,
        total_deposits: deposits,
        total_withdrawals: withdrawals,
        last_active_at: this.generateRandomDate(7),
        status,
        signup_date: this.generateRandomDate(365)
      });
    }

    return players;
  }

  generateEventsForPlayer(player: DemoPlayer, eventCount: number): DemoEvent[] {
    const events: DemoEvent[] = [];
    const baseDate = new Date();

    for (let i = 0; i < eventCount; i++) {
      const eventTemplate = this.randomElement(EVENT_TYPES);
      const hoursAgo = this.randomInt(1, 720); // Last 30 days
      const eventDate = new Date(baseDate);
      eventDate.setHours(eventDate.getHours() - hoursAgo);

      const riskLevel = player.risk_score > 70 ? 'Critical' :
                        player.risk_score > 50 ? 'High' :
                        player.risk_score > 30 ? 'Medium' : 'Low';

      events.push({
        id: `evt-${player.id}-${i}`,
        player_id: player.id,
        casino_id: player.casino_id,
        event_type: eventTemplate.type,
        risk_level: riskLevel as any,
        description: eventTemplate.desc,
        timestamp: eventDate.toISOString(),
        metadata: {
          amount: this.randomFloat(100, 5000, 0),
          duration_minutes: this.randomInt(15, 240),
          trigger_threshold: this.randomFloat(0.7, 0.95, 2)
        }
      });
    }

    return events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  generateInterventionsForPlayer(player: DemoPlayer, count: number): DemoIntervention[] {
    const interventions: DemoIntervention[] = [];

    for (let i = 0; i < count; i++) {
      const createdDate = this.generateRandomDate(60);
      const statusWeights = { new: 0.1, in_review: 0.15, actioned: 0.3, follow_up: 0.25, closed: 0.2 };
      const rand = Math.random();
      let status: 'new' | 'in_review' | 'actioned' | 'follow_up' | 'closed' = 'closed';
      if (rand < 0.1) status = 'new';
      else if (rand < 0.25) status = 'in_review';
      else if (rand < 0.55) status = 'actioned';
      else if (rand < 0.8) status = 'follow_up';

      const reasonStack = [
        { factor: 'Loss Chasing Pattern', weight: this.randomFloat(0.15, 0.35, 3) },
        { factor: 'Spending Velocity Increase', weight: this.randomFloat(0.12, 0.28, 3) },
        { factor: 'Time-of-Day Risk Pattern', weight: this.randomFloat(0.08, 0.22, 3) },
        { factor: 'Affordability Concern Score', weight: this.randomFloat(0.05, 0.18, 3) }
      ].sort((a, b) => b.weight - a.weight);

      interventions.push({
        id: `int-${player.id}-${i}`,
        player_id: player.id,
        casino_id: player.casino_id,
        type: this.randomElement(INTERVENTION_TYPES),
        status,
        reason_stack: reasonStack.slice(0, 3),
        created_at: createdDate,
        updated_at: this.generateRandomDate(30),
        outcome: status === 'closed' ? this.randomElement([
          'Player accepted spend limit',
          'Cool-off period completed successfully',
          'Self-exclusion activated',
          'Player engaged positively with outreach',
          'Account limits adjusted'
        ]) : undefined
      });
    }

    return interventions.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  generateRevenueProtectionMetrics(players: DemoPlayer[], interventions: DemoIntervention[]) {
    const closedInterventions = interventions.filter(i => i.status === 'closed');

    const ltvSaved = closedInterventions.reduce((sum, int) => {
      const player = players.find(p => p.id === int.player_id);
      if (!player) return sum;
      return sum + (player.lifetime_value * this.randomFloat(0.15, 0.35, 2));
    }, 0);

    const vipRetained = players.filter(p =>
      ['gold', 'platinum'].includes(p.vip_tier) && p.status === 'active'
    ).length;

    const fraudPrevented = this.randomFloat(150000, 450000, 0);
    const chargebacksAvoided = this.randomFloat(75000, 250000, 0);
    const dropoutPrevention = this.randomFloat(180000, 380000, 0);

    return {
      ltv_saved: Math.round(ltvSaved),
      vip_retention_count: vipRetained,
      vip_retention_value: vipRetained * this.randomFloat(150000, 350000, 0),
      fraud_prevented: fraudPrevented,
      chargebacks_avoided: chargebacksAvoided,
      dropout_prevention: dropoutPrevention,
      total_value_protected: Math.round(ltvSaved + fraudPrevented + chargebacksAvoided + dropoutPrevention)
    };
  }

  formatZAR(amount: number): string {
    return `R ${Math.round(amount).toLocaleString('en-ZA')}`;
  }

  formatPercentage(value: number, decimals = 1): string {
    return `${value.toFixed(decimals)}%`;
  }

  formatRiskScore(score: number): string {
    return score.toFixed(1);
  }
}

export const demoDataService = new DemoDataService();
