import Link from 'next/link';
import Image from 'next/image';
import { Shield, Mail, Phone, MapPin } from 'lucide-react';

const COMPLIANCE_BADGES = [
  'ISO 27001 Aligned',
  'POPIA Compliant',
  'NGA Approved',
  'NRGP Certified',
];

export function Footer() {
  return (
    <footer className="border-t border-gray-800 bg-black relative">

      {/* Trust bar */}
      <div className="border-b border-gray-900 py-4 px-6">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-center gap-x-8 gap-y-2">
          {COMPLIANCE_BADGES.map((badge, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <Shield className="h-3 w-3 text-brand-500 shrink-0" />
              <span className="text-[11px] text-gray-500 font-medium">{badge}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Main footer */}
      <div className="py-14 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-10 mb-12">

            {/* Brand col */}
            <div className="md:col-span-2">
              <div className="mb-5">
                <Image
                  src="/safebet-logo-transparent.png"
                  alt="SafeBet IQ Logo"
                  width={354}
                  height={95}
                  className="h-10 w-auto"
                />
              </div>
              <p className="text-gray-400 text-sm mb-5 max-w-xs leading-relaxed">
                Africa&apos;s leading AI-driven responsible gambling intelligence platform.
                Protecting players. Empowering operators. Enabling regulators.
              </p>
              <div className="space-y-2.5">
                <a
                  href="mailto:sales@safebetiq.com"
                  className="flex items-center gap-2 text-sm text-gray-400 hover:text-brand-400 transition-colors"
                >
                  <Mail className="h-3.5 w-3.5 shrink-0" />
                  sales@safebetiq.com
                </a>
                <a
                  href="tel:+27873797500"
                  className="flex items-center gap-2 text-sm text-gray-400 hover:text-brand-400 transition-colors"
                >
                  <Phone className="h-3.5 w-3.5 shrink-0" />
                  (+27) 87 379 7500
                </a>
                <div className="flex items-start gap-2 text-sm text-gray-400">
                  <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>1 Sandton Drive, Sandton, 2196<br />Johannesburg, South Africa</span>
                </div>
              </div>
            </div>

            {/* Platform */}
            <div>
              <h3 className="font-semibold text-white mb-4 text-sm">Platform</h3>
              <ul className="space-y-2.5 text-sm text-gray-400">
                <li><Link href="/features/casinos" className="hover:text-brand-400 transition-colors">For Casinos</Link></li>
                <li><Link href="/features/regulators" className="hover:text-brand-400 transition-colors">For Regulators</Link></li>
                <li><Link href="/technology" className="hover:text-brand-400 transition-colors">AI Technology</Link></li>
              </ul>
            </div>

            {/* Resources */}
            <div>
              <h3 className="font-semibold text-white mb-4 text-sm">Resources</h3>
              <ul className="space-y-2.5 text-sm text-gray-400">
                <li><Link href="/contact" className="hover:text-brand-400 transition-colors">Support</Link></li>
                <li><Link href="/privacy" className="hover:text-brand-400 transition-colors">Privacy Policy</Link></li>
                <li><Link href="/terms" className="hover:text-brand-400 transition-colors">Terms of Service</Link></li>
                <li><Link href="/cookies" className="hover:text-brand-400 transition-colors">Cookie Policy</Link></li>
              </ul>
            </div>

            {/* Company */}
            <div>
              <h3 className="font-semibold text-white mb-4 text-sm">Company</h3>
              <ul className="space-y-2.5 text-sm text-gray-400">
                <li><Link href="/about" className="hover:text-brand-400 transition-colors">About SafeBet IQ</Link></li>
                <li><Link href="/contact" className="hover:text-brand-400 transition-colors">Careers</Link></li>
                <li><Link href="/contact" className="hover:text-brand-400 transition-colors">Partner Programme</Link></li>
                <li><Link href="/contact" className="hover:text-brand-400 transition-colors">Press &amp; Media</Link></li>
              </ul>
              <div className="mt-6">
                <p className="text-[11px] text-gray-600 uppercase tracking-wider font-semibold mb-3">Regulated By</p>
                <div className="space-y-1.5">
                  {['National Gambling Board', 'SARGF', 'NRGP'].map((r, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-brand-500" />
                      <span className="text-[11px] text-gray-500">{r}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>

          {/* Bottom bar */}
          <div className="pt-8 border-t border-gray-900 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-xs text-gray-600">
              © 2026 SafeBet IQ (Pty) Ltd. All rights reserved. Registration No. 2021/345891/07
            </p>
            <p className="text-xs text-gray-700">
              Protecting players across South Africa · 9 Provinces · 18 Licensed Operators
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
