'use client';

import { useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import {
  Book, Search, Shield, Users, Building2, Globe, Settings, FileText,
  ChevronRight, Plug, Lock, AlertTriangle, Activity, Bell, ShieldOff,
  HelpCircle, Video, MessageCircle, CheckCircle2, BarChart3, Key, Eye,
  Download, Clock, Zap, Info,
} from 'lucide-react';

interface Article {
  id: string;
  title: string;
  description: string;
  category: string;
  readTime: string;
  tags: string[];
  icon: React.ElementType;
  popular?: boolean;
}

const ARTICLES: Article[] = [
  // Getting Started
  { id: 'gs-1', title: 'Getting Started as Casino Admin', description: 'Complete walkthrough of your Operator Compliance Platform — from first login to running your first intervention.', category: 'Getting Started', readTime: '5 min', tags: ['onboarding', 'casino', 'dashboard'], icon: Building2, popular: true },
  { id: 'gs-2', title: 'Getting Started as National Regulator', description: 'Understand your nationwide oversight capabilities and how to monitor all licensed operators from one dashboard.', category: 'Getting Started', readTime: '4 min', tags: ['onboarding', 'regulator', 'overview'], icon: Globe, popular: true },
  { id: 'gs-3', title: 'Getting Started as Compliance Officer', description: 'Your role in player protection — monitoring alerts, managing interventions, and maintaining compliance records.', category: 'Getting Started', readTime: '5 min', tags: ['onboarding', 'compliance', 'interventions'], icon: Shield },
  { id: 'gs-4', title: 'Understanding the SafeBet IQ Dashboard', description: 'A tour of the main dashboard sections: KPI strip, tabs, live feed, and navigation sidebar.', category: 'Getting Started', readTime: '3 min', tags: ['dashboard', 'navigation', 'ui'], icon: BarChart3 },
  // Player Risk
  { id: 'pr-1', title: 'How Player Risk Scores Are Calculated', description: 'The AI engine evaluates 40+ behavioural signals to produce a 0–100 risk score. Understand what drives it.', category: 'Player Risk', readTime: '6 min', tags: ['ai', 'risk score', 'behaviour'], icon: Activity, popular: true },
  { id: 'pr-2', title: 'Reading a Player Risk Profile', description: 'Interpreting the risk signal breakdown, session patterns, cognitive fatigue index, and persona shift indicators.', category: 'Player Risk', readTime: '4 min', tags: ['risk profile', 'signals', 'analytics'], icon: Eye },
  { id: 'pr-3', title: 'Critical vs High Risk: What to Do', description: 'Step-by-step response protocols for critical (80+) and high (60–79) risk players under NGA §26.', category: 'Player Risk', readTime: '5 min', tags: ['critical', 'high risk', 'protocol'], icon: AlertTriangle },
  { id: 'pr-4', title: 'Risk Score Thresholds Explained', description: 'Understanding the four risk bands — Low (0–39), Medium (40–59), High (60–79), Critical (80–100) — and their implications.', category: 'Player Risk', readTime: '3 min', tags: ['thresholds', 'bands', 'scoring'], icon: BarChart3 },
  // Interventions
  { id: 'int-1', title: 'Dispatching a Manual Intervention', description: 'How to create, assign, and track a responsible gambling intervention for a flagged player.', category: 'Interventions', readTime: '4 min', tags: ['manual', 'dispatch', 'intervention'], icon: Bell, popular: true },
  { id: 'int-2', title: 'Auto-Trigger Intervention Rules', description: 'Setting up automatic intervention dispatch when risk thresholds are crossed — without manual review.', category: 'Interventions', readTime: '5 min', tags: ['auto', 'trigger', 'rules'], icon: Zap },
  { id: 'int-3', title: 'Intervention Outcomes and Recording', description: 'Recording outcomes (accepted, declined, no contact) and meeting your NGA §26(3) documentation obligations.', category: 'Interventions', readTime: '3 min', tags: ['outcomes', 'recording', 'nga'], icon: CheckCircle2 },
  { id: 'int-4', title: 'Nova IQ Wellbeing Assessment Tool', description: 'Using the Nova IQ cognitive wellbeing assessment — how it works, how to send invitations, and interpreting results.', category: 'Interventions', readTime: '5 min', tags: ['nova iq', 'wellbeing', 'assessment'], icon: Shield },
  // Self-Exclusion
  { id: 'se-1', title: 'Self-Exclusion Register Overview', description: 'Managing your active self-exclusion register, SARGF compliance, and reinstatement queue.', category: 'Self-Exclusion', readTime: '5 min', tags: ['exclusion', 'register', 'sargf'], icon: ShieldOff },
  { id: 'se-2', title: 'Cross-Casino Breach Detection', description: 'How SafeBet IQ detects self-excluded players attempting to gamble at other licensed casinos.', category: 'Self-Exclusion', readTime: '4 min', tags: ['breach', 'cross-casino', 'detection'], icon: Globe },
  // Compliance
  { id: 'comp-1', title: 'Understanding Your Compliance Score', description: 'How the compliance score is calculated from risk coverage, intervention rates, training compliance, and documentation.', category: 'Compliance', readTime: '4 min', tags: ['score', 'compliance', 'nga'], icon: Shield, popular: true },
  { id: 'comp-2', title: 'Monthly Report Obligations (NGA §26)', description: 'What the National Gambling Act requires you to report monthly and how SafeBet IQ automates this.', category: 'Compliance', readTime: '5 min', tags: ['monthly report', 'nga', 'obligations'], icon: FileText },
  { id: 'comp-3', title: 'Preparing for a Regulator Audit', description: 'Using the Audit Centre, generating submission packages, and ensuring your documentation is regulator-ready.', category: 'Compliance', readTime: '6 min', tags: ['audit', 'regulator', 'preparation'], icon: Book },
  // API & Integration
  { id: 'api-1', title: 'SafeBet IQ Connect — API Overview', description: 'Introduction to the SafePlay Connect REST API: authentication, data ingestion, webhook events, and rate limits.', category: 'API & Integration', readTime: '8 min', tags: ['api', 'rest', 'integration'], icon: Plug, popular: true },
  { id: 'api-2', title: 'Configuring API Keys', description: 'Generating, rotating, and managing API keys for your casino integration.', category: 'API & Integration', readTime: '3 min', tags: ['api keys', 'authentication', 'security'], icon: Key },
  { id: 'api-3', title: 'CSV Player Data Import', description: 'Uploading player data via CSV for casinos that are not yet integrated via the live API.', category: 'API & Integration', readTime: '4 min', tags: ['csv', 'import', 'data'], icon: Download },
  // Security
  { id: 'sec-1', title: 'Multi-Factor Authentication Setup', description: 'Enabling and managing MFA for your account and all users in your casino — a compliance requirement.', category: 'Security', readTime: '3 min', tags: ['mfa', 'authentication', 'security'], icon: Lock },
  { id: 'sec-2', title: 'Managing User Roles and Permissions', description: 'Casino Admin, Compliance Officer, and Staff roles — what each can see and do.', category: 'Security', readTime: '4 min', tags: ['roles', 'permissions', 'users'], icon: Users },
  { id: 'sec-3', title: 'Understanding the Security Audit Log', description: 'Reading the append-only security event log, filtering events, and exporting for POPIA compliance.', category: 'Security', readTime: '4 min', tags: ['audit log', 'popia', 'security'], icon: Eye },
];

const CATEGORIES = ['Getting Started', 'Player Risk', 'Interventions', 'Self-Exclusion', 'Compliance', 'API & Integration', 'Security'];

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  'Getting Started': Zap,
  'Player Risk': Activity,
  'Interventions': Bell,
  'Self-Exclusion': ShieldOff,
  'Compliance': Shield,
  'API & Integration': Plug,
  'Security': Lock,
};

