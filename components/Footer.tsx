import Link from 'next/link';
import Image from 'next/image';

export function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-white">
      <div className="max-w-6xl mx-auto px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
          <div className="md:col-span-1">
            <Image
              src="/safebet-logo-transparent.png"
              alt="SafeBet IQ"
              width={354}
              height={95}
              className="h-8 w-auto mb-4"
            />
            <p className="text-sm text-gray-400 leading-relaxed mb-5">
              Responsible gambling intelligence for operators and regulators across South Africa.
            </p>
            <div className="space-y-1 text-sm text-gray-400">
              <p>sales@safebetiq.com</p>
              <p>(+27) 87 379 7500</p>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wider mb-4">Platform</h3>
            <ul className="space-y-2.5">
              {[
                { label: 'For Casino Operators', href: '/features/casinos' },
                { label: 'For Regulators', href: '/features/regulators' },
                { label: 'Technology', href: '/technology' },
                { label: 'API Documentation', href: '/safeplay-connect' },
              ].map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wider mb-4">Compliance</h3>
            <ul className="space-y-2.5">
              {[
                { label: 'ISO 27001 (In Progress)', href: '/technology' },
                { label: 'ISO 9001 (In Progress)', href: '/technology' },
                { label: 'POPIA', href: '/privacy' },
                { label: 'Privacy Policy', href: '/privacy' },
                { label: 'Terms of Service', href: '/terms' },
              ].map((item) => (
                <li key={item.label}>
                  <Link href={item.href} className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wider mb-4">Contact</h3>
            <ul className="space-y-2.5">
              {[
                { label: 'Request a Demo', href: '/contact' },
                { label: 'Contact Sales', href: '/contact' },
                { label: 'Support', href: '/contact' },
              ].map((item) => (
                <li key={item.label}>
                  <Link href={item.href} className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-gray-100 flex flex-col md:flex-row items-center justify-between gap-3">
          <p className="text-xs text-gray-400">
            &copy; 2026 SafeBet IQ. All rights reserved.
          </p>
          <p className="text-xs text-gray-400">
            Protecting players across South Africa
          </p>
        </div>
      </div>
    </footer>
  );
}
