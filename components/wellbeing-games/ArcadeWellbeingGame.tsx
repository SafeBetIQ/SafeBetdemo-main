'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { Play, RefreshCw, Zap, Star, Trophy } from 'lucide-react';

interface ArcadeWellbeingGameProps {
  invitation?: any;
  demoMode?: boolean;
}

interface GameObject {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
  type: 'energy' | 'star' | 'hazard';
  value: number;
  angle: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
}

export default function ArcadeWellbeingGame({ invitation, demoMode = false }: ArcadeWellbeingGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameLoopRef = useRef<number | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  const [gameState, setGameState] = useState<'menu' | 'playing' | 'complete'>('menu');
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [timeLeft, setTimeLeft] = useState(120);

  const gameRef = useRef({
    canvas: null as HTMLCanvasElement | null,
    ctx: null as CanvasRenderingContext2D | null,

    player: {
      x: 0,
      y: 0,
      width: 60,
      height: 60,
      speed: 8,
      targetX: 0,
    },

    objects: [] as GameObject[],
    particles: [] as Particle[],

    score: 0,
    combo: 0,
    comboTimer: 0,
    maxCombo: 0,

    gameTime: 0,
    startTime: 0,
    spawnTimer: 0,
    spawnInterval: 1000,

    objectIdCounter: 0,
    collectedCount: 0,
    hazardHits: 0,
    riskyMoves: 0,

    telemetry: [] as any[],

    keys: {
      left: false,
      right: false,
    },

    difficulty: 1,

    isRunning: false,
  });

  const initGame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const container = canvas.parentElement;
    if (!container) return;

    const width = Math.min(container.clientWidth, 800);
    const height = Math.min(width * 0.75, window.innerHeight * 0.7);

    canvas.width = width;
    canvas.height = height;

    gameRef.current.canvas = canvas;
    gameRef.current.ctx = ctx;

    gameRef.current.player.x = width / 2;
    gameRef.current.player.y = height - 80;
    gameRef.current.player.targetX = width / 2;

    gameRef.current.objects = [];
    gameRef.current.particles = [];
    gameRef.current.score = 0;
    gameRef.current.combo = 0;
    gameRef.current.comboTimer = 0;
    gameRef.current.maxCombo = 0;
    gameRef.current.gameTime = 0;
    gameRef.current.startTime = Date.now();
    gameRef.current.spawnTimer = 0;
    gameRef.current.objectIdCounter = 0;
    gameRef.current.collectedCount = 0;
    gameRef.current.hazardHits = 0;
    gameRef.current.riskyMoves = 0;
    gameRef.current.difficulty = 1;
    gameRef.current.telemetry = [];

    setScore(0);
    setCombo(0);
    setTimeLeft(120);
  }, []);

  const spawnObject = useCallback(() => {
    const game = gameRef.current;
    if (!game.canvas) return;

    const canvas = game.canvas;
    const currentTime = Date.now() - game.startTime;

    game.difficulty = 1 + (currentTime / 60000) * 1.5;

    const rand = Math.random();
    let type: 'energy' | 'star' | 'hazard';
    let value: number;
    let speed: number;
    let size: number;

    if (rand > 0.92) {
      type = 'star';
      value = 50;
      speed = 2.5 + game.difficulty * 0.5;
      size = 40;
    } else if (rand > 0.7) {
      type = 'hazard';
      value = 0;
      speed = 3 + game.difficulty * 0.8;
      size = 45;
    } else {
      type = 'energy';
      value = 10;
      speed = 2 + game.difficulty * 0.5;
      size = 35;
    }

    const obj: GameObject = {
      id: game.objectIdCounter++,
      x: Math.random() * (canvas.width - size - 40) + 20,
      y: -size,
      width: size,
      height: size,
      speed: speed,
      type: type,
      value: value,
      angle: 0,
    };

    game.objects.push(obj);
  }, []);

  const createParticles = useCallback((x: number, y: number, color: string, count: number) => {
    const game = gameRef.current;

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const speed = 2 + Math.random() * 4;

      game.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1,
        life: 1.0,
        color,
        size: 3 + Math.random() * 4,
      });
    }
  }, []);

  const checkCollision = useCallback((obj: GameObject): boolean => {
    const game = gameRef.current;
    const player = game.player;

    const playerRadius = player.width / 2;
    const objRadius = obj.width / 2;

    const dx = (player.x) - (obj.x + obj.width / 2);
    const dy = (player.y) - (obj.y + obj.height / 2);
    const distance = Math.sqrt(dx * dx + dy * dy);

    return distance < (playerRadius + objRadius) * 0.8;
  }, []);

  const handleCollision = useCallback((obj: GameObject) => {
    const game = gameRef.current;

    if (obj.type === 'hazard') {
      game.combo = 0;
      game.comboTimer = 0;
      game.hazardHits++;

      createParticles(obj.x + obj.width / 2, obj.y + obj.height / 2, '#ef4444', 15);

      if (!demoMode) {
        game.telemetry.push({
          type: 'hazard_collision',
          time: Date.now() - game.startTime,
          position: { x: obj.x, y: obj.y },
          difficulty: game.difficulty,
        });
      }

      if (navigator.vibrate) {
        navigator.vibrate(100);
      }
    } else {
      const baseScore = obj.value;
      const comboBonus = game.combo > 0 ? Math.floor(baseScore * game.combo * 0.15) : 0;
      const finalScore = baseScore + comboBonus;

      game.score += finalScore;
      game.combo++;
      game.comboTimer = Date.now();
      game.collectedCount++;

      if (game.combo > game.maxCombo) {
        game.maxCombo = game.combo;
      }

      const color = obj.type === 'star' ? '#fbbf24' : '#10b981';
      createParticles(obj.x + obj.width / 2, obj.y + obj.height / 2, color, 20);

      const nearbyHazards = game.objects.filter(
        o => o.type === 'hazard' &&
             Math.abs(o.x - obj.x) < 120 &&
             Math.abs(o.y - obj.y) < 150
      );

      if (nearbyHazards.length > 0) {
        game.riskyMoves++;
      }

      if (!demoMode) {
        game.telemetry.push({
          type: 'object_collected',
          objectType: obj.type,
          time: Date.now() - game.startTime,
          score: finalScore,
          combo: game.combo,
          nearbyHazards: nearbyHazards.length,
          difficulty: game.difficulty,
        });
      }
    }
  }, [createParticles, demoMode]);

  const updateGame = useCallback(() => {
    const game = gameRef.current;
    const canvas = game.canvas;
    const ctx = game.ctx;

    if (!canvas || !ctx || !game.isRunning) return;

    const currentTime = Date.now() - game.startTime;
    game.gameTime = currentTime;

    const timeRemaining = Math.max(0, 120 - Math.floor(currentTime / 1000));
    setTimeLeft(timeRemaining);

    if (timeRemaining <= 0) {
      game.isRunning = false;
      setGameState('complete');
      return;
    }

    if (game.keys.left) {
      game.player.targetX -= game.player.speed;
    }
    if (game.keys.right) {
      game.player.targetX += game.player.speed;
    }

    game.player.targetX = Math.max(game.player.width / 2, Math.min(canvas.width - game.player.width / 2, game.player.targetX));

    game.player.x += (game.player.targetX - game.player.x) * 0.2;

    if (currentTime - game.spawnTimer > game.spawnInterval) {
      spawnObject();
      game.spawnTimer = currentTime;
      game.spawnInterval = Math.max(400, 1000 - game.difficulty * 100);
    }

    for (let i = game.objects.length - 1; i >= 0; i--) {
      const obj = game.objects[i];
      obj.y += obj.speed;
      obj.angle += 0.05;

      if (checkCollision(obj)) {
        handleCollision(obj);
        game.objects.splice(i, 1);
        continue;
      }

      if (obj.y > canvas.height + 50) {
        game.objects.splice(i, 1);
      }
    }

    for (let i = game.particles.length - 1; i >= 0; i--) {
      const p = game.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.2;
      p.life -= 0.02;

      if (p.life <= 0) {
        game.particles.splice(i, 1);
      }
    }

    if (currentTime - game.comboTimer > 3000 && game.combo > 0) {
      game.combo = 0;
    }

    setScore(game.score);
    setCombo(game.combo);
  }, [spawnObject, checkCollision, handleCollision]);

  const drawGame = useCallback(() => {
    const game = gameRef.current;
    const canvas = game.canvas;
    const ctx = game.ctx;

    if (!canvas || !ctx) return;

    ctx.fillStyle = '#0a0e27';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#0f1729');
    gradient.addColorStop(0.5, '#1a1f3a');
    gradient.addColorStop(1, '#0f1729');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < 50; i++) {
      const x = (i * 30 + (game.gameTime * 0.05) % 30) % canvas.width;
      const y = ((game.gameTime * 0.8 + i * 50) % (canvas.height + 100));
      ctx.fillStyle = `rgba(100, 200, 255, ${0.1 + Math.random() * 0.1})`;
      ctx.fillRect(x, y, 2, 30);
    }

    game.objects.forEach(obj => {
      ctx.save();
      ctx.translate(obj.x + obj.width / 2, obj.y + obj.height / 2);
      ctx.rotate(obj.angle);

      if (obj.type === 'energy') {
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, obj.width / 2);
        grad.addColorStop(0, '#34d399');
        grad.addColorStop(0.5, '#10b981');
        grad.addColorStop(1, 'rgba(16, 185, 129, 0)');

        ctx.shadowColor = '#10b981';
        ctx.shadowBlur = 20;
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, obj.width / 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#6ee7b7';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, obj.width / 3, 0, Math.PI * 2);
        ctx.stroke();
      } else if (obj.type === 'star') {
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, obj.width / 2);
        grad.addColorStop(0, '#fde047');
        grad.addColorStop(0.5, '#fbbf24');
        grad.addColorStop(1, 'rgba(251, 191, 36, 0)');

        ctx.shadowColor = '#fbbf24';
        ctx.shadowBlur = 25;
        ctx.fillStyle = grad;

        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
          const x = Math.cos(angle) * obj.width / 2;
          const y = Math.sin(angle) * obj.height / 2;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);

          const angle2 = angle + Math.PI / 5;
          const x2 = Math.cos(angle2) * obj.width / 4;
          const y2 = Math.sin(angle2) * obj.height / 4;
          ctx.lineTo(x2, y2);
        }
        ctx.closePath();
        ctx.fill();
      } else {
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, obj.width / 2);
        grad.addColorStop(0, '#f87171');
        grad.addColorStop(0.5, '#ef4444');
        grad.addColorStop(1, 'rgba(239, 68, 68, 0)');

        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = 20;
        ctx.fillStyle = grad;

        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const angle = (Math.PI * 2 * i) / 6;
          const x = Math.cos(angle) * obj.width / 2;
          const y = Math.sin(angle) * obj.height / 2;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
      }

      ctx.restore();
    });

    game.particles.forEach(p => {
      ctx.fillStyle = p.color.replace(')', `, ${p.life})`).replace('rgb', 'rgba');
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
    });

    const player = game.player;
    const playerGrad = ctx.createRadialGradient(
      player.x, player.y, 0,
      player.x, player.y, player.width / 2
    );

    const glowBoost = 1 + (game.combo * 0.1);
    playerGrad.addColorStop(0, '#60a5fa');
    playerGrad.addColorStop(0.5, '#3b82f6');
    playerGrad.addColorStop(1, 'rgba(59, 130, 246, 0)');

    ctx.shadowColor = '#3b82f6';
    ctx.shadowBlur = 30 * glowBoost;
    ctx.fillStyle = playerGrad;
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.width / 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.width / 3, 0, Math.PI * 2);
    ctx.stroke();

    if (game.combo > 1) {
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 10;
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 28px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`x${game.combo}`, player.x, player.y - 60);
      ctx.shadowBlur = 0;
    }
  }, []);

  const gameLoop = useCallback(() => {
    const game = gameRef.current;

    if (!game.isRunning) return;

    updateGame();
    drawGame();

    gameLoopRef.current = requestAnimationFrame(gameLoop);
  }, [updateGame, drawGame]);

  const startGame = async () => {
    initGame();

    const game = gameRef.current;
    game.isRunning = true;

    if (!demoMode && invitation) {
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
        sessionIdRef.current = data.id;
      }
    }

    setGameState('playing');
    gameLoopRef.current = requestAnimationFrame(gameLoop);
  };

  const endGame = async () => {
    const game = gameRef.current;
    game.isRunning = false;

    if (gameLoopRef.current) {
      cancelAnimationFrame(gameLoopRef.current);
      gameLoopRef.current = null;
    }

    if (!demoMode && sessionIdRef.current) {
      const session = sessionIdRef.current;

      for (const event of game.telemetry) {
        await supabase.from('wellbeing_game_telemetry').insert({
          session_id: session,
          event_type: event.type,
          event_timestamp: new Date(game.startTime + event.time).toISOString(),
          decision_speed_ms: event.time,
          risk_level_chosen: event.nearbyHazards || 0,
          event_data: event,
        });
      }

      await supabase
        .from('wellbeing_game_sessions')
        .update({
          completed_at: new Date().toISOString(),
          duration_seconds: Math.floor(game.gameTime / 1000),
          completion_rate: 100,
          abandoned: false,
          raw_score: game.score,
        })
        .eq('id', session);

      try {
        await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/wellbeing-risk-calculator`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({ session_id: session }),
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
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const game = gameRef.current;
    if (!game.isRunning) return;

    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
      game.keys.left = true;
      e.preventDefault();
    }
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
      game.keys.right = true;
      e.preventDefault();
    }
  }, []);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    const game = gameRef.current;

    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
      game.keys.left = false;
    }
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
      game.keys.right = false;
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const game = gameRef.current;
    if (!game.isRunning || !game.canvas) return;

    const rect = game.canvas.getBoundingClientRect();
    game.player.targetX = e.clientX - rect.left;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    const game = gameRef.current;
    if (!game.isRunning || !game.canvas) return;

    e.preventDefault();
    const rect = game.canvas.getBoundingClientRect();
    game.player.targetX = e.touches[0].clientX - rect.left;
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);

      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
    };
  }, [handleKeyDown, handleKeyUp]);

  useEffect(() => {
    if (gameState === 'complete') {
      endGame();
    }
  }, [gameState]);

  const resetGame = () => {
    setGameState('menu');
    sessionIdRef.current = null;
  };

  return (
    <Card className="bg-gray-900 border-gray-800 overflow-hidden">
      {gameState === 'menu' && (
        <div className="bg-gradient-to-br from-blue-950 via-purple-950 to-gray-900 p-4 md:p-6 relative overflow-hidden">
          <div className="absolute inset-0 opacity-20">
            {[...Array(20)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-1.5 h-1.5 bg-blue-400 rounded-full"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                }}
                animate={{
                  y: [0, -20, 0],
                  opacity: [0.2, 0.8, 0.2],
                }}
                transition={{
                  duration: 3 + Math.random() * 2,
                  repeat: Infinity,
                  delay: Math.random() * 2,
                }}
              />
            ))}
          </div>

          <div className="max-w-lg mx-auto text-center relative z-10">
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-16 h-16 md:w-20 md:h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-3 shadow-xl shadow-blue-500/50"
            >
              <Zap className="w-8 h-8 md:w-10 md:h-10 text-white" />
            </motion.div>

            <motion.h2
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-2xl md:text-3xl font-bold text-white mb-2"
            >
              {demoMode ? 'Energy Flow - Demo' : 'Energy Flow'}
            </motion.h2>

            <motion.p
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-sm md:text-base text-gray-300 mb-4"
            >
              Collect orbs and stars while avoiding hazards
            </motion.p>

            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="grid grid-cols-3 gap-2 mb-4"
            >
              <div className="bg-gray-800/50 rounded-lg p-3 backdrop-blur">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full mx-auto mb-2 flex items-center justify-center shadow-md shadow-green-500/30">
                  <div className="w-5 h-5 md:w-6 md:h-6 bg-white rounded-full"></div>
                </div>
                <p className="text-white font-semibold text-xs md:text-sm mb-0.5">Energy</p>
                <p className="text-xs text-gray-400">+10</p>
              </div>

              <div className="bg-gray-800/50 rounded-lg p-3 backdrop-blur">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full mx-auto mb-2 flex items-center justify-center shadow-md shadow-yellow-400/30">
                  <Star className="w-5 h-5 md:w-6 md:h-6 text-white fill-white" />
                </div>
                <p className="text-white font-semibold text-xs md:text-sm mb-0.5">Star</p>
                <p className="text-xs text-gray-400">+50</p>
              </div>

              <div className="bg-gray-800/50 rounded-lg p-3 backdrop-blur">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-red-500 to-pink-600 rounded-full mx-auto mb-2 flex items-center justify-center shadow-md shadow-red-500/30">
                  <div className="w-5 h-5 md:w-6 md:h-6 bg-white rotate-45 rounded"></div>
                </div>
                <p className="text-white font-semibold text-xs md:text-sm mb-0.5">Hazard</p>
                <p className="text-xs text-gray-400">Avoid!</p>
              </div>
            </motion.div>

            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="bg-gray-800/30 rounded-lg p-3 mb-4 border border-gray-700/50 backdrop-blur"
            >
              <p className="text-white font-semibold text-xs md:text-sm mb-2">Controls</p>
              <div className="flex flex-col sm:flex-row justify-center gap-2 sm:gap-4 text-xs md:text-sm text-gray-300">
                <div>Desktop: Arrow Keys</div>
                <div>Mobile: Touch & Drag</div>
              </div>
            </motion.div>

            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.6 }}
            >
              <Button
                onClick={startGame}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold text-base md:text-lg px-6 py-5 shadow-xl shadow-blue-500/40"
              >
                <Play className="w-5 h-5 mr-2" />
                Start Game
              </Button>
            </motion.div>

            {demoMode && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="text-gray-500 text-xs mt-3"
              >
                Demo Mode - No Data Collected
              </motion.p>
            )}
          </div>
        </div>
      )}

      {gameState === 'playing' && (
        <div className="relative">
          <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/80 to-transparent p-2 md:p-3">
            <div className="flex justify-between items-center">
              <div className="flex gap-3 md:gap-4">
                <div>
                  <div className="text-xs text-gray-400 mb-0.5">SCORE</div>
                  <div className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                    {score}
                  </div>
                </div>
                {combo > 1 && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="bg-yellow-500/20 border-2 border-yellow-400 rounded-lg px-2.5 py-1 backdrop-blur"
                  >
                    <div className="text-xs text-yellow-300">COMBO</div>
                    <div className="text-xl md:text-2xl font-bold text-yellow-400">x{combo}</div>
                  </motion.div>
                )}
              </div>
              <div>
                <div className="text-xs text-gray-400 mb-0.5">TIME</div>
                <div className="text-2xl md:text-3xl font-bold text-white">
                  {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                </div>
              </div>
            </div>
          </div>

          <canvas
            ref={canvasRef}
            onMouseMove={handleMouseMove}
            onTouchMove={handleTouchMove}
            className="w-full cursor-none touch-none"
            style={{ maxHeight: '70vh', display: 'block' }}
          />
        </div>
      )}

      {gameState === 'complete' && (
        <div className="bg-gradient-to-br from-blue-950 via-purple-950 to-gray-900 p-4 md:p-6 relative overflow-hidden min-h-[400px] md:min-h-[500px] flex items-center">
          <div className="absolute inset-0 opacity-10">
            {[...Array(30)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-1 h-1 bg-blue-400 rounded-full"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                }}
                animate={{
                  scale: [0, 1.5, 0],
                  opacity: [0, 1, 0],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  delay: Math.random() * 2,
                }}
              />
            ))}
          </div>

          <div className="max-w-lg mx-auto text-center relative z-10 w-full">
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', duration: 1 }}
            >
              <Trophy className="w-16 h-16 md:w-20 md:h-20 text-yellow-400 mx-auto mb-3 drop-shadow-2xl" />
            </motion.div>

            <motion.h3
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-2xl md:text-3xl font-bold text-white mb-2"
            >
              Challenge Complete!
            </motion.h3>

            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.5, type: 'spring' }}
              className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mb-4"
            >
              {gameRef.current.score}
            </motion.div>

            {!demoMode && (
              <motion.div
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.7 }}
                className="bg-gray-800/50 rounded-lg p-4 mb-4 border border-gray-700 backdrop-blur"
              >
                <h4 className="text-white font-bold text-sm md:text-base mb-3">Performance</h4>
                <div className="space-y-2 text-left text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">Collected:</span>
                    <span className="text-white font-bold">{gameRef.current.collectedCount}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">Max Combo:</span>
                    <span className="text-yellow-400 font-bold">x{gameRef.current.maxCombo}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">Hazards:</span>
                    <span className="text-red-400 font-bold">{gameRef.current.hazardHits}</span>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-gray-700">
                  <p className="text-gray-300 text-xs leading-relaxed">
                    Thanks for playing! Your gameplay helps us understand player behavior.
                  </p>
                </div>
              </motion.div>
            )}

            <motion.div
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.9 }}
            >
              <Button
                onClick={resetGame}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold text-base px-6 py-5 shadow-xl shadow-blue-500/40"
              >
                <RefreshCw className="w-5 h-5 mr-2" />
                Play Again
              </Button>
            </motion.div>
          </div>
        </div>
      )}
    </Card>
  );
}
