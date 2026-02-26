'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface TrendDataPoint {
  timestamp: string;
  riskScore: number;
  impulseLevel?: number;
  fatigueIndex?: number;
}

interface BehaviorTrendGraphProps {
  data: TrendDataPoint[];
  title?: string;
  description?: string;
  showImpulse?: boolean;
  showFatigue?: boolean;
}

export function BehaviorTrendGraph({
  data,
  title = 'Behavioral Risk Trends',
  description = 'Real-time player behavior analysis over time',
  showImpulse = true,
  showFatigue = true
}: BehaviorTrendGraphProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
            <XAxis
              dataKey="timestamp"
              stroke="#666"
              style={{ fontSize: '12px' }}
            />
            <YAxis
              stroke="#666"
              style={{ fontSize: '12px' }}
              domain={[0, 100]}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                padding: '12px'
              }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="riskScore"
              stroke="#ef4444"
              strokeWidth={3}
              name="Risk Score"
              dot={{ fill: '#ef4444', r: 4 }}
              activeDot={{ r: 6 }}
            />
            {showImpulse && (
              <Line
                type="monotone"
                dataKey="impulseLevel"
                stroke="#f59e0b"
                strokeWidth={2}
                name="Impulse Level"
                dot={{ fill: '#f59e0b', r: 3 }}
              />
            )}
            {showFatigue && (
              <Line
                type="monotone"
                dataKey="fatigueIndex"
                stroke="#8b5cf6"
                strokeWidth={2}
                name="Fatigue Index"
                dot={{ fill: '#8b5cf6', r: 3 }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
