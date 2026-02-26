import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.58.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ESGContributionPayload {
  casino_id: string;
  contribution_type: 'nrgp' | 'sargf' | 'treatment_program' | 'research' | 'education' | 'other';
  contribution_amount: number;
  contribution_date: string;
  recipient_organization: string;
  program_name: string;
  notes?: string;
}

interface ESGTrainingPayload {
  casino_id: string;
  staff_id: string;
  training_program: string;
  training_provider: string;
  training_date: string;
  completion_status: 'completed' | 'in_progress' | 'scheduled';
  hours_completed?: number;
  score?: number;
  certificate_issued?: boolean;
  certificate_number?: string;
  expiry_date?: string;
  next_training_due?: string;
}

interface ESGMetricsPayload {
  casino_id: string;
  reporting_period: string;
  period_type: 'monthly' | 'quarterly' | 'annual';
  nrgp_contribution_amount?: number;
  total_players_screened?: number;
  high_risk_players_identified?: number;
  interventions_performed?: number;
  successful_interventions?: number;
  self_exclusions_active?: number;
  self_exclusions_new?: number;
  employees_trained?: number;
  training_completion_rate?: number;
  training_hours_delivered?: number;
  problem_gambling_referrals?: number;
  helpline_contacts?: number;
  counseling_sessions_funded?: number;
  community_investment_amount?: number;
  local_jobs_created?: number;
  compliance_audits_passed?: number;
  compliance_issues_resolved?: number;
  regulatory_violations?: number;
  renewable_energy_kwh?: number;
  carbon_emissions_tons?: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const url = new URL(req.url);
    const endpoint = url.pathname.split('/').pop();

    switch (endpoint) {
      case 'contributions':
        return await handleContributions(req, supabase);
      case 'training':
        return await handleTraining(req, supabase);
      case 'metrics':
        return await handleMetrics(req, supabase);
      default:
        return new Response(
          JSON.stringify({
            error: 'Invalid endpoint',
            available_endpoints: ['/contributions', '/training', '/metrics']
          }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function handleContributions(req: Request, supabase: any) {
  const payload: ESGContributionPayload = await req.json();

  const validTypes = ['nrgp', 'sargf', 'treatment_program', 'research', 'education', 'other'];
  if (!validTypes.includes(payload.contribution_type)) {
    return new Response(
      JSON.stringify({ error: 'Invalid contribution_type', valid_types: validTypes }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const { data, error } = await supabase
    .from('responsible_gambling_contributions')
    .insert({
      casino_id: payload.casino_id,
      contribution_type: payload.contribution_type,
      contribution_amount: payload.contribution_amount,
      contribution_date: payload.contribution_date,
      recipient_organization: payload.recipient_organization,
      program_name: payload.program_name,
      notes: payload.notes || '',
    })
    .select()
    .single();

  if (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({
      success: true,
      message: 'Contribution recorded successfully',
      data,
    }),
    { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleTraining(req: Request, supabase: any) {
  const payload: ESGTrainingPayload | ESGTrainingPayload[] = await req.json();
  const records = Array.isArray(payload) ? payload : [payload];

  const insertData = records.map(record => ({
    casino_id: record.casino_id,
    staff_id: record.staff_id,
    training_program: record.training_program,
    training_provider: record.training_provider,
    training_date: record.training_date,
    completion_status: record.completion_status,
    hours_completed: record.hours_completed,
    score: record.score,
    certificate_issued: record.certificate_issued || false,
    certificate_number: record.certificate_number,
    expiry_date: record.expiry_date,
    next_training_due: record.next_training_due,
  }));

  const { data, error } = await supabase
    .from('employee_rg_training')
    .insert(insertData)
    .select();

  if (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({
      success: true,
      message: `${records.length} training record(s) recorded successfully`,
      count: data.length,
      data,
    }),
    { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleMetrics(req: Request, supabase: any) {
  const payload: ESGMetricsPayload = await req.json();

  const validPeriodTypes = ['monthly', 'quarterly', 'annual'];
  if (!validPeriodTypes.includes(payload.period_type)) {
    return new Response(
      JSON.stringify({ error: 'Invalid period_type', valid_types: validPeriodTypes }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const existingRecord = await supabase
    .from('esg_metrics')
    .select('id')
    .eq('casino_id', payload.casino_id)
    .eq('reporting_period', payload.reporting_period)
    .eq('period_type', payload.period_type)
    .maybeSingle();

  let data, error;

  if (existingRecord.data) {
    const { data: updatedData, error: updateError } = await supabase
      .from('esg_metrics')
      .update({
        nrgp_contribution_amount: payload.nrgp_contribution_amount,
        total_players_screened: payload.total_players_screened,
        high_risk_players_identified: payload.high_risk_players_identified,
        interventions_performed: payload.interventions_performed,
        successful_interventions: payload.successful_interventions,
        self_exclusions_active: payload.self_exclusions_active,
        self_exclusions_new: payload.self_exclusions_new,
        employees_trained: payload.employees_trained,
        training_completion_rate: payload.training_completion_rate,
        training_hours_delivered: payload.training_hours_delivered,
        problem_gambling_referrals: payload.problem_gambling_referrals,
        helpline_contacts: payload.helpline_contacts,
        counseling_sessions_funded: payload.counseling_sessions_funded,
        community_investment_amount: payload.community_investment_amount,
        local_jobs_created: payload.local_jobs_created,
        compliance_audits_passed: payload.compliance_audits_passed,
        compliance_issues_resolved: payload.compliance_issues_resolved,
        regulatory_violations: payload.regulatory_violations,
        renewable_energy_kwh: payload.renewable_energy_kwh,
        carbon_emissions_tons: payload.carbon_emissions_tons,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingRecord.data.id)
      .select()
      .single();

    data = updatedData;
    error = updateError;
  } else {
    const { data: insertedData, error: insertError } = await supabase
      .from('esg_metrics')
      .insert({
        casino_id: payload.casino_id,
        reporting_period: payload.reporting_period,
        period_type: payload.period_type,
        nrgp_contribution_amount: payload.nrgp_contribution_amount,
        total_players_screened: payload.total_players_screened,
        high_risk_players_identified: payload.high_risk_players_identified,
        interventions_performed: payload.interventions_performed,
        successful_interventions: payload.successful_interventions,
        self_exclusions_active: payload.self_exclusions_active,
        self_exclusions_new: payload.self_exclusions_new,
        employees_trained: payload.employees_trained,
        training_completion_rate: payload.training_completion_rate,
        training_hours_delivered: payload.training_hours_delivered,
        problem_gambling_referrals: payload.problem_gambling_referrals,
        helpline_contacts: payload.helpline_contacts,
        counseling_sessions_funded: payload.counseling_sessions_funded,
        community_investment_amount: payload.community_investment_amount,
        local_jobs_created: payload.local_jobs_created,
        compliance_audits_passed: payload.compliance_audits_passed,
        compliance_issues_resolved: payload.compliance_issues_resolved,
        regulatory_violations: payload.regulatory_violations,
        renewable_energy_kwh: payload.renewable_energy_kwh,
        carbon_emissions_tons: payload.carbon_emissions_tons,
      })
      .select()
      .single();

    data = insertedData;
    error = insertError;
  }

  if (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({
      success: true,
      message: existingRecord.data ? 'ESG metrics updated successfully' : 'ESG metrics recorded successfully',
      data,
    }),
    { status: existingRecord.data ? 200 : 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
