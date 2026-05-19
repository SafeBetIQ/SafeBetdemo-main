'use client';

import { useState, useEffect } from 'react';
import WellbeingGameContent from './WellbeingGameContent';

export default function WellbeingGamePage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-cyan-400 border-t-transparent" />
      </div>
    );
  }

  return <WellbeingGameContent />;
}
