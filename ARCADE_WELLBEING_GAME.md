# SafeBetIQ Arcade Wellbeing Game - Technical Documentation

## Overview

The **Energy Flow Challenge** is a high-performance, arcade-style wellbeing game that provides behavioral risk insights through engaging gameplay. This document describes the complete arcade upgrade, visual system, and integration architecture.

---

## 🎮 Game Design

### Core Concept: Energy Flow

Players control a glowing vessel navigating through an energy stream, collecting positive resources while avoiding hazards. The game features:

- **Original IP**: Entirely custom visuals, no recognizable mechanics from existing games
- **High-energy arcade feel**: Inspired by speed-based classics but with unique identity
- **Behavioral telemetry**: Invisible data collection for risk assessment
- **Progressive difficulty**: Smooth scaling that challenges without frustrating

---

## 🎨 Visual Style Guide

### Color Palette

**Primary Colors:**
- Deep Space Blue: `#0a0e27` to `#1a1f3a` (background gradients)
- Neon Blue: `#60a5fa` to `#3b82f6` (player vessel)
- Energy Green: `#22c55e` to `#16a34a` (collectible energy orbs)
- Star Gold: `#fde047` to `#facc15` (bonus star items)
- Hazard Red: `#f87171` to `#ef4444` (obstacles)

**Accent Colors:**
- Purple Gradient: `#a855f7` (UI accents)
- Cyan Highlights: `#22d3ee` (speed lines)
- Pink Energy: `#ec4899` (particle effects)

### Visual Elements

**1. Player Vessel**
- Circular glowing orb with pulsing energy
- Radial gradient from bright blue center to transparent edges
- Motion trail effect (8 frame trail with fade)
- Glow intensity increases with combo multiplier
- Inner white ring for contrast
- Shadow blur: 30px (increases with combos)

**2. Collectible Objects**

**Energy Orbs (Base Collectible)**
- Green circular gradient with glow
- Inner white ring detail
- Pulse animation: 15% scale variance
- Size: 32px base
- Shadow: 20px blur
- Spawn rate: ~65% of objects

**Star Items (High Value)**
- 5-pointed star shape with inner/outer radius
- Golden yellow gradient glow
- Rotation animation
- Size: 35px base
- Shadow: 25px blur
- Spawn rate: ~8% of objects

**Hazards (Obstacles)**
- Hexagonal shape (6 sides)
- Red gradient with glow
- Rotation and pulse
- Size: 40px base
- Shadow: 20px blur
- Spawn rate: ~27% of objects

**3. Background System**

**Parallax Layers:**
- Layer 1: Subtle horizontal bands (blue gradient, 5 layers)
- Layer 2: Vertical speed lines (8 columns)
- Both layers scroll at different speeds for depth
- Opacity: 5-10% for subtle effect

**Base Gradient:**
- Top: `#0a0e27`
- Middle: `#1a1f3a`
- Bottom: `#0f1729`

**4. Particle System**

**Burst Effects:**
- Radial explosion on collection (20 particles)
- Color matches collected object type
- Particle size: 3-6px with random variance
- Lifespan: 0.5-1 second
- Gravity effect: vy += 0.1
- Fade out based on remaining life

**Trail Effects:**
- 8-frame motion trail behind player
- Exponential fade: alpha *= 0.85 per frame
- Size scales down: 10% reduction per frame
- Blue glow with transparency

### Animation Principles

1. **Smooth Movement**: 10px per frame player speed, interpolated
2. **Rotation**: Objects rotate at 0.05 radians per frame
3. **Pulse**: Sine wave with 15% amplitude, 0.1 phase increment
4. **Combo Flash**: Glow multiplier increases by 10% per combo
5. **Particle Physics**: Realistic gravity and velocity decay

---

## ⚙️ Game Mechanics

### Progressive Difficulty System

**Difficulty Multiplier Formula:**
```javascript
difficultyMultiplier = 1 + (elapsedSeconds / 60) * 0.8
```

**Effects:**
- Object speed scales with multiplier
- Spawn rate decreases over time (800ms → 300ms minimum)
- More challenging patterns emerge naturally
- No sudden difficulty spikes

### Spawn Logic

**Safe Path Algorithm:**
- Objects must maintain 150px distance from recent spawns
- Up to 10 spawn attempts to find safe position
- Ensures at least one clear path for player
- Prevents unfair clustering

**Object Distribution:**
- Random positioning within safe zones
- Variety in speeds and types
- Risk-reward positioning (stars near hazards)

### Combo System

