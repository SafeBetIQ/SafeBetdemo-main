import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { formatPlayerId } from "../../../lib/playerIdentity/core.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface GameCompletionData {
  duration_seconds: number;
  completion_rate: number;
  behaviour_risk_index: number;
  hesitation_score: number;
  consistency_score: number;
  telemetry: any[];
  insights: any[];
  badges: any[];
}

interface NovaIQResult {
  risk_score: number;
  risk_level: "low" | "medium" | "high" | "critical";
  narrative: string;
  primary_drivers: string[];
  protective_factors: string[];
  confidence: number;
  recommended_action: string;
}

interface ComplianceDetails {
  label: string;
  reason: string;
  priority: string;
}

interface TransactionState {
  assessment_id: string | null;
  invitation_status_changed: boolean;
  player_profile_updated: boolean;
  risk_score_inserted: boolean;
  intervention_id: string | null;
  audit_events_written: number;
}

// ─── 1. Validate Invitation ───────────────────────────────────────────────────

async function validateInvitation(supabase: any, secure_token: string) {
  const { data: invitation, error } = await supabase
    .from("wellbeing_game_invitations")
    .select("*, game_concept:wellbeing_game_concepts(*)")
    .eq("secure_token", secure_token)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (error || !invitation) {
    throw { status: 404, message: "Invalid or expired invitation token" };
  }
  if (invitation.status === "completed") {
    throw { status: 409, message: "Assessment already completed for this invitation" };
  }
  return invitation;
}

// ─── 2. Load Player Context (all data needed for rich Nova IQ analysis) ──────

async function loadPlayerContext(supabase: any, player_id: string, casino_id: string) {
  const [playerRes, recentSessionsRes, previousAssessmentsRes, interventionCountRes, exclusionRes] = await Promise.all([
    supabase.from("players").select("*").eq("id", player_id).single(),
    supabase.from("wellbeing_game_sessions")
      .select("behaviour_risk_index, completed_at")
      .eq("player_id", player_id)
      .order("completed_at", { ascending: false })
      .limit(5),
    supabase.from("wellbeing_assessments")
      .select("nova_iq_risk_score, nova_iq_risk_level, compliance_action, completed_at, assessment_number")
      .eq("player_id", player_id)
      .order("completed_at", { ascending: false })
      .limit(10),
    supabase.from("interventions")
      .select("id", { count: "exact", head: true })
      .eq("player_id", player_id),
    supabase.from("self_exclusions")
      .select("id", { count: "exact", head: true })
      .eq("player_id", player_id)
      .eq("status", "active"),
  ]);

  if (playerRes.error || !playerRes.data) {
    throw { status: 404, message: "Player not found" };
  }

  return {
    player: playerRes.data,
    recentSessions: recentSessionsRes.data ?? [],
    previousAssessments: previousAssessmentsRes.data ?? [],
    interventionCount: interventionCountRes.count ?? 0,
    activeExclusionCount: exclusionRes.count ?? 0,
  };
}

// ─── 3. Calculate Nova IQ (rich, data-driven scoring) ────────────────────────

