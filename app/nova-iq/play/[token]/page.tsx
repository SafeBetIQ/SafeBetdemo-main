'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import GemRunnerGame from '@/components/wellbeing-games/GemRunnerGame';
import BalanceJourneyGame from '@/components/wellbeing-games/BalanceJourneyGame';
import ResourceGuardianGame from '@/components/wellbeing-games/ResourceGuardianGame';
import ImpulseChallengeGame from '@/components/wellbeing-games/ImpulseChallengeGame';
import FinancialDecisionGame from '@/components/wellbeing-games/FinancialDecisionGame';
import { Loader2, ShieldCheck } from 'lucide-react';

interface GameInvitation {
  id: string;
  player_id: string;
  game_concept_id: string;
  status: string;
  expires_at: string;
  game_concept?: {
    id: string;
    name: string;
    slug: string;
    description: string;
    mechanics_type: string;
    duration_minutes: number;
    config: any;
  };
}

export default function WellbeingGamePage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [loading, setLoading] = useState(true);
  const [invitation, setInvitation] = useState<GameInvitation | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadInvitation();
  }, [token]);

  async function loadInvitation() {
    try {
      const { data, error } = await supabase
        .from('wellbeing_game_invitations')
        .select(`
          *,
          game_concept:wellbeing_game_concepts(*)
        `)
        .eq('secure_token', token)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (error || !data) {
        setError('This invitation has expired or is not valid.');
        setLoading(false);
        return;
      }

      if (data.status === 'completed') {
        setError('You have already completed this wellbeing check-in.');
        setLoading(false);
        return;
      }

      if (data.status === 'pending') {
        await supabase
          .from('wellbeing_game_invitations')
          .update({
            status: 'opened',
            opened_at: new Date().toISOString()
          })
          .eq('id', data.id);
      }

      setInvitation(data);
      setLoading(false);
    } catch (err) {
      setError('An error occurred while loading the game.');
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-black flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-cyan-400 animate-spin mx-auto mb-4" />
          <p className="text-gray-300 text-lg">Loading your wellbeing check-in...</p>
        </div>
      </div>
    );
  }

  if (error || !invitation) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-black flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-lg p-8 text-center">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Unable to Load Game</h1>
          <p className="text-gray-400 mb-6">{error}</p>
          <p className="text-sm text-gray-500">
            If you believe this is an error, please contact support.
          </p>
        </div>
      </div>
    );
  }

  const renderGame = () => {
    switch (invitation.game_concept?.slug) {
      case 'gem-runner':
        return <GemRunnerGame invitation={invitation} />;
      case 'balance-journey':
        return <BalanceJourneyGame invitation={invitation} />;
      case 'resource-guardian':
        return <ResourceGuardianGame invitation={invitation} />;
      case 'impulse-challenge':
        return <ImpulseChallengeGame invitation={invitation} />;
      case 'financial-decision':
        return <FinancialDecisionGame invitation={invitation} />;
      default:
        return (
          <div className="text-center text-white">
            <p>Game type not found.</p>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-black">
      {renderGame()}
    </div>
  );
}
