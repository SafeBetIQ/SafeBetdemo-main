/*
  # Enhance security_events table for Command Center
  Adds missing columns to the existing security_events table
  and ensures all command center tables have required fields.
*/

-- Add missing columns to existing security_events table
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='security_events' AND column_name='title') THEN
    ALTER TABLE security_events ADD COLUMN title text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='security_events' AND column_name='description') THEN
    ALTER TABLE security_events ADD COLUMN description text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='security_events' AND column_name='source_ip_hash') THEN
    ALTER TABLE security_events ADD COLUMN source_ip_hash text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='security_events' AND column_name='source_country') THEN
    ALTER TABLE security_events ADD COLUMN source_country text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='security_events' AND column_name='affected_system') THEN
    ALTER TABLE security_events ADD COLUMN affected_system text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='security_events' AND column_name='actor_hash') THEN
    ALTER TABLE security_events ADD COLUMN actor_hash text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='security_events' AND column_name='actor_role') THEN
    ALTER TABLE security_events ADD COLUMN actor_role text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='security_events' AND column_name='resource_path') THEN
    ALTER TABLE security_events ADD COLUMN resource_path text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='security_events' AND column_name='incident_id') THEN
    ALTER TABLE security_events ADD COLUMN incident_id uuid;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='security_events' AND column_name='raw_metadata') THEN
    ALTER TABLE security_events ADD COLUMN raw_metadata jsonb DEFAULT '{}';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='security_events' AND column_name='is_automated') THEN
    ALTER TABLE security_events ADD COLUMN is_automated boolean DEFAULT true;
  END IF;
END $$;

-- Backfill title from event_type for any existing rows
UPDATE security_events SET title = initcap(replace(event_type, '_', ' ')) WHERE title IS NULL;

-- Make title not null now that backfilled
ALTER TABLE security_events ALTER COLUMN title SET DEFAULT 'Security Event';

CREATE INDEX IF NOT EXISTS idx_sec_events_casino_id ON security_events(casino_id);
CREATE INDEX IF NOT EXISTS idx_sec_events_severity ON security_events(severity);
CREATE INDEX IF NOT EXISTS idx_sec_events_created_at ON security_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sec_events_type ON security_events(event_type);
