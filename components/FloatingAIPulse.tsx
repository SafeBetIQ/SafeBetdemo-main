'use client';

import { motion } from 'framer-motion';

export default function FloatingAIPulse() {
  return (
    <motion.div
      className="absolute"
      animate={{
        x: [0, 100, 200, 300, 200, 100, 0],
        y: [0, -50, 50, -30, 60, -40, 0],
      }}
      transition={{
        duration: 20,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
      style={{ top: '20%', left: '10%' }}
    >
      <div className="relative">
        <motion.div
          className="w-3 h-3 bg-brand-400 rounded-full"
          animate={{
            scale: [1, 1.5, 1],
            opacity: [0.7, 1, 0.7],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        <motion.div
          className="absolute inset-0 w-3 h-3 bg-brand-400 rounded-full blur-md"
          animate={{
            scale: [1, 2, 1],
            opacity: [0.5, 0, 0.5],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      </div>
    </motion.div>
  );
}