function calculateNovaIQ(
  gameData: GameCompletionData,
  player: any,
  recentSessions: any[],
  previousAssessments: any[],
  interventionCount: number,
  activeExclusionCount: number,
): NovaIQResult {
  const { behaviour_risk_index: bri, hesitation_score, consistency_score } = gameData;
  const casinoRisk = Math.min(100, player.risk_score ?? 50);
  const hesitationRisk = 100 - hesitation_score;
  const inconsistencyRisk = 100 - consistency_score;

  let score =
    bri * 0.35 +
    hesitationRisk * 0.15 +
    inconsistencyRisk * 0.20 +
    casinoRisk * 0.30;

  const drivers: string[] = [];
  const protective: string[] = [];

  // Financial exposure
  if (player.total_wagered && player.total_won !== undefined) {
    const netLoss = Number(player.total_wagered) - Number(player.total_won);
    if (netLoss > 50000) { score += 5; drivers.push(`Significant cumulative net loss (R${Math.round(netLoss / 1000)}k)`); }
    else if (netLoss > 20000) { score += 3; drivers.push(`Elevated net loss exposure (R${Math.round(netLoss / 1000)}k)`); }
    else if (netLoss > 5000) { score += 1; }
  }

  // Session frequency
  if (player.session_count > 100) { score += 4; drivers.push(`Very high session frequency (${player.session_count} lifetime sessions)`); }
  else if (player.session_count > 50) { score += 2; drivers.push(`Elevated session frequency (${player.session_count} sessions)`); }

  // Behavioral risk signals
  if (bri > 75) { score += 5; drivers.push("High-risk behavioral pattern across assessment scenarios"); }
  else if (bri > 60) { score += 2; drivers.push("Moderate risk-taking behavior in scenarios"); }

  if (hesitation_score < 25) { score += 4; drivers.push("Highly impulsive decision-making (low hesitation)"); }
  else if (hesitation_score < 40) { score += 2; drivers.push("Impulsive response patterns noted"); }

  if (consistency_score < 35) { score += 3; drivers.push("Inconsistent risk judgement across scenarios"); }
  else if (consistency_score < 50) { score += 1; }

  // Worsening trend across assessments
  if (previousAssessments.length >= 2) {
    const lastScore = previousAssessments[0]?.nova_iq_risk_score ?? 0;
    const prevScore = previousAssessments[1]?.nova_iq_risk_score ?? 0;
    const trend = lastScore - prevScore;
    if (trend > 10) { score += 4; drivers.push(`Worsening Nova IQ trend (+${trend.toFixed(0)} pts since last assessment)`); }
    else if (trend > 5) { score += 2; }
    else if (trend < -10) { protective.push(`Improving Nova IQ trend (${Math.abs(trend).toFixed(0)} pts improvement)`); }
  }

  // Session duration (proxy for extended play)
  if (player.avg_session_duration > 180) { score += 3; drivers.push(`Extended session duration (avg ${player.avg_session_duration} min)`); }
  else if (player.avg_session_duration > 90) { score += 1; }

  // Behavioral sessions trend
  if (recentSessions.length >= 2) {
    const briTrend = recentSessions[0]?.behaviour_risk_index - recentSessions[1]?.behaviour_risk_index;
    if (briTrend > 10) { score += 2; drivers.push("Worsening behavioral pattern in recent game sessions"); }
  }

  // Intervention history (already escalated)
  if (interventionCount > 5) { score += 3; drivers.push(`History of ${interventionCount} responsible gambling interventions`); }
  else if (interventionCount > 2) { score += 2; drivers.push(`${interventionCount} prior responsible gambling interventions`); }
  else if (interventionCount > 0) { score += 1; }

  // Active self-exclusion (very protective — flag anomaly if still playing)
  if (activeExclusionCount > 0) { score += 8; drivers.push("Playing under active self-exclusion — compliance breach"); }

  // Protective factors
  if (consistency_score > 75) protective.push("Consistent responsible decision-making across scenarios");
  if (hesitation_score > 65) protective.push("Deliberate risk consideration before decisions");
  if (bri < 35) protective.push("Low behavioral risk index — well-controlled responses");
  if (player.self_excluded === false && player.fica_verified) protective.push("FICA verified, no active exclusion history");
  if (gameData.badges.some((b: any) => b.id === "responsible_player")) protective.push("Responsible player badge earned");
  if (previousAssessments.length > 0 && interventionCount === 0) protective.push("No prior responsible gambling interventions required");
  if (player.session_count < 10) protective.push("Low engagement frequency");

  // Assessment count context
  const assessmentCount = previousAssessments.length + 1;
  if (assessmentCount > 3) score += 1; // repeated screening adds weight

  score = Math.max(0, Math.min(100, score));

  let risk_level: "low" | "medium" | "high" | "critical";
  if (score >= 80) risk_level = "critical";
  else if (score >= 65) risk_level = "high";
  else if (score >= 45) risk_level = "medium";
  else risk_level = "low";

  let recommended_action: string;
  if (score >= 80) recommended_action = "self_exclusion_recommendation";
  else if (score >= 70) recommended_action = "mandatory_review";
  else if (score >= 60) recommended_action = "deposit_limit_recommendation";
  else if (score >= 50) recommended_action = "responsible_gambling_contact";
  else if (score >= 35) recommended_action = "monitor";
  else recommended_action = "no_action";

  const dataSources = [
    player.session_count > 5,
    recentSessions.length > 0,
    gameData.telemetry.length > 10,
    Number(player.total_wagered) > 0,
    previousAssessments.length > 0,
    interventionCount > 0,
  ].filter(Boolean).length;
  const confidence = Math.min(98, 65 + dataSources * 6);

  const narrative = buildNarrative(
    player, gameData, score, risk_level, drivers, protective,
    player.nova_iq_composite_score ?? player.risk_score ?? 50,
    previousAssessments, interventionCount, activeExclusionCount,
  );

  return {
    risk_score: parseFloat(score.toFixed(1)),
    risk_level,
    narrative,
    primary_drivers: drivers,
    protective_factors: protective,
    confidence,
    recommended_action,
  };
}

