import { db } from '../client';
import { randomInt, pick, daysAgoRandom, log, logOk, logErr } from '../utils';

// Values must match check constraints on player_protection_interventions
const INTERVENTION_TYPES = [
  'ai_alert', 'manual_review', 'limit_setting',
  'timeout', 'self_exclusion_referral', 'helpline_referral', 'counseling_referral',
] as const;

const OUTCOMES = ['accepted', 'declined', 'pending', 'successful', 'unsuccessful'] as const;

// channel check: whatsapp | sms | email | in_app | system | manual
const CHANNELS = ['whatsapp', 'sms', 'email', 'in_app', 'system', 'manual'] as const;

// source check: auto | manual | regulator_mandated
const SOURCES = ['auto', 'manual', 'regulator_mandated'] as const;

const TRIGGER_REASONS = [
  'AI risk model flagged sustained betting velocity over 3-hour window',
  'Rapid loss of R5 000+ within 90-minute session detected by system',
  'Player risk score exceeded threshold of 75 for second consecutive session',
  'Multiple failed deposit limit breach attempts in past 24 hours',
  'Player self-reported distress during check-in with VIP host',
  'Session velocity anomaly: 3rd session today, aggregate loss exceeds R10 000',
  'Player showed signs of chasing losses after 40-minute negative run',
] as const;

const ACTIONS_TAKEN = [
  'Responsible gambling pop-up displayed; player acknowledged and continued with session',
  'VIP host conducted welfare check; player accepted responsible gambling brochure',
  'Mandatory 15-minute break enforced by system; player re-engaged after timeout period',
  'Player referred to NRGP counsellor hotline; session ended by staff on request',
  'Deposit limit reduction recommended; player accepted 30-day cooling-off period',
  'Self-exclusion form provided; player enrolled in national exclusion registry',
  'Account temporarily suspended pending responsible gambling review by compliance team',
] as const;

const MESSAGE_TEMPLATES = [
  'We noticed your session has been longer than usual. Would you like to take a break?',
  'You have reached your daily spend limit. Your account has been temporarily paused.',
  'A friendly check-in: our support team is available if you would like to talk.',
  'Your spending pattern has triggered a responsible gambling review. Please check your limits.',
  'Self-exclusion options are available in your account settings. Our team is here to help.',
] as const;

export async function seedInterventions(casinoIds: string[], playerIds: string[]): Promise<void> {
  log('Seeding player protection interventions...');

  if (playerIds.length === 0) {
    logErr('interventions: no playerIds provided — skipping');
    return;
  }

  const rows: Record<string, unknown>[] = [];
  const playerPool = playerIds.slice(0, Math.min(playerIds.length, 200));

  for (const casinoId of casinoIds) {
    const count = randomInt(20, 35);
    for (let i = 0; i < count; i++) {
      const channel    = pick(CHANNELS);
      const outcome    = pick(OUTCOMES);
      const source     = pick(SOURCES);
      const createdAt  = daysAgoRandom(1, 180);

      rows.push({
        casino_id: casinoId,
        // player_id is NOT NULL
        player_id: pick(playerPool),
        intervention_date: createdAt,
        intervention_type: pick(INTERVENTION_TYPES),
        trigger_reason: pick(TRIGGER_REASONS),
        action_taken: pick(ACTIONS_TAKEN),
        outcome,
        channel,
        source,
        message_content: pick(MESSAGE_TEMPLATES),
        risk_score: randomInt(40, 98),
        risk_score_at_trigger: randomInt(40, 98),
        auto_triggered: source === 'auto',
        intervention_successful: outcome === 'accepted' || outcome === 'successful',
        follow_up_required: outcome === 'declined' || outcome === 'pending',
        nrgp_reported: Math.random() < 0.2,
        dispatch_status: channel === 'manual' || channel === 'system' ? 'delivered' : 'sent',
        delivery_attempts: 1,
      });
    }
  }

  const { error } = await db.from('player_protection_interventions').insert(rows);
  if (error) logErr(`interventions: ${error.message}`);
  else logOk(`${rows.length} interventions seeded`);
}

export async function resetInterventions(casinoIds: string[]): Promise<void> {
  if (casinoIds.length === 0) return;
  const { error } = await db.from('player_protection_interventions').delete().in('casino_id', casinoIds);
  if (error) logErr(`reset interventions: ${error.message}`);
  else logOk('Demo interventions deleted');
}
