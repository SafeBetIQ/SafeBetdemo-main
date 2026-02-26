'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function AuthDebugPage() {
  const { user, loading } = useAuth();
  const [sessionInfo, setSessionInfo] = useState<any>(null);
  const [storageInfo, setStorageInfo] = useState<any>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    setSessionInfo({
      hasSession: !!session,
      sessionAccessToken: session?.access_token?.substring(0, 20) + '...',
      sessionExpiry: session?.expires_at ? new Date(session.expires_at * 1000).toISOString() : 'N/A',
      authUserId: authUser?.id,
      authUserEmail: authUser?.email,
    });

    const storage = {
      adminViewingCasinoId: localStorage.getItem('admin_viewing_casino_id'),
      supabaseAuth: localStorage.getItem('sb-' + process.env.NEXT_PUBLIC_SUPABASE_URL?.split('//')[1]?.split('.')[0] + '-auth-token'),
    };

    setStorageInfo(storage);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Authentication Debug Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold text-lg mb-2">AuthContext State</h3>
              <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
                {JSON.stringify(
                  {
                    loading,
                    hasUser: !!user,
                    userEmail: user?.email,
                    userRole: (user as any)?.role,
                  },
                  null,
                  2
                )}
              </pre>
            </div>

            <div>
              <h3 className="font-semibold text-lg mb-2">Supabase Session Info</h3>
              <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
                {JSON.stringify(sessionInfo, null, 2)}
              </pre>
            </div>

            <div>
              <h3 className="font-semibold text-lg mb-2">LocalStorage Info</h3>
              <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
                {JSON.stringify(storageInfo, null, 2)}
              </pre>
            </div>

            <Button onClick={checkAuth}>Refresh</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
