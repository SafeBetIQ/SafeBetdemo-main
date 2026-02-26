'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { supabase } from '@/lib/supabase';
import { formatPercentage } from '@/lib/utils';
import {
  Shield,
  TrendingUp,
  TrendingDown,
  Minus,
  Award,
  FileCheck,
  Users,
  Building2,
  Leaf,
  Heart,
  Scale,
  CheckCircle,
  AlertCircle,
  Download,
  Eye
} from 'lucide-react';

interface ESGScore {
  id: string;
  composite_score: number;
  environmental_score: number;
  social_score: number;
  governance_score: number;
  environmental_weighted: number;
  social_weighted: number;
  governance_weighted: number;
  ethical_culture_score: number;
  good_performance_score: number;
  effective_control_score: number;
  legitimacy_score: number;
  trend_direction: string;
  score_change: number;
  scoring_period_start: string;
  scoring_period_end: string;
}

interface KingIVPrinciple {
  id: string;
  principle_number: number;
  principle_title: string;
  principle_description: string;
  esg_category: string;
  esg_weighting: number;
}

interface ComplianceStatus {
  compliance_level: string;
  compliance_score: number;
  explanation: string;
  improvement_areas: string[];
  king_iv_principle_id: string;
}

export default function KingIVESGDashboard({ casinoId }: { casinoId: string }) {
  const [esgScore, setEsgScore] = useState<ESGScore | null>(null);
  const [principles, setPrinciples] = useState<KingIVPrinciple[]>([]);
  const [complianceStatus, setComplianceStatus] = useState<ComplianceStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadESGData();
  }, [casinoId]);

  const loadESGData = async () => {
    try {
      setLoading(true);

      // Fetch latest ESG score
      const { data: scoreData } = await supabase
        .from('esg_scores')
        .select('*')
        .eq('casino_id', casinoId)
        .order('scoring_period_end', { ascending: false })
        .limit(1)
        .single();

      if (scoreData) setEsgScore(scoreData);

      // Fetch King IV principles
      const { data: principlesData } = await supabase
        .from('king_iv_principles')
        .select('*')
        .order('principle_number');

      if (principlesData) setPrinciples(principlesData);

      // Fetch compliance status
      const { data: complianceData } = await supabase
        .from('king_iv_compliance_status')
        .select('*')
        .eq('casino_id', casinoId)
        .order('compliance_score', { ascending: false });

      if (complianceData) setComplianceStatus(complianceData);
    } catch (error) {
      console.error('Error loading ESG data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 80) return 'bg-green-100';
    if (score >= 60) return 'bg-yellow-100';
    return 'bg-red-100';
  };

  const getComplianceBadgeColor = (level: string) => {
    switch (level) {
      case 'applied': return 'bg-green-500';
      case 'partially_applied': return 'bg-yellow-500';
      case 'not_applied': return 'bg-red-500';
      case 'not_applicable': return 'bg-gray-500';
      default: return 'bg-blue-500';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving': return <TrendingUp className="h-5 w-5 text-green-600" />;
      case 'declining': return <TrendingDown className="h-5 w-5 text-red-600" />;
      case 'stable': return <Minus className="h-5 w-5 text-gray-600" />;
      default: return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-500"></div>
      </div>
    );
  }

  if (!esgScore) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No ESG scores available yet. Calculate your first King IV ESG score.</p>
          <Button className="mt-4">Calculate ESG Score</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Composite Score */}
      <Card className="border-2 border-brand-400">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-3xl">King IV ESG Score</CardTitle>
              <CardDescription>
                Principles-based governance for responsible gambling
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export Report
              </Button>
              <Button variant="outline" size="sm">
                <Eye className="h-4 w-4 mr-2" />
                View Evidence
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="flex flex-col items-center justify-center">
              <div className={`text-8xl font-bold ${getScoreColor(esgScore.composite_score)}`}>
                {esgScore.composite_score.toFixed(1)}
              </div>
              <div className="text-xl text-gray-600 mt-2">Composite Score</div>
              <div className="flex items-center gap-2 mt-4">
                {getTrendIcon(esgScore.trend_direction)}
                <span className="text-sm text-gray-600 capitalize">
                  {esgScore.trend_direction}
                  {esgScore.score_change !== null && (
                    <span className="ml-2">
                      ({esgScore.score_change > 0 ? '+' : ''}{esgScore.score_change.toFixed(1)})
                    </span>
                  )}
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Leaf className="h-5 w-5 text-green-600" />
                    <span className="font-semibold">Environmental (15%)</span>
                  </div>
                  <span className={`text-lg font-bold ${getScoreColor(esgScore.environmental_score)}`}>
                    {esgScore.environmental_score.toFixed(1)}
                  </span>
                </div>
                <Progress value={esgScore.environmental_score} className="h-2" />
                <div className="text-xs text-gray-600 mt-1">
                  Weighted contribution: {esgScore.environmental_weighted.toFixed(1)} points
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Heart className="h-5 w-5 text-pink-600" />
                    <span className="font-semibold">Social (55%)</span>
                  </div>
                  <span className={`text-lg font-bold ${getScoreColor(esgScore.social_score)}`}>
                    {esgScore.social_score.toFixed(1)}
                  </span>
                </div>
                <Progress value={esgScore.social_score} className="h-2" />
                <div className="text-xs text-gray-600 mt-1">
                  Weighted contribution: {esgScore.social_weighted.toFixed(1)} points
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Scale className="h-5 w-5 text-blue-600" />
                    <span className="font-semibold">Governance (30%)</span>
                  </div>
                  <span className={`text-lg font-bold ${getScoreColor(esgScore.governance_score)}`}>
                    {esgScore.governance_score.toFixed(1)}
                  </span>
                </div>
                <Progress value={esgScore.governance_score} className="h-2" />
                <div className="text-xs text-gray-600 mt-1">
                  Weighted contribution: {esgScore.governance_weighted.toFixed(1)} points
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* King IV Outcomes */}
      <Card>
        <CardHeader>
          <CardTitle>King IV Outcomes</CardTitle>
          <CardDescription>
            The four outcomes of good corporate governance
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className={getScoreBgColor(esgScore.ethical_culture_score)}>
              <CardContent className="p-6">
                <Award className="h-8 w-8 mb-3" />
                <div className={`text-3xl font-bold ${getScoreColor(esgScore.ethical_culture_score)}`}>
                  {esgScore.ethical_culture_score.toFixed(0)}
                </div>
                <div className="text-sm font-semibold mt-2">Ethical Culture</div>
              </CardContent>
            </Card>

            <Card className={getScoreBgColor(esgScore.good_performance_score)}>
              <CardContent className="p-6">
                <TrendingUp className="h-8 w-8 mb-3" />
                <div className={`text-3xl font-bold ${getScoreColor(esgScore.good_performance_score)}`}>
                  {esgScore.good_performance_score.toFixed(0)}
                </div>
                <div className="text-sm font-semibold mt-2">Good Performance</div>
              </CardContent>
            </Card>

            <Card className={getScoreBgColor(esgScore.effective_control_score)}>
              <CardContent className="p-6">
                <Shield className="h-8 w-8 mb-3" />
                <div className={`text-3xl font-bold ${getScoreColor(esgScore.effective_control_score)}`}>
                  {esgScore.effective_control_score.toFixed(0)}
                </div>
                <div className="text-sm font-semibold mt-2">Effective Control</div>
              </CardContent>
            </Card>

            <Card className={getScoreBgColor(esgScore.legitimacy_score)}>
              <CardContent className="p-6">
                <CheckCircle className="h-8 w-8 mb-3" />
                <div className={`text-3xl font-bold ${getScoreColor(esgScore.legitimacy_score)}`}>
                  {esgScore.legitimacy_score.toFixed(0)}
                </div>
                <div className="text-sm font-semibold mt-2">Legitimacy</div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* King IV Principles Compliance */}
      <Card>
        <CardHeader>
          <CardTitle>17 King IV Principles - Compliance Status</CardTitle>
          <CardDescription>
            Apply or explain framework for each principle
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="all">All Principles</TabsTrigger>
              <TabsTrigger value="environmental">Environmental</TabsTrigger>
              <TabsTrigger value="social">Social</TabsTrigger>
              <TabsTrigger value="governance">Governance</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="space-y-4 mt-6">
              <Accordion type="single" collapsible className="w-full">
                {principles.map((principle) => {
                  const status = complianceStatus.find(
                    (s) => s.king_iv_principle_id === principle.id
                  );
                  return (
                    <AccordionItem key={principle.id} value={principle.id}>
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex items-center justify-between w-full pr-4">
                          <div className="flex items-center gap-4">
                            <div className="flex items-center justify-center w-10 h-10 bg-brand-400 text-black rounded-full font-bold">
                              {principle.principle_number}
                            </div>
                            <div className="text-left">
                              <div className="font-semibold">{principle.principle_title}</div>
                              <div className="text-xs text-gray-600">
                                {principle.esg_category} • {principle.esg_weighting}% weighting
                              </div>
                            </div>
                          </div>
                          {status && (
                            <div className="flex items-center gap-2">
                              <Badge className={getComplianceBadgeColor(status.compliance_level)}>
                                {status.compliance_level.replace('_', ' ')}
                              </Badge>
                              <span className="text-sm font-semibold">
                                {formatPercentage(status.compliance_score)}
                              </span>
                            </div>
                          )}
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="pl-14 space-y-4">
                          <p className="text-sm text-gray-700">{principle.principle_description}</p>
                          {status && (
                            <div className="space-y-3">
                              <div>
                                <h4 className="font-semibold text-sm mb-2">Explanation:</h4>
                                <p className="text-sm text-gray-700">{status.explanation}</p>
                              </div>
                              {status.improvement_areas && status.improvement_areas.length > 0 && (
                                <div>
                                  <h4 className="font-semibold text-sm mb-2">Improvement Areas:</h4>
                                  <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                                    {status.improvement_areas.map((area, idx) => (
                                      <li key={idx}>{area}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </TabsContent>

            <TabsContent value="environmental" className="space-y-4 mt-6">
              <Accordion type="single" collapsible className="w-full">
                {principles
                  .filter((p) => p.esg_category === 'environmental')
                  .map((principle) => {
                    const status = complianceStatus.find(
                      (s) => s.king_iv_principle_id === principle.id
                    );
                    return (
                      <AccordionItem key={principle.id} value={principle.id}>
                        <AccordionTrigger>
                          <div className="flex items-center gap-4">
                            <Leaf className="h-5 w-5 text-green-600" />
                            <span>Principle {principle.principle_number}: {principle.principle_title}</span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <p className="text-sm text-gray-700">{principle.principle_description}</p>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
              </Accordion>
            </TabsContent>

            <TabsContent value="social" className="space-y-4 mt-6">
              <Accordion type="single" collapsible className="w-full">
                {principles
                  .filter((p) => p.esg_category === 'social')
                  .map((principle) => {
                    const status = complianceStatus.find(
                      (s) => s.king_iv_principle_id === principle.id
                    );
                    return (
                      <AccordionItem key={principle.id} value={principle.id}>
                        <AccordionTrigger>
                          <div className="flex items-center gap-4">
                            <Heart className="h-5 w-5 text-pink-600" />
                            <span>Principle {principle.principle_number}: {principle.principle_title}</span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <p className="text-sm text-gray-700">{principle.principle_description}</p>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
              </Accordion>
            </TabsContent>

            <TabsContent value="governance" className="space-y-4 mt-6">
              <Accordion type="single" collapsible className="w-full">
                {principles
                  .filter((p) => p.esg_category === 'governance')
                  .map((principle) => {
                    const status = complianceStatus.find(
                      (s) => s.king_iv_principle_id === principle.id
                    );
                    return (
                      <AccordionItem key={principle.id} value={principle.id}>
                        <AccordionTrigger>
                          <div className="flex items-center gap-4">
                            <Scale className="h-5 w-5 text-blue-600" />
                            <span>Principle {principle.principle_number}: {principle.principle_title}</span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <p className="text-sm text-gray-700">{principle.principle_description}</p>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
              </Accordion>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