function buildNarrative(
  player: any,
  data: GameCompletionData,
  novaScore: number,
  level: string,
  drivers: string[],
  protective: string[],
  previousScore: number,
  previousAssessments: any[],
  interventionCount: number,
  activeExclusionCount: number,
): string {
  const delta = novaScore - previousScore;
  const playerRef = formatPlayerId(player.player_id ?? player.id);
  const netLoss = Number(player.total_wagered ?? 0) - Number(player.total_won ?? 0);
  const assessmentNumber = previousAssessments.length + 1;
  const parts: string[] = [];

  // Score movement vs previous Nova IQ
  if (previousAssessments.length > 0) {
    const prevNovaScore = previousAssessments[0]?.nova_iq_risk_score;
    if (prevNovaScore != null) {
      const prevDelta = novaScore - prevNovaScore;
      if (Math.abs(prevDelta) >= 5) {
        const dir = prevDelta > 0 ? "increased" : "decreased";
        parts.push(
          `Nova IQ ${dir} player ${playerRef}'s composite risk score from ${prevNovaScore.toFixed(0)} to ${novaScore.toFixed(0)} following this assessment (Assessment #${assessmentNumber}).`
        );
      } else {
        parts.push(
          `Nova IQ composite risk score remains ${level} at ${novaScore.toFixed(0)} following Assessment #${assessmentNumber} (unchanged from previous score of ${prevNovaScore.toFixed(0)}).`
        );
      }
    } else {
      parts.push(`Nova IQ composite risk score established at ${novaScore.toFixed(0)} (${level}) — Assessment #${assessmentNumber}.`);
    }
  } else {
    parts.push(`Nova IQ baseline composite risk score established at ${novaScore.toFixed(0)} (${level}) — first assessment completed.`);
  }

  // Behavioral assessment findings
  if (data.behaviour_risk_index >= 70) {
    parts.push(
      `Player Assessment #${assessmentNumber} recorded a high behavioral risk index of ${data.behaviour_risk_index.toFixed(0)}/100, revealing patterns consistent with impulsive or escalating gambling behavior across all 8 decision scenarios.`
    );
  } else if (data.behaviour_risk_index >= 50) {
    parts.push(
      `Player Assessment #${assessmentNumber} recorded a moderate behavioral risk index of ${data.behaviour_risk_index.toFixed(0)}/100, indicating elevated risk patterns in several scenarios.`
    );
  } else {
    parts.push(
      `Player Assessment #${assessmentNumber} recorded a controlled behavioral risk index of ${data.behaviour_risk_index.toFixed(0)}/100, indicating generally responsible decision-making across scenarios.`
    );
  }

  // Decision speed
  if (data.hesitation_score < 30) {
    parts.push(
      `Decisions were made with very low hesitation (${data.hesitation_score.toFixed(0)}/100), a strong indicator of impulsive response patterns when confronted with realistic gambling risk scenarios.`
    );
  } else if (data.hesitation_score > 65) {
    parts.push(
      `The player demonstrated careful deliberation (hesitation score ${data.hesitation_score.toFixed(0)}/100), a positive indicator of self-regulation and considered decision-making.`
    );
  }

  // Consistency
  if (data.consistency_score < 40) {
    parts.push(
      `Inconsistent decision-making (consistency score ${data.consistency_score.toFixed(0)}/100) across scenarios raises concern about stable risk awareness and pattern recognition.`
    );
  } else if (data.consistency_score > 70) {
    parts.push(
      `Strong behavioural consistency (${data.consistency_score.toFixed(0)}/100) across all scenarios indicates predictable, controlled responses to gambling risk stimuli.`
    );
  }

  // Financial context
  if (netLoss > 50000) {
    parts.push(
      `Casino records indicate cumulative net losses of R${Math.round(netLoss / 1000)}k across ${player.session_count} sessions, compounding the behavioral risk signals from this assessment.`
    );
  } else if (netLoss > 10000) {
    parts.push(
      `Casino records show cumulative net losses of R${netLoss.toLocaleString("en-ZA")} — an elevated financial exposure indicator.`
    );
  }

  // Session frequency context
  if (player.session_count > 100) {
    parts.push(
      `With ${player.session_count} recorded gambling sessions and an average duration of ${player.avg_session_duration} minutes, engagement frequency and intensity are significantly elevated.`
    );
  } else if (player.session_count > 50) {
    parts.push(
      `With ${player.session_count} recorded sessions (avg ${player.avg_session_duration} min), session frequency warrants continued monitoring.`
    );
  }

  // Active exclusion anomaly
  if (activeExclusionCount > 0) {
    parts.push(
      `CRITICAL: Player is participating under an active self-exclusion order. This constitutes a potential compliance breach requiring immediate operator intervention.`
    );
  }

  // Intervention history
  if (interventionCount > 3) {
    parts.push(
      `${interventionCount} prior responsible gambling interventions have been recorded for this player with no sustained improvement in risk profile.`
    );
  }

  // Assessment trend
  if (previousAssessments.length >= 2) {
    const scores = previousAssessments.slice(0, 3).map(a => a.nova_iq_risk_score ?? 0).reverse();
    scores.push(novaScore);
    const allRising = scores.every((s, i) => i === 0 || s >= scores[i - 1] - 2);
    if (allRising && novaScore > 60) {
      parts.push(`Nova IQ trend across ${assessmentNumber} assessments shows consistent risk escalation.`);
    }
  }

  // Primary drivers
  if (drivers.length > 0) {
    parts.push(`Primary risk drivers: ${drivers.join("; ")}.`);
  }

  // Protective factors
  if (protective.length > 0) {
    parts.push(`Protective factors noted: ${protective.join("; ")}.`);
  }

  return parts.join(" ");
}

