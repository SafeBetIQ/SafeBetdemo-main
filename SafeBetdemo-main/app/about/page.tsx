import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Footer } from '@/components/Footer';
import MainNavigation from '@/components/MainNavigation';
import {
  ArrowRight, Shield, Brain, Globe,
  Target, Heart, Lightbulb, TrendingUp, CheckCircle
} from 'lucide-react';

const MISSION_PILLARS = [
  {
    icon: Shield,
    title: 'Player Protection',
    desc: 'Every product decision is evaluated through one lens: does this better protect the people sitting at the casino floor?',
  },
  {
    icon: Brain,
    title: 'AI with Integrity',
    desc: 'Our AI is explainable. Operators and regulators can always see why a risk decision was made — no black boxes in a regulated industry.',
  },
  {
    icon: Globe,
    title: 'Industry Transformation',
    desc: 'We believe compliance should be a data advantage, not a cost centre. SafeBet IQ converts regulatory obligation into operational intelligence.',
  },
  {
    icon: Heart,
    title: 'Responsible Innovation',
    desc: 'Gambling harm is a public health issue. Technology that accelerates harm is not innovation. Every feature we build must measurably reduce it.',
  },
];

const MILESTONES = [
  { year: '2021', event: 'SafeBet IQ founded in Johannesburg. Mission: AI-driven responsible gambling compliance for the South African regulated market.' },
  { year: '2022', event: 'First casino operator deployment. Nova IQ AI risk engine enters active training on South African behavioural data.' },
  { year: '2023', event: 'National Gambling Board partnership established. Provincial regulator dashboards launched across all 9 provinces.' },
  { year: '2024', event: 'Cross-operator intelligence module launched. Self-Exclusion Network expands to cover 12 licensed operators.' },
  { year: '2025', event: 'SafePlay Connect API opens to third-party integration. Platform reaches 2.4M sessions monitored milestone.' },
  { year: '2026', event: '18 licensed operators. 9 provincial boards. AI accuracy reaches 86.9%. Intervention engine sends 12,000+ responsible gambling messages.' },
];

