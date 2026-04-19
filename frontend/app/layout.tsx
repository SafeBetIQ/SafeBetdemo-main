import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { AuthProvider } from '@/contexts/AuthContext';
import { ModuleProvider } from '@/contexts/ModuleContext';
import { Toaster } from '@/components/ui/sonner';
import AIMonitoringIndicator from '@/components/AIMonitoringIndicator';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'SafeBet IQ - Responsible Gaming Platform',
  description: 'AI-powered responsible gaming intervention platform',
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