// ─── 4. Save Assessment (with version tracking) ───────────────────────────────

async function saveAssessment(
  supabase: any,
  invitation: any,
  gameData: GameCompletionData,
  novaIQ: NovaIQResult,
  compliance: ComplianceDetails,
  previousRiskScore: number,
  previousNovaIQScore: number | null,
) {
  const delta = novaIQ.risk_score - previousRiskScore;

  const { data: assessment, error } = await supabase
    .from("wellbeing_assessments")
    .insert({
      invitation_id:              invitation.id,
      player_id:                  invitation.player_id,
      game_concept_id:            invitation.game_concept_id,
      casino_id:                  invitation.casino_id,
      assessment_version:         1,
      behaviour_risk_index:       gameData.behaviour_risk_index,
      hesitation_score:           gameData.hesitation_score,
      consistency_score:          gameData.consistency_score,
      completion_rate:            gameData.completion_rate,
      duration_seconds:           gameData.duration_seconds,
      nova_iq_risk_score:         novaIQ.risk_score,
      nova_iq_risk_level:         novaIQ.risk_level,
      nova_iq_narrative:          novaIQ.narrative,
      nova_iq_primary_drivers:    novaIQ.primary_drivers,
      nova_iq_protective_factors: novaIQ.protective_factors,
      nova_iq_confidence:         novaIQ.confidence,
      nova_iq_recommended_action: novaIQ.recommended_action,
      previous_risk_score:        previousRiskScore,
      previous_nova_iq_score:     previousNovaIQScore,
      risk_score_delta:           parseFloat(delta.toFixed(1)),
      compliance_action:          compliance.label,
      compliance_reason:          compliance.reason,
      compliance_framework:       "NRGP",
      compliance_priority:        compliance.priority,
      telemetry_summary:          gameData.telemetry.slice(0, 50),
      insights:                   gameData.insights,
      badges:                     gameData.badges,
      completed_at:               new Date().toISOString(),
      rollback_status:            "committed",
    })
    .select()
    .single();

  if (error || !assessment) {
    console.error("Assessment insert error:", JSON.stringify(error));
    throw { status: 500, message: "Failed to save assessment record", detail: error?.message };
  }
  return assessment;
}

