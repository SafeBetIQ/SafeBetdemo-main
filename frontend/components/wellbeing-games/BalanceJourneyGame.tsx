'use client';

import ArcadeWellbeingGame from './ArcadeWellbeingGame';

interface BalanceJourneyGameProps {
  invitation: any;
}

export default function BalanceJourneyGame({ invitation }: BalanceJourneyGameProps) {
  return <ArcadeWellbeingGame invitation={invitation} demoMode={false} />;
}
