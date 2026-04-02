
/*
  # Enable pg_cron and pg_net extensions

  Enables the job scheduler (pg_cron) and async HTTP (pg_net) extensions
  needed to power the live casino feed simulation.
*/
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
