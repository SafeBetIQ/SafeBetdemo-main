'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle } from 'lucide-react';

export default function HealthCheckPage() {
  const [checks, setChecks] = useState({
    supabaseUrl: false,
    supabaseKey: false,
    supabaseConnection: false,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function runChecks() {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      const newChecks = {
        supabaseUrl: !!(supabaseUrl && !supabaseUrl.includes('placeholder')),
        supabaseKey: !!(supabaseKey && !supabaseKey.includes('placeholder')),
        supabaseConnection: false,
      };

      // Test connection
      if (newChecks.supabaseUrl && newChecks.supabaseKey && supabaseUrl && supabaseKey) {
        try {
          const response = await fetch(`${supabaseUrl}/rest/v1/`, {
            headers: {
              'apikey': supabaseKey,
            },
          });
          newChecks.supabaseConnection = response.ok;
        } catch (err) {
        }
      }

      setChecks(newChecks);
      setLoading(false);
    }

    runChecks();
  }, []);

  const CheckItem = ({ label, status }: { label: string; status: boolean }) => (
    <div className="flex items-center justify-between p-3 bg-gray-950 rounded-lg border border-gray-800">
      <span className="text-gray-300">{label}</span>
      {status ? (
        <Badge className="bg-brand-400/20 text-brand-400 border-brand-400/50">
          <CheckCircle2 className="w-4 h-4 mr-1" />
          OK
        </Badge>
      ) : (
        <Badge variant="destructive">
          <XCircle className="w-4 h-4 mr-1" />
          Failed
        </Badge>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-black p-8">
      <div className="max-w-2xl mx-auto">
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white text-2xl">System Health Check</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <p className="text-gray-400">Running checks...</p>
            ) : (
              <>
                <CheckItem label="Supabase URL Configured" status={checks.supabaseUrl} />
                <CheckItem label="Supabase API Key Configured" status={checks.supabaseKey} />
                <CheckItem label="Supabase Connection" status={checks.supabaseConnection} />

                <div className="mt-6 p-4 bg-gray-950 rounded-lg border border-gray-800">
                  <p className="text-sm font-semibold text-gray-300 mb-2">Environment Variables:</p>
                  <div className="space-y-1 text-xs font-mono">
                    <p className="text-gray-400">
                      NEXT_PUBLIC_SUPABASE_URL: {process.env.NEXT_PUBLIC_SUPABASE_URL || 'NOT SET'}
                    </p>
                    <p className="text-gray-400">
                      NEXT_PUBLIC_SUPABASE_ANON_KEY: {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '***...***' : 'NOT SET'}
                    </p>
                  </div>
                </div>

                {!checks.supabaseUrl || !checks.supabaseKey ? (
                  <div className="mt-4 p-4 bg-red-950/50 rounded-lg border border-red-900">
                    <p className="text-red-300 font-semibold mb-3">❌ Configuration Missing</p>
                    <p className="text-red-400 text-sm mb-3">
                      Environment variables are not set in AWS Amplify.
                    </p>
                    <div className="bg-black/50 p-4 rounded space-y-3">
                      <div>
                        <p className="text-red-300 font-semibold text-xs mb-1">Step 1: Open AWS Amplify Console</p>
                        <p className="text-red-400 text-xs">Go to your app → Environment variables</p>
                      </div>
                      <div>
                        <p className="text-red-300 font-semibold text-xs mb-1">Step 2: Add these variables:</p>
                        <div className="text-xs font-mono text-red-400 space-y-1">
                          <p>Key: NEXT_PUBLIC_SUPABASE_URL</p>
                          <p>Value: https://uexdjngogzunjxkpxwll.supabase.co</p>
                          <p className="mt-2">Key: NEXT_PUBLIC_SUPABASE_ANON_KEY</p>
                          <p className="break-all">Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVleGRqbmdvZ3p1bmp4a3B4d2xsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4ODE4OTUsImV4cCI6MjA3OTQ1Nzg5NX0.-OSpm7VFAK8CM2_N80gqjCKRN_8d-5MwqnstYAPnpbo</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-red-300 font-semibold text-xs mb-1">Step 3: Redeploy</p>
                        <p className="text-red-400 text-xs">Save variables and redeploy your app</p>
                      </div>
                    </div>
                    <p className="text-red-300 text-xs mt-3">
                      📄 See AWS_AMPLIFY_QUICK_FIX.md for detailed instructions
                    </p>
                  </div>
                ) : !checks.supabaseConnection ? (
                  <div className="mt-4 p-4 bg-yellow-950/50 rounded-lg border border-yellow-900">
                    <p className="text-yellow-300 font-semibold mb-2">⚠️ Connection Failed</p>
                    <p className="text-yellow-400 text-sm mb-3">
                      Environment variables are set, but unable to connect to Supabase.
                    </p>
                    <div className="bg-black/50 p-3 rounded">
                      <p className="text-yellow-300 font-semibold text-xs mb-2">Possible causes:</p>
                      <ul className="text-yellow-400 text-xs space-y-1 list-disc list-inside">
                        <li>Network connectivity issue</li>
                        <li>Supabase service temporarily down</li>
                        <li>Invalid API key</li>
                        <li>Variables not applied after deployment</li>
                      </ul>
                    </div>
                    <p className="text-yellow-300 text-xs mt-3">
                      Try: Clear cache, redeploy, or check Supabase status at status.supabase.com
                    </p>
                  </div>
                ) : (
                  <div className="mt-4 p-4 bg-brand-950/50 rounded-lg border border-brand-800">
                    <p className="text-brand-300 font-semibold mb-2">All Systems Operational</p>
                    <p className="text-brand-400 text-sm">
                      Configuration is correct and connection is working.
                    </p>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