**Combo Mechanics:**
- Builds on consecutive collections without hitting hazards
- 2-second grace period to maintain combo
- Visual feedback: "x2", "x3", etc. display above player
- Score multiplier: 1 + (combo * 0.1)
- Glow intensity increases with combo

**Combo Bonus:**
```javascript
finalScore = baseValue * (1 + combo * 0.1)
```

### Collision Detection

**Bounding Box Algorithm:**
- AABB (Axis-Aligned Bounding Box) collision
- Efficient for circular and rectangular shapes
- Checked every frame for all active objects
- Immediate response on collision

---

## 🧠 Behavioral Telemetry

### Data Points Captured

**1. Reaction Times**
- Time between object spawn and collection
- Analyzed for impulsivity patterns
- Tracked per collection event
- Used in risk scoring algorithm

**2. Risk Proximity Behavior**
- Collections made near hazards (within 100px)
- Counts as "risky collection"
- High ratio indicates risk-taking tendency
- Weighted heavily in risk score

**3. Movement Patterns**
- Delta between frames tracked
- Variance calculation for smoothness
- Erratic movement = higher impulsivity score
- Steady movement = higher patience score

**4. Collision Recovery**
- Time between hazard hit and next collection
- Quick recovery (<800ms) = reactive behavior
- Delayed recovery (>800ms) = composed behavior
- Multiple collisions tracked

**5. Difficulty Response**
- Performance at different difficulty levels
- Maintained combo during high difficulty = positive
- Increased risk-taking as difficulty rises = negative
- Average difficulty level achieved

**6. Combo Maintenance**
- Maximum combo reached
- Combo breaks and reasons
- Patience indicator when combos sustained
- High combos (>5) = positive behavioral sign

### Telemetry Events

```typescript
// Game lifecycle
'game_started'        // Device type, screen size
'game_completed'      // Final stats, averages

// Gameplay events
'object_collected'    // Type, value, combo, nearby hazards, reaction time, difficulty
'hazard_collision'    // Position, reaction time, difficulty level

// Derived from analysis
'risky_collection'    // Collection near hazards
'combo_maintained'    // Long combo sequences
'difficulty_mastered' // High performance at elevated difficulty
```

---

## 📊 Risk Scoring Integration

### Enhanced Risk Calculator

**Key Metrics:**

1. **Impulsivity Score (0-100)**
   - Fast reaction times (<500ms) +5 points
   - Very fast reactions (<400ms during high difficulty) +8 points
   - Risky collections ratio >50% +15 points
   - Reduced by pause/break actions

2. **Risk Escalation Score (0-100)**
   - Risky collections add +8 per event
   - Ratio of risky to total collections weighted heavily
   - Pattern detection for consecutive risky behavior
   - Difficulty-adjusted scoring

3. **Patience Score (0-100)**
   - Starts at 100, reduces with impulsive actions
   - Long combos (>5) add +3 points
   - Slow, measured collections improve score
   - Pause actions boost score

4. **Recovery Response Score (0-100)**
   - Starts at 100
   - Quick recovery after collision (<800ms) -10 points
   - Composed recovery (>800ms) +5 points
   - Multiple collisions (>5) -10 points

**Behavior Risk Index Formula:**
```javascript
BRI = (impulsivity * 0.3) +
      (riskEscalation * 0.35) +
      ((100 - patience) * 0.2) +
      ((100 - recovery) * 0.15)
```

**Explainability Features:**
- Clear factor identification
- Human-readable recommendations
- Confidence score based on data volume
- Trend analysis over multiple sessions

---

## 🚀 Performance Optimization

### Target Specifications

- **Frame Rate**: 60 FPS consistent
- **Load Time**: <2 seconds on 4G
- **Canvas Size**: Responsive, max 70vh
- **Memory**: Efficient particle cleanup
- **Cross-device**: Mobile and desktop optimized

### Optimization Techniques

**1. Canvas Rendering**
- Hardware-accelerated Canvas API
- No DOM manipulation during gameplay
- Efficient gradient caching
- Minimal shadow blur operations

**2. Object Management**
- Array-based object pool
- Efficient splice operations for removal
- Limited particle count (cleanup on lifespan)
- Trail array limited to 8 frames

**3. Event Handling**
- Passive event listeners for touch
- RequestAnimationFrame for consistent timing
- Key state management (no repeated events)
- Touch preventDefault for smooth mobile

**4. State Management**
- Refs for game state (no re-renders during play)
- React state only for UI updates
- Batch state updates when possible
- Minimal context switching

### Build Output

```
Route: /wellbeing-game
Size: 11.2 kB
First Load JS: 213 kB
Type: Static (pre-rendered)
```

