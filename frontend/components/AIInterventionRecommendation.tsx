'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Brain, MessageSquare, Clock, AlertTriangle, Shield, Eye, CheckCircle, XCircle, PauseCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface AIInterventionRecommendationProps {
  recommendationId: string;
  playerId: string;
  interventionType: 'soft_message' | 'cooling_off' | 'limit' | 'escalation' | 'monitor';
  recommendedTiming: 'immediate' | 'delayed' | 'scheduled' | 'monitor';
  successProbability: number;
  rationale: string;
  alternativeOptions?: any[];
  staffDecision?: 'accepted' | 'overridden' | 'deferred' | null;
  decisionRationale?: string;
  onDecisionMade?: (decision: string, rationale: string) => void;
  readOnly?: boolean;
  showAnonymized?: boolean;
}

export function AIInterventionRecommendation({
  recommendationId,
  playerId,
  interventionType,
  recommendedTiming,
  successProbability,
  rationale,
  alternativeOptions = [],
  staffDecision,
  decisionRationale,
  onDecisionMade,
  readOnly = false,
  showAnonymized = false,
}: AIInterventionRecommendationProps) {
  const [decision, setDecision] = useState<string | null>(staffDecision || null);
  const [overrideReason, setOverrideReason] = useState(decisionRationale || '');
  const [submitting, setSubmitting] = useState(false);
  const [showDecisionDialog, setShowDecisionDialog] = useState(false);
  const [selectedDecision, setSelectedDecision] = useState<string>('');

  const getInterventionIcon = (type: string) => {
    switch (type) {
      case 'soft_message': return <MessageSquare className="h-5 w-5" />;
      case 'cooling_off': return <Clock className="h-5 w-5" />;
      case 'limit': return <Shield className="h-5 w-5" />;
      case 'escalation': return <AlertTriangle className="h-5 w-5" />;
      case 'monitor': return <Eye className="h-5 w-5" />;
      default: return <Brain className="h-5 w-5" />;
    }
  };

  const getInterventionLabel = (type: string) => {
    switch (type) {
      case 'soft_message': return 'Soft Message';
      case 'cooling_off': return 'Cooling-Off Period';
      case 'limit': return 'Set Limits';
      case 'escalation': return 'Escalate to Senior Staff';
      case 'monitor': return 'Continue Monitoring';
      default: return type;
    }
  };

  const getTimingLabel = (timing: string) => {
    switch (timing) {
      case 'immediate': return 'Immediate Action Required';
      case 'delayed': return 'Action Within 24 Hours';
      case 'scheduled': return 'Schedule for Later';
      case 'monitor': return 'Monitor and Reassess';
      default: return timing;
    }
  };

  const getSuccessColor = (probability: number) => {
    if (probability >= 75) return 'text-green-600';
    if (probability >= 50) return 'text-yellow-600';
    return 'text-orange-600';
  };

  const getDecisionIcon = (decisionType: string | null) => {
    switch (decisionType) {
      case 'accepted': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'overridden': return <XCircle className="h-4 w-4 text-orange-600" />;
      case 'deferred': return <PauseCircle className="h-4 w-4 text-blue-600" />;
      default: return null;
    }
  };

  const handleDecisionClick = (decisionType: string) => {
    setSelectedDecision(decisionType);
    if (decisionType === 'accepted') {
      handleSubmitDecision(decisionType, 'AI recommendation accepted');
    } else {
      setShowDecisionDialog(true);
    }
  };

  const handleSubmitDecision = async (decisionType: string, reason: string) => {
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('ai_intervention_recommendations')
        .update({
          staff_decision: decisionType,
          decision_rationale: reason,
          decided_at: new Date().toISOString(),
        })
        .eq('id', recommendationId);

      if (error) throw error;

      setDecision(decisionType);
      setOverrideReason(reason);
      setShowDecisionDialog(false);
      toast.success('Decision recorded successfully');

      if (onDecisionMade) {
        onDecisionMade(decisionType, reason);
      }
    } catch (error) {
      console.error('Error recording decision:', error);
      toast.error('Failed to record decision');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="border-2 border-purple-200">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Brain className="h-5 w-5 text-purple-600" />
              AI-Guided Intervention Recommendation
            </CardTitle>
            <CardDescription>
              {showAnonymized ? 'Anonymized Player' : `Player ${playerId}`}
            </CardDescription>
          </div>
          {decision && (
            <Badge className={`${
              decision === 'accepted' ? 'bg-green-100 text-green-700' :
              decision === 'overridden' ? 'bg-orange-100 text-orange-700' :
              'bg-blue-100 text-blue-700'
            } border-0 flex items-center gap-1`}>
              {getDecisionIcon(decision)}
              {decision.toUpperCase()}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="p-4 bg-purple-50 border-2 border-purple-300 rounded-lg">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              {getInterventionIcon(interventionType)}
              <div>
                <div className="font-bold text-lg text-gray-900">{getInterventionLabel(interventionType)}</div>
                <div className="text-sm text-gray-600">{getTimingLabel(recommendedTiming)}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-600 mb-1">Success Probability</div>
              <div className={`text-2xl font-bold ${getSuccessColor(successProbability)}`}>
                {successProbability}%
              </div>
            </div>
          </div>

          <div className="p-3 bg-white rounded border border-purple-200">
            <div className="text-xs font-semibold text-purple-900 mb-1">AI Rationale</div>
            <p className="text-sm text-gray-700">{rationale}</p>
          </div>
        </div>

        {alternativeOptions && alternativeOptions.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-2">Alternative Options</h4>
            <div className="space-y-2">
              {alternativeOptions.map((option: any, index: number) => (
                <div key={index} className="p-3 bg-gray-50 rounded border border-gray-200">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-900">{option.type}</span>
                    <span className="text-sm text-gray-600">{option.probability}% success</span>
                  </div>
                  <p className="text-xs text-gray-600">{option.rationale}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {!readOnly && !decision && (
          <div className="flex gap-3 pt-4 border-t">
            <Button
              onClick={() => handleDecisionClick('accepted')}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Accept Recommendation
            </Button>
            <Button
              onClick={() => handleDecisionClick('overridden')}
              variant="outline"
              className="flex-1 border-orange-300 text-orange-700 hover:bg-orange-50"
            >
              <XCircle className="h-4 w-4 mr-2" />
              Override
            </Button>
            <Button
              onClick={() => handleDecisionClick('deferred')}
              variant="outline"
              className="flex-1 border-blue-300 text-blue-700 hover:bg-blue-50"
            >
              <PauseCircle className="h-4 w-4 mr-2" />
              Defer
            </Button>
          </div>
        )}

        {decision && decisionRationale && (
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <div className="text-xs font-semibold text-gray-900 mb-2 flex items-center gap-2">
              {getDecisionIcon(decision)}
              Staff Decision Rationale
            </div>
            <p className="text-sm text-gray-700">{decisionRationale}</p>
          </div>
        )}

        <Dialog open={showDecisionDialog} onOpenChange={setShowDecisionDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {selectedDecision === 'overridden' ? 'Override AI Recommendation' : 'Defer Decision'}
              </DialogTitle>
              <DialogDescription>
                Please provide a rationale for your decision. This will be logged for compliance and audit purposes.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Textarea
                placeholder="Enter your rationale..."
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                rows={4}
              />
              <div className="flex gap-3">
                <Button
                  onClick={() => handleSubmitDecision(selectedDecision, overrideReason)}
                  disabled={!overrideReason.trim() || submitting}
                  className="flex-1"
                >
                  Submit Decision
                </Button>
                <Button
                  onClick={() => setShowDecisionDialog(false)}
                  variant="outline"
                  disabled={submitting}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <div className="pt-4 border-t bg-gray-50 -mx-6 -mb-6 px-6 py-3 rounded-b-lg">
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <Brain className="h-3 w-3" />
            <span>
              AI recommends, you decide. All decisions are logged for compliance and outcome learning.
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
