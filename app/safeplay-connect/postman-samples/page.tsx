'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import MainNavigation from '@/components/MainNavigation';
import { Download } from 'lucide-react';

export default function PostmanSamplesPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-black text-white">
      <MainNavigation />
      <div className="max-w-5xl mx-auto px-6 py-16">
        <div className="flex items-center space-x-3 mb-6">
          <Download className="h-10 w-10 text-brand-400" />
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-brand-400 to-teal-500 text-transparent bg-clip-text">
            Postman Collection
          </h1>
        </div>
        <p className="text-xl text-gray-400 mb-8">Download and import into Postman for instant API testing</p>
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-8">
          <h2 className="text-2xl font-bold mb-4">Getting Started</h2>
          <ol className="space-y-3 text-gray-300">
            <li>1. Download the Postman collection</li>
            <li>2. Open Postman and click Import</li>
            <li>3. Select the downloaded JSON file</li>
            <li>4. Replace YOUR_API_KEY with your actual key</li>
            <li>5. Start testing the API endpoints</li>
          </ol>
          <div className="mt-6">
            <Link href="/contact">
              <Button className="bg-brand-400 hover:bg-brand-500 text-black font-semibold">
                Request API Access
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
