'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart3, TrendingUp, Users, Banknote } from 'lucide-react';
import { useCasinoData } from '@/contexts/CasinoDataContext';

interface AnalyticsData {
  totalWagered: number;
  totalWon: number;
  activePlayers: number;
  avgBetSize: number;
  riskDistribution: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  hourlyData: Array<{
    hour: string;
    wagered: number;
    players: number;
  }>;
  gameDistribution: Array<{
    game: string;
    count: number;
    color: string;
  }>;
}

export function RealTimeAnalytics() {
  const { data: casinoData } = useCasinoData();
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  const getSATime = () => {
    return new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Johannesburg' }));
  };

  const [analytics, setAnalytics] = useState<AnalyticsData>({
    totalWagered: 1847250,
    totalWon: 823580,
    activePlayers: 127,
    avgBetSize: 385,
    riskDistribution: {
      low: 45,
      medium: 38,
      high: 23,
      critical: 11,
    },
    hourlyData: [],
    gameDistribution: [],
  });

  const calculateGameDistribution = () => {
    const activePlayers = casinoData.players.filter(p => p.isActive);
    const gameCounts: { [key: string]: number } = {};

    activePlayers.forEach(player => {
      gameCounts[player.game] = (gameCounts[player.game] || 0) + 1;
    });

    const colors: { [key: string]: string } = {
      'Slots': 'bg-cyan-500',
      'Blackjack': 'bg-blue-500',
      'Roulette': 'bg-purple-500',
      'Poker': 'bg-orange-500',
      'Baccarat': 'bg-brand-400',
    };

    return Object.entries(gameCounts)
      .map(([game, count]) => ({
        game,
        count,
        color: colors[game] || 'bg-gray-500',
      }))
      .sort((a, b) => b.count - a.count);
  };

  useEffect(() => {
    const generateHourlyData = () => {
      const hours = [];
      const now = getSATime();
      for (let i = 11; i >= 0; i--) {
        const hour = new Date(now.getTime() - i * 60 * 60 * 1000);
        hours.push({
          hour: hour.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false }).substring(0, 5),
          wagered: Math.floor(Math.random() * 200000) + 100000,
          players: Math.floor(Math.random() * 20) + Math.floor(casinoData.activePlayers * 0.7),
        });
      }
      return hours;
    };

    setAnalytics(prev => ({
      ...prev,
      hourlyData: generateHourlyData(),
      totalWagered: casinoData.totalWagered,
      totalWon: casinoData.totalWon,
      activePlayers: casinoData.activePlayers,
      avgBetSize: casinoData.avgBetSize,
      riskDistribution: casinoData.riskDistribution,
      gameDistribution: calculateGameDistribution(),
    }));

    const interval = setInterval(() => {
      setAnalytics((prev) => ({
        ...prev,
        totalWagered: casinoData.totalWagered,
        totalWon: casinoData.totalWon,
        activePlayers: casinoData.activePlayers,
        avgBetSize: casinoData.avgBetSize,
        riskDistribution: casinoData.riskDistribution,
        gameDistribution: calculateGameDistribution(),
      }));
    }, 3000);

    const timeInterval = setInterval(() => {
      setCurrentTime(getSATime());
    }, 1000);

    return () => {
      clearInterval(interval);
      clearInterval(timeInterval);
    };
  }, []);

  const maxWagered = Math.max(...analytics.hourlyData.map(d => d.wagered));
  const totalRiskPlayers = analytics.riskDistribution.low + analytics.riskDistribution.medium +
    analytics.riskDistribution.high + analytics.riskDistribution.critical;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-white border-gray-200 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-cyan-100 rounded-xl flex items-center justify-center">
                <Banknote className="h-6 w-6 text-cyan-600" />
              </div>
              <Badge className="bg-brand-100 text-brand-600 border-0">+2.4%</Badge>
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-1">R {analytics.totalWagered.toLocaleString()}</div>
            <p className="text-sm text-gray-600">Total Wagered</p>
            <div className="mt-3 text-xs text-gray-500">
              Last 24 hours
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-brand-100 rounded-xl flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-brand-500" />
              </div>
              <Badge className="bg-blue-100 text-blue-700 border-0">44.6%</Badge>
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-1">R {analytics.totalWon.toLocaleString()}</div>
            <p className="text-sm text-gray-600">Total Won</p>
            <div className="mt-3 text-xs text-gray-500">
              Win rate: 44.6%
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              <Badge className="bg-brand-100 text-brand-600 border-0">Live</Badge>
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-1">{analytics.activePlayers}</div>
            <p className="text-sm text-gray-600">Active Players</p>
            <div className="mt-3 text-xs text-brand-500 font-medium">
              ↑ 12% vs yesterday
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <BarChart3 className="h-6 w-6 text-purple-600" />
              </div>
              <Badge className="bg-purple-100 text-purple-700 border-0">Avg</Badge>
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-1">R {analytics.avgBetSize}</div>
            <p className="text-sm text-gray-600">Avg Bet Size</p>
            <div className="mt-3 text-xs text-gray-500">
              Across all games
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardHeader className="border-b border-gray-100 pb-4">
            <CardTitle className="text-gray-900">Hourly Activity</CardTitle>
            <CardDescription className="text-gray-600">Wagered amount by hour</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-3">
              {analytics.hourlyData.map((data, index) => (
                <div key={index} className="flex items-center space-x-3">
                  <div className="w-16 text-sm text-gray-600 font-medium">{data.hour}</div>
                  <div className="flex-1 h-8 bg-gray-100 rounded-lg overflow-hidden relative">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-500 to-blue-600 rounded-lg transition-all duration-500"
                      style={{ width: `${(data.wagered / maxWagered) * 100}%` }}
                    ></div>
                    <div className="absolute inset-0 flex items-center px-3">
                      <span className="text-xs font-semibold text-white drop-shadow-md">
                        R {data.wagered.toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <div className="w-12 text-sm text-gray-600 text-right">{data.players}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="bg-white border-gray-200 shadow-sm">
            <CardHeader className="border-b border-gray-100 pb-4">
              <CardTitle className="text-gray-900">Risk Distribution</CardTitle>
              <CardDescription className="text-gray-600">Player risk levels</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">Low Risk</span>
                    <span className="text-sm font-semibold text-gray-900">{analytics.riskDistribution.low} players</span>
                  </div>
                  <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-brand-400" style={{ width: `${(analytics.riskDistribution.low / totalRiskPlayers) * 100}%` }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">Medium Risk</span>
                    <span className="text-sm font-semibold text-gray-900">{analytics.riskDistribution.medium} players</span>
                  </div>
                  <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-yellow-500" style={{ width: `${(analytics.riskDistribution.medium / totalRiskPlayers) * 100}%` }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">High Risk</span>
                    <span className="text-sm font-semibold text-gray-900">{analytics.riskDistribution.high} players</span>
                  </div>
                  <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-orange-500" style={{ width: `${(analytics.riskDistribution.high / totalRiskPlayers) * 100}%` }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">Critical Risk</span>
                    <span className="text-sm font-semibold text-gray-900">{analytics.riskDistribution.critical} players</span>
                  </div>
                  <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-red-500" style={{ width: `${(analytics.riskDistribution.critical / totalRiskPlayers) * 100}%` }}></div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-gray-200 shadow-sm">
            <CardHeader className="border-b border-gray-100 pb-4">
              <CardTitle className="text-gray-900">Game Distribution</CardTitle>
              <CardDescription className="text-gray-600">Active players by game</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-3">
                {analytics.gameDistribution.map((game) => (
                  <div key={game.game} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`w-3 h-3 rounded-full ${game.color}`}></div>
                      <span className="text-sm text-gray-700">{game.game}</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-900">{game.count} players</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