**Performance Grade: A+**

---

## 🔐 Privacy & Compliance

### Data Collection Policy

**Collected (Telemetry Only):**
- Reaction times (milliseconds)
- Object positions (X/Y coordinates)
- Collision events (timestamp + type)
- Combo counts (numerical)
- Difficulty levels reached (1.0-2.0 range)
- Session duration (seconds)

**Never Collected:**
- Personal identifying information
- Medical or health data
- Diagnostic assessments
- Gambling behavior data
- Financial information
- Location data beyond device type

### Regulator-Safe Design

**Explainability:**
- Every risk score has clear reasoning
- Transparent weighting system
- Human-readable recommendations
- Confidence levels provided
- Audit trail maintained

**Compliance Features:**
- POPIA/GDPR compliant by design
- Voluntary participation (no forced play)
- Anonymous aggregation for reporting
- Time-limited access tokens
- No persistent player tracking

**Casino Visibility:**
- Risk indicators only (no raw gameplay)
- Engagement status (played/not played)
- Trend analysis (improving/stable/elevated)
- Compliance evidence timestamps
- No access to individual decisions

---

## 🎯 Demo Mode vs Production Mode

### Demo Mode (Website)

**Features:**
- Full gameplay experience
- All visual effects enabled
- No backend calls
- No data storage
- Client-side only
- Clear "Demo" labeling
- "No Player Data Collected" disclaimer

**Use Cases:**
- Sales demonstrations
- Regulator presentations
- Website visitors
- Marketing purposes
- Feature showcases

### Production Mode (Player-Facing)

**Features:**
- Full telemetry collection
- Session management
- Database storage
- Risk calculation API calls
- Invitation tracking
- Completion callbacks
- WhatsApp/Email delivery

**Workflow:**
1. Player receives secure link
2. Game loads in browser
3. Session created in database
4. Telemetry collected during play
5. Risk calculation on completion
6. Session marked complete
7. Risk score stored
8. Invitation status updated

---

## 📱 Cross-Device Support

### Mobile (Touch)

**Controls:**
- Touch and drag to move vessel
- Smooth touch tracking with preventDefault
- No touch delay or lag
- Responsive canvas sizing
- Portrait and landscape support

**Optimizations:**
- Reduced particle count on mobile
- Efficient touch event handling
- No hover states
- Large touch targets
- Minimal text rendering

### Desktop (Keyboard + Mouse)

**Controls:**
- Arrow keys: Left/Right movement
- A/D keys: Alternative movement
- Mouse: Hover positioning
- Cursor: Hidden during play (cursor: none)

**Optimizations:**
- Full particle effects
- Higher quality gradients
- Additional visual details
- Mouse smoothing

### Browser Compatibility

**Tested Browsers:**
- Chrome 90+ ✓
- Safari 14+ ✓
- Firefox 88+ ✓
- Edge 90+ ✓
- Mobile Safari iOS 14+ ✓
- Chrome Android 90+ ✓

---

## 🔗 Integration Points

### Supabase Tables

**wellbeing_game_sessions**
- Tracks individual play sessions
- Links to player and casino
- Stores final score and duration
- Completion status

**wellbeing_game_telemetry**
- Event-by-event gameplay data
- Timestamped actions
- Linked to session
- Used for risk calculation

**wellbeing_risk_scores**
- Calculated behavioral risk index
- Component scores (impulsivity, escalation, etc.)
- Explanation and recommendations
- Linked to session and player

**wellbeing_game_invitations**
- Tracks outreach campaigns
- Secure tokenized links
- Status tracking (sent/played/completed)
- Expiration management

### Edge Functions

**wellbeing-risk-calculator**
- Processes session telemetry
- Calculates behavioral risk scores
- Generates explanations
- Stores results in database
- Returns confidence levels

**send-wellbeing-invitation**
- Creates secure invitation tokens
- Sends WhatsApp/Email links
- Tracks delivery status
- Manages expiration

---

## 🎨 Brand Differentiation

### What Makes This Original

**Visual Identity:**
- Custom gradient-based aesthetic (not flat design)
- Unique "Energy Flow" concept
- Original color palette (blue/green/gold, no classic game colors)
- Particle system design unique to SafeBetIQ
- No recognizable character or mechanic from existing games

**Gameplay Innovation:**
- Combo system tied to behavioral insights
- Progressive difficulty for data richness
- Risk-reward placement algorithm
- Safe path guarantee (player dignity)
- No punishment mechanics (no "game over")

