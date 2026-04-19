'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, RefreshCw, Trophy, Heart, Clock, Target } from 'lucide-react';

interface FallingObjectsGameProps {
  invitation?: any;
  demoMode?: boolean;
}

interface GameObject {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'coin' | 'bonus' | 'trap';
  speed: number;
  value: number;
}

interface TelemetryEvent {
  timestamp: number;
  eventType: string;
  data: any;
}

export default function FallingObjectsGame({ invitation, demoMode = false }: FallingObjectsGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();
  const sessionIdRef = useRef<string | null>(null);

  const [gameState, setGameState] = useState<'idle' | 'playing' | 'complete'>('idle');
  const [score, setScore] = useState(0);
  const [health, setHealth] = useState(100);
  const [timeRemaining, setTimeRemaining] = useState(120);
  const [playerX, setPlayerX] = useState(0);
  const [objects, setObjects] = useState<GameObject[]>([]);
  const [telemetry, setTelemetry] = useState<TelemetryEvent[]>([]);

  const gameConfigRef = useRef({
    canvasWidth: 800,
    canvasHeight: 600,
    playerWidth: 60,
    playerHeight: 60,
    gameDuration: 120,
    objectSpawnRate: 600,
    playerSpeed: 8,
  });

  const gameDataRef = useRef({
    objects: [] as GameObject[],
    playerX: 0,
    score: 0,
    health: 100,
    timeRemaining: 120,
    lastSpawnTime: 0,
    startTime: 0,
    objectIdCounter: 0,
    collectedCount: 0,
    trapHitCount: 0,
    riskyCollections: 0,
    reactionTimes: [] as number[],
    movementDeltas: [] as number[],
    lastPlayerX: 0,
    keys: { left: false, right: false },
  });

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const container = canvas.parentElement;
    if (!container) return;

    const containerWidth = container.clientWidth;
    const containerHeight = Math.min(containerWidth * 0.75, window.innerHeight * 0.7);

    canvas.width = containerWidth;
    canvas.height = containerHeight;

    gameConfigRef.current.canvasWidth = containerWidth;
    gameConfigRef.current.canvasHeight = containerHeight;

    if (gameDataRef.current.playerX === 0) {
      gameDataRef.current.playerX = containerWidth / 2;
      setPlayerX(containerWidth / 2);
    }
  }, []);

  useEffect(() => {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [resizeCanvas]);

  const trackTelemetry = useCallback((eventType: string, data: any) => {
    const event: TelemetryEvent = {
      timestamp: Date.now(),
      eventType,
      data,
    };

    setTelemetry(prev => [...prev, event]);

    if (!demoMode && sessionIdRef.current) {
      supabase.from('wellbeing_game_telemetry').insert({
        session_id: sessionIdRef.current,
        event_type: eventType,
        event_sequence: telemetry.length,
        event_timestamp: new Date().toISOString(),
        decision_speed_ms: data.reactionTime || null,
        risk_level_chosen: data.riskLevel || null,
        event_data: data,
      }).then();
    }
  }, [demoMode, telemetry.length]);

  const spawnObject = useCallback((currentTime: number) => {
    const config = gameConfigRef.current;
    const data = gameDataRef.current;

    if (currentTime - data.lastSpawnTime < config.objectSpawnRate) return;

    data.lastSpawnTime = currentTime;
    data.objectIdCounter += 1;

    const rand = Math.random();
    let type: 'coin' | 'bonus' | 'trap';
    let value: number;
    let speed: number;
    let width: number;
    let height: number;

    if (rand > 0.85) {
      type = 'bonus';
      value = 25;
      speed = 2.5;
      width = 40;
      height = 40;
    } else if (rand > 0.65) {
      type = 'trap';
      value = -15;
      speed = 3.5;
      width = 45;
      height = 45;
    } else {
      type = 'coin';
      value = 10;
      speed = 2.8;
      width = 35;
      height = 35;
    }

    const x = Math.random() * (config.canvasWidth - width - 40) + 20;

    const newObject: GameObject = {
      id: data.objectIdCounter,
      x,
      y: -height,
      width,
      height,
      type,
      speed,
      value,
    };

    data.objects.push(newObject);
  }, []);

  const checkCollision = useCallback((obj: GameObject) => {
    const config = gameConfigRef.current;
    const data = gameDataRef.current;

    const playerY = config.canvasHeight - config.playerHeight - 20;
    const playerLeft = data.playerX - config.playerWidth / 2;
    const playerRight = data.playerX + config.playerWidth / 2;
    const playerTop = playerY;
    const playerBottom = playerY + config.playerHeight;

    const objLeft = obj.x;
    const objRight = obj.x + obj.width;
    const objTop = obj.y;
    const objBottom = obj.y + obj.height;

    return (
      playerLeft < objRight &&
      playerRight > objLeft &&
      playerTop < objBottom &&
      playerBottom > objTop
    );
  }, []);

  const gameLoop = useCallback((currentTime: number) => {
    if (gameState !== 'playing') return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const config = gameConfigRef.current;
    const data = gameDataRef.current;

    if (data.startTime === 0) {
      data.startTime = currentTime;
    }

    const elapsed = (currentTime - data.startTime) / 1000;
    const timeLeft = Math.max(0, config.gameDuration - elapsed);
    data.timeRemaining = timeLeft;

    if (timeLeft <= 0 || data.health <= 0) {
      setGameState('complete');
      return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#1e293b');
    gradient.addColorStop(1, '#0f172a');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (data.keys.left) {
      data.playerX = Math.max(config.playerWidth / 2, data.playerX - config.playerSpeed);
      const delta = Math.abs(data.playerX - data.lastPlayerX);
      data.movementDeltas.push(delta);
      data.lastPlayerX = data.playerX;
    }
    if (data.keys.right) {
      data.playerX = Math.min(config.canvasWidth - config.playerWidth / 2, data.playerX + config.playerSpeed);
      const delta = Math.abs(data.playerX - data.lastPlayerX);
      data.movementDeltas.push(delta);
      data.lastPlayerX = data.playerX;
    }

    spawnObject(currentTime);

    for (let i = data.objects.length - 1; i >= 0; i--) {
      const obj = data.objects[i];
      obj.y += obj.speed;

      if (checkCollision(obj)) {
        const reactionTime = currentTime - data.lastSpawnTime;
        data.reactionTimes.push(reactionTime);

        if (obj.type === 'trap') {
          data.health = Math.max(0, data.health - 15);
          data.trapHitCount += 1;

          trackTelemetry('trap_collision', {
            health: data.health,
            position: obj.x,
            reactionTime,
          });

          if (navigator.vibrate) {
            navigator.vibrate(100);
          }
        } else {
          data.score += obj.value;
          data.collectedCount += 1;

          const nearbyTraps = data.objects.filter(
            o => o.type === 'trap' && Math.abs(o.x - obj.x) < 80 && Math.abs(o.y - obj.y) < 80
          );

          if (nearbyTraps.length > 0) {
            data.riskyCollections += 1;
          }

          trackTelemetry('object_collected', {
            type: obj.type,
            value: obj.value,
            score: data.score,
            nearbyTraps: nearbyTraps.length,
            reactionTime,
          });
        }

        data.objects.splice(i, 1);
        continue;
      }

      if (obj.y > canvas.height) {
        data.objects.splice(i, 1);
        continue;
      }

      if (obj.type === 'coin') {
        ctx.fillStyle = '#22c55e';
        ctx.shadowColor = '#22c55e';
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(obj.x + obj.width / 2, obj.y + obj.height / 2, obj.width / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      } else if (obj.type === 'bonus') {
        ctx.fillStyle = '#facc15';
        ctx.shadowColor = '#facc15';
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.arc(obj.x + obj.width / 2, obj.y + obj.height / 2, obj.width / 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('★', obj.x + obj.width / 2, obj.y + obj.height / 2);
        ctx.shadowBlur = 0;
      } else {
        ctx.fillStyle = '#ef4444';
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = 15;

        const centerX = obj.x + obj.width / 2;
        const centerY = obj.y + obj.height / 2;
        const size = obj.width / 2;

        ctx.beginPath();
        ctx.moveTo(centerX, centerY - size);
        ctx.lineTo(centerX - size * 0.8, centerY + size * 0.6);
        ctx.lineTo(centerX + size * 0.8, centerY + size * 0.6);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }

    const playerY = canvas.height - config.playerHeight - 20;
    const playerGradient = ctx.createRadialGradient(
      data.playerX, playerY + config.playerHeight / 2, 0,
      data.playerX, playerY + config.playerHeight / 2, config.playerWidth / 2
    );
    playerGradient.addColorStop(0, '#60a5fa');
    playerGradient.addColorStop(1, '#3b82f6');

    ctx.fillStyle = playerGradient;
    ctx.shadowColor = '#3b82f6';
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(data.playerX, playerY + config.playerHeight / 2, config.playerWidth / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    setScore(data.score);
    setHealth(data.health);
    setTimeRemaining(Math.ceil(timeLeft));
    setPlayerX(data.playerX);

    animationFrameRef.current = requestAnimationFrame(gameLoop);
  }, [gameState, spawnObject, checkCollision, trackTelemetry]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (gameState !== 'playing') return;

    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
      gameDataRef.current.keys.left = true;
      e.preventDefault();
    } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
      gameDataRef.current.keys.right = true;
      e.preventDefault();
    }
  }, [gameState]);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
      gameDataRef.current.keys.left = false;
    } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
      gameDataRef.current.keys.right = false;
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (gameState !== 'playing') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;

    gameDataRef.current.playerX = Math.max(
      gameConfigRef.current.playerWidth / 2,
      Math.min(gameConfigRef.current.canvasWidth - gameConfigRef.current.playerWidth / 2, x)
    );
  }, [gameState]);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    if (gameState !== 'playing') return;
    e.preventDefault();

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.touches[0].clientX - rect.left;

    gameDataRef.current.playerX = Math.max(
      gameConfigRef.current.playerWidth / 2,
      Math.min(gameConfigRef.current.canvasWidth - gameConfigRef.current.playerWidth / 2, x)
    );
  }, [gameState]);

  useEffect(() => {
    if (gameState === 'playing') {
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);
      animationFrameRef.current = requestAnimationFrame(gameLoop);

      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      };
    }
  }, [gameState, handleKeyDown, handleKeyUp, gameLoop]);

  const startGame = async () => {
    const config = gameConfigRef.current;
    gameDataRef.current = {
      objects: [],
      playerX: config.canvasWidth / 2,
      score: 0,
      health: 100,
      timeRemaining: config.gameDuration,
      lastSpawnTime: 0,
      startTime: 0,
      objectIdCounter: 0,
      collectedCount: 0,
      trapHitCount: 0,
      riskyCollections: 0,
      reactionTimes: [],
      movementDeltas: [],
      lastPlayerX: config.canvasWidth / 2,
      keys: { left: false, right: false },
    };

    setScore(0);
    setHealth(100);
    setTimeRemaining(config.gameDuration);
    setPlayerX(config.canvasWidth / 2);
    setObjects([]);
    setTelemetry([]);

    if (!demoMode && invitation) {
      const { data, error } = await supabase
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
        sessionIdRef.current = data.id;
      }
    }

    trackTelemetry('game_started', {
      deviceType: /mobile|android|iphone|ipad/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
      screenWidth: window.innerWidth,
      screenHeight: window.innerHeight,
    });

    setGameState('playing');
  };

  const endGame = async () => {
    const data = gameDataRef.current;

    const avgReactionTime = data.reactionTimes.length > 0
      ? data.reactionTimes.reduce((a, b) => a + b, 0) / data.reactionTimes.length
      : 0;

    const movementVariance = data.movementDeltas.length > 0
      ? Math.sqrt(data.movementDeltas.reduce((sum, delta) => sum + delta * delta, 0) / data.movementDeltas.length)
      : 0;

    const riskTakingScore = data.collectedCount > 0
      ? (data.riskyCollections / data.collectedCount) * 100
      : 0;

    trackTelemetry('game_completed', {
      finalScore: data.score,
      finalHealth: data.health,
      collectedCount: data.collectedCount,
      trapHitCount: data.trapHitCount,
      riskyCollections: data.riskyCollections,
      avgReactionTime,
      movementVariance,
      riskTakingScore,
    });

    if (!demoMode && sessionIdRef.current) {
      await supabase
        .from('wellbeing_game_sessions')
        .update({
          completed_at: new Date().toISOString(),
          duration_seconds: gameConfigRef.current.gameDuration - data.timeRemaining,
          completion_rate: 100,
          abandoned: false,
          raw_score: data.score,
        })
        .eq('id', sessionIdRef.current);

      try {
        await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/wellbeing-risk-calculator`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({ session_id: sessionIdRef.current }),
          }
        );
      } catch (error) {
        console.error('Risk calculation error:', error);
      }

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

    setGameState('complete');
  };

  const resetGame = () => {
    setGameState('idle');
    sessionIdRef.current = null;
  };

  useEffect(() => {
    if (gameState === 'complete') {
      endGame();
    }
  }, [gameState]);

  const calculateRiskProfile = () => {
    const data = gameDataRef.current;

    if (data.collectedCount === 0) return { risk: 'Low', color: 'text-green-400' };

    const riskRatio = data.riskyCollections / data.collectedCount;
    const avgReaction = data.reactionTimes.reduce((a, b) => a + b, 0) / data.reactionTimes.length;

    if (riskRatio > 0.6 || avgReaction < 400) {
      return { risk: 'Elevated', color: 'text-orange-400' };
    } else if (riskRatio > 0.3 || avgReaction < 600) {
      return { risk: 'Medium', color: 'text-yellow-400' };
    }

    return { risk: 'Low', color: 'text-green-400' };
  };

  return (
    <Card className="bg-gray-900 border-gray-800 overflow-hidden">
      <div className="p-0">
        {gameState === 'idle' && (
          <div className="bg-gradient-to-br from-blue-900/40 to-gray-900 p-4 md:p-6">
            <div className="max-w-lg mx-auto text-center">
              <div className="w-16 h-16 md:w-20 md:h-20 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-3 md:mb-4">
                <Target className="w-8 h-8 md:w-10 md:h-10 text-blue-400" />
              </div>
              <h3 className="text-2xl md:text-3xl font-bold text-white mb-2 md:mb-3">
                {demoMode ? 'Balance Challenge Demo' : 'Balance Challenge'}
              </h3>
              <p className="text-gray-300 mb-4 md:mb-6 text-sm md:text-base">
                Collect resources while avoiding obstacles. This 2-minute activity helps us understand your decision-making patterns.
              </p>

              <div className="grid grid-cols-3 gap-2 md:gap-3 mb-4 md:mb-6 max-w-md mx-auto">
                <div className="bg-gray-800/50 rounded-lg p-3">
                  <div className="w-10 h-10 bg-green-500 rounded-full mx-auto mb-2 flex items-center justify-center text-white font-bold text-sm">
                    ●
                  </div>
                  <p className="text-xs text-gray-400">Collect</p>
                  <p className="text-xs text-gray-500">+10 pts</p>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-3">
                  <div className="w-10 h-10 bg-yellow-400 rounded-full mx-auto mb-2 flex items-center justify-center text-white font-bold text-sm">
                    ★
                  </div>
                  <p className="text-xs text-gray-400">Bonus</p>
                  <p className="text-xs text-gray-500">+25 pts</p>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-3">
                  <div className="w-10 h-10 bg-red-500 rounded-full mx-auto mb-2 flex items-center justify-center text-white font-bold text-sm">
                    ▲
                  </div>
                  <p className="text-xs text-gray-400">Avoid</p>
                  <p className="text-xs text-gray-500">-15 hp</p>
                </div>
              </div>

              <div className="bg-gray-800/30 rounded-lg p-3 mb-4 max-w-lg mx-auto">
                <p className="text-xs md:text-sm text-gray-300 mb-2 font-semibold">Controls:</p>
                <div className="flex flex-col sm:flex-row justify-center gap-2 sm:gap-4 text-xs md:text-sm text-gray-400">
                  <div>Desktop: Arrow keys or mouse</div>
                  <div>Mobile: Touch screen</div>
                </div>
              </div>

              <Button
                size="lg"
                onClick={startGame}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold text-base md:text-lg px-6 py-5"
              >
                <Play className="w-5 h-5 mr-2" />
                Start Challenge
              </Button>

              {demoMode && (
                <p className="text-xs text-gray-500 mt-3">Demo Mode - No Data Collected</p>
              )}
            </div>
          </div>
        )}

        {gameState === 'playing' && (
          <div className="relative">
            <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/80 to-transparent p-2 md:p-3">
              <div className="flex justify-between items-center max-w-4xl mx-auto">
                <div className="flex gap-3 md:gap-4">
                  <div>
                    <div className="text-xs text-gray-400 mb-0.5">Score</div>
                    <div className="text-xl md:text-2xl font-bold text-blue-400">{score}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 mb-0.5">Time</div>
                    <div className="text-xl md:text-2xl font-bold text-white flex items-center">
                      <Clock className="w-4 h-4 md:w-5 md:h-5 mr-1" />
                      {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}
                    </div>
                  </div>
                </div>
                <div className="w-32 md:w-48">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-400 flex items-center">
                      <Heart className="w-3 h-3 md:w-4 md:h-4 mr-1" />
                      <span className="hidden sm:inline">Health</span>
                    </span>
                    <span className="text-white font-semibold">{health}</span>
                  </div>
                  <Progress value={health} className="h-2 md:h-3" />
                </div>
              </div>
            </div>

            <canvas
              ref={canvasRef}
              onMouseMove={handleMouseMove}
              onTouchMove={handleTouchMove}
              className="w-full cursor-none touch-none"
              style={{ maxHeight: '70vh' }}
            />
          </div>
        )}

        {gameState === 'complete' && (
          <div className="bg-gradient-to-br from-blue-900/40 to-gray-900 p-4 md:p-6">
            <div className="max-w-lg mx-auto text-center">
              <Trophy className="w-16 h-16 md:w-20 md:h-20 text-yellow-400 mx-auto mb-4 md:mb-6" />
              <h3 className="text-2xl md:text-3xl font-bold text-white mb-2 md:mb-3">Challenge Complete!</h3>
              <p className="text-3xl md:text-4xl font-bold text-blue-400 mb-4 md:mb-6">{score} Points</p>

              {!demoMode && (
                <div className="bg-gray-800 rounded-lg p-4 md:p-6 mb-4 md:mb-6 text-left max-w-md mx-auto border border-gray-700">
                  <h4 className="text-white font-semibold mb-3 md:mb-4 text-center text-sm md:text-base">Activity Summary</h4>
                  <div className="space-y-2 md:space-y-3 text-xs md:text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Collected:</span>
                      <span className="text-white font-semibold">{gameDataRef.current.collectedCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Decision Pattern:</span>
                      <span className={`font-semibold ${calculateRiskProfile().color}`}>
                        {calculateRiskProfile().risk}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Final Health:</span>
                      <span className="text-white font-semibold">{health}%</span>
                    </div>
                  </div>

                  <div className="mt-4 md:mt-6 pt-4 md:pt-6 border-t border-gray-700">
                    <p className="text-gray-300 text-xs md:text-sm leading-relaxed">
                      Thanks for participating. Your gameplay helps us provide better support for balanced play.
                    </p>
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 md:gap-4 justify-center">
                <Button
                  size="lg"
                  onClick={resetGame}
                  className="w-full sm:w-auto bg-blue-500 hover:bg-blue-600 text-white font-semibold px-6 py-5"
                >
                  <RefreshCw className="w-5 h-5 mr-2" />
                  Play Again
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
