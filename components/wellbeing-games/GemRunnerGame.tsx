'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { Play, RefreshCw, Trophy, Volume2, VolumeX } from 'lucide-react';

interface GemRunnerGameProps {
  invitation?: any;
  demoMode?: boolean;
}

interface Gem {
  id: number;
  x: number;
  y: number;
  type: 'ring';
  value: number;
  collected: boolean;
  rotation: number;
  floatOffset: number;
}

interface Obstacle {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'rock' | 'spike';
  hasCollided?: boolean;
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

interface Cloud {
  x: number;
  y: number;
  speed: number;
  scale: number;
}

export default function GemRunnerGame({ invitation, demoMode = false }: GemRunnerGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameLoopRef = useRef<number | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const musicIntervalRef = useRef<number | null>(null);

  const [gameState, setGameState] = useState<'menu' | 'playing' | 'gameover'>('menu');
  const [score, setScore] = useState(0);
  const [distance, setDistance] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const gameRef = useRef({
    canvas: null as HTMLCanvasElement | null,
    ctx: null as CanvasRenderingContext2D | null,

    player: {
      x: 150,
      y: 0,
      width: 50,
      height: 60,
      velocityY: 0,
      isJumping: false,
      groundY: 0,
      frame: 0,
      frameTimer: 0,
    },

    gems: [] as Gem[],
    obstacles: [] as Obstacle[],
    particles: [] as Particle[],
    clouds: [] as Cloud[],

    camera: {
      x: 0,
    },

    terrain: {
      groundY: 0,
      segments: [] as { x: number; height: number }[],
    },

    background: {
      mountains: [] as { x: number; height: number; width: number }[],
      trees: [] as { x: number; y: number; size: number }[],
    },

    score: 0,
    distance: 0,
    speed: 6,
    maxSpeed: 12,

    gemIdCounter: 0,
    obstacleIdCounter: 0,
    spawnTimer: 0,
    obstacleSpawnTimer: 0,

    collectedGems: 0,
    collisions: 0,
    jumps: 0,
    nearMisses: 0,

    telemetry: [] as any[],

    isRunning: false,
    startTime: 0,
    gameTime: 0,

    keys: {
      space: false,
      up: false,
    },
  });

  const playSound = useCallback((frequency: number, duration: number, type: OscillatorType = 'sine', volume: number = 0.3) => {
    if (!soundEnabled) return;

    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      const ctx = audioContextRef.current;
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);

      gainNode.gain.setValueAtTime(volume, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + duration);
    } catch (error) {
      console.log('Audio not available');
    }
  }, [soundEnabled]);

  const playJumpSound = useCallback(() => {
    playSound(400, 0.15, 'square', 0.2);
    setTimeout(() => playSound(600, 0.1, 'square', 0.15), 50);
  }, [playSound]);

  const playGemSound = useCallback((type: string) => {
    playSound(880, 0.15, 'sine', 0.35);
    setTimeout(() => playSound(1047, 0.1, 'sine', 0.25), 60);
  }, [playSound]);

  const playCollisionSound = useCallback(() => {
    playSound(100, 0.3, 'sawtooth', 0.4);
    setTimeout(() => playSound(80, 0.2, 'sawtooth', 0.3), 100);
  }, [playSound]);

  const playBackgroundMusic = useCallback(() => {
    if (!soundEnabled) return;

    // Upbeat Sonic-style melody
    const melody = [
      { note: 523.25, duration: 150 },  // C5
      { note: 659.25, duration: 150 },  // E5
      { note: 783.99, duration: 150 },  // G5
      { note: 1046.50, duration: 300 }, // C6
      { note: 783.99, duration: 150 },  // G5
      { note: 659.25, duration: 150 },  // E5
      { note: 587.33, duration: 150 },  // D5
      { note: 659.25, duration: 300 },  // E5
      { note: 523.25, duration: 150 },  // C5
      { note: 587.33, duration: 150 },  // D5
      { note: 659.25, duration: 150 },  // E5
      { note: 783.99, duration: 300 },  // G5
      { note: 659.25, duration: 150 },  // E5
      { note: 523.25, duration: 150 },  // C5
      { note: 587.33, duration: 300 },  // D5
      { note: 523.25, duration: 300 },  // C5
    ];

    let noteIndex = 0;

    const playNextNote = () => {
      if (!soundEnabled || gameState !== 'playing') return;

      try {
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }

        const ctx = audioContextRef.current;
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        const { note, duration } = melody[noteIndex];

        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(note, ctx.currentTime);

        gainNode.gain.setValueAtTime(0.08, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration / 1000);

        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + duration / 1000);

        noteIndex = (noteIndex + 1) % melody.length;
      } catch (error) {
        console.log('Music not available');
      }
    };

    // Play first note immediately
    playNextNote();

    // Schedule subsequent notes
    musicIntervalRef.current = window.setInterval(() => {
      playNextNote();
    }, 150);
  }, [soundEnabled, gameState]);

  const stopBackgroundMusic = useCallback(() => {
    if (musicIntervalRef.current !== null) {
      clearInterval(musicIntervalRef.current);
      musicIntervalRef.current = null;
    }
  }, []);

  const initGame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const container = canvas.parentElement;
    if (!container) return;

    const width = Math.min(container.clientWidth, 1200);
    const height = Math.min(600, window.innerHeight * 0.7);

    canvas.width = width;
    canvas.height = height;

    gameRef.current.canvas = canvas;
    gameRef.current.ctx = ctx;

    const groundY = height - 100;
    gameRef.current.player.groundY = groundY;
    gameRef.current.player.y = groundY;
    gameRef.current.terrain.groundY = groundY;

    gameRef.current.clouds = [];
    for (let i = 0; i < 8; i++) {
      gameRef.current.clouds.push({
        x: Math.random() * width * 2,
        y: 50 + Math.random() * 150,
        speed: 0.5 + Math.random() * 0.5,
        scale: 0.5 + Math.random() * 0.8,
      });
    }

    gameRef.current.background.mountains = [];
    for (let i = 0; i < 10; i++) {
      gameRef.current.background.mountains.push({
        x: i * 200,
        height: 150 + Math.random() * 100,
        width: 150 + Math.random() * 100,
      });
    }

    gameRef.current.background.trees = [];
    for (let i = 0; i < 20; i++) {
      gameRef.current.background.trees.push({
        x: i * 100 + Math.random() * 50,
        y: groundY,
        size: 30 + Math.random() * 20,
      });
    }

    gameRef.current.gems = [];
    gameRef.current.obstacles = [];
    gameRef.current.particles = [];
    gameRef.current.score = 0;
    gameRef.current.distance = 0;
    gameRef.current.speed = 3;
    gameRef.current.camera.x = 0;
    gameRef.current.spawnTimer = 0;
    gameRef.current.obstacleSpawnTimer = 0;
    gameRef.current.gemIdCounter = 0;
    gameRef.current.obstacleIdCounter = 0;
    gameRef.current.collectedGems = 0;
    gameRef.current.collisions = 0;
    gameRef.current.jumps = 0;
    gameRef.current.nearMisses = 0;
    gameRef.current.telemetry = [];
    gameRef.current.player.velocityY = 0;
    gameRef.current.player.isJumping = false;
    gameRef.current.player.frame = 0;

    setScore(0);
    setDistance(0);
  }, []);

  const spawnGem = useCallback(() => {
    const game = gameRef.current;
    const canvas = game.canvas;
    if (!canvas) return;

    const type: 'ring' = 'ring';
    const value = 10;

    const patterns = [
      [{ x: 0, y: -50 }],
      [{ x: 0, y: -50 }, { x: 40, y: -50 }],
      [{ x: 0, y: -50 }, { x: 40, y: -50 }, { x: 80, y: -50 }],
      [{ x: 0, y: -50 }, { x: 40, y: -50 }, { x: 80, y: -50 }, { x: 120, y: -50 }],
      [{ x: 0, y: -50 }, { x: 50, y: -100 }, { x: 100, y: -50 }],
      [{ x: 0, y: -80 }, { x: 40, y: -120 }, { x: 80, y: -80 }],
      [{ x: 20, y: -150 }, { x: 60, y: -150 }, { x: 100, y: -150 }],
    ];

    const pattern = patterns[Math.floor(Math.random() * patterns.length)];
    const baseX = game.camera.x + canvas.width + 50;

    pattern.forEach((offset, index) => {
      game.gems.push({
        id: game.gemIdCounter++,
        x: baseX + offset.x,
        y: game.terrain.groundY + offset.y,
        type: type,
        value: value,
        collected: false,
        rotation: 0,
        floatOffset: index * 0.5,
      });
    });
  }, []);

  const spawnObstacle = useCallback(() => {
    const game = gameRef.current;
    const canvas = game.canvas;
    if (!canvas) return;

    const type: 'rock' | 'spike' = Math.random() > 0.5 ? 'rock' : 'spike';
    const dimensions = type === 'rock'
      ? { width: 50, height: 50 }
      : { width: 40, height: 60 };

    game.obstacles.push({
      id: game.obstacleIdCounter++,
      x: game.camera.x + canvas.width + 50,
      y: game.terrain.groundY - dimensions.height,
      width: dimensions.width,
      height: dimensions.height,
      type: type,
    });
  }, []);

  const createParticles = useCallback((x: number, y: number, color: string, count: number) => {
    const game = gameRef.current;

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const speed = 3 + Math.random() * 5;

      game.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        life: 1.0,
        color,
        size: 4 + Math.random() * 6,
      });
    }
  }, []);

  const checkGemCollision = useCallback((gem: Gem): boolean => {
    const game = gameRef.current;
    const player = game.player;

    // Convert gem world position to screen position
    const gemScreenX = gem.x - game.camera.x;

    // Gem is 30x30 centered at gemScreenX + 15, gem.y + 15
    return (
      gemScreenX + 5 < player.x + player.width &&
      gemScreenX + 25 > player.x &&
      gem.y + 5 < player.y + player.height &&
      gem.y + 25 > player.y
    );
  }, []);

  const checkObstacleCollision = useCallback((obstacle: Obstacle): boolean => {
    const game = gameRef.current;
    const player = game.player;

    // Convert obstacle world position to screen position
    const obstacleScreenX = obstacle.x - game.camera.x;

    const margin = 5;

    return (
      obstacleScreenX + margin < player.x + player.width - margin &&
      obstacleScreenX + obstacle.width - margin > player.x + margin &&
      obstacle.y + margin < player.y + player.height - margin &&
      obstacle.y + obstacle.height - margin > player.y + margin
    );
  }, []);

  const updateGame = useCallback(() => {
    const game = gameRef.current;
    const canvas = game.canvas;
    if (!canvas || !game.isRunning) return;

    game.gameTime = Date.now() - game.startTime;

    // Start at speed 3 and gradually increase
    game.speed = Math.min(game.maxSpeed, 3 + (game.gameTime / 10000) * 6);

    if (game.keys.space || game.keys.up) {
      if (!game.player.isJumping) {
        game.player.velocityY = -18;
        game.player.isJumping = true;
        game.jumps++;
        playJumpSound();

        if (!demoMode) {
          game.telemetry.push({
            type: 'jump',
            time: game.gameTime,
            distance: game.distance,
            speed: game.speed,
          });
        }
      }
      game.keys.space = false;
      game.keys.up = false;
    }

    game.player.velocityY += 1;
    game.player.y += game.player.velocityY;

    if (game.player.y >= game.player.groundY) {
      game.player.y = game.player.groundY;
      game.player.velocityY = 0;
      game.player.isJumping = false;
    }

    // Check if there's an obstacle directly ahead before moving
    let canMove = true;
    for (const obstacle of game.obstacles) {
      const obstacleScreenX = obstacle.x - game.camera.x;
      const playerRight = game.player.x + game.player.width;

      // Check if obstacle is directly in front and player is not jumping high enough
      if (obstacleScreenX < playerRight + game.speed + 10 &&
          obstacleScreenX + obstacle.width > playerRight &&
          game.player.y + game.player.height > obstacle.y + 5) {
        canMove = false;
        break;
      }
    }

    if (canMove) {
      game.camera.x += game.speed;
      game.distance += game.speed;
      setDistance(Math.floor(game.distance / 10));
    } else {
      // Player hits obstacle - bounce back slightly
      game.camera.x = Math.max(0, game.camera.x - 2);
      game.speed = Math.max(3, game.speed * 0.95);
    }

    game.player.frameTimer++;
    if (game.player.frameTimer > 6) {
      game.player.frame = (game.player.frame + 1) % 4;
      game.player.frameTimer = 0;
    }

    if (game.gameTime - game.spawnTimer > 1500 - (game.speed * 50)) {
      spawnGem();
      game.spawnTimer = game.gameTime;
    }

    if (game.gameTime - game.obstacleSpawnTimer > 2000 - (game.speed * 80)) {
      spawnObstacle();
      game.obstacleSpawnTimer = game.gameTime;
    }

    for (let i = game.gems.length - 1; i >= 0; i--) {
      const gem = game.gems[i];
      gem.rotation += 0.05;

      if (checkGemCollision(gem) && !gem.collected) {
        gem.collected = true;
        game.score += gem.value;
        game.collectedGems++;
        setScore(game.score);

        const gemScreenX = gem.x - game.camera.x;
        createParticles(gemScreenX + 15, gem.y + 15, '#fbbf24', 20);
        playGemSound(gem.type);

        if (!demoMode) {
          game.telemetry.push({
            type: 'gem_collected',
            gemType: gem.type,
            time: game.gameTime,
            distance: game.distance,
            value: gem.value,
            speed: game.speed,
          });
        }
      }

      if (gem.x < game.camera.x - 100 || gem.collected) {
        game.gems.splice(i, 1);
      }
    }

    for (let i = game.obstacles.length - 1; i >= 0; i--) {
      const obstacle = game.obstacles[i];

      // Check if obstacle has been passed (player jumped over it successfully)
      const obstacleScreenX = obstacle.x - game.camera.x;
      if (obstacleScreenX < game.player.x - 50) {
        game.obstacles.splice(i, 1);
        continue;
      }

      if (checkObstacleCollision(obstacle)) {
        // Only count collision once per obstacle
        if (!obstacle.hasCollided) {
          obstacle.hasCollided = true;
          game.collisions++;
          game.speed = Math.max(3, game.speed - 2);
          createParticles(obstacleScreenX + obstacle.width / 2, obstacle.y, '#ef4444', 20);
          playCollisionSound();

          if (!demoMode) {
            game.telemetry.push({
              type: 'collision',
              obstacleType: obstacle.type,
              time: game.gameTime,
              distance: game.distance,
              speed: game.speed,
            });
          }

          // Game over after 5 collisions
          if (game.collisions >= 5) {
            game.isRunning = false;
            setGameState('gameover');
            return;
          }
        }
        continue;
      }

      const playerRight = game.player.x + game.player.width;
      if (obstacleScreenX < playerRight && obstacleScreenX + obstacle.width > playerRight && Math.abs(obstacleScreenX - playerRight) < 20) {
        game.nearMisses++;
      }

      if (obstacle.x < game.camera.x - 100) {
        game.obstacles.splice(i, 1);
      }
    }

    for (let i = game.particles.length - 1; i >= 0; i--) {
      const p = game.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.3;
      p.life -= 0.02;

      if (p.life <= 0) {
        game.particles.splice(i, 1);
      }
    }

    game.clouds.forEach(cloud => {
      cloud.x -= cloud.speed;
      if (cloud.x < -200) {
        cloud.x = canvas.width + 100;
        cloud.y = 50 + Math.random() * 150;
      }
    });

    setScore(game.score);
  }, [spawnGem, spawnObstacle, createParticles, checkGemCollision, checkObstacleCollision, playJumpSound, playGemSound, playCollisionSound, demoMode]);

  const drawGame = useCallback(() => {
    const game = gameRef.current;
    const canvas = game.canvas;
    const ctx = game.ctx;
    if (!canvas || !ctx) return;

    const skyGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    skyGradient.addColorStop(0, '#1e40af');
    skyGradient.addColorStop(0.4, '#3b82f6');
    skyGradient.addColorStop(1, '#60a5fa');
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    game.clouds.forEach(cloud => {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.shadowColor = 'rgba(255, 255, 255, 0.5)';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.ellipse(cloud.x, cloud.y, 60 * cloud.scale, 30 * cloud.scale, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cloud.x + 40 * cloud.scale, cloud.y, 50 * cloud.scale, 35 * cloud.scale, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cloud.x + 70 * cloud.scale, cloud.y, 55 * cloud.scale, 30 * cloud.scale, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    game.background.mountains.forEach(mountain => {
      const screenX = mountain.x - game.camera.x * 0.3;
      if (screenX > -200 && screenX < canvas.width + 200) {
        const mountainGradient = ctx.createLinearGradient(
          screenX + mountain.width / 2,
          game.terrain.groundY - mountain.height,
          screenX + mountain.width / 2,
          game.terrain.groundY
        );
        mountainGradient.addColorStop(0, '#8b5cf6');
        mountainGradient.addColorStop(0.6, '#7c3aed');
        mountainGradient.addColorStop(1, '#6d28d9');
        ctx.fillStyle = mountainGradient;
        ctx.beginPath();
        ctx.moveTo(screenX, game.terrain.groundY);
        ctx.lineTo(screenX + mountain.width / 2, game.terrain.groundY - mountain.height);
        ctx.lineTo(screenX + mountain.width, game.terrain.groundY);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.beginPath();
        ctx.moveTo(screenX + mountain.width / 2, game.terrain.groundY - mountain.height);
        ctx.lineTo(screenX + mountain.width / 2 + 30, game.terrain.groundY - mountain.height + 40);
        ctx.lineTo(screenX + mountain.width / 2, game.terrain.groundY - mountain.height + 30);
        ctx.closePath();
        ctx.fill();
      }
    });

    game.background.trees.forEach(tree => {
      const screenX = tree.x - game.camera.x * 0.6;
      if (screenX > -100 && screenX < canvas.width + 100) {
        ctx.fillStyle = '#92400e';
        ctx.fillRect(screenX + tree.size / 2 - 5, tree.y - tree.size, 10, tree.size);

        const treeGradient = ctx.createRadialGradient(
          screenX + tree.size / 2,
          tree.y - tree.size * 0.9,
          0,
          screenX + tree.size / 2,
          tree.y - tree.size * 0.9,
          tree.size * 0.6
        );
        treeGradient.addColorStop(0, '#4ade80');
        treeGradient.addColorStop(0.7, '#22c55e');
        treeGradient.addColorStop(1, '#16a34a');
        ctx.fillStyle = treeGradient;
        ctx.beginPath();
        ctx.moveTo(screenX, tree.y - tree.size * 0.5);
        ctx.lineTo(screenX + tree.size / 2, tree.y - tree.size * 1.2);
        ctx.lineTo(screenX + tree.size, tree.y - tree.size * 0.5);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(screenX + tree.size * 0.2, tree.y - tree.size * 0.7);
        ctx.lineTo(screenX + tree.size / 2, tree.y - tree.size * 1.4);
        ctx.lineTo(screenX + tree.size * 0.8, tree.y - tree.size * 0.7);
        ctx.closePath();
        ctx.fill();
      }
    });

    const groundGradient = ctx.createLinearGradient(0, game.terrain.groundY, 0, canvas.height);
    groundGradient.addColorStop(0, '#84cc16');
    groundGradient.addColorStop(0.3, '#65a30d');
    groundGradient.addColorStop(1, '#4d7c0f');
    ctx.fillStyle = groundGradient;
    ctx.fillRect(0, game.terrain.groundY, canvas.width, canvas.height - game.terrain.groundY);

    const checkSize = 30;
    const groundStartY = game.terrain.groundY + 10;
    const groundHeight = canvas.height - groundStartY;
    for (let y = 0; y < groundHeight; y += checkSize) {
      for (let x = 0; x < canvas.width + checkSize; x += checkSize) {
        const offsetX = ((x - game.camera.x) % (checkSize * 2) + checkSize * 2) % (checkSize * 2);
        const col = Math.floor((x + game.camera.x) / checkSize);
        const row = Math.floor(y / checkSize);

        if ((col + row) % 2 === 0) {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
          const drawX = x - (x % checkSize) - (game.camera.x % checkSize);
          ctx.fillRect(drawX, groundStartY + y, checkSize, checkSize);
        }
      }
    }

    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, game.terrain.groundY + 3);
    ctx.lineTo(canvas.width, game.terrain.groundY + 3);
    ctx.stroke();

    game.gems.forEach(gem => {
      if (gem.collected) return;

      const screenX = gem.x - game.camera.x;
      if (screenX > -50 && screenX < canvas.width + 50) {
        const floatY = Math.sin(game.gameTime / 200 + gem.floatOffset) * 5;

        ctx.save();
        ctx.translate(screenX + 15, gem.y + 15 + floatY);

        const scale = Math.abs(Math.cos(gem.rotation));
        ctx.scale(scale * 1.2, 1.2);

        const ringGradient = ctx.createRadialGradient(0, 0, 5, 0, 0, 18);
        ringGradient.addColorStop(0, '#fef08a');
        ringGradient.addColorStop(0.5, '#fbbf24');
        ringGradient.addColorStop(1, '#f59e0b');

        ctx.shadowColor = '#fbbf24';
        ctx.shadowBlur = 20;
        ctx.strokeStyle = ringGradient;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(0, 0, 15, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;

        ctx.strokeStyle = '#ca8a04';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 15, 0, Math.PI * 2);
        ctx.stroke();

        const highlightGradient = ctx.createLinearGradient(-10, -10, 10, 10);
        highlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
        highlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.strokeStyle = highlightGradient;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(-3, -3, 12, Math.PI, Math.PI * 1.5);
        ctx.stroke();

        ctx.restore();
      }
    });

    game.obstacles.forEach(obstacle => {
      const screenX = obstacle.x - game.camera.x;
      if (screenX > -100 && screenX < canvas.width + 100) {
        if (obstacle.type === 'rock') {
          const rockGradient = ctx.createRadialGradient(
            screenX + obstacle.width / 2,
            obstacle.y + obstacle.height / 2,
            0,
            screenX + obstacle.width / 2,
            obstacle.y + obstacle.height / 2,
            obstacle.width / 2
          );
          rockGradient.addColorStop(0, '#8b5cf6');
          rockGradient.addColorStop(0.6, '#7c3aed');
          rockGradient.addColorStop(1, '#6d28d9');
          ctx.fillStyle = rockGradient;
          ctx.beginPath();
          ctx.ellipse(screenX + obstacle.width / 2, obstacle.y + obstacle.height / 2, obstacle.width / 2, obstacle.height / 2, 0, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
          ctx.beginPath();
          ctx.ellipse(screenX + obstacle.width / 3, obstacle.y + obstacle.height / 3, 10, 8, 0, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = '#5b21b6';
          ctx.lineWidth = 3;
          ctx.stroke();
        } else {
          const spikeGradient = ctx.createLinearGradient(
            screenX + obstacle.width / 2,
            obstacle.y,
            screenX + obstacle.width / 2,
            obstacle.y + obstacle.height
          );
          spikeGradient.addColorStop(0, '#ef4444');
          spikeGradient.addColorStop(0.5, '#dc2626');
          spikeGradient.addColorStop(1, '#991b1b');
          ctx.fillStyle = spikeGradient;
          ctx.beginPath();
          ctx.moveTo(screenX + obstacle.width / 2, obstacle.y);
          ctx.lineTo(screenX + obstacle.width, obstacle.y + obstacle.height);
          ctx.lineTo(screenX, obstacle.y + obstacle.height);
          ctx.closePath();
          ctx.fill();

          ctx.strokeStyle = '#7f1d1d';
          ctx.lineWidth = 2;
          ctx.stroke();

          ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
          ctx.beginPath();
          ctx.moveTo(screenX + obstacle.width / 2, obstacle.y + 5);
          ctx.lineTo(screenX + obstacle.width / 2 + 5, obstacle.y + 15);
          ctx.lineTo(screenX + obstacle.width / 2 - 5, obstacle.y + 15);
          ctx.closePath();
          ctx.fill();
        }
      }
    });

    game.particles.forEach(p => {
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 15 * p.life;
      ctx.fillStyle = p.color.replace(')', `, ${p.life})`).replace('rgb', 'rgba');
      ctx.beginPath();
      ctx.arc(p.x - game.camera.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    const player = game.player;
    const screenX = player.x;

    if (game.speed > 6) {
      const speedLineCount = Math.floor(game.speed - 6);
      for (let i = 0; i < speedLineCount; i++) {
        const lineY = player.y + Math.random() * player.height;
        const lineLength = 30 + Math.random() * 40;
        const lineX = screenX - 20 - Math.random() * 30;

        ctx.strokeStyle = `rgba(255, 255, 255, ${0.3 - i * 0.05})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(lineX, lineY);
        ctx.lineTo(lineX - lineLength, lineY);
        ctx.stroke();
      }
    }

    ctx.save();

    // Head (skin tone)
    const headGradient = ctx.createRadialGradient(
      screenX + player.width / 2, player.y + 12, 0,
      screenX + player.width / 2, player.y + 12, 16
    );
    headGradient.addColorStop(0, '#fcd3b1');
    headGradient.addColorStop(0.7, '#f9b88e');
    headGradient.addColorStop(1, '#e69c6b');
    ctx.fillStyle = headGradient;
    ctx.beginPath();
    ctx.arc(screenX + player.width / 2, player.y + 12, 14, 0, Math.PI * 2);
    ctx.fill();

    // Hair (spiky blue-ish black)
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(screenX + player.width / 2, player.y + 8, 15, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(screenX + player.width / 2 - 15, player.y + 8, 30, 6);

    // Spiky hair points
    ctx.beginPath();
    ctx.moveTo(screenX + player.width / 2 - 12, player.y + 8);
    ctx.lineTo(screenX + player.width / 2 - 15, player.y + 2);
    ctx.lineTo(screenX + player.width / 2 - 8, player.y + 8);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(screenX + player.width / 2 + 12, player.y + 8);
    ctx.lineTo(screenX + player.width / 2 + 15, player.y + 2);
    ctx.lineTo(screenX + player.width / 2 + 8, player.y + 8);
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(screenX + 18, player.y + 12, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(screenX + 32, player.y + 12, 4, 0, Math.PI * 2);
    ctx.fill();

    // Pupils
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(screenX + 19, player.y + 12, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(screenX + 33, player.y + 12, 2, 0, Math.PI * 2);
    ctx.fill();

    // Smile
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(screenX + player.width / 2, player.y + 15, 6, 0.2, Math.PI - 0.2);
    ctx.stroke();

    // Body/Shirt (blue)
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(screenX + 12, player.y + 24, 26, 18);

    // Shirt collar
    ctx.fillStyle = '#2563eb';
    ctx.fillRect(screenX + 15, player.y + 24, 20, 3);

    // Arms
    const armSwing = player.frame < 2 ? -5 : 5;
    ctx.fillStyle = '#fcd3b1';
    ctx.fillRect(screenX + 8, player.y + 26, 6, 14);
    ctx.fillRect(screenX + 36, player.y + 26, 6, 14);

    // Pants (dark blue)
    ctx.fillStyle = '#1e3a8a';
    ctx.fillRect(screenX + 15, player.y + 42, 8, 16);
    ctx.fillRect(screenX + 27, player.y + 42, 8, 16);

    // Running animation for legs
    const legOffset = player.frame < 2 ? 2 : -2;
    ctx.fillRect(screenX + 15, player.y + 42, 8, 16 + legOffset);
    ctx.fillRect(screenX + 27, player.y + 42, 8, 16 - legOffset);

    // Shoes (red with white stripe)
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(screenX + 13, player.y + 57, 12, 5);
    ctx.fillRect(screenX + 27, player.y + 57 + legOffset * 2, 12, 5);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(screenX + 13, player.y + 58, 12, 2);
    ctx.fillRect(screenX + 27, player.y + 58 + legOffset * 2, 12, 2);

    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(screenX + player.width / 2, player.y + 35, 8, 0, Math.PI);
    ctx.stroke();

    ctx.restore();
  }, []);

  const gameLoop = useCallback(() => {
    const game = gameRef.current;
    if (!game.isRunning) return;

    updateGame();
    drawGame();

    gameLoopRef.current = requestAnimationFrame(gameLoop);
  }, [updateGame, drawGame]);

  const startGame = async () => {
    setGameState('playing');

    await new Promise(resolve => setTimeout(resolve, 50));

    initGame();

    const game = gameRef.current;
    game.isRunning = true;
    game.startTime = Date.now();

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

    gameLoopRef.current = requestAnimationFrame(gameLoop);

    // Start background music
    playBackgroundMusic();
  };

  const endGame = async () => {
    const game = gameRef.current;
    game.isRunning = false;

    // Stop background music
    stopBackgroundMusic();

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
          risk_level_chosen: 0,
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

    if (e.key === ' ' || e.code === 'Space') {
      game.keys.space = true;
      e.preventDefault();
    }
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
      game.keys.up = true;
      e.preventDefault();
    }
  }, []);

  const handleCanvasClick = useCallback(() => {
    const game = gameRef.current;
    if (!game.isRunning) return;

    if (!game.player.isJumping) {
      game.keys.space = true;
    }
  }, []);


  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);

      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }

      stopBackgroundMusic();

      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [handleKeyDown, stopBackgroundMusic]);

  useEffect(() => {
    if (gameState === 'gameover') {
      endGame();
    }
  }, [gameState]);

  const resetGame = () => {
    stopBackgroundMusic();
    setGameState('menu');
    sessionIdRef.current = null;
  };

  return (
    <Card className="bg-gray-900 border-gray-800 overflow-hidden relative">
      {gameState === 'menu' && (
        <div className="bg-gradient-to-br from-black via-gray-900 to-gray-800 p-4 md:p-6 relative overflow-hidden">
          <motion.div
            className="absolute top-20 left-10 w-96 h-96 bg-brand-400/10 rounded-full blur-3xl"
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.5, 0.3],
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
          <motion.div
            className="absolute bottom-20 right-10 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl"
            animate={{
              scale: [1, 1.3, 1],
              opacity: [0.3, 0.6, 0.3],
            }}
            transition={{
              duration: 10,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: 1,
            }}
          />
          <div className="absolute inset-0 opacity-20">
            {[...Array(40)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-2 h-2 md:w-3 md:h-3 bg-yellow-400 rounded-full"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                }}
                animate={{
                  scale: [0, 1.5, 0],
                  rotate: [0, 180, 360],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  delay: Math.random() * 3,
                }}
              />
            ))}
          </div>

          <div className="max-w-lg mx-auto text-center relative z-10">
            <motion.h2
              initial={{ y: -30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="text-3xl md:text-4xl font-bold text-white mb-4 md:mb-6"
              style={{
                textShadow: '2px 2px 0px #1e40af, 4px 4px 0px rgba(0,0,0,0.3)'
              }}
            >
              Ring Runner
            </motion.h2>

            <motion.p
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-base md:text-lg text-gray-200 mb-6 md:mb-8"
            >
              Dash through vibrant zones and collect golden rings
            </motion.p>

            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 mb-6 md:mb-8"
            >
              <div className="bg-black/30 backdrop-blur rounded-xl p-3 md:p-4">
                <div className="w-12 h-12 md:w-16 md:h-16 mx-auto mb-2 relative">
                  <div className="absolute inset-0 border-4 md:border-6 border-yellow-400 rounded-full"></div>
                  <div className="absolute inset-1 md:inset-2 border-2 md:border-3 border-yellow-500 rounded-full"></div>
                </div>
                <p className="text-white font-bold mb-1 text-sm md:text-base">Golden Ring</p>
                <p className="text-xs md:text-sm text-gray-300">+10 pts</p>
              </div>

              <div className="bg-black/30 backdrop-blur rounded-xl p-3 md:p-4">
                <div className="w-12 h-12 md:w-16 md:h-16 mx-auto mb-2 relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-purple-700 rounded-full"></div>
                </div>
                <p className="text-white font-bold mb-1 text-sm md:text-base">Purple Rock</p>
                <p className="text-xs md:text-sm text-gray-300">Avoid!</p>
              </div>

              <div className="bg-black/30 backdrop-blur rounded-xl p-3 md:p-4">
                <div className="w-12 h-12 md:w-16 md:h-16 mx-auto mb-2 relative flex items-end justify-center">
                  <div className="w-0 h-0 border-l-[16px] md:border-l-[20px] border-l-transparent border-r-[16px] md:border-r-[20px] border-r-transparent border-b-[32px] md:border-b-[40px] border-b-red-500"></div>
                </div>
                <p className="text-white font-bold mb-1 text-sm md:text-base">Red Spike</p>
                <p className="text-xs md:text-sm text-gray-300">Game Over!</p>
              </div>
            </motion.div>

            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="bg-black/20 backdrop-blur rounded-xl p-3 md:p-4 mb-6 md:mb-8 border border-white/20"
            >
              <p className="text-white font-bold text-base md:text-lg mb-2 md:mb-3">Controls</p>
              <div className="flex flex-col sm:flex-row justify-center gap-2 sm:gap-4 text-gray-200 text-xs md:text-sm">
                <div>SPACE / UP - Jump</div>
                <div>CLICK - Jump</div>
              </div>
              <p className="text-yellow-400 mt-2 md:mt-3 text-xs md:text-sm font-semibold">Dodge obstacles and collect rings! Speed increases over time!</p>
            </motion.div>

            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="flex flex-col sm:flex-row justify-center gap-3"
            >
              <Button
                size="lg"
                onClick={startGame}
                className="w-full sm:w-auto bg-gradient-to-r from-brand-400 to-teal-500 hover:from-brand-500 hover:to-teal-600 text-black font-bold text-base md:text-lg px-6 py-5 shadow-2xl transform hover:scale-105 transition-all"
              >
                <Play className="w-5 h-5 md:w-6 md:h-6 mr-2" />
                Start Game
              </Button>

              <Button
                size="lg"
                variant="outline"
                onClick={() => setSoundEnabled(!soundEnabled)}
                className="w-full sm:w-auto bg-black/30 backdrop-blur border-white/30 text-white hover:bg-black/50 px-6 py-5"
              >
                {soundEnabled ? <Volume2 className="w-5 h-5 md:w-6 md:h-6" /> : <VolumeX className="w-5 h-5 md:w-6 md:h-6" />}
              </Button>
            </motion.div>
          </div>
        </div>
      )}

      {gameState === 'playing' && (
        <div className="relative">
          <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/70 to-transparent p-2 md:p-3">
            <div className="flex justify-between items-center max-w-6xl mx-auto">
              <div className="flex gap-3 md:gap-6">
                <div>
                  <div className="text-xs text-gray-300 mb-0.5">RINGS</div>
                  <div className="text-2xl md:text-3xl font-bold text-yellow-400 flex items-center justify-center gap-1 md:gap-2">
                    <span className="inline-block w-5 h-5 md:w-6 md:h-6 border-2 md:border-3 border-yellow-400 rounded-full"></span>
                    {score}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-300 mb-0.5">DISTANCE</div>
                  <div className="text-2xl md:text-3xl font-bold text-blue-400">{distance}m</div>
                </div>
                <div>
                  <div className="text-xs text-gray-300 mb-0.5">HEALTH</div>
                  <div className="flex gap-1 md:gap-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div
                        key={i}
                        className={`w-5 h-5 md:w-6 md:h-6 rounded-full border-2 md:border-3 ${
                          i < 5 - gameRef.current.collisions
                            ? 'bg-red-500 border-red-400'
                            : 'bg-gray-700 border-gray-600'
                        }`}
                      ></div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="relative bg-black">
            <canvas
              ref={canvasRef}
              onClick={handleCanvasClick}
              className="w-full cursor-pointer mx-auto"
              style={{ maxHeight: '70vh', display: 'block' }}
            />
            <div className="absolute bottom-2 md:bottom-4 left-0 right-0 text-center z-10">
              <p className="text-white text-xs md:text-sm font-bold bg-black/50 backdrop-blur inline-block px-3 md:px-4 py-1 md:py-2 rounded-full">
                Press SPACE or CLICK to JUMP
              </p>
            </div>
          </div>
        </div>
      )}

      {gameState === 'gameover' && (
        <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-black p-4 md:p-6 relative overflow-hidden min-h-[400px] md:min-h-[500px] flex items-center">
          <motion.div
            className="absolute top-20 left-10 w-96 h-96 bg-brand-400/10 rounded-full blur-3xl"
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.5, 0.3],
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
          <motion.div
            className="absolute bottom-20 right-10 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl"
            animate={{
              scale: [1, 1.3, 1],
              opacity: [0.3, 0.6, 0.3],
            }}
            transition={{
              duration: 10,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: 1,
            }}
          />
          <div className="absolute inset-0 opacity-10">
            {[...Array(50)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-1 h-1 md:w-2 md:h-2 bg-yellow-400 rounded-full"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                }}
                animate={{
                  y: [0, -50, 0],
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
              transition={{ type: 'spring', duration: 0.8 }}
            >
              <Trophy className="w-16 h-16 md:w-20 md:h-20 text-yellow-400 mx-auto mb-4 md:mb-6 drop-shadow-2xl" />
            </motion.div>

            <motion.h3
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-3xl md:text-4xl font-bold text-white mb-4 md:mb-6"
            >
              Run Complete!
            </motion.h3>

            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.5, type: 'spring' }}
              className="mb-6 md:mb-8"
            >
              <div className="flex items-center justify-center gap-3 mb-3">
                <span className="inline-block w-12 h-12 md:w-16 md:h-16 border-4 md:border-6 border-yellow-400 rounded-full"></span>
                <div className="text-4xl md:text-6xl font-bold text-yellow-400">{gameRef.current.collectedGems}</div>
              </div>
              <div className="text-xl md:text-2xl text-gray-200">Rings Collected</div>
            </motion.div>

            <motion.div
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.7 }}
              className="grid grid-cols-3 gap-2 md:gap-3 mb-6 md:mb-8 max-w-lg mx-auto"
            >
              <div className="bg-black/40 backdrop-blur rounded-lg p-3 md:p-4">
                <div className="text-2xl md:text-3xl font-bold text-blue-400 mb-1">{Math.floor(gameRef.current.distance / 10)}m</div>
                <div className="text-xs md:text-sm text-gray-300">Distance</div>
              </div>
              <div className="bg-black/40 backdrop-blur rounded-lg p-3 md:p-4">
                <div className="text-2xl md:text-3xl font-bold text-yellow-400 mb-1">{gameRef.current.score}</div>
                <div className="text-xs md:text-sm text-gray-300">Points</div>
              </div>
              <div className="bg-black/40 backdrop-blur rounded-lg p-3 md:p-4">
                <div className="text-2xl md:text-3xl font-bold text-purple-400 mb-1">{gameRef.current.jumps}</div>
                <div className="text-xs md:text-sm text-gray-300">Jumps</div>
              </div>
            </motion.div>

            <motion.div
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.9 }}
            >
              <Button
                size="lg"
                onClick={resetGame}
                className="w-full sm:w-auto bg-gradient-to-r from-brand-400 to-teal-500 hover:from-brand-500 hover:to-teal-600 text-black font-bold text-base md:text-lg px-6 py-5 shadow-2xl"
              >
                <RefreshCw className="w-5 h-5 md:w-6 md:h-6 mr-2" />
                Play Again
              </Button>
            </motion.div>
          </div>
        </div>
      )}
    </Card>
  );
}
