'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Footer } from '@/components/Footer';
import { useState } from 'react';

export default function PrivacyPolicyPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-black">
      <nav className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-xl border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
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

            <div className="hidden lg:flex items-center space-x-8">
              <Link href="/" className="text-gray-300 hover:text-brand-400 transition-colors">Home</Link>
              <Link href="/features/casinos" className="text-gray-300 hover:text-brand-400 transition-colors">For Casinos</Link>
              <Link href="/features/regulators" className="text-gray-300 hover:text-brand-400 transition-colors">For Regulators</Link>
              <Link href="/technology" className="text-gray-300 hover:text-brand-400 transition-colors">Technology</Link>
              <Link href="/contact" className="text-gray-300 hover:text-brand-400 transition-colors">Contact</Link>
            </div>

            <div className="hidden lg:flex items-center space-x-4">
              <Link href="/login"><Button variant="ghost" className="text-gray-300 hover:text-white hover:bg-gray-800">Sign In</Button></Link>
              <Link href="/contact"><Button className="bg-brand-400 hover:bg-brand-500 text-black font-semibold">Get Started</Button></Link>
            </div>

            <button className="lg:hidden text-white" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </nav>

      <div className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Privacy Policy</h1>
          <p className="text-gray-400 mb-12">Last Updated: January 2025</p>

          <div className="space-y-8 text-gray-300">
            <section>
              <h2 className="text-2xl font-bold text-white mb-4">1. Introduction</h2>
              <p className="leading-relaxed mb-4">
                SafeBet IQ (Pty) Ltd ("we," "us," or "our") is committed to protecting your privacy and ensuring the security of your personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information in compliance with the Protection of Personal Information Act, 2013 (POPIA) and other applicable South African laws.
              </p>
              <p className="leading-relaxed">
                By using our services, you consent to the data practices described in this policy. This policy applies to all users of SafeBet IQ's responsible gambling and risk compliance platform.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">2. Information We Collect</h2>
              <h3 className="text-xl font-semibold text-white mb-3">2.1 Personal Information</h3>
              <p className="leading-relaxed mb-4">We collect the following categories of personal information:</p>
              <ul className="list-disc list-inside space-y-2 mb-4 ml-4">
                <li>Identity information (name, surname, ID number)</li>
                <li>Contact information (email address, phone number, physical address)</li>
                <li>Gaming account information (player ID, username)</li>
                <li>Financial information (transaction history, deposit amounts, withdrawal records)</li>
                <li>Behavioral data (gaming patterns, session duration, bet sizes, frequency of play)</li>
                <li>Technical information (IP address, device information, browser type)</li>
              </ul>

              <h3 className="text-xl font-semibold text-white mb-3">2.2 Sensitive Personal Information</h3>
              <p className="leading-relaxed mb-4">
                In accordance with Section 26 of POPIA, we process the following special personal information only with your explicit consent:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Health information related to gambling behavior patterns</li>
                <li>Risk assessment scores for responsible gambling purposes</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">3. How We Use Your Information</h2>
              <p className="leading-relaxed mb-4">We process your personal information for the following lawful purposes:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>Service Delivery:</strong> To provide responsible gambling monitoring and intervention services</li>
                <li><strong>Risk Assessment:</strong> To analyze behavioral patterns and calculate risk scores using AI algorithms</li>
                <li><strong>Regulatory Compliance:</strong> To comply with National Gambling Board requirements and provincial gaming regulations</li>
                <li><strong>Player Protection:</strong> To send automated interventions via WhatsApp, SMS, or email when risk thresholds are exceeded</li>
                <li><strong>Reporting:</strong> To generate compliance reports for gaming authorities and licensed operators</li>
                <li><strong>System Improvement:</strong> To enhance our AI models and platform performance</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">4. Legal Basis for Processing (POPIA Compliance)</h2>
              <p className="leading-relaxed mb-4">We process your personal information based on the following lawful grounds:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>Consent:</strong> You have provided explicit consent for specific processing activities</li>
                <li><strong>Contractual Necessity:</strong> Processing is necessary to fulfill our service agreement with casino operators</li>
                <li><strong>Legal Obligation:</strong> We are required to process data to comply with gaming regulations</li>
                <li><strong>Legitimate Interests:</strong> Processing is necessary for player protection and responsible gambling objectives</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">5. Data Sharing and Disclosure</h2>
              <p className="leading-relaxed mb-4">We may share your personal information with:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>Casino Operators:</strong> The licensed operator where you hold a gaming account</li>
                <li><strong>Gaming Regulators:</strong> National Gambling Board and provincial authorities as required by law</li>
                <li><strong>Service Providers:</strong> Third-party technology providers (Supabase for database services) under strict data processing agreements</li>
                <li><strong>Law Enforcement:</strong> When required by South African law or court order</li>
              </ul>
              <p className="leading-relaxed mt-4">
                We do not sell, rent, or trade your personal information to third parties for marketing purposes.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">6. Your Rights Under POPIA</h2>
              <p className="leading-relaxed mb-4">You have the following rights regarding your personal information:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>Right to Access:</strong> Request copies of your personal information</li>
                <li><strong>Right to Correction:</strong> Request correction of inaccurate or incomplete data</li>
                <li><strong>Right to Deletion:</strong> Request deletion of your personal information (subject to legal retention requirements)</li>
                <li><strong>Right to Object:</strong> Object to processing based on legitimate interests</li>
                <li><strong>Right to Data Portability:</strong> Receive your data in a structured, machine-readable format</li>
                <li><strong>Right to Withdraw Consent:</strong> Withdraw consent at any time where processing is based on consent</li>
              </ul>
              <p className="leading-relaxed mt-4">
                To exercise these rights, contact our Information Officer at privacy@safeplayai.com
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">7. Data Security</h2>
              <p className="leading-relaxed mb-4">
                We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, loss, destruction, or alteration, including:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>End-to-end encryption for data transmission</li>
                <li>Secure database storage with row-level security</li>
                <li>Role-based access controls</li>
                <li>Regular security audits and vulnerability assessments</li>
                <li>Staff training on data protection obligations</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">8. Data Retention</h2>
              <p className="leading-relaxed">
                We retain your personal information for as long as necessary to fulfill the purposes outlined in this policy and to comply with legal obligations, including:
              </p>
              <ul className="list-disc list-inside space-y-2 mt-4 ml-4">
                <li>Gaming transaction records: 5 years (as required by gambling regulations)</li>
                <li>Risk assessment data: 3 years</li>
                <li>Intervention logs: 5 years</li>
                <li>Account information: Duration of active account plus 1 year</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">9. Cross-Border Data Transfers</h2>
              <p className="leading-relaxed">
                Your personal information is stored on servers located in South Africa and complies with POPIA requirements. If we transfer data internationally, we ensure adequate safeguards are in place as required by Chapter 9 of POPIA.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">10. Information Officer</h2>
              <p className="leading-relaxed mb-2">SafeBet IQ (Pty) Ltd</p>
              <p className="leading-relaxed mb-2">Information Officer: [Name]</p>
              <p className="leading-relaxed mb-2">Email: privacy@safeplayai.com</p>
              <p className="leading-relaxed mb-2">Phone: +27 12 345 6789</p>
              <p className="leading-relaxed">Address: Johannesburg, South Africa</p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">11. Complaints</h2>
              <p className="leading-relaxed">
                If you believe we have not complied with POPIA, you have the right to lodge a complaint with the Information Regulator of South Africa:
              </p>
              <p className="leading-relaxed mt-4 mb-2">Information Regulator (South Africa)</p>
              <p className="leading-relaxed mb-2">Email: inforeg@justice.gov.za</p>
              <p className="leading-relaxed">Website: www.justice.gov.za/inforeg</p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-4">12. Changes to This Policy</h2>
              <p className="leading-relaxed">
                We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new policy on our website and updating the "Last Updated" date. Continued use of our services after changes constitutes acceptance of the updated policy.
              </p>
            </section>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
