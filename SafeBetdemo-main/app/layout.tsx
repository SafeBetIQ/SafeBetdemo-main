import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { AuthProvider } from '@/contexts/AuthContext';
import { ModuleProvider } from '@/contexts/ModuleContext';
import { Toaster } from '@/components/ui/sonner';
import AIMonitoringIndicator from '@/components/AIMonitoringIndicator';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  metadataBase: new URL('https://www.safebetiq.com'),
  title: {
    default: 'SafeBet IQ — Responsible Gambling Intelligence Platform',
    template: '%s | SafeBet IQ',
  },
  description:
    "South Africa's AI-driven responsible gambling compliance platform. Real-time player risk intelligence, automated interventions, and live regulatory oversight for licensed casino operators and the National Gambling Board.",
  keywords: [
    'responsible gambling', 'gambling compliance', 'player protection', 'casino compliance',
    'National Gambling Act', 'NGA §26', 'POPIA', 'SARGF', 'South Africa gambling',
    'gambling AI', 'problem gambling detection', 'self-exclusion network',
  ],
  authors: [{ name: 'SafeBet IQ (Pty) Ltd' }],
  openGraph: {
    type: 'website',
    locale: 'en_ZA',
    siteName: 'SafeBet IQ',
    title: 'SafeBet IQ — Responsible Gambling Intelligence Platform',
    description: "AI-driven player protection and compliance for South Africa's regulated gambling sector.",
  },
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: 'any' },
    ],
    apple: '/favicon.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" style={{ backgroundColor: '#000000' }}>
      <body className={`${inter.className} bg-black`}>
        <AuthProvider>
          <ModuleProvider>
            {children}
            <Toaster />
            <AIMonitoringIndicator />
          </ModuleProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