// ─── 5. Update Player Profile ─────────────────────────────────────────────────

async function updatePlayerProfile(
  supabase: any,
  player_id: string,
  player: any,
  novaIQ: NovaIQResult,
  assessmentId: string,
) {
  const newRiskLevel = novaIQ.risk_score >= 80 ? "critical"
                     : novaIQ.risk_score >= 65 ? "high"
                     : novaIQ.risk_score >= 45 ? "medium"
                     : "low";

  const { error } = await supabase.from("players").update({
    risk_score:              Math.round(novaIQ.risk_score),
    risk_level:              newRiskLevel,
    risk_score_updated_at:   new Date().toISOString(),
    last_assessment_date:    new Date().toISOString(),
    last_assessment_score:   novaIQ.risk_score,
    last_assessment_id:      assessmentId,
    nova_iq_composite_score: novaIQ.risk_score,
    assessment_count:        (player.assessment_count ?? 0) + 1,
    next_assessment_date:    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  }).eq("id", player_id);

  if (error) {
    console.error("Player profile update error:", error.message);
    throw { status: 500, message: "Failed to update player profile", detail: error.message };
  }
  return newRiskLevel;
}

// ─── 6. Write Risk Score History ──────────────────────────────────────────────

async function writeRiskScoreHistory(
  supabase: any,
  player_id: string,
  casino_id: string,
  novaIQ: NovaIQResult,
  gameData: GameCompletionData,
  assessmentId: string,
) {
  await supabase.from("wellbeing_risk_scores").insert({
    player_id,
    casino_id,
    behaviour_risk_index:    novaIQ.risk_score,
    impulsivity_score:       100 - gameData.hesitation_score,
    risk_escalation_score:   gameData.behaviour_risk_index,
    patience_score:          gameData.hesitation_score,
    recovery_response_score: gameData.consistency_score,
    explanation: {
      nova_iq_narrative:  novaIQ.narrative,
      primary_drivers:    novaIQ.primary_drivers,
      protective_factors: novaIQ.protective_factors,
      recommended_action: novaIQ.recommended_action,
      confidence:         novaIQ.confidence,
      assessment_id:      assessmentId,
    },
  });
}

// ─── 7. Generate Intervention ─────────────────────────────────────────────────

async function generateIntervention(
  supabase: any,
  player: any,
  invitation: any,
  novaIQ: NovaIQResult,
  gameData: GameCompletionData,
  compliance: ComplianceDetails,
  assessmentId: string,
): Promise<string | null> {
  const INTERVENTION_THRESHOLDS = [
    "responsible_gambling_contact",
    "deposit_limit_recommendation",
    "mandatory_review",
    "self_exclusion_recommendation",
  ];

  if (!INTERVENTION_THRESHOLDS.includes(novaIQ.recommended_action)) return null;

  const { data: intervention, error } = await supabase.from("interventions").insert({
    player_id:              invitation.player_id,
    casino_id:              invitation.casino_id,
    channel:                "email",
    message_content:        buildInterventionMessage(player, novaIQ, gameData, compliance),
    status:                 "pending",
    assessment_id:          assessmentId,
    trigger_type:           "nova_iq_assessment",
    nova_iq_recommendation: novaIQ.recommended_action,
  }).select().single();

  if (error) {
    console.error("Intervention insert error:", error.message);
    return null; // Non-fatal — assessment still saves
  }

  // Link intervention back to assessment
  await supabase.from("wellbeing_assessments")
    .update({ intervention_id: intervention.id })
    .eq("id", assessmentId);

  return intervention.id;
}

// ─── 8. Write Audit Chain (all required events, SHA-256 chained) ──────────────

