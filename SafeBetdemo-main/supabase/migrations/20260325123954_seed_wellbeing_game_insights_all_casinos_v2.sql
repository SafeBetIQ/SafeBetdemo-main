
/*
  # Seed wellbeing_game_insights for all 18 casinos (v2)

  Creates 3–6 AI-generated insights per casino, tied to real sessions.
  Mix of severity levels and insight types displayed across all dashboards.
*/
DO $$
DECLARE
  casino_rec RECORD;
  sess_rec   RECORD;
  n          int;
  ins_count  int;
  bri        numeric;
  sev        text;
  itype      text;
  icat       text;
  ititle     text;
  idesc      text;
  irec       text;
  trigger_sc numeric;
BEGIN
  FOR casino_rec IN SELECT id, name FROM casinos ORDER BY name LOOP
    ins_count := 0;

    FOR sess_rec IN
      SELECT s.id, s.player_id, s.behaviour_risk_index, s.completed_at
      FROM wellbeing_game_sessions s
      WHERE s.casino_id = casino_rec.id
      ORDER BY s.behaviour_risk_index DESC NULLS LAST
      LIMIT 6
    LOOP
      bri := coalesce(sess_rec.behaviour_risk_index, 30);
      trigger_sc := round((bri * (0.8 + random() * 0.4))::numeric, 1);

      sev := CASE
        WHEN bri > 70 THEN CASE WHEN random() > 0.4 THEN 'critical' ELSE 'warning' END
        WHEN bri > 45 THEN CASE WHEN random() > 0.5 THEN 'warning'  ELSE 'info'    END
        ELSE 'info'
      END;

      itype := CASE
        WHEN bri > 70 AND random() > 0.5 THEN 'risk_escalation'
        WHEN bri > 70                     THEN 'intervention_recommended'
        WHEN bri > 45                     THEN 'pattern_detected'
        ELSE 'positive_behaviour'
      END;

      icat := CASE
        WHEN itype IN ('risk_escalation','intervention_recommended') THEN 'behavioural_risk'
        WHEN itype = 'pattern_detected'                              THEN 'session_patterns'
        ELSE 'wellbeing'
      END;

      IF itype = 'risk_escalation' THEN
        ititle := 'Loss-chasing pattern escalating';
        idesc  := 'Player BRI of ' || bri || ' indicates persistent loss-recovery decisions across multiple scenarios. Decision speed accelerated by 38% after consecutive losses.';
        irec   := 'Trigger a cooling-off period prompt and send follow-up Nova IQ invitation within 7 days.';
      ELSIF itype = 'intervention_recommended' THEN
        ititle := 'Intervention recommended — high impulsivity';
        idesc  := 'Assessment score of ' || bri || ' places this player in the high-risk band. Impulse-control scenarios showed consistent override of rational defaults.';
        irec   := 'Assign responsible gambling counsellor outreach and apply deposit velocity monitoring.';
      ELSIF itype = 'pattern_detected' THEN
        ititle := 'Moderate risk escalation detected';
        idesc  := 'BRI of ' || bri || ' detected. Player shows moderate risk-taking under simulated financial pressure. Session consistency score below casino average.';
        irec   := 'Send periodic check-in invitation and review deposit limits.';
      ELSE
        ititle := 'Balanced decision-making observed';
        idesc  := 'Player BRI of ' || bri || ' indicates healthy financial decision-making habits. Strong patience scores on cooling-off scenarios.';
        irec   := 'No immediate action required. Continue periodic Nova IQ monitoring.';
      END IF;

      INSERT INTO wellbeing_game_insights
        (id, session_id, player_id, casino_id, insight_type, insight_category,
         title, description, severity, evidence, recommendation, resources, created_at)
      VALUES (
        gen_random_uuid(),
        sess_rec.id,
        sess_rec.player_id,
        casino_rec.id,
        itype, icat, ititle, idesc, sev,
        jsonb_build_object('bri', bri, 'session_id', sess_rec.id::text, 'trigger_score', trigger_sc),
        irec,
        jsonb_build_array(
          jsonb_build_object('label', 'National Problem Gambling Helpline', 'url', 'https://www.npgh.co.za'),
          jsonb_build_object('label', 'Self-Exclusion Register', 'url', '/casino/players')
        ),
        sess_rec.completed_at + ((floor(random() * 5 + 1)::int)::text || ' minutes')::interval
      );

      ins_count := ins_count + 1;
    END LOOP;

    IF ins_count < 3 THEN
      FOR n IN 1..(3 - ins_count) LOOP
        INSERT INTO wellbeing_game_insights
          (id, session_id, player_id, casino_id, insight_type, insight_category,
           title, description, severity, evidence, recommendation, resources, created_at)
        VALUES (
          gen_random_uuid(),
          NULL, NULL,
          casino_rec.id,
          'compliance_alert',
          'outreach_compliance',
          'Nova IQ outreach cycle due',
          casino_rec.name || ' has not completed the required quarterly Nova IQ outreach cycle. Regulator compliance requires minimum 60% player invitation rate per quarter.',
          'warning',
          jsonb_build_object('casino', casino_rec.name, 'cycle', 'Q' || extract(quarter from now())::int || '-' || extract(year from now())::int),
          'Launch a Nova IQ campaign targeting all active players registered in the past 90 days.',
          jsonb_build_array(jsonb_build_object('label', 'Nova IQ Campaign Setup', 'url', '/casino/wellbeing-games')),
          now() - ((n * 7)::text || ' days')::interval
        );
      END LOOP;
    END IF;
  END LOOP;
END $$;
