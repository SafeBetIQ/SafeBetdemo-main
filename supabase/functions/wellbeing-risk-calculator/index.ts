import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface TelemetryEvent {
  event_type: string;
  decision_speed_ms: number;
  risk_level_chosen: string;
  event_data: Record<string, any>;
}

interface RiskScoreResult {
  behaviour_risk_index: number;
  impulsivity_score: number;
  risk_escalation_score: number;
  patience_score: number;
  recovery_response_score: number;
  explanation: {
    factors: string[];
    confidence: number;
    recommendations: string[];
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { session_id } = await req.json();

    if (!session_id) {
      return new Response(
        JSON.stringify({ error: "session_id is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: session, error: sessionError } = await supabase
      .from("wellbeing_game_sessions")
      .select("*, player_id, casino_id, game_concept_id")
      .eq("id", session_id)
      .single();

    if (sessionError || !session) {
      return new Response(
        JSON.stringify({ error: "Session not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: telemetry, error: telemetryError } = await supabase
      .from("wellbeing_game_telemetry")
      .select("*")
      .eq("session_id", session_id)
      .order("event_sequence", { ascending: true });

    if (telemetryError || !telemetry || telemetry.length === 0) {
      return new Response(
        JSON.stringify({ error: "No telemetry data found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const riskScore = calculateRiskScore(telemetry);

    const { error: insertError } = await supabase
      .from("wellbeing_risk_scores")
      .insert({
        player_id: session.player_id,
        casino_id: session.casino_id,
        session_id: session_id,
        behaviour_risk_index: riskScore.behaviour_risk_index,
        impulsivity_score: riskScore.impulsivity_score,
        risk_escalation_score: riskScore.risk_escalation_score,
        patience_score: riskScore.patience_score,
        recovery_response_score: riskScore.recovery_response_score,
        explanation: riskScore.explanation,
      });

    if (insertError) {
      console.error("Error inserting risk score:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to save risk score" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { error: updateError } = await supabase
      .from("wellbeing_game_sessions")
      .update({ behaviour_risk_index: riskScore.behaviour_risk_index })
      .eq("id", session_id);

    if (updateError) {
      console.error("Error updating session:", updateError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        risk_score: riskScore,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in wellbeing-risk-calculator:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

function calculateRiskScore(telemetry: TelemetryEvent[]): RiskScoreResult {
  let impulsivityScore = 0;
  let riskEscalationScore = 0;
  let patienceScore = 100;
  let recoveryResponseScore = 100;

  const decisionSpeeds: number[] = [];
  const riskLevels: string[] = [];
  const pauseActions = telemetry.filter(e => e.event_type === 'pause_action').length;
  const resetActions = telemetry.filter(e => e.event_type === 'reset_triggered').length;
  const totalDecisions = telemetry.filter(e => e.event_type === 'decision_made').length;

  const objectsCollected = telemetry.filter(e => e.event_type === 'object_collected');
  const trapCollisions = telemetry.filter(e => e.event_type === 'trap_collision');
  const hazardCollisions = telemetry.filter(e => e.event_type === 'hazard_collision');
  const riskyCollections = objectsCollected.filter(e => (e.event_data?.nearbyTraps > 0 || e.event_data?.nearbyHazards > 0)).length;

  telemetry.forEach((event, index) => {
    if (event.decision_speed_ms) {
      decisionSpeeds.push(event.decision_speed_ms);
    }

    if (event.risk_level_chosen && event.risk_level_chosen !== 'none') {
      riskLevels.push(event.risk_level_chosen);
    }

    if (event.event_type === 'decision_made') {
      if (event.decision_speed_ms < 2000) {
        impulsivityScore += 10;
      } else if (event.decision_speed_ms > 5000) {
        patienceScore = Math.min(100, patienceScore + 5);
      }
    }

    if (event.event_type === 'object_collected') {
      if (event.event_data?.reactionTime < 500) {
        impulsivityScore += 5;
      }

      if ((event.event_data?.nearbyTraps > 0) || (event.event_data?.nearbyHazards > 0)) {
        riskEscalationScore += 8;
      }

      if (event.event_data?.combo > 5) {
        patienceScore = Math.min(100, patienceScore + 3);
      }

      const difficultyLevel = event.event_data?.difficultyLevel || 1;
      if (difficultyLevel > 1.5 && event.event_data?.reactionTime < 600) {
        impulsivityScore += 8;
      }
    }

    if (event.event_type === 'trap_collision' || event.event_type === 'hazard_collision') {
      const nextEvent = telemetry[index + 1];
      if (nextEvent && nextEvent.event_type === 'object_collected') {
        const timeDiff = nextEvent.event_data?.reactionTime || 0;
        if (timeDiff < 800) {
          recoveryResponseScore -= 10;
        } else {
          recoveryResponseScore = Math.min(100, recoveryResponseScore + 5);
        }
      }
    }

    if (event.event_type === 'setback_occurred') {
      const nextEvent = telemetry[index + 1];
      if (nextEvent && nextEvent.event_type === 'decision_made') {
        if (nextEvent.decision_speed_ms < 2000) {
          recoveryResponseScore -= 15;
        } else {
          recoveryResponseScore = Math.min(100, recoveryResponseScore + 5);
        }
      }
    }
  });

  let consecutiveHighRisk = 0;
  let maxConsecutiveHighRisk = 0;

  riskLevels.forEach(level => {
    if (level === 'high') {
      consecutiveHighRisk++;
      maxConsecutiveHighRisk = Math.max(maxConsecutiveHighRisk, consecutiveHighRisk);
    } else {
      consecutiveHighRisk = 0;
    }
  });

  riskEscalationScore = Math.min(100, maxConsecutiveHighRisk * 20);

  const avgDecisionSpeed = decisionSpeeds.length > 0
    ? decisionSpeeds.reduce((a, b) => a + b, 0) / decisionSpeeds.length
    : 3000;

  if (avgDecisionSpeed < 2000) {
    impulsivityScore += 20;
  } else if (avgDecisionSpeed > 6000) {
    patienceScore = Math.min(100, patienceScore + 10);
  }

  const highRiskCount = riskLevels.filter(r => r === 'high').length;
  const highRiskRatio = totalDecisions > 0 ? highRiskCount / totalDecisions : 0;

  riskEscalationScore += Math.min(30, highRiskRatio * 100);

  const totalCollections = objectsCollected.length;
  if (totalCollections > 0) {
    const riskyCollectionRatio = riskyCollections / totalCollections;
    riskEscalationScore += Math.min(25, riskyCollectionRatio * 100);

    if (riskyCollectionRatio > 0.5) {
      impulsivityScore += 15;
    }
  }

  const totalCollisionEvents = trapCollisions.length + hazardCollisions.length;
  if (totalCollisionEvents > 5) {
    recoveryResponseScore -= 10;
  }

  const avgDifficultyLevel = objectsCollected.length > 0
    ? objectsCollected.reduce((sum, e) => sum + (e.event_data?.difficultyLevel || 1), 0) / objectsCollected.length
    : 1;

  if (avgDifficultyLevel > 1.5 && riskEscalationScore > 50) {
    riskEscalationScore += 10;
  }

  if (pauseActions > 0) {
    patienceScore = Math.min(100, patienceScore + (pauseActions * 10));
    impulsivityScore = Math.max(0, impulsivityScore - (pauseActions * 5));
  }

  if (resetActions > 0) {
    recoveryResponseScore = Math.min(100, recoveryResponseScore + (resetActions * 15));
  }

  impulsivityScore = Math.min(100, Math.max(0, impulsivityScore));
  riskEscalationScore = Math.min(100, Math.max(0, riskEscalationScore));
  patienceScore = Math.min(100, Math.max(0, patienceScore));
  recoveryResponseScore = Math.min(100, Math.max(0, recoveryResponseScore));

  const behaviourRiskIndex = (
    (impulsivityScore * 0.3) +
    (riskEscalationScore * 0.35) +
    ((100 - patienceScore) * 0.2) +
    ((100 - recoveryResponseScore) * 0.15)
  );

  const factors: string[] = [];
  const recommendations: string[] = [];

  if (impulsivityScore > 60) {
    factors.push("High impulsivity detected in decision-making");
    recommendations.push("Consider taking more time before making decisions");
  }

  if (riskEscalationScore > 60) {
    factors.push("Pattern of escalating risk-taking observed");
    recommendations.push("Be aware of the tendency to increase risk over time");
  }

  if (patienceScore < 40) {
    factors.push("Limited patience shown during gameplay");
    recommendations.push("Practice waiting and evaluating options carefully");
  }

  if (recoveryResponseScore < 40) {
    factors.push("Reactive responses to setbacks observed");
    recommendations.push("Take breaks after unexpected events");
  }

  if (pauseActions > 2) {
    factors.push("Good use of pause function demonstrates self-awareness");
  }

  if (totalCollections > 0 && riskyCollections / totalCollections > 0.6) {
    factors.push("High-risk collection pattern detected");
    recommendations.push("Consider more cautious decision-making");
  }

  if (totalCollisionEvents > 5) {
    factors.push("Multiple collision events observed");
    recommendations.push("Take time to assess risks before acting");
  }

  if (avgDifficultyLevel > 1.5) {
    factors.push("Strong performance maintained as challenge increased");
  }

  if (factors.length === 0) {
    factors.push("Balanced gameplay patterns observed");
    recommendations.push("Continue maintaining balanced play habits");
  }

  const confidence = Math.min(100, (telemetry.length / 10) * 100);

  return {
    behaviour_risk_index: Math.round(behaviourRiskIndex * 100) / 100,
    impulsivity_score: Math.round(impulsivityScore * 100) / 100,
    risk_escalation_score: Math.round(riskEscalationScore * 100) / 100,
    patience_score: Math.round(patienceScore * 100) / 100,
    recovery_response_score: Math.round(recoveryResponseScore * 100) / 100,
    explanation: {
      factors,
      confidence: Math.round(confidence * 100) / 100,
      recommendations,
    },
  };
}