async function writeAuditChain(
  supabase: any,
  {
    player_id, casino_id, invitation, assessment, novaIQ, compliance,
    previousRiskScore, newRiskLevel, interventionId, gameData,
  }: {
    player_id: string;
    casino_id: string;
    invitation: any;
    assessment: any;
    novaIQ: NovaIQResult;
    compliance: ComplianceDetails;
    previousRiskScore: number;
    newRiskLevel: string;
    interventionId: string | null;
    gameData: GameCompletionData;
  }
): Promise<number> {
  const base = { player_id, casino_id };
  const sev = (level: string) =>
    level === "critical" ? "critical" : level === "high" ? "high" : "medium";
  let eventsWritten = 0;

  const events: Array<{
    action: string; resource_type: string; resource_id: string;
    payload: any; severity: string;
  }> = [
    {
      action:        "ASSESSMENT_COMPLETED",
      resource_type: "wellbeing_assessment",
      resource_id:   assessment.id,
      payload: {
        assessment_id:        assessment.id,
        assessment_number:    assessment.assessment_number,
        game_concept:         invitation.game_concept?.name,
        behaviour_risk_index: gameData.behaviour_risk_index,
        hesitation_score:     gameData.hesitation_score,
        consistency_score:    gameData.consistency_score,
        duration_seconds:     gameData.duration_seconds,
        invitation_id:        invitation.id,
      },
      severity: sev(novaIQ.risk_level),
    },
    {
      action:        "NOVA_IQ_ANALYSIS_COMPLETE",
      resource_type: "wellbeing_assessment",
      resource_id:   assessment.id,
      payload: {
        nova_iq_risk_score:         novaIQ.risk_score,
        nova_iq_risk_level:         novaIQ.risk_level,
        nova_iq_confidence:         novaIQ.confidence,
        nova_iq_recommended_action: novaIQ.recommended_action,
        compliance_action:          compliance.label,
        compliance_priority:        compliance.priority,
        compliance_framework:       "NRGP",
        primary_drivers:            novaIQ.primary_drivers,
        protective_factors:         novaIQ.protective_factors,
        previous_risk_score:        previousRiskScore,
      },
      severity: sev(novaIQ.risk_level),
    },
    {
      action:        "PLAYER_RISK_PROFILE_UPDATED",
      resource_type: "player",
      resource_id:   player_id,
      payload: {
        previous_risk_score: previousRiskScore,
        new_risk_score:      novaIQ.risk_score,
        delta:               parseFloat((novaIQ.risk_score - previousRiskScore).toFixed(1)),
        new_risk_level:      newRiskLevel,
        source:              "nova_iq_assessment",
        assessment_id:       assessment.id,
        assessment_number:   assessment.assessment_number,
      },
      severity: "medium",
    },
  ];

  if (interventionId) {
    events.push({
      action:        "INTERVENTION_GENERATED",
      resource_type: "intervention",
      resource_id:   interventionId,
      payload: {
        intervention_id:    interventionId,
        trigger:            "nova_iq_assessment",
        recommended_action: novaIQ.recommended_action,
        compliance_action:  compliance.label,
        compliance_priority: compliance.priority,
        assessment_id:      assessment.id,
      },
      severity: novaIQ.risk_level === "critical" ? "critical" : "high",
    });
  }

  for (const ev of events) {
    try {
      await logAuditEvent(supabase, {
        ...base,
        ...ev,
        risk_before: previousRiskScore,
        risk_after:  novaIQ.risk_score,
      });
      eventsWritten++;
    } catch (err) {
      console.error("Audit event write failed:", ev.action, err);
    }
  }

  return eventsWritten;
}

// ─── SHA-256 Hash-Chained Audit Logger ───────────────────────────────────────

async function logAuditEvent(
  supabase: any,
  {
    action, player_id, casino_id, resource_type, resource_id,
    payload, severity = "low", risk_before, risk_after,
  }: {
    action: string; player_id: string; casino_id: string;
    resource_type: string; resource_id: string; payload: any;
    severity?: string; risk_before?: number; risk_after?: number;
  }
) {
  const { data: lastEntry } = await supabase
    .from("audit_logs")
    .select("entry_hash, chain_sequence")
    .order("chain_sequence", { ascending: false })
    .limit(1)
    .single();

  const prevHash = lastEntry?.entry_hash ?? "0".repeat(64);
  const chainSeq = (lastEntry?.chain_sequence ?? 0) + 1;

  const rawEntry = JSON.stringify({
    action, player_id, casino_id, resource_type, resource_id, payload,
    risk_before, risk_after, created_at: new Date().toISOString(), chain_sequence: chainSeq,
  });

  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(prevHash + rawEntry));
  const entryHash = Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, "0")).join("");

  const { error: insertErr } = await supabase.from("audit_logs").insert({
    action, player_id, casino_id, resource_type, resource_id,
    payload:          { ...payload, risk_before, risk_after },
    severity,
    log_type:         "compliance_action",
    entry_hash:       entryHash,
    previous_hash:    prevHash,
    chain_sequence:   chainSeq,
    environment:      "demo",
  });

  if (insertErr) {
    console.error("Audit log insert error:", insertErr.message, insertErr.code);
    throw insertErr;
  }

  return entryHash;
}

