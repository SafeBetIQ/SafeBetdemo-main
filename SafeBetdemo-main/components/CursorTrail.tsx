'use client';

import { useRef, useEffect } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';

export default function CursorTrail() {
  const isVisible = useRef(false);
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);

  const dotX = useSpring(rawX, { damping: 30, stiffness: 200, mass: 0.5 });
  const dotY = useSpring(rawY, { damping: 30, stiffness: 200, mass: 0.5 });
  const ringX = useSpring(rawX, { damping: 20, stiffness: 100, mass: 0.8 });
  const ringY = useSpring(rawY, { damping: 20, stiffness: 100, mass: 0.8 });

  useEffect(() => {
    let rafId: number;

    const handleMouseMove = (e: MouseEvent) => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        rawX.set(e.clientX);
        rawY.set(e.clientY);
        if (!isVisible.current) {
          isVisible.current = true;
          if (dotRef.current) dotRef.current.style.opacity = '1';
          if (ringRef.current) ringRef.current.style.opacity = '1';
        }
      });
    };

    const handleMouseLeave = () => {
      isVisible.current = false;
      if (dotRef.current) dotRef.current.style.opacity = '0';
      if (ringRef.current) ringRef.current.style.opacity = '0';
    };

    window.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
      cancelAnimationFrame(rafId);
    };
  }, [rawX, rawY]);

  return (
    <>
      <motion.div
        ref={dotRef}
        className="fixed pointer-events-none z-50 w-2 h-2 bg-brand-400 rounded-full mix-blend-screen"
        style={{ x: dotX, y: dotY, translateX: '-4px', translateY: '-4px', opacity: 0 }}
      />
      <motion.div
        ref={ringRef}
        className="fixed pointer-events-none z-50 w-8 h-8 border border-brand-400/30 rounded-full"
        style={{ x: ringX, y: ringY, translateX: '-16px', translateY: '-16px', opacity: 0 }}
      />
    </>
  );
}
