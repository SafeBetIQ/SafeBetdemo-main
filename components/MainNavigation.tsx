'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Menu, X, ChevronDown } from 'lucide-react';

const NAV_ITEMS = [
  {
    label: 'Platform',
    children: [
      { label: 'For Casino Operators', href: '/features/casinos' },
      { label: 'Behavioural Risk Intelligence', href: '/features/behavioral-risk-intelligence' },
      { label: 'Responsible Gambling Interventions', href: '/features/responsible-gambling-interventions' },
      { label: 'Compliance Reporting', href: '/features/compliance-reporting' },
      { label: 'Cross-Operator Intelligence', href: '/features/cross-operator-intelligence' },
      { label: 'Self-Exclusion Network', href: '/features/self-exclusion-network' },
    ],
  },
  {
    label: 'Solutions',
    children: [
      { label: 'For Regulators', href: '/features/regulators' },
      { label: 'Regulator Intelligence', href: '/features/regulator-intelligence' },
    ],
  },
  {
    label: 'Compliance',
    href: '/technology',
  },
  {
    label: 'Contact',
    href: '/contact',
  },
];

export default function MainNavigation() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  return (
    <nav className="border-b border-white/10 bg-[#0a0a0a] sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex-shrink-0">
            <Image
              src="/safebet-logo-transparent.png"
              alt="SafeBet IQ"
              width={354}
              height={95}
              className="h-9 w-auto"
              priority
            />
          </Link>

          <div className="hidden lg:flex items-center space-x-1">
            {NAV_ITEMS.map((item) =>
              item.children ? (
                <div
                  key={item.label}
                  className="relative"
                  onMouseEnter={() => setOpenDropdown(item.label)}
                  onMouseLeave={() => setOpenDropdown(null)}
                >
                  <button className="flex items-center gap-1 px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors rounded-md hover:bg-white/5">
                    {item.label}
                    <ChevronDown className="h-3.5 w-3.5 text-gray-600" />
                  </button>
                  {openDropdown === item.label && (
                    <div className="absolute left-0 top-full pt-1 z-50">
                      <div className="bg-[#111111] border border-white/10 rounded-lg shadow-xl overflow-hidden min-w-[240px] py-1">
                        {item.children.map((child) => (
                          <Link
                            key={child.href}
                            href={child.href}
                            className="block px-4 py-2.5 text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                          >
                            {child.label}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  key={item.label}
                  href={item.href!}
                  className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors rounded-md hover:bg-white/5"
                >
                  {item.label}
                </Link>
              )
            )}
          </div>

          <div className="hidden lg:flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white hover:bg-white/5 font-medium">
                Sign In
              </Button>
            </Link>
            <Link href="/contact">
              <Button size="sm" className="bg-brand-500 hover:bg-brand-400 text-white font-medium px-5">
                Request Demo
              </Button>
            </Link>
          </div>

          <button
            className="lg:hidden p-2 rounded-md text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-white/10 bg-[#0a0a0a]">
          <div className="px-6 py-4 space-y-1">
            {NAV_ITEMS.map((item) =>
              item.children ? (
                <div key={item.label} className="space-y-1">
                  <p className="px-3 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    {item.label}
                  </p>
                  {item.children.map((child) => (
                    <Link
                      key={child.href}
                      href={child.href}
                      className="block px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-white/5 rounded-md transition-colors"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      {child.label}
                    </Link>
                  ))}
                </div>
              ) : (
                <Link
                  key={item.label}
                  href={item.href!}
                  className="block px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-white/5 rounded-md transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item.label}
                </Link>
              )
            )}
            <div className="pt-4 border-t border-white/10 space-y-2">
              <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="outline" size="sm" className="w-full border-white/20 text-gray-300 bg-transparent hover:bg-white/5">Sign In</Button>
              </Link>
              <Link href="/contact" onClick={() => setMobileMenuOpen(false)}>
                <Button size="sm" className="w-full bg-brand-500 hover:bg-brand-400 text-white">Request Demo</Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
