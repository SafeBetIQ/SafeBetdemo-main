import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Nova IQ Intelligence System - SafeBet IQ',
  description: 'Nova IQ - an interactive, explainable behavioural assessment that complements SafeBet IQ rule-based risk scoring through interactive decision analysis',
};

export default function NovaIQLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