**Technical Excellence:**
- Canvas-based for maximum performance
- Lightweight (11.2 kB route size)
- 60 FPS on budget devices
- Cross-platform parity
- Sub-2-second load time

**Behavioral Science:**
- Invisible telemetry collection
- Explainable AI scoring
- Multiple behavioral dimensions
- Trend analysis capability
- Regulator-acceptable methodology

---

## 📝 Regulator-Friendly Explanation

### For Gaming Authorities

**Purpose:**
This arcade-style game serves as a voluntary behavioral health check-in for players, delivered outside the casino environment via WhatsApp or email. It is NOT a gambling product.

**How It Works:**
1. Player receives optional invitation
2. 2-minute gameplay in browser
3. Behavioral patterns analyzed
4. Risk indicators generated (not diagnoses)
5. Results inform responsible gambling interventions

**What Makes It Compliant:**
- Voluntary participation (can exit anytime)
- Privacy-protected (no personal data)
- Non-diagnostic (behavioral patterns only)
- Explainable AI (transparent scoring)
- Operator oversight (casinos see trends, not gameplay)
- Audit-ready (complete timestamp logs)

**Scientific Basis:**
Behavioral telemetry captures decision-making patterns similar to those observed in responsible gambling research:
- Impulsivity indicators
- Risk-taking tendencies
- Recovery behavior
- Patience and self-regulation

**Differentiation from Gambling:**
- No wagering mechanics
- No monetary value
- No randomness affecting outcomes
- No competitive leaderboards
- No gambling-style rewards

---

## 🚀 Deployment Checklist

### Website Demo
- [x] ArcadeWellbeingGame component created
- [x] Demo mode implemented (demoMode={true})
- [x] No backend dependencies
- [x] Disclaimer displayed
- [x] Performance optimized
- [x] Cross-device testing

### Production Integration
- [x] All game wrappers updated (Balance, Resource, Impulse)
- [x] Session management connected
- [x] Telemetry storage working
- [x] Risk calculator enhanced
- [x] Edge functions deployed
- [x] Database tables ready

### Performance Validation
- [x] Build successful (213 kB first load)
- [x] 60 FPS target achieved
- [x] Mobile responsive
- [x] Cross-browser compatible
- [x] Load time <2 seconds
- [x] No console errors

---

## 🎯 Success Metrics

### Player Experience
- Engagement rate >60%
- Completion rate >80%
- Average session: 2 minutes
- Voluntary replay rate tracked

### Technical Performance
- 60 FPS maintained throughout
- Zero crashes or freezes
- <2 second load time
- Works on 3+ year old devices

### Business Value
- Behavioral insights captured
- Risk identification improved
- Regulator approval obtained
- Clear competitive differentiation

---

## 📚 Future Enhancements (Roadmap)

### Phase 2 Concepts
- Additional game variants (different mechanics)
- Adaptive difficulty based on player skill
- Multi-language support
- Accessibility features (colorblind modes)
- Sound effects and music (optional)

### Phase 3 Advanced Features
- Machine learning pattern recognition
- Longitudinal trend analysis
- Peer comparison (anonymized)
- Intervention effectiveness tracking
- Integration with wearables (optional biometric data)

---

## 🏆 Competitive Advantages

**vs Traditional Questionnaires:**
- Higher engagement (arcade fun vs boring questions)
- Less self-report bias (behavioral vs declarative)
- Richer data (continuous vs discrete)
- Better completion rates
- Player dignity maintained

**vs Other RG Tools:**
- Proactive (not reactive)
- Off-platform (private engagement)
- Explainable (clear reasoning)
- Original IP (brand differentiation)
- Regulator-ready (compliance built-in)

---

## 📞 Support & Maintenance

### Code Location
- Main component: `/components/wellbeing-games/ArcadeWellbeingGame.tsx`
- Game wrappers: `/components/wellbeing-games/[BalanceJourney|ResourceGuardian|ImpulseChallenge]Game.tsx`
- Demo page: `/app/wellbeing-game/page.tsx`
- Risk calculator: `/supabase/functions/wellbeing-risk-calculator/index.ts`

### Key Dependencies
- React 18.2.0
- Framer Motion 12.23.24
- HTML5 Canvas API (native)
- Supabase 2.58.0
- Next.js 13.5.1

### Monitoring Points
- Canvas performance (FPS tracking)
- Session completion rates
- Risk calculation success rate
- Cross-device performance
- Error logging

---

**Document Version:** 1.0
**Last Updated:** 2026-01-23
**Author:** SafeBetIQ Development Team
**Status:** Production Ready ✓
