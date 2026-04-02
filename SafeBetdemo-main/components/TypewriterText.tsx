'use client';

import { useState, useEffect } from 'react';

interface TypewriterTextProps {
  text: string;
  delay?: number;
  startDelay?: number;
  className?: string;
  cursorClassName?: string;
}

export default function TypewriterText({
  text,
  delay = 55,
  startDelay = 400,
  className = '',
  cursorClassName = '',
}: TypewriterTextProps) {
  const [displayedText, setDisplayedText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const startTimer = setTimeout(() => setStarted(true), startDelay);
    return () => clearTimeout(startTimer);
  }, [startDelay]);

  useEffect(() => {
    if (!started) return;
    if (currentIndex < text.length) {
      const timeout = setTimeout(() => {
        setDisplayedText((prev) => prev + text[currentIndex]);
        setCurrentIndex((prev) => prev + 1);
      }, delay);
      return () => clearTimeout(timeout);
    }
  }, [currentIndex, text, delay, started]);

  return (
    <span className={className}>
      {displayedText}
      <span
        className={`inline-block w-[2px] h-[1.1em] align-middle ml-[1px] bg-current ${
          currentIndex >= text.length ? 'animate-[blink_1s_step-end_infinite]' : 'opacity-100'
        } ${cursorClassName}`}
        style={{ verticalAlign: 'middle', marginBottom: '1px' }}
      />
    </span>
  );
}
