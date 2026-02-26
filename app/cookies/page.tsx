'use client';
import Link from 'next/link';
import Image from 'next/image';
import { Footer } from '@/components/Footer';

export default function CookiePolicyPage() {
  return (
    <div className="min-h-screen bg-black">
      <nav className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-xl border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <Link href="/">
            <Image
              src="/safebet-logo-transparent.png"
              alt="SafeBet IQ Logo"
              width={354}
              height={95}
              className="h-14 w-auto"
              priority
            />
          </Link>
        </div>
      </nav>

      <div className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-white mb-4">Cookie Policy</h1>
          <p className="text-gray-400 mb-12">Last Updated: January 2025</p>

          <div className="space-y-8 text-gray-300 leading-relaxed">
            <section>
              <h2 className="text-2xl font-bold text-white mb-4">1. Introduction</h2>
              <p>SafeBet IQ (Pty) Ltd uses cookies and similar technologies in compliance with the Protection of Personal Information Act, 2013 (POPIA) and the Electronic Communications and Transactions Act, 2002 (ECTA). This policy explains how we use cookies and your choices.</p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">2. What Are Cookies</h2>
              <p>Cookies are small text files stored on your device when you visit our Platform. They help us provide you with a better experience by remembering your preferences and analyzing Platform usage.</p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">3. Types of Cookies We Use</h2>
              
              <h3 className="text-xl font-semibold text-white mt-6 mb-3">Essential Cookies</h3>
              <p className="mb-4">Required for the Platform to function. These include:</p>
              <ul className="list-disc ml-6 space-y-2">
                <li>Authentication cookies to keep you logged in</li>
                <li>Security cookies to protect against fraud</li>
                <li>Session management cookies</li>
              </ul>

              <h3 className="text-xl font-semibold text-white mt-6 mb-3">Performance Cookies</h3>
              <p className="mb-4">Help us understand how you use the Platform:</p>
              <ul className="list-disc ml-6 space-y-2">
                <li>Analytics cookies to measure Platform performance</li>
                <li>Usage tracking for improvement purposes</li>
              </ul>

              <h3 className="text-xl font-semibold text-white mt-6 mb-3">Functional Cookies</h3>
              <p className="mb-4">Remember your preferences:</p>
              <ul className="list-disc ml-6 space-y-2">
                <li>Language preferences</li>
                <li>Dashboard layout settings</li>
                <li>Notification preferences</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">4. Third-Party Cookies</h2>
              <p className="mb-4">We use the following third-party services that may set cookies:</p>
              <ul className="list-disc ml-6 space-y-2">
                <li><strong>Supabase:</strong> For database and authentication services</li>
                <li><strong>Analytics providers:</strong> To understand Platform usage</li>
              </ul>
              <p className="mt-4">These third parties are contractually required to comply with POPIA and process data only as directed by us.</p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">5. Legal Basis Under POPIA</h2>
              <p className="mb-4">We process cookie data based on:</p>
              <ul className="list-disc ml-6 space-y-2">
                <li><strong>Consent:</strong> For non-essential cookies, we obtain your explicit consent</li>
                <li><strong>Legitimate Interests:</strong> For essential cookies necessary for service delivery</li>
                <li><strong>Contractual Necessity:</strong> For cookies required to provide services you requested</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">6. Your Cookie Choices</h2>
              <p className="mb-4">You can control cookies through:</p>
              <ul className="list-disc ml-6 space-y-2">
                <li><strong>Browser Settings:</strong> Most browsers allow you to refuse or delete cookies</li>
                <li><strong>Opt-Out Tools:</strong> You can opt out of analytics cookies</li>
                <li><strong>Platform Settings:</strong> Manage cookie preferences in your account settings</li>
              </ul>
              <p className="mt-4">Note: Disabling essential cookies may affect Platform functionality.</p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">7. Data Retention</h2>
              <p>Cookie data is retained for:</p>
              <ul className="list-disc ml-6 space-y-2 mt-4">
                <li>Session cookies: Until you close your browser</li>
                <li>Persistent cookies: Up to 12 months</li>
                <li>Analytics data: 24 months</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">8. Updates to This Policy</h2>
              <p>We may update this Cookie Policy to reflect changes in technology or legal requirements. Updates will be posted on this page with a revised "Last Updated" date.</p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">9. Contact Us</h2>
              <p>For questions about our use of cookies:<br/>SafeBet IQ (Pty) Ltd<br/>Email: privacy@safeplayai.com<br/>Phone: +27 12 345 6789<br/>Johannesburg, South Africa</p>
            </section>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
