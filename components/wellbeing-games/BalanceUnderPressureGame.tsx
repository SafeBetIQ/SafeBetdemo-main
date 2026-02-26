'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface BalanceUnderPressureGameProps {
  invitation?: any;
  demoMode?: boolean;
  onGameComplete?: (data: GameCompletionData) => void;
}

interface GameCompletionData {
  duration_seconds: number;
  completion_rate: number;
  behaviour_risk_index: number;
  telemetry: TelemetryEvent[];
}

interface TelemetryEvent {
  event_type: string;
  event_timestamp: string;
  event_sequence: number;
  event_data: Record<string, any>;
  decision_speed_ms?: number;
  risk_level_chosen?: 'low' | 'medium' | 'high' | 'none';
}

interface SystemState {
  balance: number;
  velocity: number;
  pressure: number;
  stability: number;
}

export default function BalanceUnderPressureGame({
  invitation,
  demoMode = false,
  onGameComplete,
}: BalanceUnderPressureGameProps) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const gameStateRef = useRef<{
    startTime: number;
    gameTime: number;
    isRunning: boolean;
    isPaused: boolean;
    system: SystemState;
    targetBalance: number;
    actions: Array<{ type: string; timestamp: number; intensity: number }>;
    telemetry: TelemetryEvent[];
    eventSequence: number;
    lastActionTime: number;
    pressureIncreaseRate: number;
    particles: Array<{ x: number; y: number; vx: number; vy: number; alpha: number; color: string }>;
    stabilityHistory: number[];
    overCorrectionCount: number;
    totalCorrections: number;
  }>({
    startTime: Date.now(),
    gameTime: 0,
    isRunning: true,
    isPaused: false,
    system: {
      balance: 50,
      velocity: 0,
      pressure: 10,
      stability: 100,
    },
    targetBalance: 50,
    actions: [],
    telemetry: [],
    eventSequence: 0,
    lastActionTime: 0,
    pressureIncreaseRate: 0.5,
    particles: [],
    stabilityHistory: [100],
    overCorrectionCount: 0,
    totalCorrections: 0,
  });

  const [gameStatus, setGameStatus] = useState<'playing' | 'completed'>('playing');
  const [showInstructions, setShowInstructions] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const [currentAction, setCurrentAction] = useState<string>('');

  useEffect(() => {
    setIsMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
  }, []);

  const recordTelemetry = useCallback((
    eventType: string,
    eventData: Record<string, any>,
    decisionSpeedMs?: number,
    riskLevel?: 'low' | 'medium' | 'high' | 'none'
  ) => {
    if (demoMode) return;

    const state = gameStateRef.current;
    const telemetryEvent: TelemetryEvent = {
      event_type: eventType,
      event_timestamp: new Date().toISOString(),
      event_sequence: state.eventSequence++,
      event_data: {
        ...eventData,
        game_time: state.gameTime,
        system_state: { ...state.system },
      },
      decision_speed_ms: decisionSpeedMs,
      risk_level_chosen: riskLevel,
    };

    state.telemetry.push(telemetryEvent);
  }, [demoMode]);

  const applyAction = useCallback((actionType: 'gentle' | 'strong' | 'pause', intensity: number) => {
    const state = gameStateRef.current;
    const now = Date.now();
    const timeSinceLastAction = state.lastActionTime ? now - state.lastActionTime : 0;

    recordTelemetry('action_taken', {
      action_type: actionType,
      intensity,
      time_since_last: timeSinceLastAction,
      balance: state.system.balance,
      pressure: state.system.pressure,
      stability: state.system.stability,
    }, timeSinceLastAction);

    state.actions.push({
      type: actionType,
      timestamp: now,
      intensity,
    });
    state.lastActionTime = now;

    if (actionType === 'gentle') {
      const correction = (state.targetBalance - state.system.balance) * 0.15;
      state.system.velocity += correction;
      setCurrentAction('Gentle Stabilize');

      for (let i = 0; i < 5; i++) {
        state.particles.push({
          x: 400,
          y: 300,
          vx: (Math.random() - 0.5) * 2,
          vy: (Math.random() - 0.5) * 2,
          alpha: 0.6,
          color: 'rgba(100, 200, 255, ',
        });
      }
    } else if (actionType === 'strong') {
      const correction = (state.targetBalance - state.system.balance) * 0.4;
      state.system.velocity += correction;
      state.totalCorrections++;

      const prevBalance = state.stabilityHistory[state.stabilityHistory.length - 1] || 100;
      if (Math.abs(correction) > 20 && state.system.stability < prevBalance) {
        state.overCorrectionCount++;
        recordTelemetry('overcorrection_detected', {
          correction_magnitude: Math.abs(correction),
          stability_loss: prevBalance - state.system.stability,
        });
      }

      setCurrentAction('Strong Stabilize');

      for (let i = 0; i < 12; i++) {
        state.particles.push({
          x: 400,
          y: 300,
          vx: (Math.random() - 0.5) * 6,
          vy: (Math.random() - 0.5) * 6,
          alpha: 0.9,
          color: 'rgba(255, 180, 100, ',
        });
      }
    } else if (actionType === 'pause') {
      setCurrentAction('Observing...');
      recordTelemetry('pause_observe', {
        duration: intensity,
        balance: state.system.balance,
      });
    }

    setTimeout(() => setCurrentAction(''), 800);
  }, [recordTelemetry]);

  const handleKeyPress = useCallback((e: KeyboardEvent) => {
    if (!gameStateRef.current.isRunning || gameStateRef.current.isPaused) return;

    switch (e.key) {
      case 'ArrowUp':
      case 'w':
      case 'W':
        applyAction('gentle', 1);
        break;
      case 'ArrowDown':
      case 's':
      case 'S':
        applyAction('strong', 2);
        break;
      case ' ':
        e.preventDefault();
        applyAction('pause', 0);
        break;
    }
  }, [applyAction]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    setTouchStartY(touch.clientY);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (touchStartY === null || !gameStateRef.current.isRunning) return;

    const touch = e.touches[0];
    const deltaY = touchStartY - touch.clientY;

    if (Math.abs(deltaY) > 30) {
      if (deltaY > 0) {
        applyAction('gentle', 1);
      } else {
        applyAction('strong', 2);
      }
      setTouchStartY(touch.clientY);
    }
  }, [touchStartY, applyAction]);

  const handleTouchEnd = useCallback(() => {
    setTouchStartY(null);
  }, []);

  const updateGameState = useCallback(() => {
    const state = gameStateRef.current;
    if (!state.isRunning || state.isPaused) return;

    const deltaTime = 1 / 60;
    state.gameTime += deltaTime;

    state.system.pressure += state.pressureIncreaseRate * deltaTime;
    if (state.system.pressure > 100) state.system.pressure = 100;

    const pressureEffect = (Math.random() - 0.5) * (state.system.pressure / 10);
    state.system.velocity += pressureEffect;

    state.system.balance += state.system.velocity * deltaTime;
    state.system.velocity *= 0.92;

    if (state.system.balance < 0) {
      state.system.balance = 0;
      state.system.velocity *= -0.5;
    }
    if (state.system.balance > 100) {
      state.system.balance = 100;
      state.system.velocity *= -0.5;
    }

    const deviation = Math.abs(state.system.balance - state.targetBalance);
    const targetStability = Math.max(0, 100 - deviation * 2);
    state.system.stability += (targetStability - state.system.stability) * 0.05;
    state.stabilityHistory.push(state.system.stability);
    if (state.stabilityHistory.length > 300) state.stabilityHistory.shift();

    state.particles = state.particles.filter((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= 0.02;
      return p.alpha > 0;
    });

    if (Math.random() < 0.005) {
      const oldTarget = state.targetBalance;
      state.targetBalance = 30 + Math.random() * 40;
      recordTelemetry('target_shifted', {
        old_target: oldTarget,
        new_target: state.targetBalance,
      });
    }

    if (state.gameTime >= 150) {
      state.isRunning = false;
      completeGame();
    }
  }, [recordTelemetry]);

  const startGame = useCallback(async () => {
    if (!demoMode && invitation && !sessionId) {
      const { data } = await supabase
        .from('wellbeing_game_sessions')
        .insert({
          invitation_id: invitation.id,
          player_id: invitation.player_id,
          game_concept_id: invitation.game_concept_id,
          casino_id: invitation.casino_id,
          started_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (data) {
        setSessionId(data.id);
      }
    }

    gameStateRef.current.startTime = Date.now();
  }, [demoMode, invitation, sessionId]);

  const completeGame = useCallback(async () => {
    const state = gameStateRef.current;
    setGameStatus('completed');

    const durationSeconds = Math.floor(state.gameTime);
    const avgStability = state.stabilityHistory.reduce((a, b) => a + b, 0) / state.stabilityHistory.length;
    const completionRate = 100;

    const actionCount = state.actions.length;
    const actionFrequency = actionCount / (durationSeconds / 60);
    const overcorrectionRate = state.totalCorrections > 0 ? (state.overCorrectionCount / state.totalCorrections) * 100 : 0;

    const patienceScore = Math.max(0, 100 - (actionFrequency * 5));

    let rapidActionCount = 0;
    for (let i = 1; i < state.actions.length; i++) {
      if (state.actions[i].timestamp - state.actions[i - 1].timestamp < 1000) {
        rapidActionCount++;
      }
    }
    const impulsivityScore = Math.min(100, (rapidActionCount / actionCount) * 200);

    const behaviourRiskIndex = (
      impulsivityScore * 0.35 +
      overcorrectionRate * 0.35 +
      (100 - patienceScore) * 0.20 +
      (100 - Math.min(100, avgStability)) * 0.10
    );

    recordTelemetry('game_completed', {
      duration_seconds: durationSeconds,
      completion_rate: completionRate,
      action_count: actionCount,
      action_frequency: actionFrequency,
      overcorrection_rate: overcorrectionRate,
      patience_score: patienceScore,
      impulsivity_score: impulsivityScore,
      avg_stability: avgStability,
      behaviour_risk_index: behaviourRiskIndex,
    });

    const completionData: GameCompletionData = {
      duration_seconds: durationSeconds,
      completion_rate: completionRate,
      behaviour_risk_index: behaviourRiskIndex,
      telemetry: state.telemetry,
    };

    if (!demoMode && sessionId) {
      await supabase
        .from('wellbeing_game_sessions')
        .update({
          completed_at: new Date().toISOString(),
          duration_seconds: durationSeconds,
          completion_rate: completionRate,
          behaviour_risk_index: behaviourRiskIndex,
        })
        .eq('id', sessionId);

      if (state.telemetry.length > 0) {
        await supabase
          .from('wellbeing_game_telemetry')
          .insert(
            state.telemetry.map((t) => ({
              session_id: sessionId,
              ...t,
            }))
          );
      }

      await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/wellbeing-risk-calculator`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ session_id: sessionId }),
        }
      );

      if (invitation) {
        await supabase
          .from('wellbeing_game_invitations')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
          })
          .eq('id', invitation.id);
      }
    }

    onGameComplete?.(completionData);
  }, [demoMode, sessionId, onGameComplete, recordTelemetry, invitation]);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const state = gameStateRef.current;

    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#0f172a');
    gradient.addColorStop(1, '#1e293b');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = 'rgba(100, 116, 139, 0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i < canvas.height; i += 40) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(canvas.width, i);
      ctx.stroke();
    }

    state.particles.forEach((p) => {
      ctx.fillStyle = p.color + p.alpha + ')';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    const barX = canvas.width / 2 - 40;
    const barY = 100;
    const barWidth = 80;
    const barHeight = 400;

    ctx.fillStyle = 'rgba(30, 41, 59, 0.8)';
    ctx.roundRect(barX, barY, barWidth, barHeight, 8);
    ctx.fill();

    const targetY = barY + barHeight - (state.targetBalance / 100) * barHeight;
    const targetZoneHeight = 40;
    const targetGradient = ctx.createRadialGradient(
      barX + barWidth / 2,
      targetY,
      0,
      barX + barWidth / 2,
      targetY,
      60
    );
    targetGradient.addColorStop(0, 'rgba(100, 200, 255, 0.3)');
    targetGradient.addColorStop(1, 'rgba(100, 200, 255, 0)');
    ctx.fillStyle = targetGradient;
    ctx.fillRect(barX - 20, targetY - targetZoneHeight / 2, barWidth + 40, targetZoneHeight);

    const balanceY = barY + barHeight - (state.system.balance / 100) * barHeight;
    const balanceGradient = ctx.createLinearGradient(barX, balanceY, barX + barWidth, balanceY);

    const deviation = Math.abs(state.system.balance - state.targetBalance);
    if (deviation < 10) {
      balanceGradient.addColorStop(0, 'rgba(100, 255, 200, 0.9)');
      balanceGradient.addColorStop(1, 'rgba(100, 255, 200, 0.6)');
    } else if (deviation < 25) {
      balanceGradient.addColorStop(0, 'rgba(100, 200, 255, 0.9)');
      balanceGradient.addColorStop(1, 'rgba(100, 200, 255, 0.6)');
    } else {
      balanceGradient.addColorStop(0, 'rgba(255, 180, 100, 0.9)');
      balanceGradient.addColorStop(1, 'rgba(255, 180, 100, 0.6)');
    }

    ctx.fillStyle = balanceGradient;
    const fillHeight = (state.system.balance / 100) * barHeight;
    ctx.roundRect(barX, barY + barHeight - fillHeight, barWidth, fillHeight, 8);
    ctx.fill();

    ctx.shadowColor = deviation < 10 ? '#64ffc8' : deviation < 25 ? '#64c8ff' : '#ffb464';
    ctx.shadowBlur = 20;
    ctx.strokeStyle = deviation < 10 ? '#64ffc8' : deviation < 25 ? '#64c8ff' : '#ffb464';
    ctx.lineWidth = 2;
    ctx.roundRect(barX, barY + barHeight - fillHeight, barWidth, fillHeight, 8);
    ctx.stroke();
    ctx.shadowBlur = 0;

    const metricsX = canvas.width / 2 + 80;
    ctx.font = '14px Inter, system-ui, sans-serif';
    ctx.fillStyle = 'rgba(148, 163, 184, 0.8)';
    ctx.fillText('SYSTEM METRICS', metricsX, 120);

    ctx.fillStyle = 'rgba(226, 232, 240, 0.9)';
    ctx.font = '12px Inter, system-ui, sans-serif';
    ctx.fillText('Pressure', metricsX, 150);

    const pressureBarWidth = 200;
    ctx.fillStyle = 'rgba(30, 41, 59, 0.6)';
    ctx.fillRect(metricsX, 160, pressureBarWidth, 8);

    const pressureGradient = ctx.createLinearGradient(metricsX, 160, metricsX + pressureBarWidth, 160);
    pressureGradient.addColorStop(0, 'rgba(100, 200, 255, 0.8)');
    pressureGradient.addColorStop(1, 'rgba(255, 100, 100, 0.8)');
    ctx.fillStyle = pressureGradient;
    ctx.fillRect(metricsX, 160, (state.system.pressure / 100) * pressureBarWidth, 8);

    ctx.fillStyle = 'rgba(226, 232, 240, 0.9)';
    ctx.fillText('Stability', metricsX, 200);

    ctx.fillStyle = 'rgba(30, 41, 59, 0.6)';
    ctx.fillRect(metricsX, 210, pressureBarWidth, 8);

    const stabilityColor = state.system.stability > 70 ? 'rgba(100, 255, 200, 0.8)' :
                           state.system.stability > 40 ? 'rgba(255, 200, 100, 0.8)' :
                           'rgba(255, 100, 100, 0.8)';
    ctx.fillStyle = stabilityColor;
    ctx.fillRect(metricsX, 210, (state.system.stability / 100) * pressureBarWidth, 8);

    const timeRemaining = Math.max(0, 150 - state.gameTime);
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = Math.floor(timeRemaining % 60);
    ctx.fillStyle = 'rgba(226, 232, 240, 0.9)';
    ctx.fillText('Time', metricsX, 250);
    ctx.font = '24px Inter, system-ui, sans-serif';
    ctx.fillText(`${minutes}:${seconds.toString().padStart(2, '0')}`, metricsX, 280);

    ctx.font = '12px Inter, system-ui, sans-serif';
    ctx.fillText(`Actions: ${state.actions.length}`, metricsX, 320);

    if (currentAction) {
      ctx.font = '16px Inter, system-ui, sans-serif';
      ctx.fillStyle = 'rgba(100, 200, 255, 0.9)';
      ctx.fillText(currentAction, metricsX, 360);
    }

    if (demoMode) {
      ctx.fillStyle = 'rgba(255, 200, 100, 0.15)';
      ctx.fillRect(0, canvas.height - 40, canvas.width, 40);

      ctx.font = '14px Inter, system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255, 200, 100, 0.9)';
      ctx.textAlign = 'center';
      ctx.fillText('Demonstration Experience – No Player Data Collected', canvas.width / 2, canvas.height - 15);
      ctx.textAlign = 'left';
    }
  }, [currentAction, demoMode]);

  const gameLoop = useCallback(() => {
    updateGameState();
    render();

    if (gameStateRef.current.isRunning) {
      animationRef.current = requestAnimationFrame(gameLoop);
    }
  }, [updateGameState, render]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = 800;
    canvas.height = 600;

    recordTelemetry('game_started', {
      demo_mode: demoMode,
      device_type: isMobile ? 'mobile' : 'desktop',
      screen_width: window.innerWidth,
      screen_height: window.innerHeight,
    });

    window.addEventListener('keydown', handleKeyPress);
    animationRef.current = requestAnimationFrame(gameLoop);

    return () => {
      window.removeEventListener('keydown', handleKeyPress);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [demoMode, isMobile, handleKeyPress, gameLoop, recordTelemetry]);

  if (gameStatus === 'completed') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] md:min-h-[600px] bg-gradient-to-b from-slate-900 to-slate-800 rounded-lg p-4 md:p-8">
        <div className="text-center space-y-4 md:space-y-6 max-w-md">
          <div className="w-16 h-16 md:w-20 md:h-20 mx-auto bg-cyan-500/20 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 md:w-10 md:h-10 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h2 className="text-xl md:text-2xl font-semibold text-slate-100">Experience Complete</h2>

          <p className="text-sm md:text-base text-slate-300 leading-relaxed">
            Thank you for participating in this behavioral reflection experience.
            {!demoMode && ' Your anonymous behavioral patterns have been recorded for compliance purposes only.'}
          </p>

          {demoMode && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 md:p-4">
              <p className="text-xs md:text-sm text-amber-200">
                This was a demonstration. No data was collected.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center space-y-4">
      {showInstructions && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 md:p-6 max-w-lg mb-4">
          <h3 className="text-base md:text-lg font-semibold text-slate-100 mb-2 md:mb-3">Balance Under Pressure</h3>
          <p className="text-slate-300 text-xs md:text-sm mb-3 md:mb-4">
            Maintain system stability as pressure increases. There is no score, no winning, no failing.
            This is about judgment and restraint.
          </p>

          <div className="space-y-2 text-xs md:text-sm text-slate-300 mb-3 md:mb-4">
            <div className="flex items-center space-x-2 md:space-x-3">
              <kbd className="px-2 py-1 bg-slate-700 rounded text-xs">↑ or W</kbd>
              <span>Gentle stabilize</span>
            </div>
            <div className="flex items-center space-x-2 md:space-x-3">
              <kbd className="px-2 py-1 bg-slate-700 rounded text-xs">↓ or S</kbd>
              <span>Strong stabilize</span>
            </div>
            <div className="flex items-center space-x-2 md:space-x-3">
              <kbd className="px-2 py-1 bg-slate-700 rounded text-xs">Space</kbd>
              <span>Pause and observe</span>
            </div>
            {isMobile && (
              <div className="flex items-center space-x-2 md:space-x-3">
                <kbd className="px-2 py-1 bg-slate-700 rounded text-xs">Swipe</kbd>
                <span>Up for gentle, down for strong</span>
              </div>
            )}
          </div>

          <button
            onClick={() => {
              setShowInstructions(false);
              startGame();
            }}
            className="w-full bg-cyan-600 hover:bg-cyan-500 text-white py-2 md:py-2.5 rounded-lg transition-colors text-sm md:text-base"
          >
            Begin Experience
          </button>
        </div>
      )}

      <canvas
        ref={canvasRef}
        className="rounded-lg shadow-2xl border border-slate-700"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ maxWidth: '100%', height: 'auto' }}
      />
    </div>
  );
}
