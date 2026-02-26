'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Trophy, Target, Zap, Heart, Shield, CircleAlert as AlertCircle, CircleCheck as CheckCircle2, ChartBar as BarChart3, Brain, Timer, Sparkles, TrendingUp, Star, Award, BookOpen, Phone, ExternalLink, Volume2, VolumeX, Accessibility, Pause, Play, X, RotateCcw, Download, Flame, Keyboard, Grip, Eye } from 'lucide-react';

interface EnhancedInteractiveCardGameProps {
  invitation?: any;
  demoMode?: boolean;
  onGameComplete?: (data: GameCompletionData) => void;
}

interface GameCompletionData {
  duration_seconds: number;
  completion_rate: number;
  behaviour_risk_index: number;
  telemetry: TelemetryEvent[];
  hesitation_score: number;
  consistency_score: number;
  insights: Insight[];
  badges: Badge[];
}

interface TelemetryEvent {
  event_type: string;
  event_timestamp: string;
  event_sequence: number;
  event_data: Record<string, any>;
  decision_speed_ms?: number;
  risk_level_chosen?: 'safe' | 'risky' | 'very-risky' | 'none';
  hover_duration_ms?: number;
  hesitation_detected?: boolean;
}

interface MouseMovementData {
  x: number;
  y: number;
  timestamp: number;
}

interface Insight {
  type: string;
  category: string;
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'concern';
}

interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  tier: string;
}

interface EducationalResource {
  resource_type: string;
  title: string;
  description: string;
  content?: string;
}

interface GameScenario {
  id: number;
  situation: string;
  context: string;
  category: string;
  cards: {
    label: string;
    type: 'safe' | 'risky' | 'very-risky';
    icon: any;
    description: string;
    points: number;
    consequence?: string;
  }[];
}

const gameScenarios: GameScenario[] = [
  {
    id: 1,
    situation: "You're on a winning streak",
    context: "Won 3 rounds in a row. Up R300 from R100 start.",
    category: "winning_streak",
    cards: [
      { label: "Cash Out Now", type: 'safe', icon: Shield, description: "Walk away with profit", points: 10, consequence: "You secure your winnings and feel great about your discipline." },
      { label: "Keep Playing Same Bet", type: 'risky', icon: Target, description: "Maintain current strategy", points: 5, consequence: "You continue cautiously, aware that luck can change." },
      { label: "Double Next Bet", type: 'very-risky', icon: Zap, description: "Ride the hot streak", points: -5, consequence: "The feeling of invincibility can lead to bigger losses." },
    ]
  },
  {
    id: 2,
    situation: "Chasing Losses",
    context: "Down R200. Feeling frustrated. Budget was R300.",
    category: "loss_chasing",
    cards: [
      { label: "Stop Playing", type: 'safe', icon: Shield, description: "Accept loss, come back fresh", points: 15, consequence: "Walking away prevents bigger losses and emotional decisions." },
      { label: "Try Lower Stakes", type: 'risky', icon: Target, description: "Slow recovery attempt", points: 0, consequence: "Lower stakes reduce risk but don't guarantee recovery." },
      { label: "Bet Big to Recover", type: 'very-risky', icon: Zap, description: "Win it all back quickly", points: -10, consequence: "This is how small losses become big problems." },
    ]
  },
  {
    id: 3,
    situation: "Big Win Decision",
    context: "Just hit R2,000 from R200 bet. Feeling amazing!",
    category: "winning_streak",
    cards: [
      { label: "Withdraw Everything", type: 'safe', icon: Trophy, description: "Celebrate your win", points: 20, consequence: "You lock in an incredible win and can enjoy it guilt-free." },
      { label: "Keep R1,500, Play R500", type: 'risky', icon: Target, description: "Secure profit, have fun", points: 10, consequence: "A balanced approach that secures most gains." },
      { label: "Keep Playing All", type: 'very-risky', icon: Zap, description: "Go for even bigger win", points: -15, consequence: "Big wins often evaporate when not protected." },
    ]
  },
  {
    id: 4,
    situation: "Budget Limit Reached",
    context: "Hit your R500 limit. Friends still playing.",
    category: "budget_violation",
    cards: [
      { label: "Stop & Socialize", type: 'safe', icon: Heart, description: "Stick to your plan", points: 20, consequence: "Your discipline protects you from overspending." },
      { label: "Play R50 More", type: 'risky', icon: Target, description: "Small overage only", points: -5, consequence: "Small exceptions often become larger ones." },
      { label: "Get More Cash", type: 'very-risky', icon: Zap, description: "Keep the night going", points: -20, consequence: "Breaking limits removes your safety net." },
    ]
  },
  {
    id: 5,
    situation: "Emotional Play",
    context: "Had a stressful day. Feeling upset.",
    category: "emotional_play",
    cards: [
      { label: "Skip Tonight", type: 'safe', icon: Shield, description: "Play when clear-headed", points: 15, consequence: "Emotional gambling rarely goes well." },
      { label: "Stick to Budget", type: 'risky', icon: Target, description: "Play but stay careful", points: 0, consequence: "Extra vigilance is needed when emotions are high." },
      { label: "Play More Than Usual", type: 'very-risky', icon: Zap, description: "Blow off steam", points: -15, consequence: "Using gambling to cope often backfires." },
    ]
  },
  {
    id: 6,
    situation: "Near-Miss Pattern",
    context: "Slot showing 'almost wins'. Feels close.",
    category: "risk_escalation",
    cards: [
      { label: "Switch Games", type: 'safe', icon: Shield, description: "Break the pattern", points: 10, consequence: "Near-misses are designed to keep you playing." },
      { label: "Keep Same Bets", type: 'risky', icon: Target, description: "Wait for the hit", points: -5, consequence: "The next spin isn't any more likely to win." },
      { label: "Increase Bet Size", type: 'very-risky', icon: Zap, description: "It's about to pay", points: -15, consequence: "Near-misses don't predict wins - that's cognitive bias." },
    ]
  },
  {
    id: 7,
    situation: "Free Drinks Available",
    context: "Had 2 drinks. Breaking even. More offered.",
    category: "impaired_decision",
    cards: [
      { label: "Switch to Water", type: 'safe', icon: Shield, description: "Stay sharp", points: 10, consequence: "Clear thinking protects your bankroll." },
      { label: "One More Drink", type: 'risky', icon: Target, description: "Still in control", points: -5, consequence: "Alcohol gradually impairs judgment." },
      { label: "Keep Drinking", type: 'very-risky', icon: Zap, description: "Part of the fun", points: -15, consequence: "Impaired judgment leads to poor bets." },
    ]
  },
  {
    id: 8,
    situation: "Late Night Decision",
    context: "Playing 4 hours. Tired. Down R300. It's 2 AM.",
    category: "time_management",
    cards: [
      { label: "Go Home Now", type: 'safe', icon: Shield, description: "Rest and perspective", points: 20, consequence: "Fatigue clouds judgment. Tomorrow is a new day." },
      { label: "30 More Minutes", type: 'risky', icon: Target, description: "One last chance", points: -5, consequence: "Tired players make costly mistakes." },
      { label: "Play Until Win", type: 'very-risky', icon: Zap, description: "Must recover losses", points: -25, consequence: "This thinking often leads to devastating losses." },
    ]
  },
];

