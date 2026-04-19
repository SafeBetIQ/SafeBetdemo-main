import Link from 'next/link';
import Image from 'next/image';

export function Footer() {
  return (
    <footer className="py-12 px-6 border-t border-gray-800 bg-black relative">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <div>
            <div className="mb-4">
              <Image
                src="/safebet-logo-transparent.png"
                alt="SafeBet IQ Logo"
                width={354}
                height={95}
                className="h-10 w-auto"
              />
            </div>
            <p className="text-gray-400 text-sm mb-4">
              Africa's first AI-driven responsible gambling platform
            </p>
            <div className="space-y-1 text-sm text-gray-400">
              <p>Email: sales@safebetiq.com</p>
              <p>Phone: (+27) 87 379 7500</p>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-white mb-4">Platform</h3>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><Link href="/features/casinos" className="hover:text-brand-400 transition-colors">For Casinos</Link></li>
              <li><Link href="/features/regulators" className="hover:text-brand-400 transition-colors">For Regulators</Link></li>
              <li><Link href="/technology" className="hover:text-brand-400 transition-colors">Technology</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-white mb-4">Resources</h3>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><Link href="/safeplay-connect" className="hover:text-brand-400 transition-colors">API Documentation</Link></li>
              <li><Link href="/contact" className="hover:text-brand-400 transition-colors">Contact Support</Link></li>
              <li><Link href="/privacy" className="hover:text-brand-400 transition-colors">Privacy Policy</Link></li>
              <li><Link href="/terms" className="hover:text-brand-400 transition-colors">Terms of Service</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-white mb-4">Company</h3>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><Link href="/contact" className="hover:text-brand-400 transition-colors">About Us</Link></li>
              <li><Link href="/contact" className="hover:text-brand-400 transition-colors">Careers</Link></li>
              <li><Link href="/contact" className="hover:text-brand-400 transition-colors">Partners</Link></li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-gray-800">
          <p className="text-center text-gray-400 text-sm">
            © 2026 SafeBet IQ. All rights reserved. | Protecting players across South Africa
          </p>
        </div>
      </div>
    </footer>
  );
}