// ─── Compliance action map ────────────────────────────────────────────────────

function getComplianceDetails(action: string, score: number): ComplianceDetails {
  const map: Record<string, ComplianceDetails> = {
    no_action:                    { label: "No Action Required",             reason: "Nova IQ score below intervention threshold (NRGP Guideline §3.1)", priority: "routine" },
    monitor:                      { label: "Continued Monitoring",           reason: "Elevated indicators — continued observation required (NRGP §3.2)", priority: "routine" },
    responsible_gambling_contact:  { label: "Responsible Gambling Contact",  reason: "Score exceeds safe-play threshold; proactive outreach required (NRGP §4.1)", priority: "standard" },
    deposit_limit_recommendation:  { label: "Deposit Limit Recommendation",  reason: "Behavioral patterns indicate financial exposure risk; limit review advised (NRGP §4.3)", priority: "elevated" },
    mandatory_review:              { label: "Mandatory Compliance Review",    reason: "High composite risk score requires compliance officer review within 48 hours (NRGP §5.2)", priority: "urgent" },
    self_exclusion_recommendation: { label: "Self-Exclusion Recommendation", reason: "Critical risk level — self-exclusion referral required per NRGP §6.1 and NGB Directive 12/2024", priority: "critical" },
  };
  return map[action] ?? { label: action, reason: `Risk score: ${score.toFixed(0)}`, priority: "routine" };
}

// ─── Intervention message builder ─────────────────────────────────────────────