export default function EnhancedInteractiveCardGame({
  invitation,
  demoMode = false,
  onGameComplete,
}: EnhancedInteractiveCardGameProps) {
  const [gameStatus, setGameStatus] = useState<'intro' | 'tutorial' | 'playing' | 'paused' | 'completed'>('intro');
  const [currentScenario, setCurrentScenario] = useState(0);
  const [score, setScore] = useState(0);
  const [decisions, setDecisions] = useState<any[]>([]);
  const [telemetry, setTelemetry] = useState<TelemetryEvent[]>([]);
  const [sessionStart, setSessionStart] = useState<Date | null>(null);
  const [scenarioStart, setScenarioStart] = useState<Date | null>(null);
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);
  const [selectedCard, setSelectedCard] = useState<number | null>(null);
  const [showConsequence, setShowConsequence] = useState(false);
  const [consequence, setConsequence] = useState<string>('');
  const [focusedCardIndex, setFocusedCardIndex] = useState<number>(0);

  // Advanced telemetry
  const [mouseMovements, setMouseMovements] = useState<MouseMovementData[]>([]);
  const [cardHoverDurations, setCardHoverDurations] = useState<Record<number, number>>({});
  const [hoverStartTime, setHoverStartTime] = useState<number | null>(null);
  const [cardComparisonPattern, setCardComparisonPattern] = useState<number[]>([]);
  const [hesitationEvents, setHesitationEvents] = useState<number>(0);
  const [comboStreak, setComboStreak] = useState<number>(0);
  const [lastChoiceType, setLastChoiceType] = useState<string>('');

  // Settings
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [showProgress, setShowProgress] = useState(true);
  const [highContrast, setHighContrast] = useState(false);
  const [textSize, setTextSize] = useState<'normal' | 'large' | 'xlarge'>('normal');
  const [showTutorial, setShowTutorial] = useState(true);

  // Results data
  const [insights, setInsights] = useState<Insight[]>([]);
  const [earnedBadges, setEarnedBadges] = useState<Badge[]>([]);
  const [educationalResources, setEducationalResources] = useState<EducationalResource[]>([]);

  // Pause/Resume state
  const [pausedTime, setPausedTime] = useState<number>(0);

  const audioContextRef = useRef<AudioContext | null>(null);
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);

  // Initialize audio context
  useEffect(() => {
    if (typeof window !== 'undefined' && soundEnabled) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }, [soundEnabled]);

  // Auto-save progress to localStorage
  useEffect(() => {
    if (gameStatus === 'playing' || gameStatus === 'paused') {
      const saveData = {
        currentScenario,
        score,
        decisions,
        telemetry,
        sessionStart,
        comboStreak,
        lastChoiceType,
        timestamp: Date.now()
      };
      localStorage.setItem('novaiq_save', JSON.stringify(saveData));
    }
  }, [currentScenario, score, decisions, gameStatus]);

  // Load saved progress
  useEffect(() => {
    const saved = localStorage.getItem('novaiq_save');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        // Only restore if less than 1 hour old
        if (Date.now() - data.timestamp < 3600000) {
          setCurrentScenario(data.currentScenario);
          setScore(data.score);
          setDecisions(data.decisions);
          setTelemetry(data.telemetry);
          setSessionStart(data.sessionStart ? new Date(data.sessionStart) : null);
          setComboStreak(data.comboStreak || 0);
          setLastChoiceType(data.lastChoiceType || '');
        }
      } catch (e) {
        console.error('Failed to load saved progress', e);
      }
    }
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameStatus !== 'playing' || showConsequence) return;

      const scenario = gameScenarios[currentScenario];

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          setFocusedCardIndex(prev => Math.max(0, prev - 1));
          playSound('hover');
          break;
        case 'ArrowRight':
          e.preventDefault();
          setFocusedCardIndex(prev => Math.min(scenario.cards.length - 1, prev + 1));
          playSound('hover');
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          if (!selectedCard) {
            handleCardSelect(focusedCardIndex);
          }
          break;
        case '1':
          if (!selectedCard) handleCardSelect(0);
          break;
        case '2':
          if (!selectedCard && scenario.cards.length > 1) handleCardSelect(1);
          break;
        case '3':
          if (!selectedCard && scenario.cards.length > 2) handleCardSelect(2);
          break;
        case 'Escape':
          if (gameStatus === 'playing') {
            togglePause();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameStatus, showConsequence, focusedCardIndex, currentScenario, selectedCard]);

  // Play sound effect
  const playSound = useCallback((type: 'hover' | 'select' | 'success' | 'milestone' | 'complete') => {
    if (!soundEnabled || !audioContextRef.current) return;

    const ctx = audioContextRef.current;
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    switch (type) {
      case 'hover':
        oscillator.frequency.value = 400;
        gainNode.gain.value = 0.05;
        oscillator.start();
        oscillator.stop(ctx.currentTime + 0.05);
        break;
      case 'select':
        oscillator.frequency.value = 600;
        gainNode.gain.value = 0.1;
        oscillator.start();
        oscillator.stop(ctx.currentTime + 0.1);
        break;
      case 'success':
        oscillator.frequency.value = 800;
        gainNode.gain.value = 0.15;
        oscillator.start();
        oscillator.stop(ctx.currentTime + 0.2);
        break;
      case 'milestone':
        oscillator.frequency.value = 1000;
        gainNode.gain.value = 0.2;
        oscillator.start();
        oscillator.stop(ctx.currentTime + 0.3);
        break;
      case 'complete':
        oscillator.frequency.value = 1200;
        gainNode.gain.value = 0.25;
        oscillator.start();
        oscillator.stop(ctx.currentTime + 0.5);
        break;
    }
  }, [soundEnabled]);

  // Haptic feedback
  const triggerHaptic = useCallback((intensity: 'light' | 'medium' | 'heavy' = 'light') => {
    if ('vibrate' in navigator) {
      const duration = intensity === 'light' ? 10 : intensity === 'medium' ? 20 : 50;
      navigator.vibrate(duration);
    }
  }, []);

  // Track mouse movements
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (gameStatus !== 'playing') return;

    const movement: MouseMovementData = {
      x: e.clientX,
      y: e.clientY,
      timestamp: Date.now()
    };

    setMouseMovements(prev => [...prev.slice(-50), movement]); // Keep last 50 movements
  }, [gameStatus]);

  // Detect hesitation (hovering between cards multiple times)
  useEffect(() => {
    if (cardComparisonPattern.length > 6) {
      const uniqueCards = new Set(cardComparisonPattern.slice(-6));
      if (uniqueCards.size >= 2) {
        setHesitationEvents(prev => prev + 1);
        logTelemetry('hesitation_detected', {
          comparison_pattern: cardComparisonPattern.slice(-6),
          scenario_id: gameScenarios[currentScenario].id
        });
      }
    }
  }, [cardComparisonPattern]);

  const logTelemetry = useCallback((eventType: string, eventData: Record<string, any>, riskLevel?: 'safe' | 'risky' | 'very-risky') => {
    const event: TelemetryEvent = {
      event_type: eventType,
      event_timestamp: new Date().toISOString(),
      event_sequence: telemetry.length + 1,
      event_data: eventData,
      risk_level_chosen: riskLevel || 'none',
    };

    if (scenarioStart && eventType === 'card_selected') {
      event.decision_speed_ms = Date.now() - scenarioStart.getTime();
    }

    if (eventType === 'card_hover_end' && hoverStartTime) {
      event.hover_duration_ms = Date.now() - hoverStartTime;

      // Detect hesitation (very long hover)
      if (event.hover_duration_ms > 5000) {
        event.hesitation_detected = true;
      }
    }

    setTelemetry(prev => [...prev, event]);
  }, [telemetry, scenarioStart, hoverStartTime]);

  // Screen reader announcement
  const announceToScreenReader = (message: string) => {
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', 'polite');
    announcement.className = 'sr-only';
    announcement.textContent = message;
    document.body.appendChild(announcement);
    setTimeout(() => document.body.removeChild(announcement), 1000);
  };

  const startGame = () => {
    if (showTutorial) {
      setGameStatus('tutorial');
      announceToScreenReader('Tutorial started. Learn how to play Nova IQ.');
    } else {
      setGameStatus('playing');
      announceToScreenReader('Nova IQ assessment started. Scenario 1 of 8.');
    }
    setSessionStart(new Date());
    setScenarioStart(new Date());
    logTelemetry('game_started', { timestamp: new Date().toISOString() });
    playSound('success');
    triggerHaptic('medium');
  };

  const togglePause = () => {
    if (gameStatus === 'playing') {
      setGameStatus('paused');
      setPausedTime(Date.now());
      logTelemetry('game_paused', { currentScenario, score });
      playSound('select');
    } else if (gameStatus === 'paused') {
      setGameStatus('playing');
      const pauseDuration = Date.now() - pausedTime;
      logTelemetry('game_resumed', { pause_duration_ms: pauseDuration });
      playSound('success');
    }
  };

  const restartGame = () => {
    setGameStatus('intro');
    setCurrentScenario(0);
    setScore(0);
    setDecisions([]);
    setTelemetry([]);
    setComboStreak(0);
    setLastChoiceType('');
    setInsights([]);
    setEarnedBadges([]);
    localStorage.removeItem('novaiq_save');
    playSound('select');
  };

  const skipTutorial = () => {
    setGameStatus('playing');
    setShowTutorial(false);
    localStorage.setItem('novaiq_tutorial_seen', 'true');
  };

  const completeTutorial = () => {
    setGameStatus('playing');
    localStorage.setItem('novaiq_tutorial_seen', 'true');
  };

  // Touch/Swipe handlers for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent, cardIndex: number) => {
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;

    const deltaX = Math.abs(touchEndX - touchStartX.current);
    const deltaY = Math.abs(touchEndY - touchStartY.current);

    // If it's a tap (not a swipe), select the card
    if (deltaX < 10 && deltaY < 10) {
      handleCardSelect(cardIndex);
    }
  };

  const handleCardHoverStart = (cardIndex: number) => {
    setHoveredCard(cardIndex);
    setHoverStartTime(Date.now());
    setCardComparisonPattern(prev => [...prev, cardIndex]);
    playSound('hover');
    triggerHaptic('light');

    logTelemetry('card_hover_start', {
      scenario_id: gameScenarios[currentScenario].id,
      card_index: cardIndex,
      card_type: gameScenarios[currentScenario].cards[cardIndex].type
    });
  };

  const handleCardHoverEnd = (cardIndex: number) => {
    if (hoverStartTime) {
      const duration = Date.now() - hoverStartTime;
      setCardHoverDurations(prev => ({
        ...prev,
        [cardIndex]: (prev[cardIndex] || 0) + duration
      }));

      logTelemetry('card_hover_end', {
        scenario_id: gameScenarios[currentScenario].id,
        card_index: cardIndex,
        duration_ms: duration
      });
    }

    setHoveredCard(null);
    setHoverStartTime(null);
  };

  const handleCardSelect = (cardIndex: number) => {
    const scenario = gameScenarios[currentScenario];
    const selectedCardData = scenario.cards[cardIndex];

    setSelectedCard(cardIndex);
    setConsequence(selectedCardData.consequence || '');
    setShowConsequence(true);

    // Check for combo streak
    let currentCombo = comboStreak;
    if (selectedCardData.type === lastChoiceType && selectedCardData.type === 'safe') {
      currentCombo += 1;
      setComboStreak(currentCombo);
      if (currentCombo >= 3) {
        playSound('milestone');
        triggerHaptic('heavy');
      }
    } else {
      setComboStreak(selectedCardData.type === 'safe' ? 1 : 0);
    }
    setLastChoiceType(selectedCardData.type);

    playSound(selectedCardData.type === 'safe' ? 'success' : 'select');
    triggerHaptic(selectedCardData.type === 'very-risky' ? 'heavy' : 'medium');

    // Update score with combo bonus
    const comboBonus = currentCombo >= 3 ? Math.floor(currentCombo * 2) : 0;
    setScore(prev => prev + selectedCardData.points + comboBonus);

    // Log decision
    const decision = {
      scenario_id: scenario.id,
      scenario_situation: scenario.situation,
      scenario_category: scenario.category,
      card_selected: selectedCardData.label,
      risk_type: selectedCardData.type,
      points: selectedCardData.points,
      decision_time_ms: scenarioStart ? Date.now() - scenarioStart.getTime() : 0,
      hover_durations: cardHoverDurations,
      comparison_count: cardComparisonPattern.length,
    };

    setDecisions(prev => [...prev, decision]);
    logTelemetry('card_selected', decision, selectedCardData.type);

    // Check for milestones
    if (currentScenario === 3) {
      playSound('milestone');
      triggerHaptic('heavy');
    }

    // Wait for consequence display then move to next scenario
    setTimeout(() => {
      setShowConsequence(false);

      if (currentScenario < gameScenarios.length - 1) {
        const nextScenario = currentScenario + 2;
        setCurrentScenario(prev => prev + 1);
        setScenarioStart(new Date());
        setSelectedCard(null);
        setCardHoverDurations({});
        setCardComparisonPattern([]);
        announceToScreenReader(`Scenario ${nextScenario} of ${gameScenarios.length}. ${gameScenarios[currentScenario + 1].situation}`);
      } else {
        completeGame();
      }
    }, 2500);
  };

  const generateInsights = useCallback((decisionsData: any[]): Insight[] => {
    const insights: Insight[] = [];

    const safeChoices = decisionsData.filter(d => d.risk_type === 'safe').length;
    const riskyChoices = decisionsData.filter(d => d.risk_type === 'risky').length;
    const veryRiskyChoices = decisionsData.filter(d => d.risk_type === 'very-risky').length;

    // Pattern: Loss chasing
    const lossChasingScenarios = decisionsData.filter(d => d.scenario_category === 'loss_chasing');
    if (lossChasingScenarios.length > 0 && lossChasingScenarios.some(d => d.risk_type === 'very-risky')) {
      insights.push({
        type: 'pattern',
        category: 'loss_chasing',
        title: 'Loss Chasing Tendency Detected',
        description: 'You showed a tendency to chase losses with risky bets. This is one of the most dangerous patterns in gambling.',
        severity: 'concern'
      });
    }

    // Pattern: Winning streak management
    const winningStreakScenarios = decisionsData.filter(d => d.scenario_category === 'winning_streak');
    if (winningStreakScenarios.length > 0 && winningStreakScenarios.every(d => d.risk_type === 'safe')) {
      insights.push({
        type: 'pattern',
        category: 'winning_streak',
        title: 'Excellent Winning Streak Management',
        description: 'You showed great discipline during wins. This is when most players lose control.',
        severity: 'info'
      });
    }

    // Pattern: Decision speed
    const avgDecisionTime = decisionsData.reduce((sum, d) => sum + d.decision_time_ms, 0) / decisionsData.length;
    if (avgDecisionTime < 3000 && veryRiskyChoices > 2) {
      insights.push({
        type: 'trigger',
        category: 'impulsivity',
        title: 'Quick Risky Decisions',
        description: 'You made several risky choices very quickly. Slowing down can improve decision quality.',
        severity: 'warning'
      });
    }

    // Recommendation: Overall balance
    if (safeChoices >= 6) {
      insights.push({
        type: 'recommendation',
        category: 'positive_reinforcement',
        title: 'Strong Self-Control',
        description: 'Your consistent safe choices show excellent self-control. Keep this awareness when playing for real.',
        severity: 'info'
      });
    } else if (veryRiskyChoices >= 5) {
      insights.push({
        type: 'recommendation',
        category: 'risk_awareness',
        title: 'Consider Setting Stricter Limits',
        description: 'Your choices suggest you might benefit from stricter pre-set limits when gambling.',
        severity: 'warning'
      });
    }

    return insights;
  }, []);

  const checkBadges = useCallback((decisionsData: any[], allPreviousSessions: any[] = []): Badge[] => {
    const badges: Badge[] = [];
    const totalSessions = allPreviousSessions.length + 1;

    const safeChoices = decisionsData.filter(d => d.risk_type === 'safe').length;
    const veryRiskyChoices = decisionsData.filter(d => d.risk_type === 'very-risky').length;

    // Self Aware (first session)
    if (totalSessions === 1) {
      badges.push({
        id: 'self_aware',
        name: 'Self-Aware Player',
        description: 'Completed your first wellbeing assessment',
        icon: 'Brain',
        tier: 'bronze'
      });
    }

    // Balanced Start
    if (safeChoices >= 6) {
      badges.push({
        id: 'balanced_start',
        name: 'Balanced Beginning',
        description: 'Made 6+ safe choices in a session',
        icon: 'Shield',
        tier: 'bronze'
      });
    }

    // Risk Manager
    if (veryRiskyChoices === 0) {
      badges.push({
        id: 'risk_manager',
        name: 'Risk Manager',
        description: 'Avoided all high-risk choices',
        icon: 'Target',
        tier: 'silver'
      });
    }

    return badges;
  }, []);

  const completeGame = async () => {
    setGameStatus('completed');
    playSound('complete');
    triggerHaptic('heavy');
    announceToScreenReader('Assessment complete! Your results are ready.');

    const durationSeconds = sessionStart ? Math.floor((Date.now() - sessionStart.getTime()) / 1000) : 0;

    // Calculate behavioral risk index (0-100, lower is better)
    const safeChoices = decisions.filter(d => d.risk_type === 'safe').length;
    const riskyChoices = decisions.filter(d => d.risk_type === 'risky').length;
    const veryRiskyChoices = decisions.filter(d => d.risk_type === 'very-risky').length;

    const riskIndex = Math.max(0, Math.min(100,
      50 - (safeChoices * 8) + (riskyChoices * 3) + (veryRiskyChoices * 10)
    ));

    // Calculate hesitation score
    const avgDecisionTime = decisions.reduce((sum, d) => sum + d.decision_time_ms, 0) / decisions.length;
    const hesitationScore = Math.min(100, Math.floor((hesitationEvents * 10) + (avgDecisionTime > 10000 ? 20 : 0)));

    // Calculate consistency score
    const riskTypes = decisions.map(d => d.risk_type);
    const switches = riskTypes.slice(0, -1).filter((type, i) => type !== riskTypes[i + 1]).length;
    const consistencyScore = Math.max(0, 100 - (switches * 10));

    // Generate insights
    const gameInsights = generateInsights(decisions);
    setInsights(gameInsights);

    // Check for badges
    const badges = checkBadges(decisions);
    setEarnedBadges(badges);

    // Get educational resources
    if (!demoMode) {
      const { data: resources } = await supabase
        .from('wellbeing_educational_resources')
        .select('*')
        .eq('active', true)
        .limit(5);

      if (resources) {
        setEducationalResources(resources);
      }
    }

    const gameData: GameCompletionData = {
      duration_seconds: durationSeconds,
      completion_rate: 100,
      behaviour_risk_index: riskIndex,
      hesitation_score: hesitationScore,
      consistency_score: consistencyScore,
      telemetry: telemetry,
      insights: gameInsights,
      badges: badges,
    };

    logTelemetry('game_completed', {
      total_score: score,
      safe_choices: safeChoices,
      risky_choices: riskyChoices,
      very_risky_choices: veryRiskyChoices,
      risk_index: riskIndex,
      hesitation_score: hesitationScore,
      consistency_score: consistencyScore,
    });

    // Save to database if not demo mode
    if (!demoMode && invitation) {
      try {
        const { data: sessionData } = await supabase
          .from('wellbeing_game_sessions')
          .insert({
            invitation_id: invitation.id,
            player_id: invitation.player_id,
            casino_id: invitation.casino_id,
            duration_seconds: durationSeconds,
            completion_rate: 100,
            behaviour_risk_index: riskIndex,
            hesitation_score: hesitationScore,
            consistency_score: consistencyScore,
            risk_escalation_detected: veryRiskyChoices > decisions.length / 2,
            telemetry: telemetry,
            insights_generated: gameInsights,
            mouse_movement_data: mouseMovements.slice(-100),
            device_info: {
              userAgent: navigator.userAgent,
              screenWidth: window.innerWidth,
              screenHeight: window.innerHeight,
            },
            completed_at: new Date().toISOString(),
          })
          .select()
          .single();

        // Save insights
        if (sessionData && gameInsights.length > 0) {
          await supabase.from('wellbeing_game_insights').insert(
            gameInsights.map(insight => ({
              session_id: sessionData.id,
              player_id: invitation.player_id,
              casino_id: invitation.casino_id,
              insight_type: insight.type,
              insight_category: insight.category,
              title: insight.title,
              description: insight.description,
              severity: insight.severity,
              evidence: decisions.filter(d => d.scenario_category === insight.category),
            }))
          );
        }

        // Award badges
        if (sessionData && badges.length > 0) {
          const { data: badgeDefinitions } = await supabase
            .from('wellbeing_game_badges')
            .select('*')
            .in('badge_type', badges.map(b => b.id));

          if (badgeDefinitions) {
            for (const badge of badgeDefinitions) {
              await supabase
                .from('wellbeing_player_badges')
                .upsert({
                  player_id: invitation.player_id,
                  casino_id: invitation.casino_id,
                  badge_id: badge.id,
                  session_id: sessionData.id,
                }, {
                  onConflict: 'player_id,badge_id',
                  ignoreDuplicates: true
                });
            }
          }
        }
      } catch (error) {
        console.error('Error saving game session:', error);
      }
    }

    if (onGameComplete) {
      onGameComplete(gameData);
    }
  };

  const scenario = gameScenarios[currentScenario];
  const progress = ((currentScenario + 1) / gameScenarios.length) * 100;

  // Tutorial scenario
  const tutorialScenario: GameScenario = {
    id: 0,
    situation: "Practice Round - Learning the Basics",
    context: "You've won R50. What do you do next?",
    category: "tutorial",
    cards: [
      { label: "Take a Break", type: 'safe', icon: Shield, description: "Walk away with your win", points: 10, consequence: "Great choice! Taking breaks helps you stay in control. This was a SAFE choice." },
      { label: "Play One More", type: 'risky', icon: Target, description: "Try your luck again", points: 5, consequence: "Not bad! This carries some risk but isn't too dangerous. This was a RISKY choice." },
      { label: "Double or Nothing", type: 'very-risky', icon: Zap, description: "Go big!", points: -5, consequence: "Careful! This kind of thinking can lead to losses. This was a VERY RISKY choice." },
    ]
  };

  // Quick exit function (privacy feature)
  const quickExit = () => {
    window.location.href = 'https://www.google.com';
  };

  if (gameStatus === 'intro') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4" ref={gameContainerRef}>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-2xl w-full"
        >
          <Card className="bg-slate-900/80 border-slate-800 backdrop-blur shadow-2xl">
            <CardContent className="p-6 md:p-12 space-y-6 text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                className="relative w-16 h-16 md:w-20 md:h-20 mx-auto"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full blur-xl opacity-50 animate-pulse" />
                <div className="relative w-full h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full flex items-center justify-center">
                  <Brain className="w-8 h-8 md:w-10 md:h-10 text-white" />
                </div>
              </motion.div>

              <div className="space-y-4">
                <h1 className="text-2xl md:text-4xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
                  Play Your Way to Insight
                </h1>
                <p className="text-base md:text-lg text-slate-300">
                  Make real decisions in realistic gaming situations. No questionnaires. Just play.
                </p>
              </div>

              <div className="bg-slate-800/50 rounded-xl p-4 md:p-6 space-y-4 text-left border border-slate-700/50">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-emerald-500/10 rounded-lg">
                    <Target className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  </div>
                  <div className="flex-1">
                    <p className="text-slate-200 font-medium">8 Real Scenarios</p>
                    <p className="text-sm text-slate-400">Choose your response as cards with instant feedback</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-teal-500/10 rounded-lg">
                    <Timer className="w-5 h-5 text-teal-400 flex-shrink-0" />
                  </div>
                  <div className="flex-1">
                    <p className="text-slate-200 font-medium">5 Minutes</p>
                    <p className="text-sm text-slate-400">Quick and engaging experience with sound & haptics</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-purple-500/10 rounded-lg">
                    <BarChart3 className="w-5 h-5 text-purple-400 flex-shrink-0" />
                  </div>
                  <div className="flex-1">
                    <p className="text-slate-200 font-medium">Personal Insights & Badges</p>
                    <p className="text-sm text-slate-400">Get AI-powered insights and unlock achievements</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
                <button
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                  aria-label={soundEnabled ? "Disable sound" : "Enable sound"}
                >
                  {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                  <span className="text-slate-300">Sound</span>
                </button>
                <button
                  onClick={() => setReducedMotion(!reducedMotion)}
                  className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                  aria-label="Reduce animations"
                >
                  <Accessibility className="w-4 h-4" />
                  <span className="text-slate-300">Reduce Motion</span>
                </button>
                <button
                  onClick={() => setHighContrast(!highContrast)}
                  className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                  aria-label="Toggle high contrast"
                >
                  <Eye className={highContrast ? "w-4 h-4" : "w-4 h-4"} />
                  <span className="text-slate-300">High Contrast</span>
                </button>
                <button
                  onClick={() => {
                    const sizes: Array<'normal' | 'large' | 'xlarge'> = ['normal', 'large', 'xlarge'];
                    const currentIndex = sizes.indexOf(textSize);
                    setTextSize(sizes[(currentIndex + 1) % sizes.length]);
                  }}
                  className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                  aria-label="Change text size"
                >
                  <Keyboard className="w-4 h-4" />
                  <span className="text-slate-300">Text: {textSize === 'normal' ? 'A' : textSize === 'large' ? 'A+' : 'A++'}</span>
                </button>
              </div>

              <Button
                onClick={startGame}
                size="lg"
                className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold text-lg py-6 shadow-lg shadow-emerald-500/25"
              >
                Start Playing
              </Button>

              <p className="text-xs text-slate-500">
                Your responses are anonymous and used only for wellbeing support
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  if (gameStatus === 'tutorial') {
    const currentTutorialScenario = tutorialScenario;
    return (
      <div
        className={`min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 md:p-8 ${textSize === 'large' ? 'text-lg' : textSize === 'xlarge' ? 'text-xl' : ''}`}
        onMouseMove={handleMouseMove}
        ref={gameContainerRef}
      >
        <div className="max-w-5xl mx-auto space-y-4 md:space-y-6">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4 backdrop-blur text-center"
          >
            <div className="flex items-center justify-center gap-2 mb-2">
              <Sparkles className="w-5 h-5 text-purple-400" />
              <h3 className="text-lg font-semibold text-purple-400">Tutorial Mode</h3>
            </div>
            <p className="text-sm text-slate-300">
              Try selecting a card. Use your mouse, keyboard (Arrow keys + Enter), or tap on mobile.
            </p>
            <Button
              onClick={skipTutorial}
              variant="ghost"
              size="sm"
              className="mt-2 text-slate-400 hover:text-slate-200"
            >
              Skip Tutorial →
            </Button>
          </motion.div>

          <AnimatePresence mode="wait">
            <motion.div
              initial={{ opacity: 0, x: reducedMotion ? 0 : 50 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 md:p-8 backdrop-blur shadow-2xl"
            >
              <div className="text-center space-y-3 md:space-y-4 mb-6 md:mb-8">
                <motion.h2
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-xl md:text-3xl font-bold text-white"
                >
                  {currentTutorialScenario.situation}
                </motion.h2>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className="text-base md:text-lg text-slate-300"
                >
                  {currentTutorialScenario.context}
                </motion.p>
              </div>

              {!showConsequence ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                  {currentTutorialScenario.cards.map((card, index) => {
                    const Icon = card.icon;
                    const isSelected = selectedCard === index;
                    const isHovered = hoveredCard === index;
                    const isFocused = focusedCardIndex === index;

                    return (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        whileHover={reducedMotion ? {} : { scale: 1.05, y: -5 }}
                        whileTap={reducedMotion ? {} : { scale: 0.98 }}
                        onHoverStart={() => handleCardHoverStart(index)}
                        onHoverEnd={() => handleCardHoverEnd(index)}
                        onTouchStart={handleTouchStart}
                        onTouchEnd={(e) => handleTouchEnd(e, index)}
                        className="w-full"
                      >
                        <Card
                          className={`
                            cursor-pointer h-full transition-all duration-300 min-h-[44px]
                            ${card.type === 'safe' ? 'border-green-500/30 hover:border-green-500' : ''}
                            ${card.type === 'risky' ? 'border-amber-500/30 hover:border-amber-500' : ''}
                            ${card.type === 'very-risky' ? 'border-red-500/30 hover:border-red-500' : ''}
                            ${isSelected ? 'ring-4 ring-emerald-400 scale-105' : ''}
                            ${isFocused ? 'ring-2 ring-white' : ''}
                            ${isHovered && !isSelected ? 'shadow-lg shadow-emerald-400/20' : ''}
                            bg-slate-800/50 backdrop-blur
                          `}
                          onClick={() => !selectedCard && handleCardSelect(index)}
                          tabIndex={0}
                          role="button"
                          aria-label={`${card.label}: ${card.description}`}
                        >
                          <CardContent className="p-6 md:p-8 space-y-4">
                            <div className={`
                              w-14 h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center mx-auto transition-all
                              ${card.type === 'safe' ? 'bg-green-500/20' : ''}
                              ${card.type === 'risky' ? 'bg-amber-500/20' : ''}
                              ${card.type === 'very-risky' ? 'bg-red-500/20' : ''}
                              ${isHovered ? 'scale-110' : ''}
                            `}>
                              <Icon className={`
                                w-8 h-8 md:w-9 md:h-9
                                ${card.type === 'safe' ? 'text-green-400' : ''}
                                ${card.type === 'risky' ? 'text-amber-400' : ''}
                                ${card.type === 'very-risky' ? 'text-red-400' : ''}
                              `} />
                            </div>

                            <h3 className="text-lg md:text-xl font-bold text-white text-center">
                              {card.label}
                            </h3>

                            <p className="text-sm md:text-base text-slate-400 text-center">
                              {card.description}
                            </p>

                            {isSelected && (
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="flex items-center justify-center"
                              >
                                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                              </motion.div>
                            )}
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 md:p-8 text-center space-y-4"
                >
                  <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
                  <p className="text-lg md:text-xl text-slate-200 leading-relaxed">
                    {consequence}
                  </p>
                  <Button
                    onClick={completeTutorial}
                    size="lg"
                    className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600"
                  >
                    Start Real Assessment →
                  </Button>
                </motion.div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    );
  }

  if (gameStatus === 'paused') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full"
        >
          <Card className="bg-slate-900/80 border-slate-800 backdrop-blur shadow-2xl">
            <CardContent className="p-8 space-y-6 text-center">
              <div className="relative w-20 h-20 mx-auto">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full blur-xl opacity-50" />
                <div className="relative w-full h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center">
                  <Pause className="w-10 h-10 text-white" />
                </div>
              </div>

              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-white">Game Paused</h2>
                <p className="text-slate-400">Your progress is saved</p>
              </div>

              <div className="space-y-3">
                <Button
                  onClick={togglePause}
                  size="lg"
                  className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600"
                >
                  <Play className="w-5 h-5 mr-2" />
                  Resume Game
                </Button>
                <Button
                  onClick={restartGame}
                  variant="outline"
                  size="lg"
                  className="w-full border-slate-700 hover:bg-slate-800"
                >
                  <RotateCcw className="w-5 h-5 mr-2" />
                  Restart from Beginning
                </Button>
              </div>

              <div className="pt-4 border-t border-slate-800">
                <p className="text-sm text-slate-500">
                  Scenario {currentScenario + 1} of {gameScenarios.length} • Score: {score}
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  if (gameStatus === 'playing') {
    return (
      <div
        className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 md:p-8"
        onMouseMove={handleMouseMove}
        ref={gameContainerRef}
      >
        <div className="max-w-5xl mx-auto space-y-4 md:space-y-6">
          {/* Header with controls */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between gap-2"
          >
            <Button
              onClick={quickExit}
              variant="ghost"
              size="sm"
              className="text-slate-400 hover:text-white"
              aria-label="Quick exit to Google"
            >
              <X className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline">Quick Exit</span>
            </Button>

            <div className="flex items-center gap-2">
              <Button
                onClick={() => window.open('tel:0800-006-008', '_blank')}
                variant="outline"
                size="sm"
                className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                aria-label="National Problem Gambling Helpline"
              >
                <Phone className="w-4 h-4 mr-1" />
                <span className="hidden sm:inline">Helpline</span>
              </Button>

              <Button
                onClick={togglePause}
                variant="outline"
                size="sm"
                className="border-slate-700"
                aria-label="Pause game (ESC)"
              >
                <Pause className="w-4 h-4 mr-1" />
                <span className="hidden sm:inline">Pause</span>
              </Button>
            </div>
          </motion.div>

          {showProgress && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-900/50 rounded-xl p-4 backdrop-blur border border-slate-800/50 shadow-xl"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-400">Scenario {currentScenario + 1} of {gameScenarios.length}</span>
                <div className="flex items-center gap-3">
                  {currentScenario === 3 && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="flex items-center gap-1 text-amber-400 text-sm"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>Halfway there!</span>
                    </motion.div>
                  )}
                  {comboStreak >= 3 && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1, rotate: [0, 5, -5, 0] }}
                      transition={{ repeat: Infinity, duration: 2 }}
                      className="flex items-center gap-1 text-orange-400 text-sm"
                    >
                      <Flame className="w-4 h-4" />
                      <span>{comboStreak}x Streak!</span>
                    </motion.div>
                  )}
                  <span className="text-sm font-semibold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                    Score: {score}
                  </span>
                </div>
              </div>
              <Progress value={progress} className="h-2 bg-slate-800" />
            </motion.div>
          )}

          <AnimatePresence mode="wait">
            <motion.div
              key={currentScenario}
              initial={{ opacity: 0, x: reducedMotion ? 0 : 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: reducedMotion ? 0 : -50 }}
              className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 md:p-8 backdrop-blur shadow-2xl"
            >
              <div className="text-center space-y-3 md:space-y-4 mb-6 md:mb-8">
                <motion.h2
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-xl md:text-3xl font-bold text-white"
                >
                  {scenario.situation}
                </motion.h2>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className="text-base md:text-lg text-slate-300"
                >
                  {scenario.context}
                </motion.p>
              </div>

              {!showConsequence ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                    {scenario.cards.map((card, index) => {
                      const Icon = card.icon;
                      const isSelected = selectedCard === index;
                      const isHovered = hoveredCard === index;
                      const isFocused = focusedCardIndex === index;

                      return (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.1 }}
                          whileHover={reducedMotion ? {} : { scale: 1.05, y: -5 }}
                          whileTap={reducedMotion ? {} : { scale: 0.98 }}
                          onHoverStart={() => handleCardHoverStart(index)}
                          onHoverEnd={() => handleCardHoverEnd(index)}
                          onTouchStart={handleTouchStart}
                          onTouchEnd={(e) => handleTouchEnd(e, index)}
                          className="w-full"
                        >
                          <Card
                            className={`
                              cursor-pointer h-full transition-all duration-300 min-h-[44px]
                              ${highContrast ? 'border-2' : ''}
                              ${card.type === 'safe' ? `border-green-500/30 hover:border-green-500 ${highContrast ? 'border-green-500' : ''}` : ''}
                              ${card.type === 'risky' ? `border-amber-500/30 hover:border-amber-500 ${highContrast ? 'border-amber-500' : ''}` : ''}
                              ${card.type === 'very-risky' ? `border-red-500/30 hover:border-red-500 ${highContrast ? 'border-red-500' : ''}` : ''}
                              ${isSelected ? 'ring-4 ring-emerald-400 scale-105' : ''}
                              ${isFocused ? 'ring-2 ring-white' : ''}
                              ${isHovered && !isSelected ? 'shadow-lg shadow-emerald-400/20' : ''}
                              bg-slate-800/50 backdrop-blur
                            `}
                            onClick={() => !selectedCard && handleCardSelect(index)}
                            tabIndex={0}
                            role="button"
                            aria-label={`${card.label}: ${card.description}. Press ${index + 1} or Enter to select.`}
                          >
                            <CardContent className="p-6 md:p-8 space-y-4 min-h-[44px] touch-manipulation">
                              <div className={`
                                w-14 h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center mx-auto transition-all
                                ${card.type === 'safe' ? 'bg-green-500/20' : ''}
                                ${card.type === 'risky' ? 'bg-amber-500/20' : ''}
                                ${card.type === 'very-risky' ? 'bg-red-500/20' : ''}
                                ${isHovered ? 'scale-110' : ''}
                              `}>
                                <Icon className={`
                                  w-8 h-8 md:w-9 md:h-9
                                  ${card.type === 'safe' ? 'text-green-400' : ''}
                                  ${card.type === 'risky' ? 'text-amber-400' : ''}
                                  ${card.type === 'very-risky' ? 'text-red-400' : ''}
                                `} />
                              </div>

                              <div className="space-y-2">
                                <div className="flex items-center justify-center gap-2">
                                  <h3 className="text-lg md:text-xl font-bold text-white text-center">
                                    {card.label}
                                  </h3>
                                  <kbd className="hidden md:inline-block px-2 py-1 text-xs bg-slate-700/50 rounded text-slate-400">
                                    {index + 1}
                                  </kbd>
                                </div>

                                <p className="text-sm md:text-base text-slate-400 text-center">
                                  {card.description}
                                </p>
                              </div>

                              {isSelected && (
                                <motion.div
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  className="flex items-center justify-center"
                                >
                                  <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                                </motion.div>
                              )}
                            </CardContent>
                          </Card>
                        </motion.div>
                      );
                    })}
                  </div>

                  {/* Keyboard hint */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="text-center"
                  >
                    <p className="text-xs text-slate-500 flex items-center justify-center gap-2">
                      <Keyboard className="w-3 h-3" />
                      <span className="hidden md:inline">Use Arrow keys to navigate • Press 1-3 or Enter to select • ESC to pause</span>
                      <span className="md:hidden">Tap a card to select</span>
                    </p>
                  </motion.div>
                </>
              ) : (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 md:p-8 text-center"
                >
                  <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
                  <p className="text-lg md:text-xl text-slate-200 leading-relaxed">
                    {consequence}
                  </p>
                </motion.div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    );
  }

  // Export results as PDF
  const exportToPDF = async () => {
    const element = document.getElementById('results-container');
    if (!element) return;

    try {
      // Dynamically import html2pdf only on client side
      const html2pdf = (await import('html2pdf.js')).default;

      const opt = {
        margin: 0.5,
        filename: `NovaIQ-Results-${new Date().toISOString().split('T')[0]}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' as const }
      };

      html2pdf().set(opt).from(element).save();
      logTelemetry('results_exported_pdf', { score, riskIndex });
    } catch (error) {
      console.error('Failed to export PDF:', error);
    }
  };

  // Results/Completed state - Continue in next part...
  const safeChoices = decisions.filter(d => d.risk_type === 'safe').length;
  const riskyChoices = decisions.filter(d => d.risk_type === 'risky').length;
  const veryRiskyChoices = decisions.filter(d => d.risk_type === 'very-risky').length;
  const riskIndex = Math.max(0, Math.min(100,
    50 - (safeChoices * 8) + (riskyChoices * 3) + (veryRiskyChoices * 10)
  ));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-4xl w-full"
      >
        <Card className="bg-slate-900/80 border-slate-800 backdrop-blur shadow-2xl overflow-hidden">
          <CardContent id="results-container" className="p-0 space-y-0">
            {/* Report Header with Logo - Black Background */}
            <div className="bg-black px-6 md:px-12 py-6 border-b-4 border-brand-400 flex items-center justify-between">
              <div className="w-32 md:w-48">
                <img
                  src="/safebet-logo-transparent.png"
                  alt="SafeBet IQ"
                  className="w-full h-auto"
                />
              </div>
              <div className="text-right">
                <h3 className="text-sm md:text-lg font-bold text-brand-400">NovaIQ Wellbeing Assessment</h3>
                <p className="text-xs md:text-sm text-gray-400">Powered by SafeBet IQ</p>
              </div>
            </div>

            {/* Content Section */}
            <div className="p-6 md:p-12 space-y-6 md:space-y-8">
              {/* Header */}
              <div className="text-center space-y-4">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200 }}
                  className="relative w-20 h-20 md:w-24 md:h-24 mx-auto"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-amber-500 to-orange-500 rounded-full blur-2xl opacity-50 animate-pulse" />
                  <div className="relative w-full h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full flex items-center justify-center">
                    <Trophy className="w-10 h-10 md:w-12 md:h-12 text-white" />
                  </div>
                </motion.div>

                <h2 className="text-2xl md:text-4xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
                  Game Complete!
                </h2>
                <p className="text-base md:text-lg text-slate-300">
                  Here's your personal wellbeing profile
                </p>
              </div>

            {/* Balance Score */}
            <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-2xl p-6 md:p-8 space-y-4 border border-slate-700/50">
              <h3 className="text-lg md:text-xl font-semibold text-white text-center flex items-center justify-center gap-2">
                <Star className="w-5 h-5 text-amber-400" />
                Balance Score
              </h3>
              <div className="relative pt-6 pb-2">
                <div className="h-4 bg-slate-700/50 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${100 - riskIndex}%` }}
                    transition={{ duration: 1.5, delay: 0.5, ease: "easeOut" }}
                    className={`h-full rounded-full ${
                      riskIndex < 30 ? 'bg-gradient-to-r from-green-500 to-emerald-400' :
                      riskIndex < 60 ? 'bg-gradient-to-r from-amber-500 to-yellow-400' :
                      'bg-gradient-to-r from-red-500 to-orange-400'
                    }`}
                  />
                </div>
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 1.5 }}
                  className="text-center mt-6"
                >
                  <div className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
                    {100 - riskIndex}
                    <span className="text-2xl md:text-3xl text-slate-400">/100</span>
                  </div>
                  <p className="text-sm md:text-base text-slate-400 mt-3">
                    {riskIndex < 30 ? 'Excellent balance and control' :
                     riskIndex < 60 ? 'Good awareness with some risk areas' :
                     'Consider reviewing your gaming approach'}
                  </p>
                </motion.div>
              </div>
            </div>

            {/* Decision Breakdown */}
            <div className="grid grid-cols-3 gap-3 md:gap-4">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-green-500/10 border border-green-500/30 rounded-xl p-3 md:p-4 text-center"
              >
                <Shield className="w-6 h-6 md:w-8 md:h-8 text-green-400 mx-auto mb-2" />
                <div className="text-2xl md:text-3xl font-bold text-white">{safeChoices}</div>
                <div className="text-xs text-slate-400">Safe Choices</div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 md:p-4 text-center"
              >
                <AlertCircle className="w-6 h-6 md:w-8 md:h-8 text-amber-400 mx-auto mb-2" />
                <div className="text-2xl md:text-3xl font-bold text-white">{riskyChoices}</div>
                <div className="text-xs text-slate-400">Risky Choices</div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 md:p-4 text-center"
              >
                <Zap className="w-6 h-6 md:w-8 md:h-8 text-red-400 mx-auto mb-2" />
                <div className="text-2xl md:text-3xl font-bold text-white">{veryRiskyChoices}</div>
                <div className="text-xs text-slate-400">High Risk</div>
              </motion.div>
            </div>

            {/* Insights */}
            {insights.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="space-y-3"
              >
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Brain className="w-5 h-5 text-purple-400" />
                  Personal Insights
                </h3>
                <div className="space-y-2">
                  {insights.map((insight, index) => (
                    <div
                      key={index}
                      className={`p-4 rounded-lg border ${
                        insight.severity === 'info' ? 'bg-blue-500/10 border-blue-500/30' :
                        insight.severity === 'warning' ? 'bg-amber-500/10 border-amber-500/30' :
                        'bg-red-500/10 border-red-500/30'
                      }`}
                    >
                      <h4 className="font-semibold text-white mb-1">{insight.title}</h4>
                      <p className="text-sm text-slate-300">{insight.description}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Badges */}
            {earnedBadges.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7 }}
                className="space-y-3"
              >
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Award className="w-5 h-5 text-amber-400" />
                  Badges Earned
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {earnedBadges.map((badge, index) => (
                    <motion.div
                      key={index}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.8 + index * 0.1, type: "spring" }}
                      className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-lg p-4 text-center"
                    >
                      <div className="w-12 h-12 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
                        <Award className="w-6 h-6 text-amber-400" />
                      </div>
                      <h4 className="font-semibold text-white text-sm mb-1">{badge.name}</h4>
                      <p className="text-xs text-slate-400">{badge.description}</p>
                      <span className={`inline-block mt-2 px-2 py-1 rounded text-xs ${
                        badge.tier === 'bronze' ? 'bg-amber-900/30 text-amber-400' :
                        badge.tier === 'silver' ? 'bg-slate-700/50 text-slate-300' :
                        badge.tier === 'gold' ? 'bg-yellow-900/30 text-yellow-400' :
                        'bg-purple-900/30 text-purple-400'
                      }`}>
                        {badge.tier.toUpperCase()}
                      </span>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Educational Resources */}
            {educationalResources.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.9 }}
                className="space-y-3"
              >
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-teal-400" />
                  Helpful Resources
                </h3>
                <div className="space-y-2">
                  {educationalResources.slice(0, 3).map((resource, index) => (
                    <div
                      key={index}
                      className="p-4 bg-slate-800/50 border border-slate-700 rounded-lg hover:border-teal-500/50 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-teal-500/10 rounded-lg">
                          {resource.resource_type === 'helpline' ? <Phone className="w-4 h-4 text-teal-400" /> :
                           resource.resource_type === 'article' ? <BookOpen className="w-4 h-4 text-teal-400" /> :
                           <ExternalLink className="w-4 h-4 text-teal-400" />}
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-white text-sm mb-1">{resource.title}</h4>
                          <p className="text-xs text-slate-400">{resource.description}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={exportToPDF}
                variant="outline"
                className="flex-1 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
              >
                <Download className="w-4 h-4 mr-2" />
                Download PDF Report
              </Button>
              <Button
                onClick={restartGame}
                variant="outline"
                className="flex-1 border-slate-700"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Take Again
              </Button>
            </div>

            {/* Emergency Support */}
            <div className="bg-gradient-to-r from-red-500/10 to-orange-500/10 border border-red-500/30 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Phone className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-semibold text-white mb-1">Need Support?</h4>
                  <p className="text-sm text-slate-300 mb-2">
                    If you're concerned about your gambling, help is available 24/7.
                  </p>
                  <Button
                    onClick={() => window.open('tel:0800-006-008', '_blank')}
                    size="sm"
                    className="bg-red-500 hover:bg-red-600 text-white"
                  >
                    <Phone className="w-4 h-4 mr-2" />
                    Call National Helpline: 0800 006 008
                  </Button>
                </div>
              </div>
            </div>

            {/* Final Score */}
            <div className="text-center pt-4 border-t border-slate-800">
              <p className="text-sm text-slate-400 mb-2">Your Total Score</p>
              <p className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                {score} points
              </p>
              {comboStreak >= 3 && (
                <p className="text-sm text-orange-400 mt-2 flex items-center justify-center gap-1">
                  <Flame className="w-4 h-4" />
                  Achieved {comboStreak}x safe choice streak!
                </p>
              )}
            </div>

            {demoMode && (
              <div className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/30 rounded-lg p-4 text-center">
                <p className="text-sm text-emerald-400">
                  This was a demonstration. No data was saved.
                </p>
              </div>
            )}

            {!demoMode && (
              <div className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/30 rounded-lg p-4 text-center">
                <p className="text-sm text-emerald-400">
                  Your anonymous results have been recorded to support your wellbeing journey.
                </p>
              </div>
            )}

            {/* Report Footer */}
            <div className="pt-6 mt-6 border-t border-slate-800">
              <div className="text-center space-y-2">
                <p className="text-sm font-semibold text-brand-400">SafeBet IQ - NovaIQ Wellbeing Assessment</p>
                <p className="text-xs text-slate-400">AI-Powered Player Protection & Responsible Gaming Technology</p>
                <p className="text-xs text-slate-500">
                  Report generated: {new Date().toLocaleDateString('en-ZA', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
                <p className="text-xs text-slate-500 mt-2">
                  This assessment is confidential and designed to support your wellbeing journey.
                </p>
              </div>
            </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
