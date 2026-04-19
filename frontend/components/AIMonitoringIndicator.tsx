'use client';

import { motion } from 'framer-motion';
import { Brain } from 'lucide-react';
import { useState } from 'react';

export default function AIMonitoringIndicator() {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      className="fixed bottom-6 right-6 z-50"
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 1, type: 'spring' }}
    >
      <div
        className="relative group cursor-pointer"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <motion.div
          className="absolute inset-0 bg-brand-400 rounded-full blur-xl"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />

        <motion.div
          className="relative bg-gradient-to-br from-brand-400 to-teal-600 p-4 rounded-full shadow-2xl border-2 border-brand-400/50"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
        >
          <motion.div
            animate={isHovered ? { rotate: 360 } : {}}
            transition={{ duration: 1 }}
          >
            <Brain className="w-6 h-6 text-white" />
          </motion.div>
        </motion.div>

        <motion.div
          className="absolute -top-2 -right-2 w-3 h-3 bg-green-400 rounded-full"
          animate={{
            scale: [1, 1.3, 1],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />

        {isHovered && (
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="absolute right-full mr-4 top-1/2 -translate-y-1/2 bg-gray-900 border border-brand-400/30 rounded-lg px-4 py-3 shadow-xl whitespace-nowrap"
          >
            <div className="flex items-center space-x-2">
              <div className="flex space-x-1">
                <motion.div
                  className="w-2 h-2 bg-brand-400 rounded-full"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1, repeat: Infinity, delay: 0 }}
                />
                <motion.div
                  className="w-2 h-2 bg-brand-400 rounded-full"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
                />
                <motion.div
                  className="w-2 h-2 bg-brand-400 rounded-full"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
                />
              </div>
              <span className="text-white text-sm font-medium">AI System Monitoring Players</span>
            </div>
            <div className="text-brand-400 text-xs mt-1">Real-Time Analysis Active</div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
