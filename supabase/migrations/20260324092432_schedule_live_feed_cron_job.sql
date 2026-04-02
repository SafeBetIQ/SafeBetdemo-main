
/*
  # Schedule Live Feed Simulator via pg_cron

  ## What this does
  Schedules simulate_live_feed() to run every minute automatically.
  This drives continuous live session churn — players joining, playing,
  and leaving — just like a real casino data feed.

  ## Schedule
  - Runs every minute (cron: '* * * * *')
  - Job name: 'casino-live-feed-tick'
  - Replaces any existing job with the same name to avoid duplicates
*/

SELECT cron.unschedule('casino-live-feed-tick')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'casino-live-feed-tick'
);

SELECT cron.schedule(
  'casino-live-feed-tick',
  '* * * * *',
  $$SELECT simulate_live_feed();$$
);
