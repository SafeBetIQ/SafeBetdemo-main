import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Nova IQ - SafeBet IQ',
  description: 'Nova IQ - Professional behavioral assessment for responsible gaming',
};

export default function WellbeingGameLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
