'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Footer } from '@/components/Footer';
import { Mail, Phone, MapPin, Send, Menu, X } from 'lucide-react';
import { useState } from 'react';

export default function ContactPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    phone: '',
    userType: '',
    message: ''
  });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 5000);
  };

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
              <Link href="/contact" className="text-white hover:text-brand-400 transition-colors">Contact</Link>
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

      <section className="relative pt-32 pb-20 px-6 overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-20 left-10 w-96 h-96 bg-brand-400/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl"></div>
        </div>

        <div className="max-w-7xl mx-auto relative">
          <div className="text-center mb-16">
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 leading-tight">
              Get Started with
              <br />
              <span className="text-brand-400">SafeBet IQ</span>
            </h1>

            <p className="text-xl text-gray-400 mb-10 max-w-3xl mx-auto leading-relaxed">
              Schedule a demo or request access to Africa's first AI-driven responsible gambling platform.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-16">
            <Card className="bg-gray-900/50 border-gray-800">
              <CardContent className="p-8 text-center">
                <div className="w-14 h-14 bg-gradient-to-br from-brand-400 to-teal-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Mail className="h-7 w-7 text-black" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Email Us</h3>
                <p className="text-gray-400 mb-4">Get in touch with our team</p>
                <a href="mailto:sales@safebetiq.com" className="text-brand-400 hover:text-brand-300">sales@safebetiq.com</a>
              </CardContent>
            </Card>

            <Card className="bg-gray-900/50 border-gray-800">
              <CardContent className="p-8 text-center">
                <div className="w-14 h-14 bg-gradient-to-br from-brand-400 to-teal-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Phone className="h-7 w-7 text-black" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Call Us</h3>
                <p className="text-gray-400 mb-4">Speak with our sales team</p>
                <a href="tel:+27873797500" className="text-brand-400 hover:text-brand-300">(+27) 87 379 7500</a>
              </CardContent>
            </Card>

            <Card className="bg-gray-900/50 border-gray-800">
              <CardContent className="p-8 text-center">
                <div className="w-14 h-14 bg-gradient-to-br from-brand-400 to-teal-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <MapPin className="h-7 w-7 text-black" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Visit Us</h3>
                <p className="text-gray-400 mb-4">Our headquarters</p>
                <p className="text-brand-400">2 Ncondo Place, Ridgeside<br/>Umhlanga Rocks, Durban</p>
              </CardContent>
            </Card>
          </div>

          <div className="max-w-3xl mx-auto">
            <Card className="bg-gray-900/50 border-gray-800">
              <CardContent className="p-8 md:p-12">
                <h2 className="text-3xl font-bold text-white mb-2">Request a Demo</h2>
                <p className="text-gray-400 mb-8">Fill out the form below and our team will get back to you within 24 hours.</p>

                {submitted ? (
                  <div className="p-6 bg-brand-400/10 border border-brand-400/20 rounded-lg text-center">
                    <div className="text-brand-400 text-xl font-semibold mb-2">Thank You!</div>
                    <p className="text-gray-300">Your request has been submitted. We'll be in touch soon.</p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <Label htmlFor="name" className="text-gray-300 mb-2 block">Full Name *</Label>
                        <Input
                          id="name"
                          required
                          value={formData.name}
                          onChange={(e) => setFormData({...formData, name: e.target.value})}
                          className="bg-gray-950 border-gray-800 text-white focus:border-brand-400"
                          placeholder="John Doe"
                        />
                      </div>

                      <div>
                        <Label htmlFor="email" className="text-gray-300 mb-2 block">Email Address *</Label>
                        <Input
                          id="email"
                          type="email"
                          required
                          value={formData.email}
                          onChange={(e) => setFormData({...formData, email: e.target.value})}
                          className="bg-gray-950 border-gray-800 text-white focus:border-brand-400"
                          placeholder="john@example.com"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <Label htmlFor="company" className="text-gray-300 mb-2 block">Company/Organization *</Label>
                        <Input
                          id="company"
                          required
                          value={formData.company}
                          onChange={(e) => setFormData({...formData, company: e.target.value})}
                          className="bg-gray-950 border-gray-800 text-white focus:border-brand-400"
                          placeholder="Your Company Name"
                        />
                      </div>

                      <div>
                        <Label htmlFor="phone" className="text-gray-300 mb-2 block">Phone Number</Label>
                        <Input
                          id="phone"
                          type="tel"
                          value={formData.phone}
                          onChange={(e) => setFormData({...formData, phone: e.target.value})}
                          className="bg-gray-950 border-gray-800 text-white focus:border-brand-400"
                          placeholder="+27 12 345 6789"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="userType" className="text-gray-300 mb-2 block">I am a *</Label>
                      <select
                        id="userType"
                        required
                        value={formData.userType}
                        onChange={(e) => setFormData({...formData, userType: e.target.value})}
                        className="w-full bg-gray-950 border border-gray-800 text-white rounded-md px-3 py-2 focus:border-brand-400 focus:outline-none"
                      >
                        <option value="">Select your role</option>
                        <option value="casino">Casino Operator</option>
                        <option value="regulator">Gaming Regulator</option>
                        <option value="consultant">Compliance Consultant</option>
                        <option value="other">Other</option>
                      </select>
                    </div>

                    <div>
                      <Label htmlFor="message" className="text-gray-300 mb-2 block">Message</Label>
                      <Textarea
                        id="message"
                        value={formData.message}
                        onChange={(e) => setFormData({...formData, message: e.target.value})}
                        className="bg-gray-950 border-gray-800 text-white focus:border-brand-400 min-h-32"
                        placeholder="Tell us about your needs..."
                      />
                    </div>

                    <Button type="submit" size="lg" className="w-full bg-brand-400 hover:bg-brand-500 text-black font-semibold py-6 text-lg">
                      Submit Request
                      <Send className="ml-2 h-5 w-5" />
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
