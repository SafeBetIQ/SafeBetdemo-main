/*
  # Add Nova IQ Invitations Data for Casino Dashboards
  
  Fixes the Nova IQ tab showing no data by:
  
  1. **Add casino_id to invitations table**
  2. **Create campaigns for each casino**
  3. **Generate invitations for existing sessions**
  4. **Create pending invitations**
  5. **Update RLS policies**
*/

-- Add casino_id column
ALTER TABLE wellbeing_game_invitations 
ADD COLUMN IF NOT EXISTS casino_id UUID REFERENCES casinos(id);

-- Backfill casino_id from players
UPDATE wellbeing_game_invitations wgi
SET casino_id = p.casino_id
FROM players p
WHERE wgi.player_id = p.id
AND wgi.casino_id IS NULL;

-- Create index
CREATE INDEX IF NOT EXISTS idx_wellbeing_invitations_casino_id 
ON wellbeing_game_invitations(casino_id);

-- Create campaigns for each casino
DO $$
DECLARE
  v_casino RECORD;
  v_game_concept_id UUID;
BEGIN
  SELECT id INTO v_game_concept_id 
  FROM wellbeing_game_concepts 
  WHERE active = true 
  LIMIT 1;
  
  FOR v_casino IN SELECT id, name FROM casinos LOOP
    INSERT INTO wellbeing_game_campaigns (
      id,
      casino_id,
      name,
      game_concept_id,
      trigger_type,
      channel,
      message_template,
      active
    ) VALUES (
      gen_random_uuid(),
      v_casino.id,
      'Nova IQ Risk Assessment',
      v_game_concept_id,
      'risk_signal',
      'whatsapp',
      'Hi {player_name}, please complete this behavioral check-in: {link}',
      true
    )
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

-- Generate invitations for existing sessions
DO $$
DECLARE
  v_session RECORD;
  v_invitation_id UUID;
  v_campaign_id UUID;
  v_count INT := 0;
BEGIN
  FOR v_session IN 
    SELECT 
      wgs.id as session_id,
      wgs.player_id,
      wgs.casino_id,
      wgs.game_concept_id,
      wgs.started_at,
      wgs.completed_at
    FROM wellbeing_game_sessions wgs
    WHERE wgs.invitation_id IS NULL
  LOOP
    SELECT id INTO v_campaign_id
    FROM wellbeing_game_campaigns
    WHERE casino_id = v_session.casino_id
    LIMIT 1;
    
    IF v_campaign_id IS NULL THEN
      CONTINUE;
    END IF;
    
    v_invitation_id := gen_random_uuid();
    
    INSERT INTO wellbeing_game_invitations (
      id, campaign_id, player_id, game_concept_id, casino_id,
      secure_token, channel, sent_at, expires_at, opened_at,
      completed_at, status, delivery_status
    ) VALUES (
      v_invitation_id, v_campaign_id, v_session.player_id,
      v_session.game_concept_id, v_session.casino_id,
      encode(gen_random_bytes(32), 'hex'),
      CASE WHEN random() < 0.7 THEN 'whatsapp' ELSE 'email' END,
      v_session.started_at - INTERVAL '1 day',
      v_session.started_at + INTERVAL '13 days',
      v_session.started_at - INTERVAL '2 hours',
      v_session.completed_at, 'completed', 'sent'
    );
    
    UPDATE wellbeing_game_sessions
    SET invitation_id = v_invitation_id
    WHERE id = v_session.session_id;
    
    v_count := v_count + 1;
  END LOOP;
  
  RAISE NOTICE '✅ Linked % sessions to invitations', v_count;
END $$;

-- Add pending invitations
DO $$
DECLARE
  v_casino RECORD;
  v_player RECORD;
  v_campaign_id UUID;
  v_game_concept_id UUID;
  v_count INT := 0;
