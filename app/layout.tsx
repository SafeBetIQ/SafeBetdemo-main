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
    default: 'SafeBet IQ — Responsible Gambling Intelligence & Regulatory Technology',
    template: '%s | SafeBet IQ',
  },
  description:
    'SafeBet IQ is a responsible gambling intelligence platform combining behavioural risk monitoring, regulatory oversight dashboards and verifiable compliance evidence for casino operators and gambling regulators.',
  keywords: [
    'responsible gambling software',
    'responsible gambling monitoring',
    'gambling compliance software',
    'gambling risk monitoring',
    'gambling regulatory technology',
    'gambling regulator dashboards',
    'player protection intelligence',
    'responsible gambling reporting',
    'RegTech South Africa',
  ],
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: 'SafeBet IQ',
    url: 'https://www.safebetiq.com',
    title: 'SafeBet IQ — Responsible Gambling Intelligence & Regulatory Technology',
    description:
      'Behavioural risk monitoring, regulatory oversight dashboards and verifiable compliance evidence in one integrated platform. Demonstration available; controlled pilot preparation underway.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SafeBet IQ — Responsible Gambling Intelligence',
    description:
      'Behavioural risk monitoring, regulatory dashboards and verifiable compliance evidence for operators and regulators.',
  },
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: 'any' }
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
    <html lang="en">
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
