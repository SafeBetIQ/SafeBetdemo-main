
/*
  # Seed Interventions for All 18 Casinos

  ## Summary
  Creates intervention records for high and critical risk players across all casinos.
  Each casino gets interventions proportional to their high-risk player count.
  Channels: whatsapp, email, sms. Statuses: sent, delivered, pending, failed.
*/

-- Remove stale Silver Star interventions (casino now has new players)
DELETE FROM interventions
WHERE casino_id = '33333333-3333-3333-3333-333333333333';

INSERT INTO interventions (
  id, player_id, casino_id, channel, message_content, status,
  sent_at, delivered_at, created_at
)
SELECT
  gen_random_uuid(),
  p.id,
  p.casino_id,
  (ARRAY['whatsapp','email','sms']::intervention_channel[])[1 + (p.rn % 3)],
  CASE p.risk_level
    WHEN 'critical' THEN
      'URGENT: Our system has detected patterns of concern in your recent activity. We strongly encourage you to take a break and reach out to our responsible gambling support team at 0800-000-083 (free call). Your wellbeing is our priority.'
    ELSE
      'We noticed extended play in your recent session. Consider setting a deposit limit or taking a short break. Visit our Responsible Gambling portal for support resources.'
  END,
  (ARRAY['sent','sent','delivered','delivered','delivered','pending','failed']::intervention_status[])[1 + (p.rn % 7)],
  now() - ((p.rn % 60) || ' days')::interval - ((p.rn % 20) || ' hours')::interval,
  CASE WHEN p.rn % 7 IN (2,3,4) THEN
    now() - ((p.rn % 60) || ' days')::interval - ((p.rn % 20 - 1) || ' hours')::interval
  ELSE NULL END,
  now() - ((p.rn % 60) || ' days')::interval
FROM (
  SELECT p2.id, p2.casino_id, p2.risk_level,
         row_number() OVER (PARTITION BY p2.casino_id ORDER BY p2.risk_score DESC, p2.id) AS rn
  FROM players p2
  WHERE p2.risk_level IN ('critical','high')
) p
WHERE p.rn <= 300
ON CONFLICT DO NOTHING;