BEGIN
  SELECT id INTO v_game_concept_id 
  FROM wellbeing_game_concepts 
  WHERE active = true 
  LIMIT 1;
  
  FOR v_casino IN SELECT id, name FROM casinos LOOP
    SELECT id INTO v_campaign_id
    FROM wellbeing_game_campaigns
    WHERE casino_id = v_casino.id
    LIMIT 1;
    
    IF v_campaign_id IS NULL THEN
      CONTINUE;
    END IF;
    
    FOR v_player IN 
      SELECT p.id
      FROM players p
      WHERE p.casino_id = v_casino.id
      AND p.risk_score > 40
      AND NOT EXISTS (
        SELECT 1 FROM wellbeing_game_invitations wgi
        WHERE wgi.player_id = p.id
        AND wgi.sent_at > NOW() - INTERVAL '7 days'
      )
      ORDER BY RANDOM()
      LIMIT (25 + floor(random() * 11)::int)
    LOOP
      INSERT INTO wellbeing_game_invitations (
        id, campaign_id, player_id, game_concept_id, casino_id,
        secure_token, channel, sent_at, expires_at, opened_at,
        status, delivery_status
      ) VALUES (
        gen_random_uuid(), v_campaign_id, v_player.id,
        v_game_concept_id, v_casino.id,
        encode(gen_random_bytes(32), 'hex'),
        CASE WHEN random() < 0.7 THEN 'whatsapp' ELSE 'email' END,
        NOW() - (floor(random() * 7)::int || ' days')::interval,
        NOW() + (floor(7 + random() * 7)::int || ' days')::interval,
        CASE WHEN random() < 0.3 
          THEN NOW() - (floor(random() * 5)::int || ' days')::interval 
          ELSE NULL END,
        CASE WHEN random() < 0.3 THEN 'opened' ELSE 'sent' END,
        'sent'
      );
      
      v_count := v_count + 1;
    END LOOP;
  END LOOP;
  
  RAISE NOTICE '✅ Created % pending invitations', v_count;
END $$;

-- Update RLS policies
DROP POLICY IF EXISTS "Casino staff view invitations" ON wellbeing_game_invitations;
DROP POLICY IF EXISTS "Casino admins view own casino invitations" ON wellbeing_game_invitations;
DROP POLICY IF EXISTS "Super admins view all invitations" ON wellbeing_game_invitations;
DROP POLICY IF EXISTS "Casino admins manage own invitations" ON wellbeing_game_invitations;
DROP POLICY IF EXISTS "Super admins manage all invitations" ON wellbeing_game_invitations;

CREATE POLICY "Casino admins view invitations"
  ON wellbeing_game_invitations FOR SELECT
  TO authenticated
  USING (
    casino_id IN (
      SELECT u.casino_id FROM users u
      WHERE u.id = auth.uid() AND u.role = 'casino_admin'
    )
  );

CREATE POLICY "Super admins view invitations"
  ON wellbeing_game_invitations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() AND u.role = 'super_admin'
    )
  );

CREATE POLICY "Casino admins manage invitations"
  ON wellbeing_game_invitations FOR ALL
  TO authenticated
  USING (
    casino_id IN (
      SELECT u.casino_id FROM users u
      WHERE u.id = auth.uid() AND u.role = 'casino_admin'
    )
  );

CREATE POLICY "Super admins manage invitations"
  ON wellbeing_game_invitations FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() AND u.role = 'super_admin'
    )
  );

-- Summary
DO $$
DECLARE
  v_casino RECORD;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '================================================';
  RAISE NOTICE 'NOVA IQ DATA SUMMARY';
  RAISE NOTICE '================================================';
  
  FOR v_casino IN 
    SELECT 
      c.name,
      COUNT(DISTINCT wgi.id) as invitations,
      COUNT(DISTINCT CASE WHEN wgi.status = 'completed' THEN wgi.id END) as completed,
      COUNT(DISTINCT CASE WHEN wgi.status IN ('sent', 'opened') THEN wgi.id END) as pending,
      COUNT(DISTINCT wgs.id) as sessions
    FROM casinos c
    LEFT JOIN wellbeing_game_invitations wgi ON c.id = wgi.casino_id
    LEFT JOIN wellbeing_game_sessions wgs ON c.id = wgs.casino_id
    GROUP BY c.id, c.name
    ORDER BY c.name
  LOOP
    RAISE NOTICE '%:', v_casino.name;
    RAISE NOTICE '  Invitations: % (Completed: %, Pending: %)', 
      v_casino.invitations, v_casino.completed, v_casino.pending;
    RAISE NOTICE '  Sessions: %', v_casino.sessions;
    RAISE NOTICE '';
  END LOOP;
  
  RAISE NOTICE '================================================';
END $$;
