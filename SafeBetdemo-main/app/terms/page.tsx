'use client';
import Link from 'next/link';
import Image from 'next/image';
import { Footer } from '@/components/Footer';

export default function TermsPage() {
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
          <h1 className="text-4xl font-bold text-white mb-4">Terms of Service</h1>
          <p className="text-gray-400 mb-12">Last Updated: January 2025</p>

          <div className="space-y-8 text-gray-300 leading-relaxed">
            <section>
              <h2 className="text-2xl font-bold text-white mb-4">1. Agreement to Terms</h2>
              <p>These Terms of Service constitute a legally binding agreement between you and SafeBet IQ (Pty) Ltd, a company incorporated under the laws of the Republic of South Africa. By accessing our platform, you agree to these Terms and our Privacy Policy.</p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">2. Regulatory Compliance</h2>
              <p className="mb-4">Our Platform assists operators in complying with:</p>
              <ul className="list-disc ml-6 space-y-2">
                <li>National Gambling Act, 2004 (Act No. 7 of 2004)</li>
                <li>Provincial gambling legislation</li>
                <li>National Gambling Board regulations</li>
                <li>Protection of Personal Information Act, 2013 (POPIA)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">3. Operator Obligations</h2>
              <p className="mb-4">Casino operators agree to:</p>
              <ul className="list-disc ml-6 space-y-2">
                <li>Hold valid gaming licenses issued by South African authorities</li>
                <li>Provide accurate player data to the Platform</li>
                <li>Act on risk alerts in a timely manner</li>
                <li>Comply with all responsible gambling obligations</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">4. Limitation of Liability</h2>
              <p>To the maximum extent permitted by South African law, SafeBet IQ shall not be liable for indirect, incidental, or consequential damages. Our total liability shall not exceed fees paid in the preceding 12 months.</p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">5. Governing Law</h2>
              <p>These Terms are governed by the laws of the Republic of South Africa. Disputes shall be subject to the exclusive jurisdiction of South African courts.</p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">6. Contact</h2>
              <p>SafeBet IQ (Pty) Ltd<br/>Email: legal@safeplayai.com<br/>Phone: +27 12 345 6789<br/>Johannesburg, South Africa</p>
            </section>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
