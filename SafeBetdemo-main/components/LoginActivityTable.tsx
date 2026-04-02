'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, User, Shield, LogIn } from 'lucide-react';

interface LoginActivity {
  id: string;
  user_email: string;
  user_type: string;
  login_timestamp: string;
  login_method: string;
  impersonated_by_email?: string;
}

interface LoginActivityTableProps {
  casinoId?: string;
  limit?: number;
  title?: string;
  description?: string;
}

export function LoginActivityTable({ casinoId, limit = 10, title = "Recent Login Activity", description = "Security audit trail for all user access" }: LoginActivityTableProps) {
  const [activities, setActivities] = useState<LoginActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadActivities();
    const interval = setInterval(loadActivities, 30000);
    return () => clearInterval(interval);
  }, [casinoId]);

  async function loadActivities() {
    try {
      let query = supabase
        .from('login_activity')
        .select(`
          id,
          user_email,
          user_type,
          login_timestamp,
          login_method,
          impersonated_by
        `)
        .order('login_timestamp', { ascending: false })
        .limit(limit);

      if (casinoId) {
        query = query.eq('casino_id', casinoId);
      }

      const { data, error } = await query;

      if (error) throw error;

      const activitiesWithImpersonator = await Promise.all(
        (data || []).map(async (activity: any) => {
          if (activity.impersonated_by) {
            const { data: impersonatorData } = await supabase
              .from('users')
              .select('email')
              .eq('id', activity.impersonated_by)
              .maybeSingle();

            return {
              ...activity,
              impersonated_by_email: impersonatorData?.email
            };
          }
          return activity;
        })
      );

      setActivities(activitiesWithImpersonator);
    } catch (error) {
      console.error('Error loading login activities:', error);
    } finally {
      setLoading(false);
    }
  }

  function getTimeAgo(timestamp: string) {
    const now = new Date();
    const loginTime = new Date(timestamp);
    const diffMs = now.getTime() - loginTime.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  }

  function getUserTypeBadge(userType: string) {
    const colors: any = {
      admin: 'bg-red-100 text-red-800',
      staff: 'bg-blue-100 text-blue-800',
      regulator: 'bg-purple-100 text-purple-800',
    };

    return (
      <Badge className={`${colors[userType] || 'bg-gray-100 text-gray-800'} border-0`}>
        {userType.toUpperCase()}
      </Badge>
    );
  }

  function getLoginMethodBadge(method: string) {
    if (method === 'impersonation') {
      return (
        <Badge className="bg-amber-100 text-amber-800 border-0">
          <Shield className="h-3 w-3 mr-1" />
          Impersonation
        </Badge>
      );
    }
    return (
      <Badge className="bg-brand-100 text-brand-700 border-0">
        <LogIn className="h-3 w-3 mr-1" />
        Direct
      </Badge>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-blue-600" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <User className="h-12 w-12 mx-auto mb-3 text-gray-400" />
            <p>No login activity recorded yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activities.map((activity) => (
              <div
                key={activity.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <User className="h-4 w-4 text-gray-400" />
                    <span className="font-medium text-gray-900">{activity.user_email}</span>
                    {getUserTypeBadge(activity.user_type)}
                    {getLoginMethodBadge(activity.login_method)}
                  </div>

                  {activity.impersonated_by_email && (
                    <div className="text-xs text-amber-600 flex items-center gap-1 ml-6">
                      <Shield className="h-3 w-3" />
                      Logged in by: {activity.impersonated_by_email}
                    </div>
                  )}

                  <div className="text-xs text-gray-500 ml-6">
                    <Clock className="h-3 w-3 inline mr-1" />
                    {getTimeAgo(activity.login_timestamp)} • {new Date(activity.login_timestamp).toLocaleString('en-ZA', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
