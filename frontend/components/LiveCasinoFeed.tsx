'use client';

import { useState, useEffect, memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, TrendingUp, TrendingDown } from 'lucide-react';
import { useCasinoData } from '@/contexts/CasinoDataContext';

export const LiveCasinoFeed = memo(function LiveCasinoFeed() {
  const { data } = useCasinoData();
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  const getSATime = () => {
    return new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Johannesburg' }));
  };

  useEffect(() => {
    const timeInterval = setInterval(() => {
      setCurrentTime(getSATime());
    }, 1000);

    return () => {
      clearInterval(timeInterval);
    };
  }, []);

  return (
    <Card className="bg-white border-gray-200 shadow-sm">
      <CardHeader className="border-b border-gray-100 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-brand-100 rounded-xl flex items-center justify-center mr-3">
              <Activity className="h-5 w-5 text-brand-500" />
            </div>
            <div>
              <CardTitle className="text-gray-900">Live Casino Feed</CardTitle>
              <p className="text-sm text-gray-600 mt-1">
                Real-time betting activity • SAST {currentTime.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </p>
            </div>
          </div>
          <Badge className="bg-brand-100 text-brand-600 border-0">
            <div className="w-2 h-2 bg-brand-500 rounded-full mr-2 animate-pulse"></div>
            LIVE
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-h-[600px] overflow-y-auto">
          {data.liveBets.map((bet, index) => (
            <div
              key={bet.id}
              className={`flex items-center justify-between p-4 border-b border-gray-100 transition-all duration-500 ${
                index === 0 ? 'bg-brand-50' : 'hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center space-x-4 flex-1">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-semibold text-sm">
                  {bet.playerName.split(' ').map(n => n[0]).join('')}
                </div>
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-gray-900">{bet.playerName}</span>
                    <Badge variant="outline" className="text-xs border-gray-200 text-gray-600">
                      {bet.playerId}
                    </Badge>
                  </div>
                  <div className="flex items-center space-x-3 mt-1 text-sm text-gray-500">
                    <span>{bet.game}</span>
                    <span>•</span>
                    <span>{bet.timestamp.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <div className="text-sm text-gray-500">Bet</div>
                  <div className="font-semibold text-gray-900">R {bet.betAmount.toLocaleString()}</div>
                </div>
                {bet.outcome !== 'active' && (
                  <div className="text-right min-w-[100px]">
                    <div className="text-sm text-gray-500">
                      {bet.outcome === 'win' ? 'Won' : 'Lost'}
                    </div>
                    <div className={`font-semibold flex items-center justify-end ${
                      bet.outcome === 'win' ? 'text-brand-500' : 'text-red-600'
                    }`}>
                      {bet.outcome === 'win' ? (
                        <>
                          <TrendingUp className="h-4 w-4 mr-1" />
                          R {bet.winAmount?.toLocaleString()}
                        </>
                      ) : (
                        <>
                          <TrendingDown className="h-4 w-4 mr-1" />
                          -R {bet.betAmount.toLocaleString()}
                        </>
                      )}
                    </div>
                  </div>
                )}
                <Badge className={
                  bet.riskScore >= 80 ? 'bg-red-100 text-red-700 border-0' :
                  bet.riskScore >= 60 ? 'bg-orange-100 text-orange-700 border-0' :
                  bet.riskScore >= 40 ? 'bg-yellow-100 text-yellow-700 border-0' :
                  'bg-brand-100 text-brand-600 border-0'
                }>
                  Risk: {bet.riskScore}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
});
