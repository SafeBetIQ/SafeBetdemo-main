# SafeBet IQ Wellbeing Games - Complete Documentation

## Executive Summary

The SafeBet IQ Wellbeing Games system is an **off-platform behavioral wellbeing check-in system** that delivers voluntary mini-games via email or WhatsApp to capture passive behavioral signals for responsible gambling compliance.

### Key Principles

- **"Outside the casino, inside compliance"**
- **Early engagement, not enforcement**
- **Player dignity and autonomy first**
- **Overlay-first architecture**
- **Regulator trust by design**

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Game Concepts](#game-concepts)
3. [Technical Architecture](#technical-architecture)
4. [Database Schema](#database-schema)
5. [API Endpoints](#api-endpoints)
6. [Risk Scoring Algorithm](#risk-scoring-algorithm)
7. [Player Flow](#player-flow)
8. [Operator Dashboard](#operator-dashboard)
9. [Regulator Dashboard](#regulator-dashboard)
10. [Compliance & Ethics](#compliance--ethics)
11. [Integration Guide](#integration-guide)

---

## System Overview

### Purpose

Deliver **voluntary** behavioral wellbeing check-ins to players **outside the casino environment** to:

- Detect early behavioral risk signals
- Support proactive responsible gambling compliance
- Provide regulators with evidence of operator diligence
- Maintain player autonomy and dignity

### Communication Triggers

Games are initiated when:

- Periodic responsible play check-ins are scheduled
- Post-session follow-ups are triggered
- Mild behavioral risk signals are detected by SafeBet IQ
- Regulator-recommended engagement cycles occur

### Delivery Channels

- **Email**: Time-limited secure link sent to player's registered email
- **WhatsApp**: Direct message with game link (requires WhatsApp Business API)

---

## Game Concepts

### Game 1: Balance Journey

**Type**: Risk vs Stability
**Duration**: 2 minutes
**Mechanics**: Path navigation game where players choose between risky shortcuts and safe routes

#### What It Measures

- **Impulsivity**: How quickly decisions are made
- **Risk Escalation**: Patterns of increasing risk-taking
- **Patience**: Willingness to take slower, safer paths

#### Player Experience

Players navigate a peaceful mountain journey, choosing between:
- **Safe Path**: Steady, reliable (95% success, 10 points, 8 time units)
- **Shortcut**: Balanced risk (75% success, 15 points, 5 time units)
- **Quick Route**: High risk (50% success, 25 points, 3 time units)

### Game 2: Resource Guardian

**Type**: Resource Balance
**Duration**: 3 minutes
**Mechanics**: Resource management across competing needs

#### What It Measures

- **Recovery Response**: How players react to setbacks
- **Impulse Control**: Ability to resist immediate gains
- **Long-term Thinking**: Balancing immediate vs future needs

#### Player Experience

Manage limited resources (Energy, Stability, Progress) by choosing:
- **Rest**: Recover energy and stability
- **Keep Going**: Balanced progress
- **Go All In**: High progress, high cost

### Game 3: Impulse Challenge

**Type**: Timing Control
**Duration**: 2 minutes
**Mechanics**: Timing-based game requiring patience

#### What It Measures

- **Patience**: Ability to wait for better outcomes
- **Impulse Resistance**: Resisting immediate small rewards
- **Response to Setbacks**: Recovery after false signals

#### Player Experience

Wait for optimal timing to claim rewards:
- **Claim Now** (0-3s): Small immediate reward
- **Wait for It** (7-10s): Larger patient reward
- **Too Late** (10s+): Missed opportunity

---

## Technical Architecture

### Overlay Model

```
┌─────────────────────────────────────────┐
│          Email/WhatsApp                  │
│     (Secure Time-Limited Link)           │
└───────────────┬─────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│      Wellbeing Game Web Interface        │
│     (Standalone, Mobile-First)           │
└───────────────┬─────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│       Behavioral Telemetry Capture       │
│    (Decision speed, risk choices, etc)   │
└───────────────┬─────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│        AI Risk Scoring Engine            │
│   (Explainable behavioral risk index)    │
└───────────────┬─────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│         SafeBet IQ Dashboard             │
│  (Operator & Regulator Reporting)        │
└─────────────────────────────────────────┘
```

### Key Characteristics

- **Zero casino interference**: Games run independently
- **Voluntary participation**: No forced interruptions
- **Secure access**: Time-limited tokens (default 72 hours)
- **Privacy-first**: No gambling mechanics, no betting data
- **POPIA/GDPR compliant**: Anonymized aggregated reporting

---

## Database Schema

### Core Tables

#### `wellbeing_game_concepts`

Stores available game types and configurations.

```sql
CREATE TABLE wellbeing_game_concepts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  description text NOT NULL,
  mechanics_type text NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 2,
  active boolean DEFAULT true,
  config jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);
```

#### `wellbeing_game_campaigns`

Tracks outbound communication campaigns.

```sql
CREATE TABLE wellbeing_game_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid REFERENCES casinos(id),
  name text NOT NULL,
  game_concept_id uuid REFERENCES wellbeing_game_concepts(id),
  trigger_type text NOT NULL, -- periodic, post_session, risk_signal, regulator_cycle
  channel text NOT NULL, -- email, whatsapp, both
  message_template text NOT NULL,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
```

#### `wellbeing_game_invitations`

Individual game invitations sent to players.

```sql
CREATE TABLE wellbeing_game_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES wellbeing_game_campaigns(id),
  player_id uuid REFERENCES players(id),
  game_concept_id uuid REFERENCES wellbeing_game_concepts(id),
  secure_token text UNIQUE NOT NULL,
  channel text NOT NULL, -- email, whatsapp
  sent_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL,
  opened_at timestamptz,
  completed_at timestamptz,
  status text DEFAULT 'pending' -- pending, opened, completed, expired, abandoned
);
```

#### `wellbeing_game_sessions`

Individual game play sessions.

```sql
CREATE TABLE wellbeing_game_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id uuid REFERENCES wellbeing_game_invitations(id),
  player_id uuid REFERENCES players(id),
  game_concept_id uuid REFERENCES wellbeing_game_concepts(id),
  casino_id uuid REFERENCES casinos(id),
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  duration_seconds integer,
  completion_rate decimal(5,2) DEFAULT 0,
  abandoned boolean DEFAULT false,
  raw_score integer DEFAULT 0,
  behaviour_risk_index decimal(5,2)
);
```

#### `wellbeing_game_telemetry`

Granular behavioral signals captured during gameplay.

```sql
CREATE TABLE wellbeing_game_telemetry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES wellbeing_game_sessions(id),
  event_type text NOT NULL,
  event_timestamp timestamptz DEFAULT now(),
  event_sequence integer NOT NULL,
  event_data jsonb DEFAULT '{}',
  decision_speed_ms integer,
  risk_level_chosen text, -- low, medium, high, none
  created_at timestamptz DEFAULT now()
);
```

#### `wellbeing_risk_scores`

Historical risk indices for trend analysis.

```sql
CREATE TABLE wellbeing_risk_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid REFERENCES players(id),
  casino_id uuid REFERENCES casinos(id),
  session_id uuid REFERENCES wellbeing_game_sessions(id),
  behaviour_risk_index decimal(5,2) NOT NULL,
  impulsivity_score decimal(5,2),
  risk_escalation_score decimal(5,2),
  patience_score decimal(5,2),
  recovery_response_score decimal(5,2),
  explanation jsonb DEFAULT '{}',
  calculated_at timestamptz DEFAULT now()
);
```

---

## API Endpoints

### 1. Send Wellbeing Invitation

**Endpoint**: `POST /functions/v1/send-wellbeing-invitation`

**Purpose**: Send a game invitation to a player via email or WhatsApp

**Authentication**: Required (JWT)

**Request Body**:

```json
{
  "player_id": "uuid",
  "game_concept_id": "uuid",
  "campaign_id": "uuid (optional)",
  "channel": "email | whatsapp",
  "expires_in_hours": 72
}
```

**Response**:

```json
{
  "success": true,
  "invitation_id": "uuid",
  "secure_token": "string",
  "game_url": "https://[domain]/wellbeing-game/play/[token]",
  "expires_at": "ISO8601 timestamp",
  "message": "Invitation sent via email"
}
```

**Example**:

```bash
curl -X POST \
  'https://[your-project].supabase.co/functions/v1/send-wellbeing-invitation' \
  -H 'Authorization: Bearer [YOUR_TOKEN]' \
  -H 'Content-Type: application/json' \
  -d '{
    "player_id": "123e4567-e89b-12d3-a456-426614174000",
    "game_concept_id": "123e4567-e89b-12d3-a456-426614174001",
    "channel": "email"
  }'
```

### 2. Calculate Risk Score

**Endpoint**: `POST /functions/v1/wellbeing-risk-calculator`

**Purpose**: Calculate behavioral risk index from game telemetry

**Authentication**: Not required (public endpoint)

**Request Body**:

```json
{
  "session_id": "uuid"
}
```

**Response**:

```json
{
  "success": true,
  "risk_score": {
    "behaviour_risk_index": 45.23,
    "impulsivity_score": 38.50,
    "risk_escalation_score": 52.00,
    "patience_score": 65.75,
    "recovery_response_score": 70.00,
    "explanation": {
      "factors": [
        "High impulsivity detected in decision-making",
        "Pattern of escalating risk-taking observed"
      ],
      "confidence": 85.50,
      "recommendations": [
        "Consider taking more time before making decisions",
        "Be aware of the tendency to increase risk over time"
      ]
    }
  }
}
```

---

## Risk Scoring Algorithm

### Behavioral Risk Index Calculation

The **Behaviour Risk Index** is a weighted composite score (0-100) calculated from four sub-scores:

```
Behaviour Risk Index =
  (Impulsivity × 0.30) +
  (Risk Escalation × 0.35) +
  ((100 - Patience) × 0.20) +
  ((100 - Recovery Response) × 0.15)
```

### Sub-Score Calculations

#### 1. Impulsivity Score (0-100)

Measures how quickly decisions are made.

```
- Fast decisions (<2s): +10 per decision
- Very slow decisions (>6s): +10 to Patience
- Average decision speed:
  - <2s: +20 Impulsivity
  - >6s: +10 Patience
- Pause actions: -5 Impulsivity per pause
```

#### 2. Risk Escalation Score (0-100)

Measures patterns of increasing risk-taking.

```
- Consecutive high-risk choices: +20 per sequence
- High-risk ratio: (high_risk_count / total_decisions) × 100
- Max consecutive high-risk: capped at 100
```

#### 3. Patience Score (0-100)

Measures willingness to wait and evaluate options.

```
- Starts at 100
- Slow decisions (>5s): +5 per decision
- Pause actions: +10 per pause
- Fast decisions (<2s): -10 per decision
```

#### 4. Recovery Response Score (0-100)

Measures reaction to setbacks.

```
- Starts at 100
- Fast decision after setback (<2s): -15
- Thoughtful response after setback (>2s): +5
- Reset actions: +15 per reset
```

### Explainable AI

Every risk score includes:

- **Factors**: Human-readable reasons for the score
- **Confidence**: Data quality indicator (based on telemetry volume)
- **Recommendations**: Neutral, non-diagnostic suggestions

**Example Explanation**:

```json
{
  "factors": [
    "High impulsivity detected in decision-making",
    "Pattern of escalating risk-taking observed",
    "Good use of pause function demonstrates self-awareness"
  ],
  "confidence": 85.5,
  "recommendations": [
    "Consider taking more time before making decisions",
    "Be aware of the tendency to increase risk over time"
  ]
}
```

---

## Player Flow

### Step 1: Invitation Delivery

Player receives email or WhatsApp message:

```
Hi [Player Name],

Take a quick 2-minute game to reflect on how you're playing.

Navigate a peaceful journey by making choices between quick risky
paths and steady safe routes.

Play now: https://[domain]/wellbeing-game/play/[secure-token]

This is a voluntary wellbeing check-in to support responsible play.

SafeBet IQ
```

### Step 2: Game Access

- Player clicks secure link
- System validates token and expiration
- Game loads in mobile-first web interface
- No login required (token-based access)

### Step 3: Gameplay

- Introduction screen with game description
- 10 stages of decision-making
- Pause option available at any time
- Optional safe exit at any stage
- No gambling mechanics or wagering

### Step 4: Telemetry Capture

All interactions tracked (invisible to player):

- Decision speed (milliseconds)
- Risk level chosen (low/medium/high)
- Pause actions
- Reset actions
- Setback responses

### Step 5: Completion & Feedback

After game completion:

- Neutral reflection message displayed
- Optional suggestions based on risk score:
  - **Low risk**: "Thanks for playing. Balanced play helps keep gaming enjoyable."
  - **Medium risk**: "Consider taking a short break to recharge."
  - **High risk**: "Reviewing your personal limits can help maintain balance."
- Links to responsible play tools (optional, not enforced)

### Step 6: Risk Calculation

- Telemetry sent to AI engine
- Behavioral Risk Index calculated
- Explanation generated
- Data stored for trend analysis

---

## Operator Dashboard

**URL**: `/casino/wellbeing-games`

**Access**: Casino managers and compliance officers

### Features

#### 1. Key Metrics

- Total Invitations Sent
- Engagement Rate (completion %)
- Completed Games Count
- Active Campaigns Count

#### 2. Available Games Tab

- List of all game concepts
- Send test invitations
- View game configurations

#### 3. Recent Sessions Tab

- Latest player game sessions
- Behavioral Risk Index per session
- Player anonymization options
- Completion timestamps

#### 4. Campaigns Tab

- Active/paused campaigns
- Trigger types (periodic, post-session, risk-signal)
- Communication channels (email, WhatsApp)
- Campaign performance metrics

### Compliance Benefits Shown

- **Early Detection**: Identify behavioral risk patterns before escalation
- **Proactive Engagement**: Reach players outside casino environment
- **Regulator Evidence**: Demonstrate proactive compliance efforts

---

## Regulator Dashboard

**URL**: `/regulator/wellbeing-compliance`

**Access**: Regulators only

### Features

#### 1. Aggregated Statistics

- Total Operators Using System
- Industry-Wide Engagement Rate
- Active Campaigns Across All Operators
- Average Behavioral Risk Index

#### 2. Risk Distribution Chart

Pie chart showing:
- Low Risk (0-39): Green
- Medium Risk (40-70): Orange
- High Risk (71-100): Red

#### 3. Risk Trend Analysis

30-day trend line of average behavioral risk index across all sessions.

#### 4. Operator Compliance Table

Anonymized or named operator statistics:
- Invitations Sent
- Sessions Completed
- Active Campaigns
- Engagement Rate %

#### 5. Compliance Highlights

- **Off-Platform Engagement**: Evidence of proactive outreach
- **Data Privacy**: POPIA/GDPR compliance confirmation
- **Time-Stamped Actions**: Audit trail availability

#### 6. Export Functionality

- PDF Report Generation
- CSV Data Export
- Time-stamped compliance evidence

---

## Compliance & Ethics

### Mandatory Requirements

✅ **Voluntary Participation Only**
✅ **Clear Disclaimer**: "This game supports responsible play and is not a diagnosis"
✅ **POPIA / GDPR Compliant**: Anonymized aggregated data
✅ **Explainable AI**: Transparent risk scoring
✅ **No Medical Claims**: Not a clinical tool
✅ **Cultural Neutrality**: Suitable for African markets
✅ **No Gambling Mechanics**: No betting, wagering, or real money
✅ **Time-Limited Access**: Secure tokens expire (default 72 hours)

### What This System Does NOT Do

❌ Does not interrupt casino gameplay
❌ Does not write to casino transactional systems
❌ Does not enforce actions or limits
❌ Does not label players as "problem gamblers"
❌ Does not collect medical or health data
❌ Does not use manipulative game mechanics
❌ Does not require casino integration

### Messaging Requirements

All player communication must:

- Use friendly, neutral wording
- Avoid terms like "risk", "problem gambling", "assessment"
- Emphasize voluntary nature
- Provide clear opt-out mechanisms
- Never create pressure or urgency

---

## Integration Guide

### For Casino Operators

#### Step 1: Campaign Creation

Create a campaign in the operator dashboard:

```javascript
const campaign = {
  casino_id: 'your-casino-id',
  name: 'Monthly Wellbeing Check-In',
  game_concept_id: 'balance-journey-id',
  trigger_type: 'periodic',
  channel: 'email',
  message_template: 'Hi {player_name}, ...',
  active: true
};
```

#### Step 2: Send Invitations

Use the API to send invitations:

```javascript
const response = await fetch(
  `${SUPABASE_URL}/functions/v1/send-wellbeing-invitation`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
    },
    body: JSON.stringify({
      player_id: player.id,
      game_concept_id: 'balance-journey-id',
      channel: 'email',
      expires_in_hours: 72
    })
  }
);
```

#### Step 3: Monitor Results

View dashboard for:
- Engagement rates
- Risk scores
- Compliance evidence

### For Regulators

1. Access `/regulator/wellbeing-compliance`
2. View anonymized aggregated data
3. Export compliance reports
4. Monitor industry-wide trends

---

## Success Criteria

### High Engagement

- Target: >40% completion rate
- Measure: Completed games / Invitations sent

### Improved Early-Risk Detection

- Identify behavioral patterns before escalation
- Longitudinal trend analysis per player

### Strong Regulator Acceptance

- Clear separation from casino systems
- Transparent methodology
- Exportable audit trails

### Zero Casino Interference

- No disruption to normal operations
- No integration with wagering systems
- Overlay-only architecture

### Clear Differentiation

This system is NOT:
- An in-platform RG tool
- A replacement for casino controls
- A medical diagnostic tool

This system IS:
- An early-warning system
- A proactive engagement tool
- Regulatory evidence of diligence

---

## Technical Requirements

### Frontend

- Next.js 13+ with App Router
- React 18+ for game interfaces
- Tailwind CSS for styling
- Framer Motion for animations
- Mobile-first responsive design

### Backend

- Supabase (PostgreSQL + Edge Functions)
- Row Level Security (RLS) enabled
- Time-limited secure tokens
- Real-time telemetry capture

### Security

- HTTPS only
- Token expiration (72 hours default)
- Rate limiting on API endpoints
- No sensitive data in URLs
- Encrypted data at rest

### Performance

- Game load time: <2 seconds
- Telemetry latency: <100ms
- Risk calculation: <5 seconds
- Dashboard load: <3 seconds

---

## Support & Maintenance

### Monitoring

- Track invitation delivery rates
- Monitor game completion rates
- Alert on high abandonment rates
- Log API errors

### Updates

- New game concepts can be added via database
- Configuration updates via JSON config field
- No code deployment needed for new campaigns

### Troubleshooting

**Issue**: Invitation expired
**Solution**: Tokens expire after 72 hours. Resend invitation.

**Issue**: Game not loading
**Solution**: Check secure token validity and expiration.

**Issue**: Risk score not calculating
**Solution**: Ensure telemetry data exists for session.

---

## Future Enhancements

- Additional game concepts (Resource Guardian, Impulse Challenge)
- SMS delivery channel
- Multi-language support
- Advanced AI risk models
- Integration with SafeBet IQ AI engine
- Real-time risk alerts
- Player self-service portal

---

## Contact & Support

For technical support or questions:
- System: SafeBet IQ Platform
- Module: Wellbeing Games
- Documentation Version: 1.0
- Last Updated: 2026-01-23

---

**"Outside the casino, inside compliance"**
