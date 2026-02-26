'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { DashboardLayout } from '@/components/DashboardLayout';
import { PageHeader } from '@/components/saas/PageHeader';
import { KPICard, TableCard } from '@/components/saas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TooltipProvider } from '@/components/ui/tooltip';
import { BarChart3, DollarSign, Users, Shield, Leaf, Save, Plus, History, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function CasinoESGDataEntryPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [casinoId, setCasinoId] = useState<string>('');
  const [casinoName, setCasinoName] = useState<string>('');

  // Historical data
  const [esgHistory, setEsgHistory] = useState<any[]>([]);
  const [contributionsHistory, setContributionsHistory] = useState<any[]>([]);
  const [socialHistory, setSocialHistory] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalSubmissions: 0,
    totalContributions: 0,
    totalSocialImpact: 0,
    lastSubmission: null as string | null,
  });

  // ESG Metrics Form Data
  const [reportingPeriod, setReportingPeriod] = useState('');
  const [periodType, setPeriodType] = useState<'monthly' | 'quarterly' | 'annual'>('monthly');
  const [nrgpContribution, setNrgpContribution] = useState('');
  const [playersScreened, setPlayersScreened] = useState('');
  const [highRiskPlayers, setHighRiskPlayers] = useState('');
  const [interventions, setInterventions] = useState('');
  const [successfulInterventions, setSuccessfulInterventions] = useState('');
  const [selfExclusionsActive, setSelfExclusionsActive] = useState('');
  const [selfExclusionsNew, setSelfExclusionsNew] = useState('');
  const [employeesTrained, setEmployeesTrained] = useState('');
  const [trainingCompletionRate, setTrainingCompletionRate] = useState('');
  const [trainingHours, setTrainingHours] = useState('');
  const [problemGamblingReferrals, setProblemGamblingReferrals] = useState('');
  const [helplineContacts, setHelplineContacts] = useState('');
  const [counselingSessions, setCounselingSessions] = useState('');
  const [communityInvestment, setCommunityInvestment] = useState('');
  const [localJobs, setLocalJobs] = useState('');
  const [complianceAudits, setComplianceAudits] = useState('');
  const [complianceIssues, setComplianceIssues] = useState('');
  const [regulatoryViolations, setRegulatoryViolations] = useState('');
  const [renewableEnergy, setRenewableEnergy] = useState('');
  const [carbonEmissions, setCarbonEmissions] = useState('');

  // RG Contribution Form
  const [contributionDate, setContributionDate] = useState('');
  const [programName, setProgramName] = useState('');
  const [contributionAmount, setContributionAmount] = useState('');
  const [recipientOrg, setRecipientOrg] = useState('');
  const [contributionType, setContributionType] = useState<string>('nrgp');
  const [contributionNotes, setContributionNotes] = useState('');

  // Social Impact Form
  const [metricDate, setMetricDate] = useState('');
  const [socialInvestment, setSocialInvestment] = useState('');
  const [beneficiariesReached, setBeneficiariesReached] = useState('');
  const [programsSupported, setProgramsSupported] = useState('');
  const [localJobsTotal, setLocalJobsTotal] = useState('');
  const [jobsCreated, setJobsCreated] = useState('');
  const [youthEmployed, setYouthEmployed] = useState('');
  const [skillsDevelopment, setSkillsDevelopment] = useState('');
  const [awarenessCompaigns, setAwarenessCampaigns] = useState('');
  const [peopleReached, setPeopleReached] = useState('');
  const [educationalMaterials, setEducationalMaterials] = useState('');
  const [socialNotes, setSocialNotes] = useState('');

  useEffect(() => {
    if (!user) return;

    const casino_id = (user as any).casino_id;
    if (!casino_id) {
      toast.error('Your account is not associated with a casino');
      return;
    }

    setCasinoId(casino_id);
    fetchCasinoDetails(casino_id);
    fetchHistoricalData(casino_id);
  }, [user]);

  async function fetchCasinoDetails(casino_id: string) {
    const { data } = await supabase
      .from('casinos')
      .select('name')
      .eq('id', casino_id)
      .single();

    if (data) {
      setCasinoName(data.name);
    }
  }

  async function fetchHistoricalData(casino_id: string) {
    const [esgData, contribData, socialData] = await Promise.all([
      supabase
        .from('esg_metrics')
        .select('*')
        .eq('casino_id', casino_id)
        .order('reporting_period', { ascending: false })
        .limit(10),
      supabase
        .from('responsible_gambling_contributions')
        .select('*')
        .eq('casino_id', casino_id)
        .order('contribution_date', { ascending: false })
        .limit(10),
      supabase
        .from('social_impact_metrics')
        .select('*')
        .eq('casino_id', casino_id)
        .order('metric_date', { ascending: false })
        .limit(10),
    ]);

    if (esgData.data) setEsgHistory(esgData.data);
    if (contribData.data) setContributionsHistory(contribData.data);
    if (socialData.data) setSocialHistory(socialData.data);

    const totalContribAmount = contribData.data?.reduce((sum, item) => sum + (item.contribution_amount || 0), 0) || 0;
    const totalSocialInvest = socialData.data?.reduce((sum, item) => sum + (item.community_investment_amount || 0), 0) || 0;

    setStats({
      totalSubmissions: esgData.data?.length || 0,
      totalContributions: totalContribAmount,
      totalSocialImpact: totalSocialInvest,
      lastSubmission: esgData.data?.[0]?.reporting_period || null,
    });
  }

  async function handleSubmitESGMetrics(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.from('esg_metrics').insert({
        casino_id: casinoId,
        reporting_period: reportingPeriod,
        period_type: periodType,
        nrgp_contribution_amount: parseFloat(nrgpContribution) || 0,
        total_players_screened: parseInt(playersScreened) || 0,
        high_risk_players_identified: parseInt(highRiskPlayers) || 0,
        interventions_performed: parseInt(interventions) || 0,
        successful_interventions: parseInt(successfulInterventions) || 0,
        self_exclusions_active: parseInt(selfExclusionsActive) || 0,
        self_exclusions_new: parseInt(selfExclusionsNew) || 0,
        employees_trained: parseInt(employeesTrained) || 0,
        training_completion_rate: parseFloat(trainingCompletionRate) || 0,
        training_hours_delivered: parseFloat(trainingHours) || 0,
        problem_gambling_referrals: parseInt(problemGamblingReferrals) || 0,
        helpline_contacts: parseInt(helplineContacts) || 0,
        counseling_sessions_funded: parseInt(counselingSessions) || 0,
        community_investment_amount: parseFloat(communityInvestment) || 0,
        local_jobs_created: parseInt(localJobs) || 0,
        compliance_audits_passed: parseInt(complianceAudits) || 0,
        compliance_issues_resolved: parseInt(complianceIssues) || 0,
        regulatory_violations: parseInt(regulatoryViolations) || 0,
        renewable_energy_kwh: parseFloat(renewableEnergy) || 0,
        carbon_emissions_tons: parseFloat(carbonEmissions) || 0,
        created_by: user?.id,
      });

      if (error) throw error;

      toast.success('ESG metrics submitted successfully');

      resetESGMetricsForm();
      fetchHistoricalData(casinoId);
    } catch (error: any) {
      toast.error(error.message || 'Failed to submit ESG metrics');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmitRGContribution(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.from('responsible_gambling_contributions').insert({
        casino_id: casinoId,
        contribution_date: contributionDate,
        program_name: programName,
        contribution_amount: parseFloat(contributionAmount),
        recipient_organization: recipientOrg,
        contribution_type: contributionType,
        notes: contributionNotes,
        created_by: user?.id,
      });

      if (error) throw error;

      toast.success('Responsible gambling contribution recorded successfully');

      resetRGContributionForm();
      fetchHistoricalData(casinoId);
    } catch (error: any) {
      toast.error(error.message || 'Failed to record contribution');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmitSocialImpact(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.from('social_impact_metrics').insert({
        casino_id: casinoId,
        metric_date: metricDate,
        community_investment_amount: parseFloat(socialInvestment) || 0,
        beneficiaries_reached: parseInt(beneficiariesReached) || 0,
        programs_supported: parseInt(programsSupported) || 0,
        local_jobs_total: parseInt(localJobsTotal) || 0,
        jobs_created_period: parseInt(jobsCreated) || 0,
        youth_employed: parseInt(youthEmployed) || 0,
        skills_development_investment: parseFloat(skillsDevelopment) || 0,
        awareness_campaigns_conducted: parseInt(awarenessCompaigns) || 0,
        people_reached: parseInt(peopleReached) || 0,
        educational_materials_distributed: parseInt(educationalMaterials) || 0,
        notes: socialNotes,
        created_by: user?.id,
      });

      if (error) throw error;

      toast.success('Social impact metrics submitted successfully');

      resetSocialImpactForm();
      fetchHistoricalData(casinoId);
    } catch (error: any) {
      toast.error(error.message || 'Failed to submit social impact metrics');
    } finally {
      setLoading(false);
    }
  }

  function resetESGMetricsForm() {
    setReportingPeriod('');
    setPeriodType('monthly');
    setNrgpContribution('');
    setPlayersScreened('');
    setHighRiskPlayers('');
    setInterventions('');
    setSuccessfulInterventions('');
    setSelfExclusionsActive('');
    setSelfExclusionsNew('');
    setEmployeesTrained('');
    setTrainingCompletionRate('');
    setTrainingHours('');
    setProblemGamblingReferrals('');
    setHelplineContacts('');
    setCounselingSessions('');
    setCommunityInvestment('');
    setLocalJobs('');
    setComplianceAudits('');
    setComplianceIssues('');
    setRegulatoryViolations('');
    setRenewableEnergy('');
    setCarbonEmissions('');
  }

  function resetRGContributionForm() {
    setContributionDate('');
    setProgramName('');
    setContributionAmount('');
    setRecipientOrg('');
    setContributionType('nrgp');
    setContributionNotes('');
  }

  function resetSocialImpactForm() {
    setMetricDate('');
    setSocialInvestment('');
    setBeneficiariesReached('');
    setProgramsSupported('');
    setLocalJobsTotal('');
    setJobsCreated('');
    setYouthEmployed('');
    setSkillsDevelopment('');
    setAwarenessCampaigns('');
    setPeopleReached('');
    setEducationalMaterials('');
    setSocialNotes('');
  }

  return (
    <DashboardLayout>
      <TooltipProvider>
        <PageHeader
          title="ESG Data Entry & Management"
          subtitle={casinoName}
        >
          <Badge variant="secondary" className="mt-2">
            <BarChart3 className="mr-1 h-3 w-3" />
            Environmental, Social & Governance Reporting
          </Badge>
        </PageHeader>

        <div className="p-6 space-y-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <KPICard
            title="Total Submissions"
            value={stats.totalSubmissions}
            icon={BarChart3}
            tooltip="Total number of ESG metric submissions"
          />
          <KPICard
            title="Total Contributions"
            value={`R ${stats.totalContributions.toLocaleString()}`}
            icon={DollarSign}
            tooltip="Total amount contributed to responsible gambling programs"
          />
          <KPICard
            title="Social Investment"
            value={`R ${stats.totalSocialImpact.toLocaleString()}`}
            icon={Users}
            tooltip="Total community investment amount"
          />
          <KPICard
            title="Last Submission"
            value={stats.lastSubmission ? format(new Date(stats.lastSubmission), 'MMM d, yyyy') : 'N/A'}
            icon={TrendingUp}
            tooltip="Date of most recent ESG data submission"
          />
          </div>

          <Tabs defaultValue="metrics" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="metrics">
              <BarChart3 className="mr-2 h-4 w-4" />
              ESG Metrics
            </TabsTrigger>
            <TabsTrigger value="contributions">
              <DollarSign className="mr-2 h-4 w-4" />
              Contributions
            </TabsTrigger>
            <TabsTrigger value="social">
              <Users className="mr-2 h-4 w-4" />
              Social Impact
            </TabsTrigger>
            <TabsTrigger value="history">
              <History className="mr-2 h-4 w-4" />
              History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="metrics">
            <Card>
              <CardHeader>
                <CardTitle>ESG Performance Metrics</CardTitle>
                <CardDescription>
                  Submit comprehensive ESG metrics for your reporting period
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmitESGMetrics} className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <Label htmlFor="reportingPeriod">Reporting Period *</Label>
                      <Input
                        id="reportingPeriod"
                        type="date"
                        value={reportingPeriod}
                        onChange={(e) => setReportingPeriod(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="periodType">Period Type *</Label>
                      <Select value={periodType} onValueChange={(value: any) => setPeriodType(value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="quarterly">Quarterly</SelectItem>
                          <SelectItem value="annual">Annual</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <h3 className="text-lg font-semibold mb-4 flex items-center">
                      <Shield className="mr-2 h-5 w-5 text-brand-600" />
                      Responsible Gambling Metrics
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="nrgpContribution">NRGP Contribution (R)</Label>
                        <Input
                          id="nrgpContribution"
                          type="number"
                          step="0.01"
                          value={nrgpContribution}
                          onChange={(e) => setNrgpContribution(e.target.value)}
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <Label htmlFor="playersScreened">Players Screened</Label>
                        <Input
                          id="playersScreened"
                          type="number"
                          value={playersScreened}
                          onChange={(e) => setPlayersScreened(e.target.value)}
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <Label htmlFor="highRiskPlayers">High Risk Players</Label>
                        <Input
                          id="highRiskPlayers"
                          type="number"
                          value={highRiskPlayers}
                          onChange={(e) => setHighRiskPlayers(e.target.value)}
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <Label htmlFor="interventions">Interventions Performed</Label>
                        <Input
                          id="interventions"
                          type="number"
                          value={interventions}
                          onChange={(e) => setInterventions(e.target.value)}
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <Label htmlFor="successfulInterventions">Successful Interventions</Label>
                        <Input
                          id="successfulInterventions"
                          type="number"
                          value={successfulInterventions}
                          onChange={(e) => setSuccessfulInterventions(e.target.value)}
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <Label htmlFor="selfExclusionsActive">Active Self-Exclusions</Label>
                        <Input
                          id="selfExclusionsActive"
                          type="number"
                          value={selfExclusionsActive}
                          onChange={(e) => setSelfExclusionsActive(e.target.value)}
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <Label htmlFor="selfExclusionsNew">New Self-Exclusions</Label>
                        <Input
                          id="selfExclusionsNew"
                          type="number"
                          value={selfExclusionsNew}
                          onChange={(e) => setSelfExclusionsNew(e.target.value)}
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <Label htmlFor="problemGamblingReferrals">Problem Gambling Referrals</Label>
                        <Input
                          id="problemGamblingReferrals"
                          type="number"
                          value={problemGamblingReferrals}
                          onChange={(e) => setProblemGamblingReferrals(e.target.value)}
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <Label htmlFor="helplineContacts">Helpline Contacts</Label>
                        <Input
                          id="helplineContacts"
                          type="number"
                          value={helplineContacts}
                          onChange={(e) => setHelplineContacts(e.target.value)}
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <Label htmlFor="counselingSessions">Counseling Sessions Funded</Label>
                        <Input
                          id="counselingSessions"
                          type="number"
                          value={counselingSessions}
                          onChange={(e) => setCounselingSessions(e.target.value)}
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <h3 className="text-lg font-semibold mb-4 flex items-center">
                      <Users className="mr-2 h-5 w-5 text-blue-600" />
                      Employee Training Metrics
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="employeesTrained">Employees Trained</Label>
                        <Input
                          id="employeesTrained"
                          type="number"
                          value={employeesTrained}
                          onChange={(e) => setEmployeesTrained(e.target.value)}
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <Label htmlFor="trainingCompletionRate">Completion Rate (%)</Label>
                        <Input
                          id="trainingCompletionRate"
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={trainingCompletionRate}
                          onChange={(e) => setTrainingCompletionRate(e.target.value)}
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <Label htmlFor="trainingHours">Training Hours Delivered</Label>
                        <Input
                          id="trainingHours"
                          type="number"
                          step="0.01"
                          value={trainingHours}
                          onChange={(e) => setTrainingHours(e.target.value)}
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <h3 className="text-lg font-semibold mb-4 flex items-center">
                      <Users className="mr-2 h-5 w-5 text-emerald-600" />
                      Social Impact & Community
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="communityInvestment">Community Investment (R)</Label>
                        <Input
                          id="communityInvestment"
                          type="number"
                          step="0.01"
                          value={communityInvestment}
                          onChange={(e) => setCommunityInvestment(e.target.value)}
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <Label htmlFor="localJobs">Local Jobs Created</Label>
                        <Input
                          id="localJobs"
                          type="number"
                          value={localJobs}
                          onChange={(e) => setLocalJobs(e.target.value)}
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <h3 className="text-lg font-semibold mb-4 flex items-center">
                      <Shield className="mr-2 h-5 w-5 text-purple-600" />
                      Governance & Compliance
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="complianceAudits">Audits Passed</Label>
                        <Input
                          id="complianceAudits"
                          type="number"
                          value={complianceAudits}
                          onChange={(e) => setComplianceAudits(e.target.value)}
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <Label htmlFor="complianceIssues">Issues Resolved</Label>
                        <Input
                          id="complianceIssues"
                          type="number"
                          value={complianceIssues}
                          onChange={(e) => setComplianceIssues(e.target.value)}
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <Label htmlFor="regulatoryViolations">Regulatory Violations</Label>
                        <Input
                          id="regulatoryViolations"
                          type="number"
                          value={regulatoryViolations}
                          onChange={(e) => setRegulatoryViolations(e.target.value)}
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <h3 className="text-lg font-semibold mb-4 flex items-center">
                      <Leaf className="mr-2 h-5 w-5 text-green-600" />
                      Environmental Metrics
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="renewableEnergy">Renewable Energy (kWh)</Label>
                        <Input
                          id="renewableEnergy"
                          type="number"
                          step="0.01"
                          value={renewableEnergy}
                          onChange={(e) => setRenewableEnergy(e.target.value)}
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <Label htmlFor="carbonEmissions">Carbon Emissions (tons)</Label>
                        <Input
                          id="carbonEmissions"
                          type="number"
                          step="0.01"
                          value={carbonEmissions}
                          onChange={(e) => setCarbonEmissions(e.target.value)}
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end space-x-4">
                    <Button type="button" variant="outline" onClick={resetESGMetricsForm}>
                      Reset Form
                    </Button>
                    <Button type="submit" disabled={loading}>
                      <Save className="mr-2 h-4 w-4" />
                      {loading ? 'Submitting...' : 'Submit ESG Metrics'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="contributions">
            <Card>
              <CardHeader>
                <CardTitle>Responsible Gambling Contributions</CardTitle>
                <CardDescription>
                  Record financial contributions to NRGP and other responsible gambling programs
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmitRGContribution} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <Label htmlFor="contributionDate">Contribution Date *</Label>
                      <Input
                        id="contributionDate"
                        type="date"
                        value={contributionDate}
                        onChange={(e) => setContributionDate(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="contributionType">Contribution Type *</Label>
                      <Select value={contributionType} onValueChange={setContributionType}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="nrgp">NRGP</SelectItem>
                          <SelectItem value="sargf">SARGF</SelectItem>
                          <SelectItem value="treatment_program">Treatment Program</SelectItem>
                          <SelectItem value="research">Research</SelectItem>
                          <SelectItem value="education">Education</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="programName">Program Name *</Label>
                      <Input
                        id="programName"
                        type="text"
                        value={programName}
                        onChange={(e) => setProgramName(e.target.value)}
                        placeholder="e.g., National Responsible Gambling Programme"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="contributionAmount">Amount (R) *</Label>
                      <Input
                        id="contributionAmount"
                        type="number"
                        step="0.01"
                        value={contributionAmount}
                        onChange={(e) => setContributionAmount(e.target.value)}
                        placeholder="0.00"
                        required
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label htmlFor="recipientOrg">Recipient Organization *</Label>
                      <Input
                        id="recipientOrg"
                        type="text"
                        value={recipientOrg}
                        onChange={(e) => setRecipientOrg(e.target.value)}
                        placeholder="e.g., National Gambling Board"
                        required
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label htmlFor="contributionNotes">Notes</Label>
                      <Textarea
                        id="contributionNotes"
                        value={contributionNotes}
                        onChange={(e) => setContributionNotes(e.target.value)}
                        placeholder="Additional information about this contribution"
                        rows={3}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end space-x-4">
                    <Button type="button" variant="outline" onClick={resetRGContributionForm}>
                      Reset Form
                    </Button>
                    <Button type="submit" disabled={loading}>
                      <Plus className="mr-2 h-4 w-4" />
                      {loading ? 'Submitting...' : 'Add Contribution'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="social">
            <Card>
              <CardHeader>
                <CardTitle>Social Impact Metrics</CardTitle>
                <CardDescription>
                  Track community investment and social responsibility initiatives
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmitSocialImpact} className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="md:col-span-2">
                      <Label htmlFor="metricDate">Metric Date *</Label>
                      <Input
                        id="metricDate"
                        type="date"
                        value={metricDate}
                        onChange={(e) => setMetricDate(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <h3 className="text-lg font-semibold mb-4">Community Investment</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="socialInvestment">Investment Amount (R)</Label>
                        <Input
                          id="socialInvestment"
                          type="number"
                          step="0.01"
                          value={socialInvestment}
                          onChange={(e) => setSocialInvestment(e.target.value)}
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <Label htmlFor="beneficiariesReached">Beneficiaries Reached</Label>
                        <Input
                          id="beneficiariesReached"
                          type="number"
                          value={beneficiariesReached}
                          onChange={(e) => setBeneficiariesReached(e.target.value)}
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <Label htmlFor="programsSupported">Programs Supported</Label>
                        <Input
                          id="programsSupported"
                          type="number"
                          value={programsSupported}
                          onChange={(e) => setProgramsSupported(e.target.value)}
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <h3 className="text-lg font-semibold mb-4">Employment Impact</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div>
                        <Label htmlFor="localJobsTotal">Total Local Jobs</Label>
                        <Input
                          id="localJobsTotal"
                          type="number"
                          value={localJobsTotal}
                          onChange={(e) => setLocalJobsTotal(e.target.value)}
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <Label htmlFor="jobsCreated">Jobs Created (Period)</Label>
                        <Input
                          id="jobsCreated"
                          type="number"
                          value={jobsCreated}
                          onChange={(e) => setJobsCreated(e.target.value)}
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <Label htmlFor="youthEmployed">Youth Employed</Label>
                        <Input
                          id="youthEmployed"
                          type="number"
                          value={youthEmployed}
                          onChange={(e) => setYouthEmployed(e.target.value)}
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <Label htmlFor="skillsDevelopment">Skills Development (R)</Label>
                        <Input
                          id="skillsDevelopment"
                          type="number"
                          step="0.01"
                          value={skillsDevelopment}
                          onChange={(e) => setSkillsDevelopment(e.target.value)}
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <h3 className="text-lg font-semibold mb-4">Responsible Gambling Outreach</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="awarenessCompaigns">Awareness Campaigns</Label>
                        <Input
                          id="awarenessCompaigns"
                          type="number"
                          value={awarenessCompaigns}
                          onChange={(e) => setAwarenessCampaigns(e.target.value)}
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <Label htmlFor="peopleReached">People Reached</Label>
                        <Input
                          id="peopleReached"
                          type="number"
                          value={peopleReached}
                          onChange={(e) => setPeopleReached(e.target.value)}
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <Label htmlFor="educationalMaterials">Educational Materials</Label>
                        <Input
                          id="educationalMaterials"
                          type="number"
                          value={educationalMaterials}
                          onChange={(e) => setEducationalMaterials(e.target.value)}
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <Label htmlFor="socialNotes">Additional Notes</Label>
                    <Textarea
                      id="socialNotes"
                      value={socialNotes}
                      onChange={(e) => setSocialNotes(e.target.value)}
                      placeholder="Additional information about social impact initiatives"
                      rows={4}
                    />
                  </div>

                  <div className="flex justify-end space-x-4">
                    <Button type="button" variant="outline" onClick={resetSocialImpactForm}>
                      Reset Form
                    </Button>
                    <Button type="submit" disabled={loading}>
                      <Save className="mr-2 h-4 w-4" />
                      {loading ? 'Submitting...' : 'Submit Social Impact Data'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="space-y-6">
            <TableCard
              title="ESG Metrics History"
              description="View and manage previously submitted ESG data"
              tooltip="Historical record of all ESG metric submissions"
            >
              {esgHistory.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Period</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Players Screened</TableHead>
                      <TableHead>Interventions</TableHead>
                      <TableHead>NRGP Contribution</TableHead>
                      <TableHead>Submitted</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {esgHistory.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{format(new Date(item.reporting_period), 'MMM d, yyyy')}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{item.period_type}</Badge>
                        </TableCell>
                        <TableCell>{item.total_players_screened || 0}</TableCell>
                        <TableCell>{item.interventions_performed || 0}</TableCell>
                        <TableCell>R {(item.nrgp_contribution_amount || 0).toLocaleString()}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {format(new Date(item.created_at), 'MMM d, yyyy')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  No ESG metrics submitted yet
                </div>
              )}
            </TableCard>

            <TableCard
              title="Contribution History"
              description="Record of all responsible gambling contributions"
              tooltip="All financial contributions to NRGP and RG programs"
            >
              {contributionsHistory.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Program</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Recipient</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contributionsHistory.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{format(new Date(item.contribution_date), 'MMM d, yyyy')}</TableCell>
                        <TableCell>{item.program_name}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{item.contribution_type}</Badge>
                        </TableCell>
                        <TableCell className="font-semibold">
                          R {(item.contribution_amount || 0).toLocaleString()}
                        </TableCell>
                        <TableCell>{item.recipient_organization}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  No contributions recorded yet
                </div>
              )}
            </TableCard>

            <TableCard
              title="Social Impact History"
              description="Community investment and social responsibility records"
              tooltip="Historical record of all social impact metrics"
            >
              {socialHistory.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Investment</TableHead>
                      <TableHead>Beneficiaries</TableHead>
                      <TableHead>Jobs Created</TableHead>
                      <TableHead>People Reached</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {socialHistory.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{format(new Date(item.metric_date), 'MMM d, yyyy')}</TableCell>
                        <TableCell>R {(item.community_investment_amount || 0).toLocaleString()}</TableCell>
                        <TableCell>{item.beneficiaries_reached || 0}</TableCell>
                        <TableCell>{item.jobs_created_period || 0}</TableCell>
                        <TableCell>{item.people_reached || 0}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  No social impact metrics submitted yet
                </div>
              )}
            </TableCard>
          </TabsContent>
          </Tabs>
        </div>
      </TooltipProvider>
    </DashboardLayout>
  );
}
