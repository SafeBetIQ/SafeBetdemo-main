'use client';

import ArcadeWellbeingGame from './ArcadeWellbeingGame';

interface ResourceGuardianGameProps {
  invitation: any;
}

export default function ResourceGuardianGame({ invitation }: ResourceGuardianGameProps) {
  return <ArcadeWellbeingGame invitation={invitation} demoMode={false} />;
}
