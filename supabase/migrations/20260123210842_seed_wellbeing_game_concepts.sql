/*
  # Seed Three Wellbeing Game Concepts

  ## Overview
  Seeds the database with three professional mini-game concepts designed to capture
  behavioral wellbeing signals for responsible gambling compliance.

  ## Game Concepts

  ### 1. Balance Journey (Risk vs Stability)
  A path-navigation game where players make choices between risky shortcuts and safe routes.
  Measures: Impulsivity, risk escalation patterns, patience

  ### 2. Resource Guardian (Resource Balance)
  A resource management game where players allocate limited resources across needs.
  Measures: Recovery response, impulse control, long-term thinking

  ### 3. Impulse Challenge (Timing Control)
  A timing-based game where players must resist immediate actions for better outcomes.
  Measures: Patience, impulse resistance, response to setbacks
*/

-- Insert Game Concept 1: Balance Journey
INSERT INTO wellbeing_game_concepts (
  name,
  slug,
  description,
  mechanics_type,
  duration_minutes,
  active,
  config
) VALUES (
  'Balance Journey',
  'balance-journey',
  'Navigate a peaceful journey by making choices between quick risky paths and steady safe routes. Your decisions shape your experience.',
  'risk_vs_stability',
  2,
  true,
  '{
    "theme": "mountain_path",
    "total_stages": 10,
    "decisions_per_stage": 1,
    "paths": {
      "safe": {
        "label": "Take the steady path",
        "time_cost": 8,
        "success_rate": 95,
        "reward": 10
      },
      "balanced": {
        "label": "Take the shortcut",
        "time_cost": 5,
        "success_rate": 75,
        "reward": 15
      },
      "risky": {
        "label": "Take the quick route",
        "time_cost": 3,
        "success_rate": 50,
        "reward": 25
      }
    },
    "safe_exit_available": true,
    "pause_option": true
  }'
) ON CONFLICT (slug) DO NOTHING;

-- Insert Game Concept 2: Resource Guardian
INSERT INTO wellbeing_game_concepts (
  name,
  slug,
  description,
  mechanics_type,
  duration_minutes,
  active,
  config
) VALUES (
  'Resource Guardian',
  'resource-guardian',
  'Manage your resources wisely across different needs. Balance immediate wants with long-term wellbeing.',
  'resource_balance',
  3,
  true,
  '{
    "theme": "life_balance",
    "total_rounds": 8,
    "starting_resources": 100,
    "resource_types": {
      "energy": {
        "label": "Energy",
        "depletes": true,
        "recovery_rate": 10
      },
      "stability": {
        "label": "Stability",
        "depletes": false,
        "starting_value": 50
      },
      "progress": {
        "label": "Progress",
        "depletes": false,
        "starting_value": 0
      }
    },
    "decisions": {
      "rest": {
        "label": "Take a break",
        "energy_change": 25,
        "stability_change": 10,
        "progress_change": 0
      },
      "push_forward": {
        "label": "Keep going",
        "energy_change": -15,
        "stability_change": -5,
        "progress_change": 20
      },
      "rush_ahead": {
        "label": "Go all in",
        "energy_change": -30,
        "stability_change": -15,
        "progress_change": 35
      }
    },
    "recovery_prompts": true,
    "reset_option": true
  }'
) ON CONFLICT (slug) DO NOTHING;

-- Insert Game Concept 3: Impulse Challenge
INSERT INTO wellbeing_game_concepts (
  name,
  slug,
  description,
  mechanics_type,
  duration_minutes,
  active,
  config
) VALUES (
  'Impulse Challenge',
  'impulse-challenge',
  'A game of patience and timing. Wait for the right moment to act for better rewards, or act quickly for smaller gains.',
  'timing_control',
  2,
  true,
  '{
    "theme": "opportunity_timing",
    "total_rounds": 12,
    "round_duration_seconds": 10,
    "rewards": {
      "immediate": {
        "label": "Claim now",
        "value": 5,
        "timing": "0-3s"
      },
      "patient": {
        "label": "Wait for it",
        "value": 15,
        "timing": "7-10s"
      },
      "missed": {
        "label": "Too late",
        "value": 0,
        "timing": "10s+"
      }
    },
    "setback_events": {
      "enabled": true,
      "frequency": 0.3,
      "types": ["delay", "reset", "false_signal"]
    },
    "pause_button": {
      "enabled": true,
      "penalty": 0,
      "label": "Take a moment"
    },
    "early_exit": {
      "enabled": true,
      "message": "You can stop anytime"
    }
  }'
) ON CONFLICT (slug) DO NOTHING;
