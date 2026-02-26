'use client';

import ArcadeWellbeingGame from './ArcadeWellbeingGame';

interface ImpulseChallengeGameProps {
  invitation: any;
}

export default function ImpulseChallengeGame({ invitation }: ImpulseChallengeGameProps) {
  return <ArcadeWellbeingGame invitation={invitation} demoMode={false} />;
}
