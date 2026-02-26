import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Nova IQ XAI Intelligence System - SafeBet IQ',
  description: 'Nova IQ - AI-powered behavioral assessment enhancing harm prevention accuracy by +12.5% through explainable AI and interactive decision analysis',
};

export default function NovaIQLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