function buildInterventionMessage(
  player: any, novaIQ: NovaIQResult, data: GameCompletionData,
  compliance: ComplianceDetails,
): string {
  const riskEmoji = { low: "🟢", medium: "🟡", high: "🟠", critical: "🔴" }[novaIQ.risk_level] ?? "⚠️";
  return `SafeBet IQ – Nova IQ Assessment Alert ${riskEmoji}

Player: ${formatPlayerId(player.player_id ?? player.id)}
Risk Level: ${novaIQ.risk_level.toUpperCase()} (Score: ${novaIQ.risk_score.toFixed(0)}/100)
Recommended Action: ${compliance.label}
Priority: ${compliance.priority.toUpperCase()}
Confidence: ${novaIQ.confidence.toFixed(0)}%

Nova IQ Analysis:
${novaIQ.narrative}

Primary Risk Factors: ${novaIQ.primary_drivers.join(", ") || "None identified"}
Protective Factors: ${novaIQ.protective_factors.join(", ") || "None identified"}

Assessment Scores:
• Behavioral Risk Index: ${data.behaviour_risk_index.toFixed(0)}/100
• Hesitation Score: ${data.hesitation_score.toFixed(0)}/100
• Consistency Score: ${data.consistency_score.toFixed(0)}/100
• Duration: ${Math.round(data.duration_seconds / 60)} minutes

Compliance Basis: ${compliance.reason}

This alert was generated automatically by Nova IQ following assessment completion.
Please review in the SafeBet IQ Compliance Dashboard.

SafeBet IQ – Responsible Gambling Intelligence Platform`;
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const json = (body: any, status = 200) =>
    new Response(JSON.stringify(body), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  const tx: TransactionState = {
    assessment_id: null,
    invitation_status_changed: false,
    player_profile_updated: false,
    risk_score_inserted: false,
    intervention_id: null,
    audit_events_written: 0,
  };

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { secure_token, game_completion_data }: {
      secure_token: string;
      game_completion_data: GameCompletionData;
    } = await req.json();

    if (!secure_token || !game_completion_data) {
      return json({ error: "Missing secure_token or game_completion_data" }, 400);
    }

    // ── 1. Validate invitation ─────────────────────────────────────────────
    const invitation = await validateInvitation(supabase, secure_token);

    // ── 2. Load full player context ────────────────────────────────────────
    const {
      player, recentSessions, previousAssessments, interventionCount, activeExclusionCount,
    } = await loadPlayerContext(supabase, invitation.player_id, invitation.casino_id);

    const previousRiskScore = player.risk_score ?? 50;
    const previousNovaIQScore = previousAssessments[0]?.nova_iq_risk_score ?? null;

    // ── 3. Nova IQ calculation (data-driven) ───────────────────────────────
    const novaIQ = calculateNovaIQ(
      game_completion_data, player, recentSessions,
      previousAssessments, interventionCount, activeExclusionCount,
    );
    const compliance = getComplianceDetails(novaIQ.recommended_action, novaIQ.risk_score);

    // ── 4. Save assessment (immutable historical record) ───────────────────
    const assessment = await saveAssessment(
      supabase, invitation, game_completion_data, novaIQ, compliance,
      previousRiskScore, previousNovaIQScore,
    );
    tx.assessment_id = assessment.id;

    // ── 5. Mark invitation completed ───────────────────────────────────────
    await supabase.from("wellbeing_game_invitations")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", invitation.id);
    tx.invitation_status_changed = true;

    // ── 6. Update player profile ───────────────────────────────────────────
    const newRiskLevel = await updatePlayerProfile(
      supabase, invitation.player_id, player, novaIQ, assessment.id,
    );
    tx.player_profile_updated = true;

    // ── 7. Write risk score history ────────────────────────────────────────
    await writeRiskScoreHistory(
      supabase, invitation.player_id, invitation.casino_id,
      novaIQ, game_completion_data, assessment.id,
    );
    tx.risk_score_inserted = true;

    // ── 8. Generate intervention (if warranted) ────────────────────────────
    const interventionId = await generateIntervention(
      supabase, player, invitation, novaIQ, game_completion_data, compliance, assessment.id,
    );
    tx.intervention_id = interventionId;

    // ── 9. Write audit chain ───────────────────────────────────────────────
    tx.audit_events_written = await writeAuditChain(supabase, {
      player_id:       invitation.player_id,
      casino_id:       invitation.casino_id,
      invitation, assessment, novaIQ, compliance,
      previousRiskScore, newRiskLevel, interventionId,
      gameData:        game_completion_data,
    });

    // ── 10. Return confirmed result ────────────────────────────────────────
    const delta = novaIQ.risk_score - previousRiskScore;
    return json({
      success: true,
      assessment_id:           assessment.id,
      assessment_number:       assessment.assessment_number,
      behaviour_risk_index:    game_completion_data.behaviour_risk_index,
      hesitation_score:        game_completion_data.hesitation_score,
      consistency_score:       game_completion_data.consistency_score,
      duration_seconds:        game_completion_data.duration_seconds,
      nova_iq: {
        risk_score:            novaIQ.risk_score,
        risk_level:            novaIQ.risk_level,
        narrative:             novaIQ.narrative,
        primary_drivers:       novaIQ.primary_drivers,
        protective_factors:    novaIQ.protective_factors,
        confidence:            novaIQ.confidence,
        recommended_action:    novaIQ.recommended_action,
      },
      compliance: {
        action:                compliance.label,
        reason:                compliance.reason,
        priority:              compliance.priority,
        framework:             "NRGP",
      },
      previous_risk_score:     previousRiskScore,
      previous_nova_iq_score:  previousNovaIQScore,
      new_risk_score:          Math.round(novaIQ.risk_score),
      risk_delta:              parseFloat(delta.toFixed(1)),
      intervention_created:    !!interventionId,
      intervention_id:         interventionId,
      audit_events_written:    tx.audit_events_written,
      insights:                game_completion_data.insights,
      badges:                  game_completion_data.badges,
    });

  } catch (err: any) {
    // Structured error response — never a fake result
    const status = err?.status ?? 500;
    const message = err?.message ?? "Internal server error";
    console.error("process-wellbeing-completion error:", JSON.stringify({ status, message, tx }));
    return json({
      error: message,
      transaction_state: tx,
      rollback_note: tx.assessment_id
        ? `Assessment ${tx.assessment_id} was saved before failure — manual review may be required`
        : "No assessment record was created",
    }, status);
  }
});