const VALUES = [
  { icon: Target, title: 'Precision over volume', desc: 'One accurate intervention is worth more than ten automated messages. We optimise for impact.' },
  { icon: CheckCircle, title: 'Transparency always', desc: 'Every decision the platform makes — risk score, intervention, exclusion — is logged, explainable, and auditable.' },
  { icon: Lightbulb, title: 'Regulation as design input', desc: 'NGA, POPIA, SARGF, and NRGP standards are not constraints. They are requirements that drive better product design.' },
  { icon: TrendingUp, title: 'Continuous improvement', desc: 'Nova IQ retrains monthly on outcome data. The AI gets better every time an intervention works — or doesn\'t.' },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-black text-white antialiased">
      <MainNavigation />

      {/* Hero */}
      <section className="relative pt-32 pb-20 px-6 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-brand-900/20 rounded-full blur-[120px]" />
        </div>
        <div className="relative max-w-7xl mx-auto">
          <div className="max-w-3xl mx-auto text-center">
            <p className="text-xs font-semibold text-brand-400 uppercase tracking-widest mb-4">About SafeBet IQ</p>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-tight mb-6">
              AI built for<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 to-brand-300">responsible gambling.</span>
            </h1>
            <p className="text-gray-400 text-lg leading-relaxed max-w-2xl mx-auto">
              SafeBet IQ was founded with a single purpose: to give South Africa&rsquo;s regulated gambling industry the intelligence infrastructure it needs to genuinely protect players, not just comply with the minimum requirement.
            </p>
          </div>
        </div>
      </section>

      {/* Mission */}
      <section className="py-20 px-6 border-t border-gray-800">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-4">Our Mission</p>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight leading-tight mb-5">
                Protecting players.<br />
                Empowering regulators.
              </h2>
              <p className="text-gray-400 text-lg leading-relaxed mb-6">
                The National Gambling Act mandates responsible gambling. But a mandate without intelligence is just paperwork. SafeBet IQ turns the legal obligation into operational capability — real-time risk detection, automated intervention, tamper-evident audit trails, and live regulatory oversight.
              </p>
              <p className="text-gray-400 text-lg leading-relaxed">
                We believe the gambling industry can be both commercially successful and genuinely protective of the people it serves. SafeBet IQ is the infrastructure that makes that possible.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {MISSION_PILLARS.map(({ icon: Icon, title, desc }) => (
                <div key={title} className="p-5 rounded-xl border border-gray-800 bg-gray-950">
                  <Icon className="h-5 w-5 text-brand-400 mb-3" />
                  <h3 className="font-semibold text-white text-sm mb-2">{title}</h3>
                  <p className="text-xs text-gray-400 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Responsible Gambling Commitment */}
      <section className="py-20 px-6 border-t border-gray-800 bg-gray-950">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-3xl mx-auto text-center">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-4">Responsible Gambling</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight leading-tight mb-6">
              This is not a checkbox.<br />It&rsquo;s the entire point.
            </h2>
            <p className="text-gray-400 text-lg leading-relaxed mb-5">
              Gambling harm is a genuine public health concern. Problem gambling in South Africa affects individuals, families, and communities in ways that are often invisible until the damage is severe. We founded SafeBet IQ because we believe the technology exists to change that — to catch harm patterns early, intervene meaningfully, and give regulators the visibility they need to act.
            </p>
            <p className="text-gray-400 text-lg leading-relaxed mb-10">
              Every feature in SafeBet IQ is evaluated against one question: does this measurably reduce gambling harm? If the answer is no — or if the feature could accelerate harm — it does not ship.
            </p>
            <div className="grid sm:grid-cols-3 gap-4 text-center">
              {[
                { value: '86.9%', label: 'AI harm prediction accuracy' },
                { value: '12,000+', label: 'Responsible gambling interventions sent' },
                { value: '94%', label: 'Average platform compliance score' },
              ].map(({ value, label }) => (
                <div key={label} className="p-5 rounded-xl border border-gray-800 bg-black">
                  <p className="text-3xl font-bold text-brand-400 tracking-tight">{value}</p>
                  <p className="text-xs text-gray-500 mt-1">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="py-20 px-6 border-t border-gray-800">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-4">Company History</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">Our journey</h2>
          </div>

          <div className="max-w-2xl mx-auto relative">
            {/* Vertical line */}
            <div className="absolute left-[52px] top-4 bottom-4 w-px bg-gray-800" />

            <div className="space-y-8">
              {MILESTONES.map(({ year, event }) => (
                <div key={year} className="flex gap-6">
                  <div className="flex-shrink-0 w-[52px] flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full bg-gray-950 border border-brand-800/60 flex items-center justify-center z-10">
                      <span className="text-[9px] font-bold text-brand-400">{year.slice(2)}</span>
                    </div>
                  </div>
                  <div className="pb-8">
                    <p className="text-xs font-semibold text-brand-400 uppercase tracking-widest mb-1">{year}</p>
                    <p className="text-sm text-gray-400 leading-relaxed">{event}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-20 px-6 border-t border-gray-800 bg-gray-950">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-4">Our Values</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">How we build</h2>
            <p className="text-gray-400 text-lg max-w-xl mx-auto">
              These principles guide every product decision, every customer conversation, and every line of code.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5 max-w-5xl mx-auto">
            {VALUES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="p-6 rounded-2xl border border-gray-800 bg-black">
                <Icon className="h-5 w-5 text-brand-400 mb-4" />
                <h3 className="font-semibold text-white text-sm mb-3">{title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* The Future */}
      <section className="py-20 px-6 border-t border-gray-800">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-4">The Future</p>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight leading-tight mb-5">
                AI-assisted player protection is only beginning.
              </h2>
              <p className="text-gray-400 text-lg leading-relaxed mb-5">
                Today, SafeBet IQ monitors sessions and triggers interventions. Tomorrow, Nova IQ will predict harm before it begins — identifying the player who is likely to develop a problem three months before the first warning sign appears.
              </p>
              <p className="text-gray-400 text-lg leading-relaxed mb-8">
                We are building the responsible gambling intelligence infrastructure that the entire African continent will need as regulated gambling markets expand. South Africa is the starting point, not the endpoint.
              </p>
              <Button asChild className="bg-brand-400 hover:bg-brand-500 text-black font-semibold h-11 px-7">
                <Link href="/contact">
                  Join Our Mission
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
            <div className="space-y-4">
              {[
                { label: 'Predictive harm prevention', desc: 'Identifying risk patterns weeks before they become interventions' },
                { label: 'Expanded African coverage', desc: 'Extending the platform to regulated markets across the continent' },
                { label: 'Real-time treatment referral', desc: 'Connecting at-risk players directly to NRGP counselling services' },
                { label: 'Cross-sector intelligence', desc: 'Integrating with financial intelligence to detect harm-adjacent patterns' },
              ].map(({ label, desc }) => (
                <div key={label} className="flex gap-4 p-4 rounded-xl border border-gray-800 bg-gray-950">
                  <div className="w-1.5 h-1.5 rounded-full bg-brand-400 flex-shrink-0 mt-2" />
                  <div>
                    <p className="font-semibold text-white text-sm mb-1">{label}</p>
                    <p className="text-sm text-gray-400">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 border-t border-gray-800 bg-gray-950">
        <div className="max-w-7xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-5">
            Ready to see it in action?
          </h2>
          <p className="text-gray-400 text-lg max-w-xl mx-auto mb-10 leading-relaxed">
            Book a 45-minute demonstration and see how SafeBet IQ transforms responsible gambling compliance.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button asChild size="lg" className="bg-brand-400 hover:bg-brand-500 text-black font-semibold px-10 h-12">
              <Link href="/contact">
                Book a Demo
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white font-medium px-8 h-12">
              <Link href="/login">View Live Platform</Link>
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
