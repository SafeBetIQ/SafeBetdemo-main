'use client';

import { useEffect, useRef } from 'react';

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  pulsePhase: number;
  pulseSpeed: number;
}

export default function AINetworkBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const NODE_COUNT = 80;
    const CONNECTION_DISTANCE = 150;
    let nodes: Node[] = [];
    let animationFrameId: number;
    let roCleanup: (() => void) | null = null;

    const getParentDimensions = () => {
      const parent = canvas.parentElement;
      if (!parent) return { w: window.innerWidth, h: window.innerHeight };
      const rect = parent.getBoundingClientRect();
      return {
        w: rect.width > 0 ? rect.width : parent.offsetWidth || window.innerWidth,
        h: rect.height > 0 ? rect.height : parent.offsetHeight || window.innerHeight,
      };
    };

    const setSize = () => {
      const { w, h } = getParentDimensions();
      canvas.width = w;
      canvas.height = h;
      return { w, h };
    };

    const initNodes = (w: number, h: number) => {
      nodes = Array.from({ length: NODE_COUNT }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        size: Math.random() * 2.5 + 1.5,
        pulsePhase: Math.random() * Math.PI * 2,
        pulseSpeed: 0.02 + Math.random() * 0.03,
      }));
    };

    const animate = () => {
      const cw = canvas.width;
      const ch = canvas.height;
      ctx.clearRect(0, 0, cw, ch);

      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];

        node.x += node.vx;
        node.y += node.vy;

        if (node.x < 0) { node.x = 0; node.vx *= -1; }
        if (node.x > cw) { node.x = cw; node.vx *= -1; }
        if (node.y < 0) { node.y = 0; node.vy *= -1; }
        if (node.y > ch) { node.y = ch; node.vy *= -1; }

        node.pulsePhase += node.pulseSpeed;
        const pulse = 0.6 + 0.4 * Math.sin(node.pulsePhase);
        const glowRadius = node.size * (2.5 + pulse * 2);

        const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, glowRadius);
        gradient.addColorStop(0, `rgba(137, 216, 72, ${0.9 * pulse})`);
        gradient.addColorStop(0.4, `rgba(137, 216, 72, ${0.4 * pulse})`);
        gradient.addColorStop(1, 'rgba(137, 216, 72, 0)');

        ctx.beginPath();
        ctx.arc(node.x, node.y, glowRadius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(node.x, node.y, node.size * pulse, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(190, 240, 120, ${0.95 * pulse})`;
        ctx.fill();

        for (let j = i + 1; j < nodes.length; j++) {
          const other = nodes[j];
          const dx = node.x - other.x;
          const dy = node.y - other.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < CONNECTION_DISTANCE) {
            const alpha = (1 - dist / CONNECTION_DISTANCE) * 0.55;
            const lineGradient = ctx.createLinearGradient(node.x, node.y, other.x, other.y);
            lineGradient.addColorStop(0, `rgba(137, 216, 72, ${alpha})`);
            lineGradient.addColorStop(0.5, `rgba(137, 216, 72, ${alpha * 0.7})`);
            lineGradient.addColorStop(1, `rgba(137, 216, 72, ${alpha})`);

            ctx.beginPath();
            ctx.moveTo(node.x, node.y);
            ctx.lineTo(other.x, other.y);
            ctx.strokeStyle = lineGradient;
            ctx.lineWidth = 0.8 * (1 - dist / CONNECTION_DISTANCE);
            ctx.stroke();
          }
        }
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    const start = () => {
      const { w, h } = setSize();
      initNodes(w, h);
      animate();

      if (canvas.parentElement) {
        const ro = new ResizeObserver(() => {
          const { w: nw, h: nh } = setSize();
          nodes.forEach(node => {
            node.x = Math.min(node.x, nw);
            node.y = Math.min(node.y, nh);
          });
        });
        ro.observe(canvas.parentElement);
        roCleanup = () => ro.disconnect();
      }
    };

    requestAnimationFrame(() => {
      requestAnimationFrame(start);
    });

    return () => {
      cancelAnimationFrame(animationFrameId);
      roCleanup?.();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        opacity: 0.6,
        display: 'block',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  );
}
