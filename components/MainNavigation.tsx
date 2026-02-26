'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Menu, X, ChevronDown } from 'lucide-react';

export default function MainNavigation() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="border-b border-gray-800 bg-black sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 md:py-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-2 md:space-x-3">
            <Image
              src="/safebet-logo-transparent.png"
              alt="SafeBet IQ Logo"
              width={354}
              height={95}
              className="h-10 md:h-14 w-auto"
              priority
            />
          </Link>

          <div className="hidden lg:flex items-center space-x-8">
            <Link href="/" className="text-gray-300 hover:text-brand-400 transition-colors">
              Home
            </Link>
            <div className="relative group">
              <button className="text-gray-300 hover:text-brand-400 transition-colors flex items-center space-x-1 py-2">
                <span>For Casinos</span>
                <ChevronDown className="h-4 w-4" />
              </button>
              <div className="absolute left-0 top-full pt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                <div className="w-64 bg-black border border-gray-800 rounded-lg shadow-xl overflow-hidden">
                  <Link
                    href="/features/casinos"
                    className="block px-4 py-3 text-gray-300 hover:text-brand-400 hover:bg-gray-900 transition-colors"
                  >
                    Casino Features
                  </Link>
                  <Link
                    href="/features/behavioral-risk-intelligence"
                    className="block px-4 py-3 text-gray-300 hover:text-brand-400 hover:bg-gray-900 transition-colors border-t border-gray-800"
                  >
                    Behavioral Risk Intelligence
                  </Link>
                  <Link
                    href="/guardianlayer"
                    className="block px-4 py-3 text-gray-300 hover:text-brand-400 hover:bg-gray-900 transition-colors border-t border-gray-800"
                  >
                    <span className="flex items-center gap-2">
                      GuardianLayer
                      <span className="text-xs bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 px-1.5 py-0.5 rounded">NEW</span>
                    </span>
                  </Link>
                </div>
              </div>
            </div>
            <Link href="/features/regulators" className="text-gray-300 hover:text-brand-400 transition-colors">
              For Regulators
            </Link>
            <div className="relative group">
              <button className="text-gray-300 hover:text-brand-400 transition-colors flex items-center space-x-1 py-2">
                <span>Technology</span>
                <ChevronDown className="h-4 w-4" />
              </button>
              <div className="absolute left-0 top-full pt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                <div className="w-56 bg-black border border-gray-800 rounded-lg shadow-xl overflow-hidden">
                  <Link
                    href="/technology"
                    className="block px-4 py-3 text-gray-300 hover:text-brand-400 hover:bg-gray-900 transition-colors"
                  >
                    AI Technology
                  </Link>
                  <Link
                    href="/safeplay-connect"
                    className="block px-4 py-3 text-gray-300 hover:text-brand-400 hover:bg-gray-900 transition-colors border-t border-gray-800"
                  >
                    SafeBet IQ Connect
                  </Link>
                  <Link
                    href="/nova-iq"
                    className="block px-4 py-3 text-gray-300 hover:text-brand-400 hover:bg-gray-900 transition-colors border-t border-gray-800"
                  >
                    Nova IQ
                  </Link>
                </div>
              </div>
            </div>
            <Link href="/contact" className="text-gray-300 hover:text-brand-400 transition-colors">
              Contact
            </Link>
          </div>

          <div className="hidden lg:flex items-center space-x-4">
            <Link href="/login">
              <Button variant="ghost" className="text-gray-300 hover:text-white hover:bg-gray-800">
                Sign In
              </Button>
            </Link>
            <Link href="/contact">
              <Button className="bg-brand-400 hover:bg-brand-500 text-black font-semibold">
                Get Started
              </Button>
            </Link>
          </div>

          <button
            className="lg:hidden text-white"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="lg:hidden mt-4 pb-4 space-y-4">
            <Link href="/" className="block text-white hover:text-brand-400">Home</Link>
            <div className="space-y-2">
              <div className="text-brand-400 text-sm font-semibold">For Casinos</div>
              <Link href="/features/casinos" className="block text-gray-300 hover:text-brand-400 pl-4">Casino Features</Link>
              <Link href="/features/behavioral-risk-intelligence" className="block text-gray-300 hover:text-brand-400 pl-4">Behavioral Risk Intelligence</Link>
            </div>
            <Link href="/features/regulators" className="block text-gray-300 hover:text-brand-400">For Regulators</Link>
            <div className="space-y-2">
              <div className="text-brand-400 text-sm font-semibold">Technology</div>
              <Link href="/technology" className="block text-gray-300 hover:text-brand-400 pl-4">AI Technology</Link>
              <Link href="/safeplay-connect" className="block text-gray-300 hover:text-brand-400 pl-4">SafeBet IQ Connect</Link>
              <Link href="/nova-iq" className="block text-gray-300 hover:text-brand-400 pl-4">Nova IQ</Link>
            </div>
            <Link href="/contact" className="block text-gray-300 hover:text-brand-400">Contact</Link>
            <Link href="/login">
              <Button variant="ghost" className="w-full text-gray-300">Sign In</Button>
            </Link>
            <Link href="/contact">
              <Button className="w-full bg-brand-400 hover:bg-brand-500 text-black">Get Started</Button>
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}