const CATEGORY_COLORS: Record<string, string> = {
  'Getting Started': 'text-blue-600 bg-blue-50 border-blue-200',
  'Player Risk': 'text-orange-600 bg-orange-50 border-orange-200',
  'Interventions': 'text-yellow-600 bg-yellow-50 border-yellow-200',
  'Self-Exclusion': 'text-red-600 bg-red-50 border-red-200',
  'Compliance': 'text-emerald-600 bg-emerald-50 border-emerald-200',
  'API & Integration': 'text-purple-600 bg-purple-50 border-purple-200',
  'Security': 'text-slate-600 bg-slate-50 border-slate-200',
};

export default function HelpCentrePage() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('home');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);

  const filteredArticles = ARTICLES.filter(a => {
    const matchesSearch = !search || (
      a.title.toLowerCase().includes(search.toLowerCase()) ||
      a.description.toLowerCase().includes(search.toLowerCase()) ||
      a.tags.some(t => t.includes(search.toLowerCase()))
    );
    const matchesCategory = !activeCategory || a.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const popularArticles = ARTICLES.filter(a => a.popular);

  function ArticleCard({ article }: { article: Article }) {
    const Icon = article.icon;
    const catColors = CATEGORY_COLORS[article.category] || 'text-slate-600 bg-slate-50 border-slate-200';
    return (
      <div
        className="p-4 border rounded-lg hover:border-primary/30 hover:bg-muted/20 transition-all cursor-pointer"
        onClick={() => setSelectedArticle(article)}
      >
        <div className="flex items-start gap-3">
          <div className={`w-8 h-8 rounded-lg border flex items-center justify-center flex-shrink-0 ${catColors}`}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold leading-tight">{article.title}</p>
              {article.popular && <Badge className="text-[10px] border-0 bg-primary/10 text-primary flex-shrink-0">Popular</Badge>}
            </div>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-2">{article.description}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />{article.readTime} read
              </span>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">{article.category}</Badge>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
        </div>
      </div>
    );
  }

  function ArticleDetail({ article, onBack }: { article: Article; onBack: () => void }) {
    const Icon = article.icon;
    const catColors = CATEGORY_COLORS[article.category] || 'text-slate-600 bg-slate-50 border-slate-200';
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={onBack}>
            ← Back to Help Centre
          </Button>
        </div>
        <Card>
          <CardContent className="pt-6 pb-6">
            <div className="flex items-start gap-4 mb-6">
              <div className={`w-12 h-12 rounded-xl border flex items-center justify-center flex-shrink-0 ${catColors}`}>
                <Icon className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold">{article.title}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-xs">{article.category}</Badge>
                  <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />{article.readTime} read</span>
                </div>
              </div>
            </div>

            <div className="prose prose-sm max-w-none text-sm text-muted-foreground space-y-4">
              <p className="text-foreground font-medium">{article.description}</p>

              {article.category === 'Getting Started' && article.id === 'gs-1' && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-base font-semibold text-foreground mb-2">Step 1 — Log In</h3>
                    <p>Navigate to your SafeBet IQ portal and sign in with your casino administrator credentials. You will land directly on your Operator Compliance Platform dashboard.</p>
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-foreground mb-2">Step 2 — Review Your KPI Strip</h3>
                    <p>The top of the dashboard shows eight live KPIs: Total Players, Critical Risk, Pending Alerts, Active Sessions, Self-Excluded, Open Breaches, Today's Alerts, and your Compliance Score. Review these first every day.</p>
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-foreground mb-2">Step 3 — Check Intervention Alerts</h3>
                    <p>Navigate to the Interventions tab. Any player with a pending intervention requiring action will be listed here. Resolve or dispatch each alert before end of shift to maintain NGA compliance.</p>
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-foreground mb-2">Step 4 — Review High Risk Players</h3>
                    <p>Go to Player Risk Monitoring and filter for Critical (80+) players. Each player has a full profile with risk signal breakdown, session history, and AI recommendation.</p>
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-foreground mb-2">Step 5 — Generate Monthly Report</h3>
                    <p>Before the 5th of each month, navigate to the Reporting Centre and generate your Monthly Compliance Report. Download the PDF and file it with your compliance records.</p>
                  </div>
                </div>
              )}

              {article.category === 'Player Risk' && article.id === 'pr-1' && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-base font-semibold text-foreground mb-2">The Risk Score Algorithm</h3>
                    <p>The SafeBet IQ Behavioural Intelligence Engine evaluates each active player session in real time against 40+ behavioural signals, producing a risk score from 0 (no concern) to 100 (critical risk).</p>
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-foreground mb-2">Key Signals Evaluated</h3>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Session duration and time-of-day patterns</li>
                      <li>Bet size velocity and escalation rate</li>
                      <li>Win/loss response behaviour (chasing)</li>
                      <li>Deposit frequency and amount changes</li>
                      <li>Game type switching patterns</li>
                      <li>Cognitive Fatigue Index (sustained high-frequency play)</li>
                      <li>Historical intervention acceptance rates</li>
                      <li>Self-exclusion history and reinstatement patterns</li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-foreground mb-2">Score Update Frequency</h3>
                    <p>Risk scores are recalculated every 15 minutes during active sessions. For players with critical signals, recalculation occurs every 5 minutes.</p>
                  </div>
                </div>
              )}

              {article.id !== 'gs-1' && article.id !== 'pr-1' && (
                <div className="space-y-3">
                  <div className="p-4 bg-muted/30 rounded-lg border border-dashed">
                    <p className="text-sm text-muted-foreground text-center flex items-center justify-center gap-2">
                      <Info className="h-4 w-4" />
                      Full article content available in the complete Help Centre documentation.
                    </p>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3 pt-2">
                    <div className="p-3 bg-muted/20 rounded-lg">
                      <p className="text-xs font-semibold mb-1">Related Articles</p>
                      {ARTICLES.filter(a => a.category === article.category && a.id !== article.id).slice(0, 3).map(a => (
                        <button key={a.id} className="block text-xs text-primary hover:underline text-left py-0.5 w-full" onClick={() => setSelectedArticle(a)}>
                          → {a.title}
                        </button>
                      ))}
                    </div>
                    <div className="p-3 bg-muted/20 rounded-lg">
                      <p className="text-xs font-semibold mb-1">Tags</p>
                      <div className="flex flex-wrap gap-1">
                        {article.tags.map(t => (
                          <Badge key={t} variant="outline" className="text-[10px] px-1.5 py-0">{t}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (selectedArticle) {
    return (
      <DashboardLayout>
        <div className="p-6 max-w-4xl mx-auto">
          <ArticleDetail article={selectedArticle} onBack={() => setSelectedArticle(null)} />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex min-h-full flex-col">

        {/* Header */}
        <div className="border-b bg-card px-6 py-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <HelpCircle className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Help Centre</h1>
              <p className="text-sm text-muted-foreground">Guides, documentation, and platform knowledge base</p>
            </div>
          </div>

          {/* Search */}
          <div className="relative max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Search articles, guides, and documentation..."
              value={search}
              onChange={e => { setSearch(e.target.value); setActiveCategory(null); if (activeTab !== 'library') setActiveTab('library'); }}
              className="pl-10 h-11 text-sm"
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex-1 overflow-auto">
          <Tabs value={activeTab} onValueChange={tab => { setActiveTab(tab); setSearch(''); setActiveCategory(null); }}>
            <div className="border-b bg-card px-6 pt-2 pb-0">
              <TabsList className="h-auto bg-transparent p-0 gap-0 border-0">
                {[
                  { id: 'home', label: 'Home', icon: Book },
                  { id: 'library', label: 'Article Library', icon: FileText },
                  { id: 'guides', label: 'Role Guides', icon: Users },
                  { id: 'support', label: 'Support', icon: MessageCircle },
                ].map(tab => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <TabsTrigger
                      key={tab.id}
                      value={tab.id}
                      className={`relative flex items-center gap-2 px-4 py-3 text-sm font-medium rounded-none border-b-2 transition-colors ${isActive ? 'border-primary text-foreground bg-transparent' : 'border-transparent text-muted-foreground hover:text-foreground bg-transparent'}`}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="hidden sm:inline">{tab.label}</span>
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </div>

            <div className="p-6 min-w-0">

              {/* ── HOME ── */}
              <TabsContent value="home" className="mt-0 space-y-6">

                {/* Category Cards */}
                <div>
                  <h2 className="text-base font-semibold mb-3">Browse by Topic</h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {CATEGORIES.map(cat => {
                      const Icon = CATEGORY_ICONS[cat] || Book;
                      const colorClass = CATEGORY_COLORS[cat] || '';
                      const count = ARTICLES.filter(a => a.category === cat).length;
                      return (
                        <button
                          key={cat}
                          className={`p-4 rounded-xl border text-left transition-all hover:shadow-sm hover:border-primary/30 ${colorClass}`}
                          onClick={() => { setActiveCategory(cat); setActiveTab('library'); }}
                        >
                          <Icon className="h-5 w-5 mb-2" />
                          <p className="text-sm font-semibold">{cat}</p>
                          <p className="text-xs mt-0.5 opacity-70">{count} articles</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Popular Articles */}
                <div>
                  <h2 className="text-base font-semibold mb-3">Popular Articles</h2>
                  <div className="space-y-2">
                    {popularArticles.map(a => <ArticleCard key={a.id} article={a} />)}
                  </div>
                </div>

                {/* Quick Links */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Quick Reference</CardTitle>
                    <CardDescription className="text-xs">Most common actions and where to find them</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-2 gap-2">
                      {[
                        { label: 'View Player Risk Scores', path: '/casino/players', icon: Activity },
                        { label: 'Dispatch Intervention', path: '/casino/interventions', icon: Bell },
                        { label: 'Generate Compliance Report', path: '/casino/reports', icon: FileText },
                        { label: 'Review Audit Log', path: '/admin/audit', icon: Shield },
                        { label: 'Self-Exclusion Register', path: '/casino/dashboard', icon: ShieldOff },
                        { label: 'Manage API Keys', path: '/casino/api-centre', icon: Key },
                        { label: 'Manage Staff & Training', path: '/casino/staff', icon: Users },
                        { label: 'Security Settings', path: '/admin/security', icon: Lock },
                      ].map((link, i) => {
                        const Icon = link.icon;
                        return (
                          <a
                            key={i}
                            href={link.path}
                            className="flex items-center gap-2 p-2.5 rounded-lg hover:bg-muted/30 transition-colors text-sm"
                          >
                            <Icon className="h-4 w-4 text-primary flex-shrink-0" />
                            <span>{link.label}</span>
                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground ml-auto" />
                          </a>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ── LIBRARY ── */}
              <TabsContent value="library" className="mt-0 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h2 className="text-base font-semibold">
                      {activeCategory ? `${activeCategory} Articles` : search ? `Search: "${search}"` : 'All Articles'}
                    </h2>
                    <p className="text-sm text-muted-foreground">{filteredArticles.length} articles</p>
                  </div>
                  {activeCategory && (
                    <Button variant="ghost" size="sm" className="text-xs" onClick={() => setActiveCategory(null)}>
                      ← All categories
                    </Button>
                  )}
                </div>

                {/* Category filter pills */}
                {!activeCategory && !search && (
                  <div className="flex flex-wrap gap-2">
                    {CATEGORIES.map(cat => (
                      <Button
                        key={cat}
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => setActiveCategory(cat)}
                      >
                        {cat} ({ARTICLES.filter(a => a.category === cat).length})
                      </Button>
                    ))}
                  </div>
                )}

                {filteredArticles.length === 0 ? (
                  <div className="py-16 text-center text-muted-foreground">
                    <Search className="h-8 w-8 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No articles found for "{search}"</p>
                    <Button variant="ghost" size="sm" className="mt-2 text-xs" onClick={() => setSearch('')}>Clear search</Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredArticles.map(a => <ArticleCard key={a.id} article={a} />)}
                  </div>
                )}
              </TabsContent>

              {/* ── ROLE GUIDES ── */}
              <TabsContent value="guides" className="mt-0 space-y-4">
                <div>
                  <h2 className="text-base font-semibold">Role-Specific Guides</h2>
                  <p className="text-sm text-muted-foreground">Step-by-step platform guidance tailored to your role</p>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  {[
                    {
                      role: 'Casino Administrator',
                      icon: Building2,
                      color: 'text-blue-600 bg-blue-50 border-blue-200',
                      description: 'Full platform access — player risk, interventions, compliance, reporting, and staff management.',
                      guides: [
                        'Setting up your casino profile',
                        'Daily compliance checklist',
                        'Responding to critical risk alerts',
                        'Running monthly compliance reports',
                        'Managing staff and training',
                        'API integration setup',
                      ],
                    },
                    {
                      role: 'National Regulator',
                      icon: Globe,
                      color: 'text-emerald-600 bg-emerald-50 border-emerald-200',
                      description: 'Cross-casino oversight — all licensed operators, national statistics, intervention trends, and compliance monitoring.',
                      guides: [
                        'Understanding national overview dashboard',
                        'Monitoring operator compliance scores',
                        'Reviewing high-risk player analytics',
                        'Comparing operator intervention rates',
                        'Generating audit reports',
                        'Cross-casino breach investigation',
                      ],
                    },
                    {
                      role: 'Provincial Regulator',
                      icon: Globe,
                      color: 'text-teal-600 bg-teal-50 border-teal-200',
                      description: 'Province-level oversight — operators in your jurisdiction, provincial risk profiles, and compliance enforcement.',
                      guides: [
                        'Filtering by your jurisdiction',
                        'Reviewing provincial operator performance',
                        'Investigating high-risk player patterns',
                        'Generating provincial reports',
                        'Compliance enforcement workflow',
                      ],
                    },
                    {
                      role: 'Compliance Officer',
                      icon: Shield,
                      color: 'text-orange-600 bg-orange-50 border-orange-200',
                      description: 'Player protection focus — monitoring alerts, managing interventions, tracking compliance obligations.',
                      guides: [
                        'Daily alert monitoring workflow',
                        'Intervention dispatch and tracking',
                        'Self-exclusion compliance checks',
                        'Compliance score interpretation',
                        'Regulatory reporting obligations',
                        'Evidence documentation',
                      ],
                    },
                    {
                      role: 'Staff Member',
                      icon: Users,
                      color: 'text-purple-600 bg-purple-50 border-purple-200',
                      description: 'Training and responsible gambling skills — complete your training academy, access resources.',
                      guides: [
                        'Completing training academy modules',
                        'Recognising problem gambling signs',
                        'Initiating responsible gambling conversations',
                        'Using the self-exclusion process',
                        'Escalation procedures',
                      ],
                    },
                    {
                      role: 'Super Administrator',
                      icon: Settings,
                      color: 'text-slate-600 bg-slate-50 border-slate-200',
                      description: 'Platform-wide management — all casinos, users, modules, integrations, and system configuration.',
                      guides: [
                        'Adding and configuring casino operators',
                        'Managing user accounts and roles',
                        'Activating feature modules',
                        'Cross-operator intelligence setup',
                        'Security event monitoring',
                        'Performance and infrastructure',
                      ],
                    },
                  ].map((guide, i) => {
                    const Icon = guide.icon;
                    return (
                      <Card key={i} className={`border ${guide.color.split(' ').slice(2).join(' ')}`}>
                        <CardContent className="pt-4 pb-4">
                          <div className="flex items-start gap-3 mb-3">
                            <div className={`w-9 h-9 rounded-lg border flex items-center justify-center flex-shrink-0 ${guide.color}`}>
                              <Icon className="h-4.5 w-4.5" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold">{guide.role}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{guide.description}</p>
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            {guide.guides.map((item, j) => (
                              <div key={j} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer transition-colors group">
                                <ChevronRight className="h-3 w-3 group-hover:text-primary" />
                                {item}
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </TabsContent>

              {/* ── SUPPORT ── */}
              <TabsContent value="support" className="mt-0 space-y-4">
                <div>
                  <h2 className="text-base font-semibold">Support & Contact</h2>
                  <p className="text-sm text-muted-foreground">Get help from the SafeBet IQ team</p>
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                  {[
                    { icon: MessageCircle, title: 'Technical Support', desc: 'Platform issues, login problems, data queries, and integration help.', detail: 'support@safebetiq.com', tag: 'Priority response within 4 hours', color: 'text-blue-600 bg-blue-50 border-blue-200' },
                    { icon: FileText, title: 'Compliance Queries', desc: 'Questions about NGA obligations, NRGP requirements, and regulatory submissions.', detail: 'compliance@safebetiq.com', tag: 'Response within 24 hours', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
                    { icon: Plug, title: 'API & Integration', desc: 'Technical integration support, API documentation, and developer queries.', detail: 'api@safebetiq.com', tag: 'Business hours response', color: 'text-purple-600 bg-purple-50 border-purple-200' },
                  ].map((s, i) => {
                    const Icon = s.icon;
                    return (
                      <Card key={i} className={`border ${s.color.split(' ').slice(2).join(' ')}`}>
                        <CardContent className="pt-5 pb-5">
                          <div className={`w-10 h-10 rounded-xl border flex items-center justify-center mb-3 ${s.color}`}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <p className="text-sm font-semibold">{s.title}</p>
                          <p className="text-xs text-muted-foreground mt-1 mb-3">{s.desc}</p>
                          <p className="text-xs font-medium">{s.detail}</p>
                          <Badge className="mt-2 text-[10px] border-0 bg-muted text-muted-foreground">{s.tag}</Badge>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Platform Information</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-2 gap-4 text-sm">
                      {[
                        { label: 'Platform Version', value: 'SafeBet IQ v2.0' },
                        { label: 'Last Updated', value: 'June 2026' },
                        { label: 'Compliance Standard', value: 'National Gambling Act 7 of 2004' },
                        { label: 'Data Protection', value: 'POPIA compliant' },
                        { label: 'Security Standard', value: 'ISO 27001:2022' },
                        { label: 'Data Region', value: 'South Africa (af-south-1)' },
                        { label: 'Uptime SLA', value: '99.9% monthly' },
                        { label: 'Support Hours', value: 'Mon–Fri 07:00–19:00 SAST' },
                      ].map((item, i) => (
                        <div key={i} className="flex items-center justify-between py-1.5 border-b last:border-0">
                          <span className="text-muted-foreground text-xs">{item.label}</span>
                          <span className="text-xs font-medium">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

            </div>
          </Tabs>
        </div>
      </div>
    </DashboardLayout>
  );
}
